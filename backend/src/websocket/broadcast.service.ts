/**
 * WebSocket Broadcasting Service
 * Centralized service for broadcasting events to rooms and clients
 */

import { Server as SocketIOServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from './events';

type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

export class BroadcastService {
  constructor(private io: TypedSocketIOServer) {}

  // ============================================================================
  // Room Broadcasting
  // ============================================================================

  /**
   * Broadcast to all sockets in an account
   * Used for account-wide notifications (new conversation, settings changed, etc.)
   */
  broadcastToAccount<K extends keyof ServerToClientEvents>(
    accountId: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    const room = `account:${accountId}`;
    this.io.to(room).emit(event, data);
    console.log(`📡 Broadcasting "${event}" to account:${accountId}`);
  }

  /**
   * Broadcast to a specific agent
   * Used for agent-specific notifications (assignment, mentions, etc.)
   */
  broadcastToAgent<K extends keyof ServerToClientEvents>(
    agentId: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    const room = `agent:${agentId}`;
    this.io.to(room).emit(event, data);
    console.log(`📡 Broadcasting "${event}" to agent:${agentId}`);
  }

  /**
   * Broadcast to all participants in a conversation
   * Used for messages, typing indicators, status changes
   */
  broadcastToConversation<K extends keyof ServerToClientEvents>(
    conversationId: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    const room = `conversation:${conversationId}`;
    this.io.to(room).emit(event, data);
    console.log(`📡 Broadcasting "${event}" to conversation:${conversationId}`);
  }

  /**
   * Broadcast to a specific team
   * Used for team-wide notifications and load balancing
   */
  broadcastToTeam<K extends keyof ServerToClientEvents>(
    teamId: string,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    const room = `team:${teamId}`;
    this.io.to(room).emit(event, data);
    console.log(`📡 Broadcasting "${event}" to team:${teamId}`);
  }

  /**
   * Broadcast to all connected sockets (system-wide)
   * Use sparingly - only for critical system events
   */
  broadcastToAll<K extends keyof ServerToClientEvents>(
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    this.io.emit(event, data);
    console.log(`📡 Broadcasting "${event}" to ALL clients`);
  }

  // ============================================================================
  // Specialized Broadcasting Methods
  // ============================================================================

  /**
   * Notify account about new message with AI classification
   */
  async notifyNewMessage(
    accountId: string,
    conversationId: string,
    messageData: Parameters<ServerToClientEvents['new_message']>[0]
  ): Promise<void> {
    // Broadcast to conversation participants
    this.broadcastToConversation('new_message', conversationId, messageData);

    // Also broadcast to account for inbox updates
    this.broadcastToAccount('new_message', accountId, messageData);
  }

  /**
   * Notify about AI classification results
   */
  async notifyAIClassification(
    accountId: string,
    conversationId: string,
    classificationData: Parameters<ServerToClientEvents['ai_classification']>[0]
  ): Promise<void> {
    this.broadcastToConversation('ai_classification', conversationId, classificationData);
    this.broadcastToAccount('ai_classification', accountId, classificationData);

    // If suggested agent, notify them specifically
    if (classificationData.classification.suggestedAgent) {
      this.broadcastToAgent(
        'ai_classification',
        classificationData.classification.suggestedAgent,
        classificationData
      );
    }
  }

  /**
   * Notify about AI draft generation
   */
  async notifyAIDraft(
    conversationId: string,
    assignedAgentId: string | undefined,
    draftData: Parameters<ServerToClientEvents['ai_draft']>[0]
  ): Promise<void> {
    // Send to conversation room
    this.broadcastToConversation('ai_draft', conversationId, draftData);

    // If assigned to specific agent, notify them
    if (assignedAgentId) {
      this.broadcastToAgent('ai_draft', assignedAgentId, draftData);
    }
  }

  /**
   * Notify about conversation assignment
   */
  async notifyConversationAssigned(
    accountId: string,
    conversationId: string,
    assignmentData: Parameters<ServerToClientEvents['conversation_assigned']>[0]
  ): Promise<void> {
    // Notify the assigned agent
    this.broadcastToAgent('conversation_assigned', assignmentData.assignedTo, assignmentData);

    // Notify conversation participants
    this.broadcastToConversation('conversation_assigned', conversationId, assignmentData);

    // Notify account for UI updates
    this.broadcastToAccount('conversation_assigned', accountId, assignmentData);
  }

  /**
   * Notify about agent presence changes
   */
  async notifyAgentPresence(
    accountId: string,
    presenceData: Parameters<ServerToClientEvents['agent_online' | 'agent_offline']>[0],
    status: 'online' | 'offline'
  ): Promise<void> {
    const event = status === 'online' ? 'agent_online' : 'agent_offline';
    this.broadcastToAccount(event, accountId, presenceData);
  }

  /**
   * Notify about typing indicators
   */
  async notifyTyping(
    conversationId: string,
    typingData: Parameters<ServerToClientEvents['typing_start']>[0],
    isTyping: boolean
  ): Promise<void> {
    const event = isTyping ? 'typing_start' : 'typing_stop';
    this.broadcastToConversation(event, conversationId, typingData);
  }

  /**
   * Notify about conversation status change
   */
  async notifyConversationStatusChanged(
    accountId: string,
    conversationId: string,
    statusData: Parameters<ServerToClientEvents['conversation_status_changed']>[0]
  ): Promise<void> {
    this.broadcastToConversation('conversation_status_changed', conversationId, statusData);
    this.broadcastToAccount('conversation_status_changed', accountId, statusData);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get list of all connected sockets in a room
   */
  async getSocketsInRoom(room: string): Promise<string[]> {
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.map((socket) => socket.id);
  }

  /**
   * Get count of connected sockets in a room
   */
  async getRoomSize(room: string): Promise<number> {
    const sockets = await this.getSocketsInRoom(room);
    return sockets.length;
  }

  /**
   * Get all online agents in an account
   */
  async getOnlineAgents(accountId: string): Promise<string[]> {
    const room = `account:${accountId}`;
    const sockets = await this.io.in(room).fetchSockets();

    const agentIds = new Set<string>();
    sockets.forEach((socket) => {
      if (socket.data.userId && socket.data.role === 'agent') {
        agentIds.add(socket.data.userId);
      }
    });

    return Array.from(agentIds);
  }

  /**
   * Check if a specific agent is online
   */
  async isAgentOnline(agentId: string): Promise<boolean> {
    const room = `agent:${agentId}`;
    const size = await this.getRoomSize(room);
    return size > 0;
  }

  /**
   * Get connection stats for monitoring
   */
  async getConnectionStats(): Promise<{
    totalConnections: number;
    authenticatedConnections: number;
    rooms: string[];
  }> {
    const sockets = await this.io.fetchSockets();
    const authenticatedSockets = sockets.filter((s) => s.data.authenticated);
    const rooms = await this.io.of('/').adapter.rooms;

    return {
      totalConnections: sockets.length,
      authenticatedConnections: authenticatedSockets.length,
      rooms: Array.from(rooms.keys()).filter((r) => !r.startsWith('/')),
    };
  }
}

// Export singleton factory
let broadcastServiceInstance: BroadcastService | null = null;

export function initBroadcastService(io: TypedSocketIOServer): BroadcastService {
  if (!broadcastServiceInstance) {
    broadcastServiceInstance = new BroadcastService(io);
  }
  return broadcastServiceInstance;
}

export function getBroadcastService(): BroadcastService {
  if (!broadcastServiceInstance) {
    throw new Error('BroadcastService not initialized. Call initBroadcastService first.');
  }
  return broadcastServiceInstance;
}
