/**
 * Teams Routes
 *
 * Endpoints:
 * - GET /api/v1/teams - List teams
 * - POST /api/v1/teams - Create team
 * - GET /api/v1/teams/:id - Get team detail
 * - PATCH /api/v1/teams/:id - Update team
 * - GET /api/v1/teams/:id/agents - List team agents
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  settings: z.object({
    color: z.string().optional(),
    icon: z.string().optional(),
    working_hours: z.record(z.object({
      start: z.string(),
      end: z.string(),
    })).optional(),
    auto_assignment: z.object({
      enabled: z.boolean(),
      strategy: z.enum(['round_robin', 'least_loaded', 'best_csat']),
    }).optional(),
    sla: z.object({
      first_response_minutes: z.number().optional(),
      resolution_hours: z.number().optional(),
    }).optional(),
  }).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.object({
    color: z.string().optional(),
    icon: z.string().optional(),
    working_hours: z.record(z.object({
      start: z.string(),
      end: z.string(),
    })).optional(),
    auto_assignment: z.object({
      enabled: z.boolean(),
      strategy: z.enum(['round_robin', 'least_loaded', 'best_csat']),
    }).optional(),
    sla: z.object({
      first_response_minutes: z.number().optional(),
      resolution_hours: z.number().optional(),
    }).optional(),
  }).optional(),
});

const addTeamMemberSchema = z.object({
  account_user_id: z.number(),
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function teamsRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  /**
   * GET /api/v1/teams
   * List all teams with statistics
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);

      const result = await pool.query(
        `SELECT
           t.id,
           t.account_id,
           t.name,
           t.description,
           t.settings,
           t.created_at,
           t.updated_at,

           -- Count online agents
           COUNT(au.id) FILTER (WHERE au.availability = 'online')::int as online_agents,

           -- Count total agents
           COUNT(au.id)::int as total_agents,

           -- Calculate utilization (current load / total capacity)
           CASE
             WHEN SUM(au.max_capacity) = 0 THEN 0
             ELSE ROUND((SUM(au.current_load)::float / SUM(au.max_capacity)::float) * 100)::int
           END as utilization,

           -- Average CSAT score (placeholder - would need actual CSAT data)
           0::float as avg_csat,

           -- SLA compliance (placeholder)
           0::float as sla_compliance

         FROM teams t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         LEFT JOIN account_users au ON tm.account_user_id = au.id
         WHERE t.account_id = $1
         GROUP BY t.id, t.account_id, t.name, t.description, t.settings, t.created_at, t.updated_at
         ORDER BY t.name ASC`,
        [accountId]
      );

      return reply.send({
        data: result.rows,
        meta: {
          total: result.rows.length,
        },
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * POST /api/v1/teams
   * Create a new team (admin only)
   */
  fastify.post(
    '/',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const body = createTeamSchema.parse(request.body);

        // Check if team name already exists
        const existingTeam = await pool.query(
          'SELECT id FROM teams WHERE account_id = $1 AND name = $2',
          [accountId, body.name]
        );

        if (existingTeam.rows.length > 0) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Team name already exists',
          });
        }

        // Create team
        const result = await pool.query(
          `INSERT INTO teams (account_id, name, description, settings, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING *`,
          [
            accountId,
            body.name,
            body.description,
            JSON.stringify(body.settings || {}),
          ]
        );

        const team = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('team:created', {
          type: 'team:created',
          data: team,
        });

        return reply.status(201).send(team);

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
   * GET /api/v1/teams/:id
   * Get team detail with full statistics
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const teamId = parseInt(request.params.id);

      const result = await pool.query(
        `SELECT
           t.id,
           t.account_id,
           t.name,
           t.description,
           t.settings,
           t.created_at,
           t.updated_at,

           COUNT(au.id) FILTER (WHERE au.availability = 'online')::int as online_agents,
           COUNT(au.id)::int as total_agents,

           CASE
             WHEN SUM(au.max_capacity) = 0 THEN 0
             ELSE ROUND((SUM(au.current_load)::float / SUM(au.max_capacity)::float) * 100)::int
           END as utilization,

           0::float as avg_csat,
           0::float as sla_compliance

         FROM teams t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         LEFT JOIN account_users au ON tm.account_user_id = au.id
         WHERE t.id = $1 AND t.account_id = $2
         GROUP BY t.id`,
        [teamId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Team not found',
        });
      }

      return reply.send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * PATCH /api/v1/teams/:id
   * Update team (admin only)
   */
  fastify.patch(
    '/:id',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const teamId = parseInt(request.params.id);
        const body = updateTeamSchema.parse(request.body);

        // Verify team exists and belongs to account
        const teamCheck = await pool.query(
          'SELECT id FROM teams WHERE id = $1 AND account_id = $2',
          [teamId, accountId]
        );

        if (teamCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Team not found',
          });
        }

        // Build dynamic UPDATE clause
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (body.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          params.push(body.name);
        }

        if (body.description !== undefined) {
          updates.push(`description = $${paramIndex++}`);
          params.push(body.description);
        }

        if (body.settings !== undefined) {
          updates.push(`settings = $${paramIndex++}`);
          params.push(JSON.stringify(body.settings));
        }

        updates.push('updated_at = NOW()');

        if (updates.length === 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No fields to update',
          });
        }

        params.push(teamId, accountId);

        // Execute update
        const result = await pool.query(
          `UPDATE teams
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND account_id = $${paramIndex++}
           RETURNING *`,
          params
        );

        const updated = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('team:updated', {
          type: 'team:updated',
          data: updated,
        });

        return reply.send(updated);

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
   * DELETE /api/v1/teams/:id
   * Delete team (admin only)
   */
  fastify.delete(
    '/:id',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const client = await pool.connect();

      try {
        const accountId = parseInt(request.accountId!);
        const teamId = parseInt(request.params.id);

        await client.query('BEGIN');

        // Verify team exists
        const teamCheck = await client.query(
          'SELECT id FROM teams WHERE id = $1 AND account_id = $2',
          [teamId, accountId]
        );

        if (teamCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Team not found',
          });
        }

        // Check if team has active conversations
        const activeConversations = await client.query(
          `SELECT COUNT(*)::int as count
           FROM conversations
           WHERE team_id = $1 AND status IN ('open', 'pending')`,
          [teamId]
        );

        if (activeConversations.rows[0].count > 0) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Cannot delete team with active conversations',
          });
        }

        // Delete team members
        await client.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);

        // Delete team
        await client.query('DELETE FROM teams WHERE id = $1', [teamId]);

        await client.query('COMMIT');

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('team:deleted', {
          type: 'team:deleted',
          data: { id: teamId },
        });

        return reply.status(204).send();

      } catch (error) {
        await client.query('ROLLBACK');
        fastify.log.error(error);
        throw error;
      } finally {
        client.release();
      }
    }
  );

  /**
   * GET /api/v1/teams/:id/agents
   * List all agents in a team
   */
  fastify.get('/:id/agents', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const teamId = parseInt(request.params.id);

      // Verify team exists
      const teamCheck = await pool.query(
        'SELECT id FROM teams WHERE id = $1 AND account_id = $2',
        [teamId, accountId]
      );

      if (teamCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Team not found',
        });
      }

      // Fetch team members with performance data
      const result = await pool.query(
        `SELECT
           tm.id,
           tm.team_id,
           tm.account_user_id,
           tm.created_at,

           json_build_object(
             'id', u.id,
             'name', u.name,
             'email', u.email,
             'avatar_url', u.avatar_url
           ) as user,

           au.availability,
           au.current_load,
           au.max_capacity,

           -- Performance metrics (placeholder - would need actual CSAT/metrics tables)
           json_build_object(
             'avg_response_time', 0,
             'csat_score', 0,
             'resolution_rate', 0
           ) as performance

         FROM team_members tm
         JOIN account_users au ON tm.account_user_id = au.id
         JOIN users u ON au.user_id = u.id
         WHERE tm.team_id = $1
         ORDER BY u.name ASC`,
        [teamId]
      );

      return reply.send({
        data: result.rows,
        meta: {
          team_id: teamId,
          total: result.rows.length,
        },
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * POST /api/v1/teams/:id/agents
   * Add an agent to a team (admin only)
   */
  fastify.post(
    '/:id/agents',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const teamId = parseInt(request.params.id);
        const body = addTeamMemberSchema.parse(request.body);

        // Verify team exists
        const teamCheck = await pool.query(
          'SELECT id FROM teams WHERE id = $1 AND account_id = $2',
          [teamId, accountId]
        );

        if (teamCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Team not found',
          });
        }

        // Verify account_user exists and belongs to account
        const userCheck = await pool.query(
          'SELECT id FROM account_users WHERE id = $1 AND account_id = $2',
          [body.account_user_id, accountId]
        );

        if (userCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'User not found in this account',
          });
        }

        // Check if already a member
        const memberCheck = await pool.query(
          'SELECT id FROM team_members WHERE team_id = $1 AND account_user_id = $2',
          [teamId, body.account_user_id]
        );

        if (memberCheck.rows.length > 0) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'User is already a member of this team',
          });
        }

        // Add team member
        const result = await pool.query(
          `INSERT INTO team_members (team_id, account_user_id, created_at)
           VALUES ($1, $2, NOW())
           RETURNING *`,
          [teamId, body.account_user_id]
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
    }
  );

  /**
   * DELETE /api/v1/teams/:id/agents/:agentId
   * Remove an agent from a team (admin only)
   */
  fastify.delete(
    '/:id/agents/:agentId',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string; agentId: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const teamId = parseInt(request.params.id);
        const accountUserId = parseInt(request.params.agentId);

        // Verify team exists
        const teamCheck = await pool.query(
          'SELECT id FROM teams WHERE id = $1 AND account_id = $2',
          [teamId, accountId]
        );

        if (teamCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Team not found',
          });
        }

        // Remove team member
        const result = await pool.query(
          'DELETE FROM team_members WHERE team_id = $1 AND account_user_id = $2 RETURNING id',
          [teamId, accountUserId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Team member not found',
          });
        }

        return reply.status(204).send();

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );
}
