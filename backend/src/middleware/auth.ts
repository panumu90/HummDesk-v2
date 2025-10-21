import { FastifyRequest, FastifyReply } from 'fastify';

export interface JWTPayload {
  userId: string;
  accountId: string;
  email: string;
  role: 'admin' | 'agent' | 'viewer';
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user payload to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    // Development bypass - allow requests with "dev" token or no auth
    if (!authHeader || authHeader === 'Bearer dev' || authHeader === 'dev') {
      request.user = {
        userId: '00000000-0000-4000-8000-000000000001',
        accountId: '00000000-0000-4000-8000-000000000001',
        email: 'dev@hummdesk.com',
        role: 'admin'
      };
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token using Fastify JWT plugin
    const decoded = await request.jwtVerify<JWTPayload>({ token });

    // Attach user payload to request
    request.user = decoded as JWTPayload;

    // Validate required fields
    if (!request.user.userId || !request.user.accountId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token payload',
      });
    }
  } catch (error) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Token verification failed',
    });
  }
}

/**
 * Role-based authorization middleware factory
 * Usage: server.addHook('onRequest', requireRole(['admin', 'agent']))
 */
export function requireRole(allowedRoles: Array<'admin' | 'agent' | 'viewer'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`,
      });
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for public endpoints that change behavior when authenticated
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await request.jwtVerify<JWTPayload>({ token });
      request.user = decoded as JWTPayload;
    }
  } catch (error) {
    // Silently ignore authentication errors for optional auth
    request.user = undefined;
  }
}
