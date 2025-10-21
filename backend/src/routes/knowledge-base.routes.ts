/**
 * Knowledge Base Routes
 *
 * Endpoints:
 * - GET /api/v1/knowledge-base - List articles
 * - POST /api/v1/knowledge-base - Create article
 * - GET /api/v1/knowledge-base/:id - Get article detail
 * - PATCH /api/v1/knowledge-base/:id - Update article
 * - DELETE /api/v1/knowledge-base/:id - Delete article
 * - POST /api/v1/knowledge-base/search - Semantic search
 * - GET /api/v1/knowledge-base/:id/related - Find related articles
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pool from '../config/database';
import { authMiddleware, requireRole } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createArticleSchema = z.object({
  title: z.string().min(5).max(512),
  content: z.string().min(20),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

const updateArticleSchema = z.object({
  title: z.string().min(5).max(512).optional(),
  content: z.string().min(20).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

const searchSchema = z.object({
  query: z.string().min(2).max(500),
  limit: z.number().int().min(1).max(50).optional(),
  category: z.string().max(100).optional(),
  min_relevance: z.number().min(0).max(1).optional(),
});

// ============================================================================
// HELPER: Generate embedding using simple hash (placeholder)
// ============================================================================

/**
 * Generates a deterministic 1536-dimensional embedding vector
 * This is a PLACEHOLDER - in production, use Claude or OpenAI embeddings
 */
function generateSimpleEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0);

  // Simple hash-based pseudo-embedding for demo purposes
  for (let i = 0; i < text.length && i < 1536; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % 1536] += Math.sin(charCode * 0.1) * 0.5;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export default async function knowledgeBaseRoutes(fastify: FastifyInstance) {

  // Apply auth and tenant middleware to all routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', tenantMiddleware);

  /**
   * GET /api/v1/knowledge-base
   * List all articles with optional filtering
   */
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      category?: string;
      published?: string;
      limit?: string;
      offset?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const category = request.query.category;
      const published = request.query.published === 'true' ? true : request.query.published === 'false' ? false : undefined;
      const limit = parseInt(request.query.limit || '50');
      const offset = parseInt(request.query.offset || '0');

      let query = `
        SELECT
          id,
          account_id,
          title,
          content,
          category,
          tags,
          view_count,
          helpful_count,
          published,
          published_at,
          created_at,
          updated_at
        FROM knowledge_base_articles
        WHERE account_id = $1
      `;
      const params: any[] = [accountId];
      let paramIndex = 2;

      if (category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(category);
      }

      if (published !== undefined) {
        query += ` AND published = $${paramIndex++}`;
        params.push(published);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*)::int as total FROM knowledge_base_articles WHERE account_id = $1';
      const countParams: any[] = [accountId];
      let countParamIndex = 2;

      if (category) {
        countQuery += ` AND category = $${countParamIndex++}`;
        countParams.push(category);
      }

      if (published !== undefined) {
        countQuery += ` AND published = $${countParamIndex++}`;
        countParams.push(published);
      }

      const countResult = await pool.query(countQuery, countParams);

      return reply.send({
        data: result.rows,
        meta: {
          total: countResult.rows[0].total,
          limit,
          offset,
        },
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * POST /api/v1/knowledge-base
   * Create a new knowledge base article (admin only)
   */
  fastify.post(
    '/',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const body = createArticleSchema.parse(request.body);

        // Generate embedding
        const embedding = generateSimpleEmbedding(body.content);
        const embeddingStr = `[${embedding.join(',')}]`;

        // Create article
        const result = await pool.query(
          `INSERT INTO knowledge_base_articles (
            account_id,
            title,
            content,
            category,
            tags,
            embedding,
            view_count,
            helpful_count,
            published,
            published_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::vector, 0, 0, $7, $8, NOW(), NOW())
          RETURNING *`,
          [
            accountId,
            body.title,
            body.content,
            body.category || 'general',
            body.tags || [],
            embeddingStr,
            body.published !== undefined ? body.published : true,
            body.published !== false ? new Date() : null,
          ]
        );

        const article = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('kb_article:created', {
          type: 'kb_article:created',
          data: article,
        });

        return reply.status(201).send(article);

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
   * GET /api/v1/knowledge-base/:id
   * Get article detail
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const articleId = parseInt(request.params.id);

      const result = await pool.query(
        `SELECT
          id,
          account_id,
          title,
          content,
          category,
          tags,
          view_count,
          helpful_count,
          published,
          published_at,
          created_at,
          updated_at
        FROM knowledge_base_articles
        WHERE id = $1 AND account_id = $2`,
        [articleId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Article not found',
        });
      }

      // Increment view count
      await pool.query(
        'UPDATE knowledge_base_articles SET view_count = view_count + 1 WHERE id = $1',
        [articleId]
      );

      return reply.send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * PATCH /api/v1/knowledge-base/:id
   * Update article (admin only)
   */
  fastify.patch(
    '/:id',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const articleId = parseInt(request.params.id);
        const body = updateArticleSchema.parse(request.body);

        // Verify article exists
        const articleCheck = await pool.query(
          'SELECT id, content FROM knowledge_base_articles WHERE id = $1 AND account_id = $2',
          [articleId, accountId]
        );

        if (articleCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Article not found',
          });
        }

        // Build dynamic UPDATE clause
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (body.title !== undefined) {
          updates.push(`title = $${paramIndex++}`);
          params.push(body.title);
        }

        if (body.content !== undefined) {
          updates.push(`content = $${paramIndex++}`);
          params.push(body.content);

          // Regenerate embedding if content changed
          const embedding = generateSimpleEmbedding(body.content);
          const embeddingStr = `[${embedding.join(',')}]`;
          updates.push(`embedding = $${paramIndex++}::vector`);
          params.push(embeddingStr);
        }

        if (body.category !== undefined) {
          updates.push(`category = $${paramIndex++}`);
          params.push(body.category);
        }

        if (body.tags !== undefined) {
          updates.push(`tags = $${paramIndex++}`);
          params.push(body.tags);
        }

        if (body.published !== undefined) {
          updates.push(`published = $${paramIndex++}`);
          params.push(body.published);

          // Update published_at timestamp
          if (body.published && !articleCheck.rows[0].published) {
            updates.push(`published_at = NOW()`);
          } else if (!body.published) {
            updates.push(`published_at = NULL`);
          }
        }

        updates.push('updated_at = NOW()');

        if (updates.length === 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No fields to update',
          });
        }

        params.push(articleId, accountId);

        // Execute update
        const result = await pool.query(
          `UPDATE knowledge_base_articles
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND account_id = $${paramIndex++}
           RETURNING *`,
          params
        );

        const updated = result.rows[0];

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('kb_article:updated', {
          type: 'kb_article:updated',
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
   * DELETE /api/v1/knowledge-base/:id
   * Delete article (admin only)
   */
  fastify.delete(
    '/:id',
    { onRequest: [requireRole(['admin', 'owner'])] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const accountId = parseInt(request.accountId!);
        const articleId = parseInt(request.params.id);

        // Verify article exists
        const articleCheck = await pool.query(
          'SELECT id FROM knowledge_base_articles WHERE id = $1 AND account_id = $2',
          [articleId, accountId]
        );

        if (articleCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Article not found',
          });
        }

        // Delete article
        await pool.query(
          'DELETE FROM knowledge_base_articles WHERE id = $1',
          [articleId]
        );

        // Broadcast to WebSocket
        fastify.io.to(`account:${accountId}`).emit('kb_article:deleted', {
          type: 'kb_article:deleted',
          data: { id: articleId },
        });

        return reply.status(204).send();

      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/knowledge-base/search
   * Semantic search using pgvector
   */
  fastify.post('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const body = searchSchema.parse(request.body);

      const limit = body.limit || 5;
      const minRelevance = body.min_relevance || 0.7;

      // Generate query embedding
      const queryEmbedding = generateSimpleEmbedding(body.query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Semantic search using pgvector cosine similarity
      let query = `
        SELECT
          id,
          account_id,
          title,
          content,
          category,
          tags,
          view_count,
          helpful_count,
          published,
          published_at,
          created_at,
          updated_at,
          1 - (embedding <=> $1::vector) as relevance
        FROM knowledge_base_articles
        WHERE account_id = $2
          AND published = true
          AND (1 - (embedding <=> $1::vector)) >= $3
      `;
      const params: any[] = [embeddingStr, accountId, minRelevance];
      let paramIndex = 4;

      if (body.category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(body.category);
      }

      query += ` ORDER BY relevance DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);

      // Format results with excerpts
      const searchResults = result.rows.map((row) => {
        // Extract relevant excerpt (find first occurrence of query terms)
        const queryWords = body.query.toLowerCase().split(/\s+/);
        const sentences = row.content.split(/[.!?]+/);

        let bestSentence = sentences[0] || '';
        let bestScore = 0;

        for (const sentence of sentences) {
          const sentenceLower = sentence.toLowerCase();
          const score = queryWords.filter((word: string) => sentenceLower.includes(word)).length;

          if (score > bestScore) {
            bestScore = score;
            bestSentence = sentence;
          }
        }

        const excerpt = bestSentence.length > 200
          ? bestSentence.substring(0, 200) + '...'
          : bestSentence.trim();

        return {
          id: row.id,
          title: row.title,
          excerpt,
          category: row.category,
          tags: row.tags,
          relevance: parseFloat(row.relevance),
          view_count: row.view_count,
          helpful_count: row.helpful_count,
        };
      });

      return reply.send({
        data: searchResults,
        meta: {
          query: body.query,
          total: searchResults.length,
        },
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
   * GET /api/v1/knowledge-base/:id/related
   * Find related articles using semantic similarity
   */
  fastify.get('/:id/related', async (request: FastifyRequest<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const articleId = parseInt(request.params.id);
      const limit = parseInt(request.query.limit || '5');

      // Get the article's embedding
      const articleResult = await pool.query(
        'SELECT embedding FROM knowledge_base_articles WHERE id = $1 AND account_id = $2',
        [articleId, accountId]
      );

      if (articleResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Article not found',
        });
      }

      const embedding = articleResult.rows[0].embedding;

      // Find similar articles
      const result = await pool.query(
        `SELECT
          id,
          title,
          category,
          tags,
          view_count,
          helpful_count,
          1 - (embedding <=> $1) as similarity
        FROM knowledge_base_articles
        WHERE account_id = $2
          AND id != $3
          AND published = true
        ORDER BY similarity DESC
        LIMIT $4`,
        [embedding, accountId, articleId, limit]
      );

      return reply.send({
        data: result.rows,
        meta: {
          article_id: articleId,
          total: result.rows.length,
        },
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  /**
   * POST /api/v1/knowledge-base/:id/helpful
   * Mark article as helpful
   */
  fastify.post('/:id/helpful', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const accountId = parseInt(request.accountId!);
      const articleId = parseInt(request.params.id);

      const result = await pool.query(
        `UPDATE knowledge_base_articles
         SET helpful_count = helpful_count + 1
         WHERE id = $1 AND account_id = $2
         RETURNING helpful_count`,
        [articleId, accountId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Article not found',
        });
      }

      return reply.send({
        helpful_count: result.rows[0].helpful_count,
      });

    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });
}
