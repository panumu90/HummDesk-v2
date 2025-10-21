import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    accountId?: string;
  }
}

/**
 * Tenant Context Middleware
 * Extracts account_id from authenticated user and attaches to request
 * Must be used AFTER authMiddleware
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Ensure user is authenticated
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required for tenant context',
    });
  }

  // Extract and validate account_id
  const accountId = request.user.accountId;
  if (!accountId) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Missing account_id in token',
    });
  }

  // Attach account_id to request for easy access
  request.accountId = accountId;

  // Validate account_id format (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(accountId)) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Invalid account_id format',
    });
  }
}

/**
 * Validate tenant ownership of a resource
 * Ensures that the resource belongs to the authenticated user's account
 */
export function validateTenantOwnership(
  resourceAccountId: string,
  requestAccountId: string
): boolean {
  return resourceAccountId === requestAccountId;
}

/**
 * Tenant isolation helper
 * Creates a prefixed cache key for multi-tenant Redis storage
 */
export function getTenantCacheKey(accountId: string, key: string): string {
  return `tenant:${accountId}:${key}`;
}

/**
 * Extract account_id from query parameter (for public/webhook endpoints)
 * Use this for endpoints that don't require full authentication
 */
export function extractAccountIdFromQuery(request: FastifyRequest): string | null {
  const query = request.query as Record<string, any>;
  return query.account_id || null;
}

/**
 * Extract account_id from path parameter
 * Use this for RESTful routes like /accounts/:accountId/conversations
 */
export function extractAccountIdFromParams(request: FastifyRequest): string | null {
  const params = request.params as Record<string, any>;
  return params.accountId || null;
}
