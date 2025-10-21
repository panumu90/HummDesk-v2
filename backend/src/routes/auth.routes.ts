/**
 * Authentication Routes
 *
 * Endpoints:
 * - POST /api/v1/auth/register - Create account + first user
 * - POST /api/v1/auth/login - Email/password login
 * - POST /api/v1/auth/refresh - Refresh access token
 * - POST /api/v1/auth/logout - Invalidate session
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import redis from '../config/redis';
import { AccountStatus } from '../types/account';
import { AccountUserRole, AgentAvailability } from '../types/account';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  // Account details
  account_name: z.string().min(2).max(100),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),

  // Owner details
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),

  // Optional settings
  settings: z.object({
    timezone: z.string().optional(),
    default_language: z.string().optional(),
  }).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  account_id: z.number().optional(), // For users in multiple accounts
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function authRoutes(fastify: FastifyInstance) {

  /**
   * POST /api/v1/auth/register
   * Create new account with first user (owner)
   */
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await pool.connect();

    try {
      // Validate request body
      const body = registerSchema.parse(request.body);

      await client.query('BEGIN');

      // 1. Check if subdomain is available
      const subdomainCheck = await client.query(
        'SELECT id FROM accounts WHERE subdomain = $1',
        [body.subdomain]
      );

      if (subdomainCheck.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Subdomain already taken',
        });
      }

      // 2. Check if email is already registered
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [body.email]
      );

      if (emailCheck.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already registered',
        });
      }

      // 3. Create account
      const accountResult = await client.query(
        `INSERT INTO accounts (name, subdomain, settings, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, subdomain, settings, status, created_at`,
        [
          body.account_name,
          body.subdomain,
          JSON.stringify(body.settings || {}),
          AccountStatus.TRIAL,
        ]
      );

      const account = accountResult.rows[0];

      // 4. Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // 5. Create user
      const userResult = await client.query(
        `INSERT INTO users (email, name, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, email, name, avatar_url, email_verified_at, created_at`,
        [body.email, body.name, passwordHash]
      );

      const user = userResult.rows[0];

      // 6. Link user to account as owner
      await client.query(
        `INSERT INTO account_users (account_id, user_id, role, availability, current_load, max_capacity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [account.id, user.id, AccountUserRole.OWNER, AgentAvailability.ONLINE, 0, 10]
      );

      // 7. Create default inbox
      await client.query(
        `INSERT INTO inboxes (account_id, name, channel_type, channel_config, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          account.id,
          'General Support',
          'web_widget',
          JSON.stringify({}),
          JSON.stringify({ enable_continuity: true }),
        ]
      );

      await client.query('COMMIT');

      // 8. Generate JWT tokens
      const accessToken = fastify.jwt.sign({
        userId: user.id.toString(),
        accountId: account.id.toString(),
        email: user.email,
        role: AccountUserRole.OWNER,
      }, {
        expiresIn: '7d',
      });

      const refreshToken = fastify.jwt.sign({
        userId: user.id.toString(),
        accountId: account.id.toString(),
        type: 'refresh',
      }, {
        expiresIn: '30d',
      });

      // 9. Store refresh token in Redis
      await redis.setex(
        `refresh_token:${user.id}:${account.id}`,
        30 * 24 * 60 * 60, // 30 days
        refreshToken
      );

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          email_verified: !!user.email_verified_at, // Convert timestamp to boolean
        },
        account: {
          id: account.id,
          name: account.name,
          subdomain: account.subdomain,
          status: account.status,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
      });

    } catch (error) {
      await client.query('ROLLBACK');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      throw error;
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/v1/auth/login
   * Email/password authentication
   */
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);

      // 1. Find user by email
      const userResult = await pool.query(
        `SELECT id, email, name, avatar_url, password_hash, email_verified_at
         FROM users
         WHERE email = $1`,
        [body.email]
      );

      if (userResult.rows.length === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      const user = userResult.rows[0];

      // 2. Verify password
      const passwordMatch = await bcrypt.compare(body.password, user.password_hash);

      if (!passwordMatch) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      // 3. Get user's accounts (both ACTIVE and TRIAL)
      const accountsResult = await pool.query(
        `SELECT a.id, a.name, a.subdomain, a.status, au.role
         FROM accounts a
         JOIN account_users au ON a.id = au.account_id
         WHERE au.user_id = $1 AND a.status IN ($2, $3)
         ORDER BY au.created_at ASC`,
        [user.id, AccountStatus.ACTIVE, AccountStatus.TRIAL]
      );

      if (accountsResult.rows.length === 0) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No active or trial accounts found',
        });
      }

      // 4. Select account (first one or specified account_id)
      let selectedAccount = accountsResult.rows[0];

      if (body.account_id) {
        const found = accountsResult.rows.find((a: any) => a.id === body.account_id);
        if (found) {
          selectedAccount = found;
        }
      }

      // 5. Generate JWT tokens
      const accessToken = fastify.jwt.sign({
        userId: user.id.toString(),
        accountId: selectedAccount.id.toString(),
        email: user.email,
        role: selectedAccount.role,
      }, {
        expiresIn: '7d',
      });

      const refreshToken = fastify.jwt.sign({
        userId: user.id.toString(),
        accountId: selectedAccount.id.toString(),
        type: 'refresh',
      }, {
        expiresIn: '30d',
      });

      // 6. Store refresh token in Redis (temporarily disabled due to Redis auth issues)
      try {
        await redis.setex(
          `refresh_token:${user.id}:${selectedAccount.id}`,
          30 * 24 * 60 * 60,
          refreshToken
        );
      } catch (redisError) {
        fastify.log.warn('Redis setex failed, continuing without refresh token storage');
      }

      // 7. Update last_seen_at
      await pool.query(
        'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
        [user.id]
      );

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          email_verified: !!user.email_verified_at, // Convert timestamp to boolean
        },
        account: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          subdomain: selectedAccount.subdomain,
          status: selectedAccount.status,
          role: selectedAccount.role,
        },
        accounts: accountsResult.rows, // All available accounts
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 7 * 24 * 60 * 60,
      });

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
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = refreshSchema.parse(request.body);

      // 1. Verify refresh token
      const decoded = await fastify.jwt.verify(body.refresh_token) as any;

      if (decoded.type !== 'refresh') {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid token type',
        });
      }

      // 2. Check if token exists in Redis
      const storedToken = await redis.get(
        `refresh_token:${decoded.userId}:${decoded.accountId}`
      );

      if (storedToken !== body.refresh_token) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Refresh token revoked or expired',
        });
      }

      // 3. Get user and account info
      const userResult = await pool.query(
        `SELECT u.id, u.email, u.name, au.role
         FROM users u
         JOIN account_users au ON u.id = au.user_id
         WHERE u.id = $1 AND au.account_id = $2`,
        [parseInt(decoded.userId), parseInt(decoded.accountId)]
      );

      if (userResult.rows.length === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid user or account',
        });
      }

      const user = userResult.rows[0];

      // 4. Generate new access token
      const accessToken = fastify.jwt.sign({
        userId: decoded.userId,
        accountId: decoded.accountId,
        email: user.email,
        role: user.role,
      }, {
        expiresIn: '7d',
      });

      return reply.send({
        access_token: accessToken,
        expires_in: 7 * 24 * 60 * 60,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors,
        });
      }

      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });

  /**
   * POST /api/v1/auth/logout
   * Invalidate refresh token (logout)
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract user from JWT (requires Authorization header)
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing Authorization header',
        });
      }

      const token = authHeader.substring(7);
      const decoded = await fastify.jwt.verify(token) as any;

      // Delete refresh token from Redis
      await redis.del(`refresh_token:${decoded.userId}:${decoded.accountId}`);

      return reply.send({
        message: 'Logged out successfully',
      });

    } catch (error) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }
  });
}
