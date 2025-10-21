/**
 * Conversation Handler
 * Handles conversation-related WebSocket events (join, leave, status updates, assignments)
 */

import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  UpdateConversationStatusData,
  AssignConversationData,
  UnassignConversationData,
} from '../events';
import { getBroadcastService } from '../broadcast.service';
import pool from '../../config/database';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

/**
 * Handle join_conversation event
 * Joins socket to conversation room for real-time updates
 */
export async function handleJoinConversation(
  socket: TypedSocket,
  conversationId: string
): Promise<void> {
  try {
    const { userId, accountId } = socket.data;

    if (!userId || !accountId) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify user has access to this conversation
    const conversationCheck = await pool.query(
      `SELECT id, account_id FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversationCheck.rows.length === 0) {
      socket.emit('error', {
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conversation = conversationCheck.rows[0];

    // Verify account access
    if (conversation.account_id !== accountId) {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Access denied to this conversation',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Join conversation room
    await socket.join(`conversation:${conversationId}`);

    console.log(`💬 Socket ${socket.id} joined conversation ${conversationId}`);

    // Mark messages as read (if agent)
    if (socket.data.role === 'agent') {
      await markConversationMessagesRead(conversationId, userId);
    }
  } catch (error) {
    console.error('❌ Error in handleJoinConversation:', error);
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to join conversation',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handle leave_conversation event
 * Removes socket from conversation room
 */
export async function handleLeaveConversation(
  socket: TypedSocket,
  conversationId: string
): Promise<void> {
  try {
    await socket.leave(`conversation:${conversationId}`);
    console.log(`👋 Socket ${socket.id} left conversation ${conversationId}`);
  } catch (error) {
    console.error('❌ Error in handleLeaveConversation:', error);
  }
}

/**
 * Handle update_conversation_status event
 * Updates conversation status and broadcasts to participants
 */
export async function handleUpdateConversationStatus(
  socket: TypedSocket,
  data: UpdateConversationStatusData
): Promise<void> {
  try {
    const { userId, accountId, role } = socket.data;

    if (!userId || !accountId) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { conversationId, status, reason } = data;

    // Verify conversation exists and get current status
    const conversationResult = await pool.query(
      `SELECT id, account_id, status FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      socket.emit('error', {
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conversation = conversationResult.rows[0];

    // Verify account access
    if (conversation.account_id !== accountId) {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const oldStatus = conversation.status;

    // Update status in database
    await pool.query(
      `UPDATE conversations
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, conversationId]
    );

    // Log status change
    await pool.query(
      `INSERT INTO conversation_events
       (conversation_id, event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        conversationId,
        'status_changed',
        userId,
        JSON.stringify({ oldStatus, newStatus: status, reason }),
      ]
    );

    const timestamp = new Date().toISOString();

    // Broadcast status change
    const broadcast = getBroadcastService();
    await broadcast.notifyConversationStatusChanged(accountId, conversationId, {
      conversationId,
      oldStatus,
      newStatus: status,
      changedBy: userId,
      reason,
      timestamp,
    });

    console.log(`📊 Conversation ${conversationId} status changed: ${oldStatus} → ${status}`);
  } catch (error) {
    console.error('❌ Error in handleUpdateConversationStatus:', error);
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to update status',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handle assign_conversation event
 * Assigns conversation to an agent and broadcasts update
 */
export async function handleAssignConversation(
  socket: TypedSocket,
  data: AssignConversationData
): Promise<void> {
  try {
    const { userId, accountId, role } = socket.data;

    if (!userId || !accountId) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Only agents and admins can assign conversations
    if (role !== 'agent' && role !== 'admin') {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { conversationId, agentId, teamId } = data;

    // Verify conversation exists
    const conversationResult = await pool.query(
      `SELECT id, account_id FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      socket.emit('error', {
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conversation = conversationResult.rows[0];

    // Verify account access
    if (conversation.account_id !== accountId) {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify agent exists and belongs to account
    const agentResult = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND account_id = $2 AND role = $3`,
      [agentId, accountId, 'agent']
    );

    if (agentResult.rows.length === 0) {
      socket.emit('error', {
        code: 'NOT_FOUND',
        message: 'Agent not found or invalid',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update assignment in database
    await pool.query(
      `UPDATE conversations
       SET assigned_to = $1, assigned_team = $2, updated_at = NOW()
       WHERE id = $3`,
      [agentId, teamId || null, conversationId]
    );

    // Log assignment event
    await pool.query(
      `INSERT INTO conversation_events
       (conversation_id, event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        conversationId,
        'assigned',
        userId,
        JSON.stringify({ assignedTo: agentId, assignedTeam: teamId }),
      ]
    );

    const timestamp = new Date().toISOString();

    // Broadcast assignment
    const broadcast = getBroadcastService();
    await broadcast.notifyConversationAssigned(accountId, conversationId, {
      conversationId,
      assignedTo: agentId,
      assignedTeam: teamId,
      assignedBy: userId,
      timestamp,
    });

    console.log(`👤 Conversation ${conversationId} assigned to agent ${agentId}`);
  } catch (error) {
    console.error('❌ Error in handleAssignConversation:', error);
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to assign conversation',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handle unassign_conversation event
 * Removes agent assignment from conversation
 */
export async function handleUnassignConversation(
  socket: TypedSocket,
  data: UnassignConversationData
): Promise<void> {
  try {
    const { userId, accountId, role } = socket.data;

    if (!userId || !accountId) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { conversationId, reason } = data;

    // Get current assignment
    const conversationResult = await pool.query(
      `SELECT id, account_id, assigned_to FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      socket.emit('error', {
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conversation = conversationResult.rows[0];

    if (conversation.account_id !== accountId) {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const unassignedFrom = conversation.assigned_to;

    if (!unassignedFrom) {
      socket.emit('error', {
        code: 'BAD_REQUEST',
        message: 'Conversation is not assigned',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update database
    await pool.query(
      `UPDATE conversations
       SET assigned_to = NULL, assigned_team = NULL, updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );

    // Log event
    await pool.query(
      `INSERT INTO conversation_events
       (conversation_id, event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        conversationId,
        'unassigned',
        userId,
        JSON.stringify({ unassignedFrom, reason }),
      ]
    );

    const timestamp = new Date().toISOString();

    // Broadcast
    const broadcast = getBroadcastService();
    broadcast.broadcastToConversation('conversation_unassigned', conversationId, {
      conversationId,
      unassignedFrom,
      unassignedBy: userId,
      reason,
      timestamp,
    });

    broadcast.broadcastToAccount('conversation_unassigned', accountId, {
      conversationId,
      unassignedFrom,
      unassignedBy: userId,
      reason,
      timestamp,
    });

    console.log(`❌ Conversation ${conversationId} unassigned from ${unassignedFrom}`);
  } catch (error) {
    console.error('❌ Error in handleUnassignConversation:', error);
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to unassign conversation',
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Mark all unread messages in a conversation as read
 */
async function markConversationMessagesRead(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO message_reads (message_id, user_id, read_at)
       SELECT m.id, $2, NOW()
       FROM messages m
       WHERE m.conversation_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM message_reads mr
         WHERE mr.message_id = m.id AND mr.user_id = $2
       )`,
      [conversationId, userId]
    );
  } catch (error) {
    console.error('❌ Error marking messages as read:', error);
  }
}
