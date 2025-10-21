/**
 * Contacts Routes
 *
 * Endpoints:
 * - POST /api/v1/contacts/find-or-create - Find existing contact or create new
 * - GET /api/v1/contacts - List contacts
 * - GET /api/v1/contacts/:id - Get contact detail
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const findOrCreateContactSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().optional(),
  custom_attributes: z.record(z.any()).optional(),
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function contactsRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  /**
   * POST /api/v1/contacts/find-or-create
   * Find existing contact by email or create new one
   */
  fastify.post('/find-or-create', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const body = findOrCreateContactSchema.parse(request.body);

      // Try to find existing contact
      const existingContact = await pool.query(
        'SELECT * FROM contacts WHERE account_id = $1 AND email = $2',
        [accountId, body.email]
      );

      if (existingContact.rows.length > 0) {
        // Contact exists, return it
        return reply.send(existingContact.rows[0]);
      }

      // Create new contact
      const result = await pool.query(
        `INSERT INTO contacts (
           account_id, email, name, phone, avatar_url, custom_attributes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          accountId,
          body.email,
          body.name || body.email.split('@')[0],
          body.phone || null,
          body.avatar_url || null,
          JSON.stringify(body.custom_attributes || {}),
        ]
      );

      return reply.status(201).send(result.rows[0]);

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
  });

  /**
   * GET /api/v1/contacts
   * List contacts with pagination
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const { page = 1, limit = 50, query = '' } = request.query as any;

      const offset = (page - 1) * limit;
      const searchPattern = `%${query}%`;

      // Count total
      const countResult = await pool.query(
        `SELECT COUNT(*)::int as total
         FROM contacts
         WHERE account_id = $1
           AND (name ILIKE $2 OR email ILIKE $2)`,
        [accountId, searchPattern]
      );

      const total = countResult.rows[0].total;

      // Fetch contacts
      const result = await pool.query(
        `SELECT *
         FROM contacts
         WHERE account_id = $1
           AND (name ILIKE $2 OR email ILIKE $2)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [accountId, searchPattern, limit, offset]
      );

      return reply.send({
        data: result.rows,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * GET /api/v1/contacts/:id
   * Get contact detail
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const contactId = parseInt(request.params.id);

      const result = await pool.query(
        'SELECT * FROM contacts WHERE id = $1 AND account_id = $2',
        [contactId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Contact not found',
        });
      }

      return reply.send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });
}
