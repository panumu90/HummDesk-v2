/**
 * WebSocket Server Setup
 * Initializes Socket.IO with JWT authentication and multi-tenant room isolation
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { FastifyInstance } from 'fastify';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './events';
import { initBroadcastService, getBroadcastService } from './broadcast.service';
import {
  handleSendMessage,
  handleMessageRead,
} from './handlers/message.handler';
import {
  handleTypingStart,
  handleTypingStop,
  handleAgentOnline,
  handleAgentOffline,
  updateAgentPresence,
  cleanupTypingTimeouts,
} from './handlers/presence.handler';
import {
  handleJoinConversation,
  handleLeaveConversation,
  handleUpdateConversationStatus,
  handleAssignConversation,
  handleUnassignConversation,
} from './handlers/conversation.handler';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Initialize Socket.IO server with authentication and event handlers
 */
export function initializeWebSocketServer(
  httpServer: HTTPServer,
  fastify: FastifyInstance
): TypedSocketIOServer {
  const io: TypedSocketIOServer = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Initialize broadcast service
  initBroadcastService(io);

  // ============================================================================
  // Authentication Middleware
  // ============================================================================

  io.use(async (socket: TypedSocket, next) => {
    try {
      // Extract token from auth handshake or query
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '') ||
        (socket.handshake.query.token as string);

      if (!token) {
        // Allow connection but mark as unauthenticated
        // User must send authenticate event to gain full access
        socket.data.authenticated = false;
        socket.data.connectedAt = new Date().toISOString();
        socket.data.lastActivity = new Date().toISOString();
        return next();
      }

      // Verify JWT token using Fastify's JWT instance
      const decoded = fastify.jwt.verify<{
        userId: string;
        accountId: string;
        email: string;
        role: 'admin' | 'agent' | 'viewer';
      }>(token);

      // Attach user data to socket
      socket.data.userId = decoded.userId;
      socket.data.accountId = decoded.accountId;
      socket.data.email = decoded.email;
      socket.data.role = decoded.role;
      socket.data.authenticated = true;
      socket.data.connectedAt = new Date().toISOString();
      socket.data.lastActivity = new Date().toISOString();

      console.log(`✅ Socket authenticated: ${decoded.email} (${decoded.role})`);

      next();
    } catch (error) {
      console.error('❌ Socket authentication failed:', error);
      // Allow connection but mark as unauthenticated
      socket.data.authenticated = false;
      socket.data.connectedAt = new Date().toISOString();
      socket.data.lastActivity = new Date().toISOString();
      next();
    }
  });

  // ============================================================================
  // Connection Handler
  // ============================================================================

  io.on('connection', (socket: TypedSocket) => {
    console.log(`🔌 Socket.IO client connected: ${socket.id}`);

    const { userId, accountId, email, role, authenticated } = socket.data;

    if (authenticated && userId && accountId) {
      // Auto-join account room for multi-tenant isolation
      socket.join(`account:${accountId}`);
      console.log(`🏠 Socket ${socket.id} auto-joined account:${accountId}`);

      // Auto-join agent-specific room
      if (role === 'agent') {
        socket.join(`agent:${userId}`);
        console.log(`👤 Socket ${socket.id} auto-joined agent:${userId}`);

        // Update agent presence to online
        handleAgentOnline(socket);
      }

      // Send authenticated confirmation
      socket.emit('authenticated', {
        userId,
        accountId,
        email,
        role,
      });
    } else {
      console.log(`⚠️  Socket ${socket.id} connected but not authenticated`);
      socket.emit('authentication_error', 'Authentication required for full access');
    }

    // ============================================================================
    // Authentication Events
    // ============================================================================

    socket.on('authenticate', async (token: string) => {
      try {
        const decoded = fastify.jwt.verify<{
          userId: string;
          accountId: string;
          email: string;
          role: 'admin' | 'agent' | 'viewer';
        }>(token);

        socket.data.userId = decoded.userId;
        socket.data.accountId = decoded.accountId;
        socket.data.email = decoded.email;
        socket.data.role = decoded.role;
        socket.data.authenticated = true;

        // Join rooms
        socket.join(`account:${decoded.accountId}`);
        if (decoded.role === 'agent') {
          socket.join(`agent:${decoded.userId}`);
          await handleAgentOnline(socket);
        }

        socket.emit('authenticated', {
          userId: decoded.userId,
          accountId: decoded.accountId,
          email: decoded.email,
          role: decoded.role,
        });

        console.log(`✅ Socket ${socket.id} authenticated as ${decoded.email}`);
      } catch (error) {
        socket.emit('authentication_error', 'Invalid token');
        console.error('❌ Authentication failed:', error);
      }
    });

    // ============================================================================
    // Conversation Events
    // ============================================================================

    socket.on('join_conversation', async (conversationId: string) => {
      if (!socket.data.authenticated) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await handleJoinConversation(socket, conversationId);
    });

    socket.on('leave_conversation', async (conversationId: string) => {
      await handleLeaveConversation(socket, conversationId);
    });

    socket.on('update_conversation_status', async (data) => {
      if (!socket.data.authenticated) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await handleUpdateConversationStatus(socket, data);
    });

    socket.on('assign_conversation', async (data) => {
      if (!socket.data.authenticated) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await handleAssignConversation(socket, data);
    });

    socket.on('unassign_conversation', async (data) => {
      if (!socket.data.authenticated) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await handleUnassignConversation(socket, data);
    });

    // ============================================================================
    // Message Events
    // ============================================================================

    socket.on('send_message', async (data) => {
      if (!socket.data.authenticated) {
        socket.emit('message_error', 'Authentication required');
        return;
      }
      await handleSendMessage(socket, data);
    });

    socket.on('message_read', async (data) => {
      if (!socket.data.authenticated) {
        return;
      }
      await handleMessageRead(socket, data);
    });

    // ============================================================================
    // Typing Indicator Events
    // ============================================================================

    socket.on('typing_start', async (data) => {
      if (!socket.data.authenticated) {
        return;
      }
      await handleTypingStart(socket, data);
    });

    socket.on('typing_stop', async (data) => {
      if (!socket.data.authenticated) {
        return;
      }
      await handleTypingStop(socket, data);
    });

    // ============================================================================
    // Presence Events
    // ============================================================================

    socket.on('agent_online', async () => {
      if (!socket.data.authenticated || socket.data.role !== 'agent') {
        return;
      }
      await handleAgentOnline(socket);
    });

    socket.on('agent_offline', async () => {
      if (!socket.data.authenticated || socket.data.role !== 'agent') {
        return;
      }
      await handleAgentOffline(socket);
    });

    // ============================================================================
    // Room Management (backward compatibility)
    // ============================================================================

    socket.on('join-account', (accountId: string) => {
      socket.join(`account:${accountId}`);
      console.log(`🏠 Socket ${socket.id} joined account:${accountId} (legacy)`);
    });

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 Socket ${socket.id} joined conversation:${conversationId} (legacy)`);
    });

    // ============================================================================
    // Disconnect Handler
    // ============================================================================

    socket.on('disconnect', async (reason: string) => {
      console.log(`❌ Socket ${socket.id} disconnected: ${reason}`);

      if (socket.data.authenticated && socket.data.userId && socket.data.accountId) {
        // Cleanup typing timeouts
        cleanupTypingTimeouts(socket.data.userId);

        // Update agent presence to offline if this was their last connection
        if (socket.data.role === 'agent') {
          const broadcast = getBroadcastService();
          const agentStillOnline = await broadcast.isAgentOnline(socket.data.userId);

          if (!agentStillOnline) {
            await handleAgentOffline(socket);
          }
        }
      }

      socket.emit('disconnect_reason', reason);
    });

    // ============================================================================
    // Activity Tracking (keep connection alive)
    // ============================================================================

    socket.onAny(() => {
      socket.data.lastActivity = new Date().toISOString();
    });
  });

  console.log('✅ WebSocket server initialized with authentication and event handlers');

  return io;
}

export default initializeWebSocketServer;
