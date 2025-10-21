/**
 * AI Routes
 *
 * Endpoints:
 * - POST /api/v1/ai/classify/:messageId - Manually trigger classification
 * - POST /api/v1/ai/generate-draft/:messageId - Generate AI draft
 * - POST /api/v1/ai/drafts/:draftId/accept - Agent accepts draft
 * - POST /api/v1/ai/drafts/:draftId/reject - Agent rejects draft
 * - GET /api/v1/ai/performance - AI performance metrics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { AIOrchestrator } from '../services/ai-orchestrator';
import { AIDraftStatus } from '../types/ai';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const generateDraftParamsSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'empathetic', 'urgent']).optional(),
  max_length: z.number().min(50).max(500).optional(),
  include_greeting: z.boolean().optional(),
  include_signature: z.boolean().optional(),
  language: z.enum(['fi', 'en', 'sv', 'de', 'fr', 'es']).optional(),
});

const draftActionSchema = z.object({
  edited_content: z.string().optional(), // If agent edited the draft
});

const performanceFiltersSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  team_id: z.number().optional(),
  agent_id: z.number().optional(),
});

// ============================================================================
// DATABASE IMPLEMENTATION
// ============================================================================

/**
 * Database implementation for AIOrchestrator
 * Implements the Database interface required by AIOrchestrator
 */
