/**
 * Demo Integration Routes
 *
 * Bridge endpoints for hubspot-agent-demo integration
 * Allows agent orchestration to create conversations and send replies
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const classifySchema = z.object({
  from: z.string().email().or(z.string().regex(/^.+\s<.+@.+>$/)), // "Name <email>" or "email"
  subject: z.string(),
  body: z.string(),
});

const replySchema = z.object({
  content: z.string(),
  agentName: z.string().optional(),
  agentId: z.string().optional(),
  usedAIDraft: z.boolean().optional(),
  modified: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseEmailFrom(from: string): { name: string; email: string } {
  // "Matti Meikalainen <matti@example.com>" or "matti@example.com"
  const match = from.match(/^(.+)\s<(.+@.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: from.split('@')[0], email: from };
}

// ============================================================================
// ROUTES
// ============================================================================

export default async function demoRoutes(fastify: FastifyInstance) {

  /**
   * POST /api/demo/classify
   * Create a new conversation from agent orchestration
   */
  fastify.post<{
    Body: z.infer<typeof classifySchema>;
  }>('/api/demo/classify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { from, subject, body } = classifySchema.parse(request.body);
      const { name, email } = parseEmailFrom(from);

      // Create contact if not exists
      let contact;
      const existingContact = await pool.query(
        'SELECT * FROM contacts WHERE email = $1 LIMIT 1',
        [email]
      );

      if (existingContact.rows.length > 0) {
        contact = existingContact.rows[0];
      } else {
        const newContact = await pool.query(
          `INSERT INTO contacts (
            name, email, phone, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING *`,
          [name, email, null, { source: 'agent_demo' }]
        );
        contact = newContact.rows[0];
      }

      // Create conversation
      const conversationResult = await pool.query(
        `INSERT INTO conversations (
          inbox_id, contact_id, subject, status, priority,
          ai_category, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          1, // Default inbox ID (you may want to make this configurable)
          contact.id,
          subject,
          'open',
          'normal',
          'agent_orchestration',
          { source: 'hubspot_agent_demo', original_from: from }
        ]
      );

      const conversation = conversationResult.rows[0];

      // Create initial message from customer
      await pool.query(
        `INSERT INTO messages (
          conversation_id, content, sender_type, sender_id,
          is_private, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          conversation.id,
          body,
          'contact',
          contact.id,
          false,
          { source: 'agent_demo' }
        ]
      );

      return reply.code(200).send({
        success: true,
        data: {
          conversationId: `demo-conv-${conversation.id}`,
          contactId: contact.id,
          subject: conversation.subject,
        }
      });

    } catch (error: any) {
      request.log.error(error, 'Failed to classify and create conversation');
      return reply.code(500).send({
        error: 'Failed to create conversation',
        message: error.message
      });
    }
  });

  /**
   * POST /api/demo/conversation/:id/reply
   * Add AI-generated reply to conversation
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof replySchema>;
  }>('/api/demo/conversation/:id/reply', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const payload = replySchema.parse(request.body);

      // Extract numeric ID from "demo-conv-123" format
      const conversationId = parseInt(id.replace('demo-conv-', ''), 10);

      if (isNaN(conversationId)) {
        return reply.code(400).send({
          error: 'Invalid conversation ID format'
        });
      }

      // Verify conversation exists
      const convResult = await pool.query(
        'SELECT * FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (convResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Conversation not found'
        });
      }

      // Create AI agent message
      await pool.query(
        `INSERT INTO messages (
          conversation_id, content, sender_type, sender_id,
          is_private, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          conversationId,
          payload.content,
          'agent',
          null, // No specific agent user
          false,
          {
            source: 'agent_demo',
            agent_name: payload.agentName || 'AI Demo Bot',
            agent_id: payload.agentId || 'ai-demo-bot',
            used_ai_draft: payload.usedAIDraft ?? true,
            modified: payload.modified ?? false,
            ...payload.metadata
          }
        ]
      );

      // Update conversation timestamp
      await pool.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      return reply.code(200).send({
        success: true,
        message: 'Reply added successfully'
      });

    } catch (error: any) {
      request.log.error(error, 'Failed to add demo reply');
      return reply.code(500).send({
        error: 'Failed to add reply',
        message: error.message
      });
    }
  });

  /**
   * GET /api/demo/conversations
   * List demo conversations
   */
  fastify.get('/api/demo/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await pool.query(
        `SELECT
          c.id,
          c.subject,
          c.status,
          c.priority,
          c.ai_category,
          c.created_at,
          c.updated_at,
          co.name as contact_name,
          co.email as contact_email,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        LEFT JOIN contacts co ON c.contact_id = co.id
        WHERE c.metadata->>'source' = 'hubspot_agent_demo'
        ORDER BY c.updated_at DESC
        LIMIT 50`
      );

      return reply.code(200).send({
        success: true,
        data: result.rows.map(row => ({
          id: `demo-conv-${row.id}`,
          subject: row.subject,
          status: row.status,
          priority: row.priority,
          category: row.ai_category,
          contactName: row.contact_name,
          contactEmail: row.contact_email,
          messageCount: parseInt(row.message_count, 10),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      });

    } catch (error: any) {
      request.log.error(error, 'Failed to list demo conversations');
      return reply.code(500).send({
        error: 'Failed to list conversations',
        message: error.message
      });
    }
  });
}
