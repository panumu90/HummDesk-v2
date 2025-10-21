/**
 * Presence Handler
 * Handles typing indicators and agent online/offline status
 */

import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TypingData,
} from '../events';
import { getBroadcastService } from '../broadcast.service';
import redis from '../../config/redis';
import pool from '../../config/database';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

// Store typing timeouts to auto-stop after inactivity
const typingTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Handle typing_start event
 * Broadcasts to conversation participants
 */
export async function handleTypingStart(
  socket: TypedSocket,
  data: TypingData
): Promise<void> {
  try {
    const { userId, accountId, email, role } = socket.data;

    if (!userId || !accountId) {
      return;
    }

    const { conversationId } = data;

    // Get user name from database
    const userResult = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    );

    const userName = userResult.rows[0]?.name || email || 'Unknown User';

    // Broadcast typing indicator
    const broadcast = getBroadcastService();
    await broadcast.notifyTyping(
      conversationId,
      {
        conversationId,
        userId,
        userType: role === 'agent' ? 'agent' : 'customer',
        userName,
        timestamp: new Date().toISOString(),
      },
      true
    );

    // Clear existing timeout for this user+conversation
    const timeoutKey = `${userId}:${conversationId}`;
    const existingTimeout = typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Auto-stop typing after 5 seconds of inactivity
    const timeout = setTimeout(async () => {
      await handleTypingStop(socket, data);
      typingTimeouts.delete(timeoutKey);
    }, 5000);

    typingTimeouts.set(timeoutKey, timeout);

    console.log(`⌨️  ${userName} started typing in conversation ${conversationId}`);
  } catch (error) {
    console.error('❌ Error in handleTypingStart:', error);
  }
}

/**
 * Handle typing_stop event
 * Broadcasts to conversation participants
 */
export async function handleTypingStop(
  socket: TypedSocket,
  data: TypingData
): Promise<void> {
  try {
    const { userId, accountId, email, role } = socket.data;

    if (!userId || !accountId) {
      return;
    }

    const { conversationId } = data;

    // Clear timeout if exists
    const timeoutKey = `${userId}:${conversationId}`;
    const existingTimeout = typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      typingTimeouts.delete(timeoutKey);
    }

    // Get user name
    const userResult = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    );

    const userName = userResult.rows[0]?.name || email || 'Unknown User';

    // Broadcast typing stopped
    const broadcast = getBroadcastService();
    await broadcast.notifyTyping(
      conversationId,
      {
        conversationId,
        userId,
        userType: role === 'agent' ? 'agent' : 'customer',
        userName,
        timestamp: new Date().toISOString(),
      },
      false
    );

    console.log(`⌨️  ${userName} stopped typing in conversation ${conversationId}`);
  } catch (error) {
    console.error('❌ Error in handleTypingStop:', error);
  }
}

/**
 * Handle agent_online event
 * Updates presence in Redis and broadcasts to account
 */
export async function handleAgentOnline(socket: TypedSocket): Promise<void> {
  try {
    const { userId, accountId, email, role } = socket.data;

    if (!userId || !accountId || role !== 'agent') {
      return;
    }

    // Get agent details
    const agentResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    if (agentResult.rows.length === 0) {
      return;
    }

    const agent = agentResult.rows[0];

    // Update presence in Redis (TTL 1 hour)
    await redis.setex(
      `presence:agent:${userId}`,
      3600,
      JSON.stringify({
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      })
    );

    // Update last_seen_at in database
    await pool.query(
      'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
      [userId]
    );

    // Broadcast to account
    const broadcast = getBroadcastService();
    await broadcast.notifyAgentPresence(
      accountId,
      {
        agentId: userId,
        accountId,
        name: agent.name,
        email: agent.email,
        status: 'online',
        timestamp: new Date().toISOString(),
      },
      'online'
    );

    console.log(`🟢 Agent ${agent.name} is now online`);
  } catch (error) {
    console.error('❌ Error in handleAgentOnline:', error);
  }
}

/**
 * Handle agent_offline event
 * Updates presence in Redis and broadcasts to account
 */
export async function handleAgentOffline(socket: TypedSocket): Promise<void> {
  try {
    const { userId, accountId, email, role } = socket.data;

    if (!userId || !accountId || role !== 'agent') {
      return;
    }

    // Get agent details
    const agentResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    if (agentResult.rows.length === 0) {
      return;
    }

    const agent = agentResult.rows[0];
    const timestamp = new Date().toISOString();

    // Update presence in Redis
    await redis.setex(
      `presence:agent:${userId}`,
      3600,
      JSON.stringify({
        status: 'offline',
        lastSeenAt: timestamp,
      })
    );

    // Update last_seen_at in database
    await pool.query(
      'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
      [userId]
    );

    // Broadcast to account
    const broadcast = getBroadcastService();
    await broadcast.notifyAgentPresence(
      accountId,
      {
        agentId: userId,
        accountId,
        name: agent.name,
        email: agent.email,
        status: 'offline',
        lastSeenAt: timestamp,
        timestamp,
      },
      'offline'
    );

    console.log(`🔴 Agent ${agent.name} is now offline`);
  } catch (error) {
    console.error('❌ Error in handleAgentOffline:', error);
  }
}

/**
 * Update agent presence (called periodically and on disconnect)
 */
export async function updateAgentPresence(
  userId: string,
  accountId: string,
  status: 'online' | 'offline' | 'away' | 'busy'
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    // Update in Redis
    await redis.setex(
      `presence:agent:${userId}`,
      3600,
      JSON.stringify({
        status,
        lastSeenAt: timestamp,
      })
    );

    // Update in database
    await pool.query(
      'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
      [userId]
    );

    console.log(`📊 Updated presence for agent ${userId}: ${status}`);
  } catch (error) {
    console.error('❌ Error updating agent presence:', error);
  }
}

/**
 * Get online agents in an account
 */
export async function getOnlineAgents(accountId: string): Promise<string[]> {
  try {
    // Get all agent IDs for this account
    const agentsResult = await pool.query(
      'SELECT id FROM users WHERE account_id = $1 AND role = $2',
      [accountId, 'agent']
    );

    const agentIds = agentsResult.rows.map((row) => row.id);
    const onlineAgents: string[] = [];

    // Check presence in Redis
    for (const agentId of agentIds) {
      const presence = await redis.get(`presence:agent:${agentId}`);
      if (presence) {
        const data = JSON.parse(presence);
        if (data.status === 'online') {
          onlineAgents.push(agentId);
        }
      }
    }

    return onlineAgents;
  } catch (error) {
    console.error('❌ Error getting online agents:', error);
    return [];
  }
}

/**
 * Check if agent is online
 */
export async function isAgentOnline(agentId: string): Promise<boolean> {
  try {
    const presence = await redis.get(`presence:agent:${agentId}`);
    if (!presence) {
      return false;
    }

    const data = JSON.parse(presence);
    return data.status === 'online';
  } catch (error) {
    console.error('❌ Error checking agent online status:', error);
    return false;
  }
}

/**
 * Cleanup typing timeouts on disconnect
 */
export function cleanupTypingTimeouts(userId: string): void {
  const keysToDelete: string[] = [];

  typingTimeouts.forEach((timeout, key) => {
    if (key.startsWith(`${userId}:`)) {
      clearTimeout(timeout);
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => typingTimeouts.delete(key));
}
