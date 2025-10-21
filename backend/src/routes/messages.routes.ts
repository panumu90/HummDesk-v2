/**
 * Messages Routes
 *
 * Endpoints:
 * - GET /api/v1/conversations/:id/messages - Get messages for conversation
 * - POST /api/v1/conversations/:id/messages - Send message (triggers AI classification)
 * - PATCH /api/v1/messages/:id - Edit message
 * - DELETE /api/v1/messages/:id - Delete message
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { MessageSenderType, MessageType, MessageContentType } from '../types/message';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  content_type: z.enum(['text', 'image', 'file', 'audio', 'video', 'card', 'location']).default('text'),
  message_type: z.enum(['incoming', 'outgoing', 'private_note', 'activity']).default('outgoing'),
  content_attributes: z.record(z.any()).optional(),
  ai_draft_id: z.number().optional(),
});

const updateMessageSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  content_attributes: z.record(z.any()).optional(),
  is_read: z.boolean().optional(),
});

const messageFiltersSchema = z.object({
  message_type: z.enum(['incoming', 'outgoing', 'private_note', 'activity']).optional(),
  sender_type: z.enum(['User', 'Contact', 'AgentBot']).optional(),
  is_read: z.boolean().optional(),
  limit: z.number().min(1).max(200).default(50),
  before_id: z.number().optional(), // Cursor-based pagination
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function messagesRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  /**
   * GET /api/v1/conversations/:id/messages
   * Get messages for a conversation
   */
  fastify.get(
    '/conversations/:id/messages',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const conversationId = parseInt(request.params.id);
        const filters = messageFiltersSchema.parse(request.query);

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

        // Build WHERE clause
        const conditions: string[] = ['m.conversation_id = $1', 'm.account_id = $2'];
        const params: any[] = [conversationId, accountId];
        let paramIndex = 3;

        if (filters.message_type) {
          conditions.push(`m.message_type = $${paramIndex++}`);
          params.push(filters.message_type);
        }

        if (filters.sender_type) {
          conditions.push(`m.sender_type = $${paramIndex++}`);
          params.push(filters.sender_type);
        }

        if (filters.is_read !== undefined) {
          conditions.push(`m.is_read = $${paramIndex++}`);
          params.push(filters.is_read);
        }

        if (filters.before_id) {
          conditions.push(`m.id < $${paramIndex++}`);
          params.push(filters.before_id);
        }

        params.push(filters.limit);

        const whereClause = conditions.join(' AND ');

        // Fetch messages with sender info
        const result = await pool.query(
          `SELECT
             m.id, m.conversation_id, m.account_id, m.sender_type, m.sender_id,
             m.content, m.content_type, m.content_attributes, m.message_type,
             m.ai_draft_id, m.sentiment, m.is_read, m.source_id,
             m.created_at, m.updated_at,

             -- Sender details (either User or Contact)
             CASE
               WHEN m.sender_type = 'User' THEN
                 json_build_object(
                   'id', u.id,
                   'name', u.name,
                   'email', u.email,
                   'avatar_url', u.avatar_url,
                   'type', 'User'
                 )
               WHEN m.sender_type = 'Contact' THEN
                 json_build_object(
                   'id', c.id,
                   'name', c.name,
                   'email', c.email,
                   'avatar_url', c.avatar_url,
                   'type', 'Contact'
                 )
               ELSE
                 json_build_object(
                   'id', 0,
                   'name', 'System',
                   'type', 'AgentBot'
                 )
             END as sender,

             -- AI draft details (if applicable)
             CASE
               WHEN m.ai_draft_id IS NOT NULL THEN
                 json_build_object(
                   'id', ad.id,
                   'confidence', ad.confidence,
                   'reasoning', ad.reasoning,
                   'status', ad.status
                 )
               ELSE NULL
             END as ai_draft

           FROM messages m
           LEFT JOIN account_users au ON m.sender_type = 'User' AND m.sender_id = au.id
           LEFT JOIN users u ON au.user_id = u.id
           LEFT JOIN contacts c ON m.sender_type = 'Contact' AND m.sender_id = c.id
           LEFT JOIN ai_drafts ad ON m.ai_draft_id = ad.id
           WHERE ${whereClause}
           ORDER BY m.created_at DESC
           LIMIT $${paramIndex}`,
          params
        );

        // Reverse to chronological order
        const messages = result.rows.reverse();

        return reply.send({
          data: messages,
          meta: {
            conversation_id: conversationId,
            count: messages.length,
            has_more: messages.length === filters.limit,
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
    }
  );

  /**
   * POST /api/v1/conversations/:id/messages
   * Send a message in a conversation
   */
  fastify.post(
    '/conversations/:id/messages',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const client = await pool.connect();

      try {
        const accountId = parseInt(request.accountId!);
        const conversationId = parseInt(request.params.id);
        const userId = parseInt(request.user!.userId);
        const body = createMessageSchema.parse(request.body);

        await client.query('BEGIN');

        // Verify conversation belongs to account
        const conversationCheck = await client.query(
          'SELECT id FROM conversations WHERE id = $1 AND account_id = $2',
          [conversationId, accountId]
        );

        if (conversationCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Conversation not found',
          });
        }

        // Get account_user_id for this user in this account
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

        // Determine sender type based on message type
        let senderType = MessageSenderType.USER;
        let senderId = accountUserId;

        // Create message
        const messageResult = await client.query(
          `INSERT INTO messages (
             conversation_id, account_id, sender_type, sender_id,
             content, content_type, content_attributes, message_type,
             ai_draft_id, is_read, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          [
            conversationId,
            accountId,
            senderType,
            senderId,
            body.content,
            body.content_type,
            JSON.stringify(body.content_attributes || {}),
            body.message_type,
            body.ai_draft_id,
            false, // Outgoing messages start as unread
          ]
        );

        const message = messageResult.rows[0];

        // Update conversation's updated_at and first_reply_at
        await client.query(
          `UPDATE conversations
           SET updated_at = NOW(),
               first_reply_at = COALESCE(first_reply_at, NOW())
           WHERE id = $1`,
          [conversationId]
        );

        // If this is from a customer (incoming), trigger AI classification
        if (body.message_type === MessageType.INCOMING && senderType === MessageSenderType.CONTACT) {
          // TODO: Trigger AI classification asynchronously
          // This would call AIOrchestrator.classifyMessage(message.id)
        }

        await client.query('COMMIT');

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('message:created', {
          type: 'message:created',
          data: message,
        });

        fastify.io.to(`conversation:${conversationId}`).emit('message:created', {
          type: 'message:created',
          data: message,
        });

        return reply.status(201).send(message);

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
   * PATCH /api/v1/messages/:id
   * Edit a message
   */
  fastify.patch(
    '/messages/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const messageId = parseInt(request.params.id);
        const body = updateMessageSchema.parse(request.body);

        // Build dynamic UPDATE clause
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (body.content !== undefined) {
          updates.push(`content = $${paramIndex++}`);
          params.push(body.content);
        }

        if (body.content_attributes !== undefined) {
          updates.push(`content_attributes = $${paramIndex++}`);
          params.push(JSON.stringify(body.content_attributes));
        }

        if (body.is_read !== undefined) {
          updates.push(`is_read = $${paramIndex++}`);
          params.push(body.is_read);
        }

        updates.push('updated_at = NOW()');

        if (updates.length === 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No fields to update',
          });
        }

        params.push(messageId, accountId);

        // Execute update
        const result = await pool.query(
          `UPDATE messages
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND account_id = $${paramIndex++}
           RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Message not found',
          });
        }

        const message = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('message:updated', {
          type: 'message:updated',
          data: message,
        });

        return reply.send(message);

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
    }
  );

  /**
   * DELETE /api/v1/messages/:id
   * Delete a message (soft delete by marking as deleted)
   */
  fastify.delete(
    '/messages/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const messageId = parseInt(request.params.id);

        // Instead of hard delete, we could add a deleted_at column
        // For now, we'll do a hard delete
        const result = await pool.query(
          'DELETE FROM messages WHERE id = $1 AND account_id = $2 RETURNING id, conversation_id',
          [messageId, accountId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Message not found',
          });
        }

        const deleted = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('message:deleted', {
          type: 'message:deleted',
          data: { id: messageId, conversation_id: deleted.conversation_id },
        });

        return reply.status(204).send();

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/messages/:id/mark-read
   * Mark a message as read
   */
  fastify.post(
    '/messages/:id/mark-read',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const messageId = parseInt(request.params.id);

        const result = await pool.query(
          `UPDATE messages
           SET is_read = true, updated_at = NOW()
           WHERE id = $1 AND account_id = $2
           RETURNING *`,
          [messageId, accountId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Message not found',
          });
        }

        return reply.send(result.rows[0]);

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/conversations/:id/messages/mark-all-read
   * Mark all messages in a conversation as read
   */
  fastify.post(
    '/conversations/:id/messages/mark-all-read',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const conversationId = parseInt(request.params.id);

        const result = await pool.query(
          `UPDATE messages
           SET is_read = true, updated_at = NOW()
           WHERE conversation_id = $1 AND account_id = $2 AND is_read = false
           RETURNING COUNT(*)`,
          [conversationId, accountId]
        );

        return reply.send({
          message: 'All messages marked as read',
          updated_count: result.rowCount,
        });

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );
}