class DatabaseService {
  async getMessage(messageId: number) {
    const result = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Message ${messageId} not found`);
    }
    return result.rows[0];
  }

  async getConversation(conversationId: number) {
    const result = await pool.query(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return result.rows[0];
  }

  async getContact(contactId: number) {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [contactId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Contact ${contactId} not found`);
    }
    return result.rows[0];
  }

  async getTeamsAvailability(accountId: number) {
    const result = await pool.query(
      `SELECT
         t.id,
         t.name,
         COUNT(au.id) FILTER (WHERE au.availability = 'online')::int as online_agents,
         CASE
           WHEN COUNT(au.id) = 0 THEN 0
           ELSE ROUND((SUM(au.current_load)::float / SUM(au.max_capacity)::float) * 100)::int
         END as utilization
       FROM teams t
       LEFT JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN account_users au ON tm.account_user_id = au.id
       WHERE t.account_id = $1
       GROUP BY t.id, t.name`,
      [accountId]
    );
    return result.rows;
  }

  async saveAIClassification(classification: any) {
    const result = await pool.query(
      `INSERT INTO ai_classifications (
         message_id, conversation_id, category, priority, sentiment, language,
         confidence, reasoning, suggested_team_id, suggested_agent_id, raw_response, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        classification.message_id,
        classification.conversation_id,
        classification.category,
        classification.priority,
        classification.sentiment,
        classification.language,
        classification.confidence,
        classification.reasoning,
        classification.suggested_team_id,
        classification.suggested_agent_id,
        JSON.stringify(classification.raw_response || {}),
      ]
    );
    return result.rows[0];
  }

  async saveAIDraft(draft: any) {
    const result = await pool.query(
      `INSERT INTO ai_drafts (
         conversation_id, message_id, draft_content, confidence, reasoning,
         status, raw_response, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        draft.conversation_id,
        draft.message_id,
        draft.draft_content,
        draft.confidence,
        draft.reasoning,
        draft.status,
        JSON.stringify(draft.raw_response || {}),
      ]
    );
    return result.rows[0];
  }

  async getLatestClassification(conversationId: number) {
    const result = await pool.query(
      `SELECT * FROM ai_classifications
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversationId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getConversationMessages(conversationId: number, limit: number = 10) {
    const result = await pool.query(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );
    return result.rows.reverse(); // Return in chronological order
  }

  async updateConversation(conversationId: number, updates: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${index++}`);
      values.push(value);
    });

    fields.push('updated_at = NOW()');
    values.push(conversationId);

    const result = await pool.query(
      `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
      values
    );

    return result.rows[0];
  }
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function aiRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  // Initialize AI Orchestrator
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });
  const db = new DatabaseService();
  const aiOrchestrator = new AIOrchestrator(anthropic, db, fastify.io);

  /**
   * POST /api/v1/ai/classify/:messageId
   * Manually trigger AI classification for a message
   */
  fastify.post(
    '/classify/:messageId',
    async (request: FastifyRequest<{ Params: { messageId: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const messageId = parseInt(request.params.messageId);

        // Verify message belongs to account
        const messageCheck = await pool.query(
          'SELECT id FROM messages WHERE id = $1 AND account_id = $2',
          [messageId, accountId]
        );

        if (messageCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Message not found',
          });
        }

        // Trigger classification
        const classification = await aiOrchestrator.classifyMessage(messageId);

        return reply.send({
          classification,
          auto_assigned: !!classification.suggested_agent_id && classification.confidence > 0.85,
        });

      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'AI classification failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/v1/ai/generate-draft/:messageId
   * Generate AI draft response for a message
   */
  fastify.post(
    '/generate-draft/:messageId',
    async (request: FastifyRequest<{ Params: { messageId: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const messageId = parseInt(request.params.messageId);
        const params = generateDraftParamsSchema.parse(request.body || {});

        // Verify message belongs to account
        const messageCheck = await pool.query(
          'SELECT id FROM messages WHERE id = $1 AND account_id = $2',
          [messageId, accountId]
        );

        if (messageCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Message not found',
          });
        }

        // Generate draft
        const draft = await aiOrchestrator.generateDraft(messageId);

        return reply.send({
          draft,
        });

      } catch (error) {
        fastify.log.error(error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Invalid request body',
            details: error.errors,
          });
        }

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'AI draft generation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/v1/ai/drafts/:draftId/accept
   * Agent accepts AI draft (creates message from draft)
   */
  fastify.post(
    '/drafts/:draftId/accept',
    async (request: FastifyRequest<{ Params: { draftId: string } }>, reply: FastifyReply) => {
      const client = await pool.connect();

      try {
        const accountId = parseInt(request.accountId!);
        const userId = parseInt(request.user!.userId);
        const draftId = parseInt(request.params.draftId);
        const body = draftActionSchema.parse(request.body || {});

        await client.query('BEGIN');

        // Get draft
        const draftResult = await client.query(
          `SELECT ad.*, c.account_id
           FROM ai_drafts ad
           JOIN conversations c ON ad.conversation_id = c.id
           WHERE ad.id = $1`,
          [draftId]
        );

        if (draftResult.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Draft not found',
          });
        }

        const draft = draftResult.rows[0];

        // Verify draft belongs to account
        if (draft.account_id !== accountId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Access denied',
          });
        }

        // Get account_user_id
        const accountUserResult = await client.query(
          'SELECT id FROM account_users WHERE user_id = $1 AND account_id = $2',
          [userId, accountId]
        );

        if (accountUserResult.rows.length === 0) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'User not authorized for this account',
          });
        }

        const accountUserId = accountUserResult.rows[0].id;

        // Determine final content (edited or original)
        const finalContent = body.edited_content || draft.draft_content;
        const status = body.edited_content ? AIDraftStatus.EDITED : AIDraftStatus.ACCEPTED;

        // Update draft status
        await client.query(
          `UPDATE ai_drafts
           SET status = $1,
               used_by_agent_id = $2,
               original_content = $3,
               reviewed_at = NOW()
           WHERE id = $4`,
          [
            status,
            accountUserId,
            body.edited_content ? draft.draft_content : null,
            draftId,
          ]
        );

        // Create message from draft
        const messageResult = await client.query(
          `INSERT INTO messages (
             conversation_id, account_id, sender_type, sender_id,
             content, content_type, content_attributes, message_type,
             ai_draft_id, is_read, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          [
            draft.conversation_id,
            accountId,
            'User',
            accountUserId,
            finalContent,
            'text',
            JSON.stringify({}),
            'outgoing',
            draftId,
            false,
          ]
        );

        const message = messageResult.rows[0];

        // Update conversation
        await client.query(
          `UPDATE conversations
           SET updated_at = NOW(),
               first_reply_at = COALESCE(first_reply_at, NOW())
           WHERE id = $1`,
          [draft.conversation_id]
        );

        await client.query('COMMIT');

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('message:created', {
          type: 'message:created',
          data: message,
        });

        return reply.send({
          message,
          draft_status: status,
        });

      } catch (error) {
        await client.query('ROLLBACK');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Invalid request body',
            details: error.errors,
          });
        }

        fastify.log.error(error);
        throw error;
      } finally {
        client.release();
      }
    }
  );

  /**
   * POST /api/v1/ai/drafts/:draftId/reject
   * Agent rejects AI draft
   */
  fastify.post(
    '/drafts/:draftId/reject',
    async (request: FastifyRequest<{ Params: { draftId: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const userId = parseInt(request.user!.userId);
        const draftId = parseInt(request.params.draftId);

        // Get draft and verify ownership
        const draftResult = await pool.query(
          `SELECT ad.*, c.account_id
           FROM ai_drafts ad
           JOIN conversations c ON ad.conversation_id = c.id
           WHERE ad.id = $1`,
          [draftId]
        );

        if (draftResult.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Draft not found',
          });
        }

        const draft = draftResult.rows[0];

        if (draft.account_id !== accountId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Access denied',
          });
        }

        // Get account_user_id
        const accountUserResult = await pool.query(
          'SELECT id FROM account_users WHERE user_id = $1 AND account_id = $2',
          [userId, accountId]
        );

        const accountUserId = accountUserResult.rows[0]?.id;

        // Update draft status
        await pool.query(
          `UPDATE ai_drafts
           SET status = $1,
               used_by_agent_id = $2,
               reviewed_at = NOW()
           WHERE id = $3`,
          [AIDraftStatus.REJECTED, accountUserId, draftId]
        );

        return reply.send({
          message: 'Draft rejected successfully',
          draft_id: draftId,
        });

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/ai/performance
   * Get AI performance metrics
   */
  fastify.get('/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const filters = performanceFiltersSchema.parse(request.query);

      // Build WHERE clause
      const conditions: string[] = ['c.account_id = $1'];
      const params: any[] = [accountId];
      let paramIndex = 2;

      if (filters.start_date) {
        conditions.push(`ad.created_at >= $${paramIndex++}`);
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push(`ad.created_at <= $${paramIndex++}`);
        params.push(filters.end_date);
      }

      if (filters.team_id) {
        conditions.push(`c.team_id = $${paramIndex++}`);
        params.push(filters.team_id);
      }

      if (filters.agent_id) {
        conditions.push(`c.assignee_id = $${paramIndex++}`);
        params.push(filters.agent_id);
      }

      const whereClause = conditions.join(' AND ');

      // Calculate metrics
      const result = await pool.query(
        `SELECT
           -- Draft metrics
           COUNT(ad.id)::int as total_drafts,
           COUNT(*) FILTER (WHERE ad.status = 'accepted')::int as accepted_drafts,
           COUNT(*) FILTER (WHERE ad.status = 'rejected')::int as rejected_drafts,
           COUNT(*) FILTER (WHERE ad.status = 'edited')::int as edited_drafts,
           COALESCE(AVG(ad.confidence), 0)::float as avg_confidence,

           -- Classification metrics
           COUNT(ac.id)::int as total_classifications,
           COALESCE(AVG(ac.confidence), 0)::float as avg_classification_confidence,

           -- Calculated rates
           CASE
             WHEN COUNT(ad.id) > 0 THEN
               ROUND((COUNT(*) FILTER (WHERE ad.status = 'accepted')::float / COUNT(ad.id)::float) * 100, 2)
             ELSE 0
           END as draft_acceptance_rate,

           CASE
             WHEN COUNT(ad.id) > 0 THEN
               ROUND((COUNT(*) FILTER (WHERE ad.status = 'edited')::float / COUNT(ad.id)::float) * 100, 2)
             ELSE 0
           END as draft_edit_rate

         FROM conversations c
         LEFT JOIN ai_drafts ad ON c.id = ad.conversation_id
         LEFT JOIN ai_classifications ac ON c.id = ac.conversation_id
         WHERE ${whereClause}`,
        params
      );

      const metrics = result.rows[0];

      // Estimate time saved (2 minutes per accepted draft)
      const timeSavedMinutes = metrics.accepted_drafts * 2;

      // Estimate cost savings (40€/hour agent time, 2 min saved per draft)
      const costSavingsEur = (timeSavedMinutes / 60) * 40;

      return reply.send({
        period: {
          start: filters.start_date || 'all_time',
          end: filters.end_date || 'now',
        },
        classification_accuracy: 0, // TODO: Implement feedback-based accuracy
        draft_acceptance_rate: metrics.draft_acceptance_rate,
        draft_edit_rate: metrics.draft_edit_rate,
        avg_confidence: metrics.avg_confidence,
        auto_assignment_success_rate: 0, // TODO: Track assignment success
        time_saved_minutes: timeSavedMinutes,
        cost_savings_eur: Math.round(costSavingsEur * 100) / 100,
        stats: {
          total_drafts: metrics.total_drafts,
          accepted_drafts: metrics.accepted_drafts,
          rejected_drafts: metrics.rejected_drafts,
          edited_drafts: metrics.edited_drafts,
          total_classifications: metrics.total_classifications,
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      throw error;
    }
  });
}
