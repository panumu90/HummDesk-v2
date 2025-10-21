/**
 * Conversations Routes
 *
 * Endpoints:
 * - GET /api/v1/conversations - List conversations (with filters, pagination)
 * - POST /api/v1/conversations - Create conversation
 * - GET /api/v1/conversations/:id - Get conversation detail
 * - PATCH /api/v1/conversations/:id - Update status, assignee, team
 * - DELETE /api/v1/conversations/:id - Close conversation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { ConversationStatus, ConversationPriority } from '../types/conversation';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createConversationSchema = z.object({
  inbox_id: z.number(),
  contact_id: z.number(),
  subject: z.string().max(200).optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateConversationSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'snoozed']).optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  team_id: z.number().optional(),
  assignee_id: z.number().optional(),
  subject: z.string().max(200).optional(),
  snoozed_until: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const conversationFiltersSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'snoozed']).optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  team_id: z.number().optional(),
  assignee_id: z.number().optional(),
  inbox_id: z.number().optional(),
  contact_id: z.number().optional(),
  ai_category: z.string().optional(),
  sentiment: z.string().optional(),
  has_unread: z.boolean().optional(),
  query: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(25),
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function conversationsRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  /**
   * GET /api/v1/conversations
   * List conversations with filters and pagination
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const filters = conversationFiltersSchema.parse(request.query);

      // Build dynamic WHERE clause
      const conditions: string[] = ['c.account_id = $1'];
      const params: any[] = [accountId];
      let paramIndex = 2;

      if (filters.status) {
        conditions.push(`c.status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.priority) {
        conditions.push(`c.priority = $${paramIndex++}`);
        params.push(filters.priority);
      }

      if (filters.team_id) {
        conditions.push(`c.team_id = $${paramIndex++}`);
        params.push(filters.team_id);
      }

      if (filters.assignee_id) {
        conditions.push(`c.assignee_id = $${paramIndex++}`);
        params.push(filters.assignee_id);
      }

      if (filters.inbox_id) {
        conditions.push(`c.inbox_id = $${paramIndex++}`);
        params.push(filters.inbox_id);
      }

      if (filters.contact_id) {
        conditions.push(`c.contact_id = $${paramIndex++}`);
        params.push(filters.contact_id);
      }

      if (filters.ai_category) {
        conditions.push(`c.ai_category = $${paramIndex++}`);
        params.push(filters.ai_category);
      }

      if (filters.sentiment) {
        conditions.push(`c.sentiment = $${paramIndex++}`);
        params.push(filters.sentiment);
      }

      if (filters.has_unread !== undefined) {
        conditions.push(
          filters.has_unread
            ? `EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_type = 'Contact')`
            : `NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_type = 'Contact')`
        );
      }

      if (filters.query) {
        conditions.push(`(c.subject ILIKE $${paramIndex} OR ct.name ILIKE $${paramIndex} OR ct.email ILIKE $${paramIndex})`);
        params.push(`%${filters.query}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Count total
      const countResult = await pool.query(
        `SELECT COUNT(*)::int as total
         FROM conversations c
         LEFT JOIN contacts ct ON c.contact_id = ct.id
         WHERE ${whereClause}`,
        params
      );

      const total = countResult.rows[0].total;

      // Calculate pagination
      const offset = (filters.page - 1) * filters.limit;
      params.push(filters.limit, offset);

      // Fetch conversations with related data
      const result = await pool.query(
        `SELECT
           c.id, c.account_id, c.status, c.priority, c.ai_category, c.ai_confidence,
           c.sentiment, c.subject, c.metadata, c.created_at, c.updated_at,
           c.first_reply_at, c.resolved_at, c.snoozed_until,

           -- Contact
           json_build_object(
             'id', ct.id,
             'name', ct.name,
             'email', ct.email,
             'phone', ct.phone,
             'avatar_url', ct.avatar_url,
             'custom_attributes', ct.custom_attributes
           ) as contact,

           -- Inbox
           json_build_object(
             'id', i.id,
             'name', i.name,
             'channel_type', i.channel_type
           ) as inbox,

           -- Team
           json_build_object(
             'id', t.id,
             'name', t.name,
             'settings', t.settings
           ) as team,

           -- Assignee
           json_build_object(
             'id', u.id,
             'name', u.name,
             'email', u.email,
             'avatar_url', u.avatar_url
           ) as assignee,

           -- Message count
           (SELECT COUNT(*)::int FROM messages WHERE conversation_id = c.id) as message_count,

           -- Unread count
           (SELECT COUNT(*)::int FROM messages WHERE conversation_id = c.id AND is_read = false AND sender_type = 'Contact') as unread_count,

           -- Last message
           (SELECT json_build_object(
             'content', content,
             'created_at', created_at,
             'sender_type', sender_type
           ) FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message

         FROM conversations c
         LEFT JOIN contacts ct ON c.contact_id = ct.id
         LEFT JOIN inboxes i ON c.inbox_id = i.id
         LEFT JOIN teams t ON c.team_id = t.id
         LEFT JOIN users u ON c.assignee_id = u.id
         LEFT JOIN account_users au ON au.user_id = u.id AND au.account_id = c.account_id
         WHERE ${whereClause}
         ORDER BY c.updated_at DESC
         LIMIT $${paramIndex - 1} OFFSET $${paramIndex}`,
        params
      );

      return reply.send({
        data: result.rows,
        meta: {
          total,
          page: filters.page,
          limit: filters.limit,
          total_pages: Math.ceil(total / filters.limit),
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

  /**
   * POST /api/v1/conversations
   * Create new conversation
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const body = createConversationSchema.parse(request.body);

      // Verify inbox belongs to account
      const inboxCheck = await pool.query(
        'SELECT id FROM inboxes WHERE id = $1 AND account_id = $2',
        [body.inbox_id, accountId]
      );

      if (inboxCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Inbox not found or access denied',
        });
      }

      // Verify contact belongs to account
      const contactCheck = await pool.query(
        'SELECT id FROM contacts WHERE id = $1 AND account_id = $2',
        [body.contact_id, accountId]
      );

      if (contactCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Contact not found or access denied',
        });
      }

      // Create conversation
      const result = await pool.query(
        `INSERT INTO conversations (
           account_id, inbox_id, contact_id, status, priority, subject, metadata, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          accountId,
          body.inbox_id,
          body.contact_id,
          ConversationStatus.OPEN,
          body.priority || ConversationPriority.NORMAL,
          body.subject,
          JSON.stringify(body.metadata || {}),
        ]
      );

      const conversation = result.rows[0];

      // Broadcast to WebSocket
      fastify.io.to(`account:${accountId}`).emit('conversation:created', {
        type: 'conversation:created',
        data: conversation,
      });

      return reply.status(201).send(conversation);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * GET /api/v1/conversations/:id
   * Get conversation detail with messages
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const conversationId = parseInt(request.params.id);

      // Fetch conversation with related data
      const result = await pool.query(
        `SELECT
           c.*,

           json_build_object(
             'id', ct.id,
             'name', ct.name,
             'email', ct.email,
             'phone', ct.phone,
             'avatar_url', ct.avatar_url,
             'custom_attributes', ct.custom_attributes
           ) as contact,

           json_build_object(
             'id', i.id,
             'name', i.name,
             'channel_type', i.channel_type
           ) as inbox,

           json_build_object(
             'id', t.id,
             'name', t.name,
             'settings', t.settings
           ) as team,

           json_build_object(
             'id', u.id,
             'name', u.name,
             'email', u.email,
             'avatar_url', u.avatar_url
           ) as assignee

         FROM conversations c
         LEFT JOIN contacts ct ON c.contact_id = ct.id
         LEFT JOIN inboxes i ON c.inbox_id = i.id
         LEFT JOIN teams t ON c.team_id = t.id
         LEFT JOIN users u ON c.assignee_id = u.id
         LEFT JOIN account_users au ON au.user_id = u.id AND au.account_id = c.account_id
         WHERE c.id = $1 AND c.account_id = $2`,
        [conversationId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }

      return reply.send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * PATCH /api/v1/conversations/:id
   * Update conversation (status, assignee, team, etc.)
   */
  fastify.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const conversationId = parseInt(request.params.id);
      const body = updateConversationSchema.parse(request.body);

      // Verify conversation belongs to account
      const conversationCheck = await pool.query(
        'SELECT id FROM conversations WHERE id = $1 AND account_id = $2',
        [conversationId, accountId]
      );

      if (conversationCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }

      // Build dynamic UPDATE clause
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (body.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(body.status);

        // Set resolved_at if status is resolved
        if (body.status === ConversationStatus.RESOLVED) {
          updates.push(`resolved_at = NOW()`);
        }
      }

      if (body.priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        params.push(body.priority);
      }

      if (body.team_id !== undefined) {
        updates.push(`team_id = $${paramIndex++}`);
        params.push(body.team_id);
      }

      if (body.assignee_id !== undefined) {
        updates.push(`assignee_id = $${paramIndex++}`);
        params.push(body.assignee_id);
      }

      if (body.subject !== undefined) {
        updates.push(`subject = $${paramIndex++}`);
        params.push(body.subject);
      }

      if (body.snoozed_until !== undefined) {
        updates.push(`snoozed_until = $${paramIndex++}`);
        params.push(body.snoozed_until);
      }

      if (body.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(body.metadata));
      }

      updates.push('updated_at = NOW()');

      if (updates.length === 1) { // Only updated_at
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No fields to update',
        });
      }

      params.push(conversationId, accountId);

      // Execute update
      const result = await pool.query(
        `UPDATE conversations
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND account_id = $${paramIndex++}
         RETURNING *`,
        params
      );

      const updated = result.rows[0];

      // Broadcast to WebSocket
      fastify.io.to(`account:${accountId}`).emit('conversation:updated', {
        type: 'conversation:updated',
        data: updated,
      });

      return reply.send(updated);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * DELETE /api/v1/conversations/:id
   * Close/delete conversation (soft delete by setting status to resolved)
   */
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const conversationId = parseInt(request.params.id);

      // Update status to resolved instead of hard delete
      const result = await pool.query(
        `UPDATE conversations
         SET status = $1, resolved_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND account_id = $3
         RETURNING *`,
        [ConversationStatus.RESOLVED, conversationId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }

      // Broadcast to WebSocket
      fastify.io.to(`account:${accountId}`).emit('conversation:closed', {
        type: 'conversation:closed',
        data: { id: conversationId },
      });

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * GET /api/v1/conversations/stats
   * Get conversation statistics
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);

      const result = await pool.query(
        `SELECT
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE status = 'open')::int as open,
           COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
           COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved,
           COUNT(*) FILTER (WHERE status = 'snoozed')::int as snoozed,
           COALESCE(AVG(EXTRACT(EPOCH FROM (first_reply_at - created_at)) / 60), 0)::float as avg_first_response_time,
           COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0)::float as avg_resolution_time
         FROM conversations
         WHERE account_id = $1`,
        [accountId]
      );

      return reply.send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });
}
