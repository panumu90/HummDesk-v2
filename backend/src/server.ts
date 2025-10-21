import dotenv from 'dotenv';
dotenv.config();

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { Server as SocketIOServer } from 'socket.io';
import pool, { closeDatabase } from './config/database';
import redis, { closeRedis } from './config/redis';
import { authMiddleware, optionalAuth, requireRole } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { initializeWebSocketServer } from './websocket/server';
import { registerRoutes, getRouteSummary } from './routes';

const PORT = parseInt(process.env.PORT || '5000');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Fastify instance
const fastify: FastifyInstance = Fastify({
  logger: {
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    transport: NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  trustProxy: true,
});

// Initialize Socket.IO with full WebSocket event handlers
let io: SocketIOServer;

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // JWT
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: {
      expiresIn: '7d',
    },
  });

  // WebSocket (for potential future use)
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });
}

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  fastify.log.error({
    error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
  });

  reply.status(statusCode).send({
    error: error.name || 'Error',
    message,
    statusCode,
    ...(NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// Not Found handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0',
      environment: NODE_ENV,
      services: {
        database: 'connected',
        redis: 'connected',
        socketio: 'active',
      },
    };
  } catch (error) {
    reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Protected route example
fastify.get(
  '/api/protected',
  { onRequest: [authMiddleware, tenantMiddleware] },
  async (request, reply) => {
    return {
      message: 'This is a protected route',
      user: request.user,
      accountId: request.accountId,
    };
  }
);

// Admin-only route example
fastify.get(
  '/api/admin',
  { onRequest: [authMiddleware, requireRole(['admin'])] },
  async (request, reply) => {
    return {
      message: 'This is an admin-only route',
      user: request.user,
    };
  }
);

// Public route with optional auth example
fastify.get(
  '/api/public',
  { onRequest: [optionalAuth] },
  async (request, reply) => {
    return {
      message: 'This is a public route',
      authenticated: !!request.user,
      user: request.user || null,
    };
  }
);

// Graceful shutdown
async function closeGracefully(signal: string) {
  console.log(`\n⚠️  Received signal to terminate: ${signal}`);

  try {
    // Close Socket.IO
    if (io) {
      io.close();
      console.log('✅ Socket.IO closed');
    }

    // Close Fastify (this closes the HTTP server)
    await fastify.close();
    console.log('✅ Fastify closed');

    // Close database
    await closeDatabase();
    console.log('✅ Database connection closed');

    // Close Redis
    await closeRedis();
    console.log('✅ Redis connection closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
async function start() {
  try {
    // Register plugins
    await registerPlugins();

    // Initialize WebSocket server with Fastify's HTTP server
    io = initializeWebSocketServer(fastify.server, fastify);

    // Make io available in routes via decorator
    fastify.decorate('io', io);

    // Register all API routes
    await registerRoutes(fastify);

    // Start Fastify server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log('');
    console.log('🚀 HummDesk v2 Backend Server Started');
    console.log('=====================================');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🔌 Socket.IO: Active on port ${PORT}`);
    console.log(`💾 Database: ${process.env.DB_NAME || 'hummdesk_v2'}`);
    console.log(`🔴 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
    console.log('=====================================');
    console.log('');
    console.log(getRouteSummary());
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

start();
