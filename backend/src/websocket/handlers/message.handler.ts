/**
 * Message Handler
 * Handles all message-related WebSocket events
 */

import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SendMessageData,
  MessageReadData,
} from '../events';
import { getBroadcastService } from '../broadcast.service';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

/**
 * Handle send_message event
 * Saves message to database and broadcasts to conversation participants
 */
export async function handleSendMessage(
  socket: TypedSocket,
  data: SendMessageData
): Promise<void> {
  try {
    const { userId, accountId, role } = socket.data;

    if (!userId || !accountId) {
      socket.emit('message_error', 'Not authenticated');
      return;
    }

    const { conversationId, content, contentType = 'text', attachments, metadata } = data;

    // Validate input
    if (!conversationId || !content.trim()) {
      socket.emit('message_error', 'Missing required fields');
      return;
    }

    // Check if conversation exists and user has access
    const conversationCheck = await pool.query(
      `SELECT id, account_id, assigned_to
       FROM conversations
       WHERE id = $1 AND account_id = $2`,
      [conversationId, accountId]
    );

    if (conversationCheck.rows.length === 0) {
      socket.emit('message_error', 'Conversation not found or access denied');
      return;
    }

    // Generate message ID
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    // Save message to database
    await pool.query(
      `INSERT INTO messages
       (id, conversation_id, sender_id, sender_type, content, content_type, attachments, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        messageId,
        conversationId,
        userId,
        role === 'agent' ? 'agent' : 'customer',
        content,
        contentType,
        attachments ? JSON.stringify(attachments) : null,
        metadata ? JSON.stringify(metadata) : null,
        timestamp,
      ]
    );

    // Update conversation's last_message and updated_at
    await pool.query(
      `UPDATE conversations
       SET last_message_at = $1,
           updated_at = $1
       WHERE id = $2`,
      [timestamp, conversationId]
    );

    // Confirm to sender
    socket.emit('message_sent', {
      messageId,
      conversationId,
      timestamp,
    });

    // Broadcast to conversation participants
    const broadcast = getBroadcastService();
    await broadcast.notifyNewMessage(accountId, conversationId, {
      messageId,
      conversationId,
      senderId: userId,
      senderType: role === 'agent' ? 'agent' : 'customer',
      content,
      contentType,
      attachments,
      metadata,
      timestamp,
    });

    // Trigger AI classification for customer messages
    if (role !== 'agent') {
      await triggerAIClassification(conversationId, messageId, content, accountId);
    }

    // Trigger AI draft generation for agent assignment
    const assignedTo = conversationCheck.rows[0].assigned_to;
    if (role !== 'agent' && assignedTo) {
      await triggerAIDraftGeneration(conversationId, messageId, content, assignedTo);
    }

    console.log(`✅ Message ${messageId} sent in conversation ${conversationId}`);
  } catch (error) {
    console.error('❌ Error in handleSendMessage:', error);
    socket.emit('message_error', error instanceof Error ? error.message : 'Failed to send message');
  }
}

/**
 * Handle message_read event
 * Marks message as read and broadcasts to other participants
 */
export async function handleMessageRead(
  socket: TypedSocket,
  data: MessageReadData
): Promise<void> {
  try {
    const { userId, accountId, role } = socket.data;

    if (!userId || !accountId) {
      return;
    }

    const { messageId, conversationId } = data;

    // Verify message exists
    const messageCheck = await pool.query(
      `SELECT m.id, c.account_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND c.account_id = $2`,
      [messageId, accountId]
    );

    if (messageCheck.rows.length === 0) {
      return;
    }

    // Update read status in database
    await pool.query(
      `INSERT INTO message_reads (message_id, user_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE
       SET read_at = NOW()`,
      [messageId, userId]
    );

    // Broadcast read receipt
    const broadcast = getBroadcastService();
    broadcast.broadcastToConversation('message_read', conversationId, {
      messageId,
      conversationId,
      readBy: userId,
      readByType: role === 'agent' ? 'agent' : 'customer',
      timestamp: new Date().toISOString(),
    });

    console.log(`📖 Message ${messageId} marked as read by ${userId}`);
  } catch (error) {
    console.error('❌ Error in handleMessageRead:', error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Trigger AI classification job (mock implementation)
 * In production, this would enqueue a job to Bull/BullMQ
 */
async function triggerAIClassification(
  conversationId: string,
  messageId: string,
  content: string,
  accountId: string
): Promise<void> {
  try {
    const broadcast = getBroadcastService();

    // Notify that AI processing started
    broadcast.broadcastToConversation('ai_processing_started', conversationId, {
      conversationId,
      messageId,
      processingType: 'classification',
      timestamp: new Date().toISOString(),
    });

    // TODO: Enqueue job to Redis/Bull
    // For now, simulate processing with setTimeout
    setTimeout(async () => {
      try {
        // Mock AI classification result
        const classificationData = {
          conversationId,
          messageId,
          classification: {
            category: 'technical_support',
            priority: 'medium' as const,
            urgency: 5,
            sentiment: 'neutral' as const,
            language: 'en',
            tags: ['bug', 'login'],
            suggestedTeam: 'team-tech-support',
            suggestedAgent: undefined,
          },
          confidence: 0.87,
          processingTime: 1200,
          timestamp: new Date().toISOString(),
        };

        await broadcast.notifyAIClassification(accountId, conversationId, classificationData);

        broadcast.broadcastToConversation('ai_processing_completed', conversationId, {
          conversationId,
          messageId,
          processingType: 'classification',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('AI classification error:', error);
        broadcast.broadcastToConversation('ai_error', conversationId, {
          conversationId,
          messageId,
          error: 'Classification failed',
          processingType: 'classification',
          timestamp: new Date().toISOString(),
        });
      }
    }, 2000);
  } catch (error) {
    console.error('❌ Error triggering AI classification:', error);
  }
}

/**
 * Trigger AI draft generation job (mock implementation)
 */
async function triggerAIDraftGeneration(
  conversationId: string,
  messageId: string,
  content: string,
  assignedAgentId: string
): Promise<void> {
  try {
    const broadcast = getBroadcastService();

    // Notify that AI processing started
    broadcast.broadcastToConversation('ai_processing_started', conversationId, {
      conversationId,
      messageId,
      processingType: 'draft',
      timestamp: new Date().toISOString(),
    });

    // TODO: Enqueue job to Redis/Bull
    setTimeout(async () => {
      try {
        // Mock AI draft result
        const draftData = {
          conversationId,
          messageId,
          draft: {
            content: 'Thank you for reaching out. I understand you\'re experiencing issues with login. Let me help you resolve this.',
            tone: 'empathetic' as const,
            suggestedActions: ['Reset password', 'Check account status', 'Verify email'],
          },
          confidence: 0.82,
          reasoning: 'Customer reported login issue. Suggesting standard troubleshooting steps.',
          timestamp: new Date().toISOString(),
        };

        await broadcast.notifyAIDraft(conversationId, assignedAgentId, draftData);

        broadcast.broadcastToConversation('ai_processing_completed', conversationId, {
          conversationId,
          messageId,
          processingType: 'draft',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('AI draft error:', error);
        broadcast.broadcastToConversation('ai_error', conversationId, {
          conversationId,
          messageId,
          error: 'Draft generation failed',
          processingType: 'draft',
          timestamp: new Date().toISOString(),
        });
      }
    }, 2500);
  } catch (error) {
    console.error('❌ Error triggering AI draft:', error);
  }
}
