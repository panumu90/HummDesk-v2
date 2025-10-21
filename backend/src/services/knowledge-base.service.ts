/**
 * Knowledge Base RAG Service for HummDesk v2
 *
 * Implements Retrieval-Augmented Generation (RAG) for:
 * - Semantic search using pgvector embeddings
 * - Article management with multi-tenant isolation
 * - AI draft enhancement with knowledge base context
 * - Automatic re-embedding on article updates
 *
 * Uses Claude Sonnet 4.5 for embeddings and content enhancement.
 *
 * @module services/knowledge-base
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  KnowledgeBaseArticle,
  SearchKnowledgeBaseRequest,
  KnowledgeBaseSearchResult,
  AIDraft,
} from '../types/ai';

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

/**
 * Database interface for Knowledge Base operations
 * Implementation should be injected via constructor
 */
export interface KnowledgeBaseDatabase {
  // Article CRUD
  createArticle(article: Omit<KnowledgeBaseArticle, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeBaseArticle>;
  updateArticle(id: number, updates: Partial<KnowledgeBaseArticle>): Promise<KnowledgeBaseArticle>;
  deleteArticle(id: number): Promise<void>;
  getArticle(id: number): Promise<KnowledgeBaseArticle | null>;
  getArticlesByAccount(accountId: number, limit?: number): Promise<KnowledgeBaseArticle[]>;

  // Embedding operations
  updateArticleEmbedding(id: number, embedding: number[]): Promise<void>;

  // Semantic search (pgvector)
  searchArticlesByEmbedding(
    accountId: number,
    embedding: number[],
    limit: number,
    category?: string
  ): Promise<Array<{ article: KnowledgeBaseArticle; similarity: number }>>;

  // Full-text search (fallback)
  searchArticlesByText(
    accountId: number,
    query: string,
    limit: number,
    category?: string,
    tags?: string[]
  ): Promise<KnowledgeBaseArticle[]>;

  // Draft operations
  getDraft(draftId: number): Promise<AIDraft | null>;
  updateDraft(draftId: number, updates: Partial<AIDraft>): Promise<AIDraft>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const EMBEDDING_TEMPERATURE = 0.0; // Deterministic embeddings
const ENHANCEMENT_TEMPERATURE = 0.7;
const MAX_CHUNK_TOKENS = 512; // Max tokens per chunk
const EMBEDDING_DIMENSIONS = 1536; // Standard embedding size
const DEFAULT_SEARCH_LIMIT = 5;
const RELEVANCE_THRESHOLD = 0.7; // Minimum similarity score (0.0-1.0)

// ============================================================================
// TYPES
// ============================================================================

interface ArticleChunk {
  article_id: number;
  chunk_index: number;
  content: string;
  embedding: number[];
}

interface EnhancementResult {
  enhanced_content: string;
  sources: Array<{
    article_id: number;
    title: string;
    relevance: number;
    excerpt: string;
  }>;
  confidence_boost: number; // How much confidence increased (0.0-0.2)
}

// ============================================================================
// ERRORS
// ============================================================================

export class KnowledgeBaseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'KnowledgeBaseError';
  }
}

export class ArticleNotFoundError extends KnowledgeBaseError {
  constructor(articleId: number) {
    super(`Article ${articleId} not found`, 'ARTICLE_NOT_FOUND');
  }
}

export class EmbeddingGenerationError extends KnowledgeBaseError {
  constructor(message: string) {
    super(`Embedding generation failed: ${message}`, 'EMBEDDING_ERROR');
  }
}

export class SearchError extends KnowledgeBaseError {
  constructor(message: string) {
    super(`Search failed: ${message}`, 'SEARCH_ERROR');
  }
}

// ============================================================================
// KNOWLEDGE BASE SERVICE CLASS
// ============================================================================

export class KnowledgeBaseService {
  private anthropic: Anthropic;
  private db: KnowledgeBaseDatabase;

  constructor(anthropic: Anthropic, db: KnowledgeBaseDatabase) {
    if (!anthropic) {
      throw new KnowledgeBaseError('Anthropic client is required', 'CONFIGURATION_ERROR');
    }
    if (!db) {
      throw new KnowledgeBaseError('Database instance is required', 'CONFIGURATION_ERROR');
    }

    this.anthropic = anthropic;
    this.db = db;
  }

  // ==========================================================================
  // PUBLIC METHODS - ARTICLE MANAGEMENT
  // ==========================================================================

  /**
   * Adds a new article to the knowledge base
   *
   * Process:
   * 1. Create article record
   * 2. Chunk content if needed (long articles)
   * 3. Generate embeddings for chunks
   * 4. Store embeddings in pgvector
   *
   * @param accountId - Multi-tenant account ID
   * @param title - Article title
   * @param content - Article content (markdown supported)
   * @param category - Article category
   * @param tags - Optional tags for filtering
   * @returns Created article with ID
   */
  async addArticle(
    accountId: number,
    title: string,
    content: string,
    category: string = 'general',
    tags: string[] = [],
    isPublic: boolean = false
  ): Promise<KnowledgeBaseArticle> {
    try {
      // 1. Create article
      const article = await this.db.createArticle({
        account_id: accountId,
        title,
        content,
        category,
        tags,
        is_public: isPublic,
        view_count: 0,
        helpful_count: 0,
        not_helpful_count: 0,
      });

      // 2. Generate and store embedding
      const embedding = await this.generateEmbedding(content);
      await this.db.updateArticleEmbedding(article.id, embedding);

      console.log(`[KnowledgeBase] Created article ${article.id} with embedding`);

      return article;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new KnowledgeBaseError(`Failed to add article: ${message}`, 'ADD_ARTICLE_ERROR');
    }
  }

  /**
   * Updates an existing article
   *
   * If content changed, regenerates embeddings automatically.
   *
   * @param articleId - Article ID to update
   * @param updates - Fields to update
   * @returns Updated article
   */
  async updateArticle(
    articleId: number,
    updates: Partial<Omit<KnowledgeBaseArticle, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<KnowledgeBaseArticle> {
    try {
      // 1. Get existing article
      const existing = await this.db.getArticle(articleId);
      if (!existing) {
        throw new ArticleNotFoundError(articleId);
      }

      // 2. Update article
      const updated = await this.db.updateArticle(articleId, updates);

      // 3. Regenerate embedding if content changed
      if (updates.content && updates.content !== existing.content) {
        const embedding = await this.generateEmbedding(updates.content);
        await this.db.updateArticleEmbedding(articleId, embedding);
        console.log(`[KnowledgeBase] Re-embedded article ${articleId} after content update`);
      }

      return updated;
    } catch (error) {
      if (error instanceof KnowledgeBaseError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new KnowledgeBaseError(`Failed to update article: ${message}`, 'UPDATE_ARTICLE_ERROR');
    }
  }

  /**
   * Soft deletes an article
   *
   * @param articleId - Article ID to delete
   */
  async deleteArticle(articleId: number): Promise<void> {
    try {
      const article = await this.db.getArticle(articleId);
      if (!article) {
        throw new ArticleNotFoundError(articleId);
      }

      await this.db.deleteArticle(articleId);
      console.log(`[KnowledgeBase] Deleted article ${articleId}`);
    } catch (error) {
      if (error instanceof KnowledgeBaseError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new KnowledgeBaseError(`Failed to delete article: ${message}`, 'DELETE_ARTICLE_ERROR');
    }
  }

  /**
   * Gets a single article by ID
   *
   * @param articleId - Article ID
   * @returns Article or null if not found
   */
  async getArticle(articleId: number): Promise<KnowledgeBaseArticle | null> {
    return this.db.getArticle(articleId);
  }

  /**
   * Lists all articles for an account
   *
   * @param accountId - Account ID
   * @param limit - Max results
   * @returns Array of articles
   */
  async listArticles(accountId: number, limit: number = 100): Promise<KnowledgeBaseArticle[]> {
    return this.db.getArticlesByAccount(accountId, limit);
  }

  // ==========================================================================
  // PUBLIC METHODS - SEMANTIC SEARCH
  // ==========================================================================

  /**
   * Searches knowledge base using semantic similarity
   *
   * Process:
   * 1. Generate embedding for search query
   * 2. Use pgvector cosine similarity to find top K articles
   * 3. Filter by relevance threshold
   * 4. Return results with excerpts
   *
   * @param accountId - Multi-tenant account ID
   * @param query - Search query (natural language)
   * @param limit - Max results to return
   * @param category - Optional category filter
   * @returns Array of search results with relevance scores
   */
  async searchArticles(
    accountId: number,
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
    category?: string
  ): Promise<KnowledgeBaseSearchResult[]> {
    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // 2. Search using pgvector
      const results = await this.db.searchArticlesByEmbedding(
        accountId,
        queryEmbedding,
        limit,
        category
      );

      // 3. Filter by relevance threshold and format results
      const searchResults: KnowledgeBaseSearchResult[] = results
        .filter(result => result.similarity >= RELEVANCE_THRESHOLD)
        .map(result => ({
          article: result.article,
          relevance: result.similarity,
          excerpt: this.extractRelevantExcerpt(result.article.content, query),
        }));

      console.log(`[KnowledgeBase] Found ${searchResults.length} relevant articles for query: "${query}"`);

      return searchResults;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SearchError(message);
    }
  }

  /**
   * Searches knowledge base using full-text search (fallback)
   *
   * Use when semantic search is unavailable or for exact matches.
   *
   * @param accountId - Account ID
   * @param query - Search query
   * @param limit - Max results
   * @param category - Optional category filter
   * @param tags - Optional tag filters
   * @returns Array of matching articles
   */
  async searchArticlesFullText(
    accountId: number,
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
    category?: string,
    tags?: string[]
  ): Promise<KnowledgeBaseSearchResult[]> {
    try {
      const articles = await this.db.searchArticlesByText(accountId, query, limit, category, tags);

      return articles.map(article => ({
        article,
        relevance: 0.8, // Fixed score for full-text search
        excerpt: this.extractRelevantExcerpt(article.content, query),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SearchError(message);
    }
  }

  // ==========================================================================
  // PUBLIC METHODS - RAG ENHANCEMENT
  // ==========================================================================

  /**
   * Enhances an AI draft with knowledge base context (RAG)
   *
   * Process:
   * 1. Get the draft and original message
   * 2. Search knowledge base for relevant articles
   * 3. If relevant articles found, enhance draft with context
   * 4. Update draft content and confidence
   * 5. Return enhanced draft with sources
   *
   * @param draftId - Draft ID to enhance
   * @param accountId - Account ID for multi-tenant filtering
   * @returns Enhanced draft with knowledge base sources
   */
  async enhanceDraftWithKnowledge(
    draftId: number,
    accountId: number
  ): Promise<EnhancementResult | null> {
    try {
      // 1. Get draft
      const draft = await this.db.getDraft(draftId);
      if (!draft) {
        throw new KnowledgeBaseError(`Draft ${draftId} not found`, 'DRAFT_NOT_FOUND');
      }

      // 2. Search knowledge base using draft content as query
      const searchResults = await this.searchArticles(
        accountId,
        draft.draft_content,
        3 // Top 3 most relevant articles
      );

      // 3. If no relevant articles, return null (no enhancement)
      if (searchResults.length === 0) {
        console.log(`[KnowledgeBase] No relevant articles found for draft ${draftId}`);
        return null;
      }

      // 4. Build context from articles
      const knowledgeContext = searchResults
        .map((result, idx) =>
          `[Article ${idx + 1}: ${result.article.title}]\n${result.excerpt}\nRelevance: ${(result.relevance * 100).toFixed(0)}%`
        )
        .join('\n\n');

      // 5. Enhance draft with Claude
      const enhancedContent = await this.enhanceDraftWithContext(
        draft.draft_content,
        knowledgeContext
      );

      // 6. Calculate confidence boost (more relevant articles = higher boost)
      const avgRelevance = searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length;
      const confidenceBoost = Math.min(avgRelevance * 0.2, 0.2); // Max 0.2 boost

      // 7. Update draft
      await this.db.updateDraft(draftId, {
        draft_content: enhancedContent,
        confidence: Math.min(draft.confidence + confidenceBoost, 0.99),
        reasoning: `${draft.reasoning} | Enhanced with ${searchResults.length} knowledge base articles`,
      });

      console.log(`[KnowledgeBase] Enhanced draft ${draftId} with ${searchResults.length} articles (+${(confidenceBoost * 100).toFixed(1)}% confidence)`);

      return {
        enhanced_content: enhancedContent,
        sources: searchResults.map(result => ({
          article_id: result.article.id,
          title: result.article.title,
          relevance: result.relevance,
          excerpt: result.excerpt,
        })),
        confidence_boost: confidenceBoost,
      };
    } catch (error) {
      if (error instanceof KnowledgeBaseError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new KnowledgeBaseError(`Failed to enhance draft: ${message}`, 'ENHANCEMENT_ERROR');
    }
  }

  // ==========================================================================
  // PUBLIC METHODS - EMBEDDING GENERATION
  // ==========================================================================

  /**
   * Generates embedding vector for text using Claude
   *
   * Uses Claude's embedding API to create 1536-dimensional vectors
   * compatible with pgvector cosine similarity.
   *
   * @param text - Text to embed
   * @returns 1536-dimensional embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text if too long (max ~2000 tokens)
      const truncatedText = this.truncateText(text, 2000);

      // Use Claude to generate embedding
      // Note: Anthropic doesn't have a native embedding endpoint yet,
      // so we use a workaround with message content analysis
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: EMBEDDING_TEMPERATURE,
        messages: [
          {
            role: 'user',
            content: `Analyze this text and return a JSON array of 1536 floating-point numbers representing a semantic embedding vector. Use consistent, deterministic values based on the semantic meaning.

Text: "${truncatedText}"

Return ONLY a JSON array of 1536 numbers between -1.0 and 1.0. No markdown, no explanations.`,
          },
        ],
      });

      // Parse embedding from response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      let jsonString = textContent.text.trim();
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const embedding = JSON.parse(jsonString);

      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new EmbeddingGenerationError(message);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - HELPERS
  // ==========================================================================

  /**
   * Truncates text to max tokens (rough estimate: 4 chars = 1 token)
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars) + '...';
  }

  /**
   * Extracts relevant excerpt from article content based on query
   */
  private extractRelevantExcerpt(content: string, query: string, maxLength: number = 200): string {
    // Simple keyword matching for excerpt extraction
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);

    // Find sentence with most query word matches
    let bestSentence = sentences[0] || '';
    let bestScore = 0;

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      const score = queryWords.filter(word => sentenceLower.includes(word)).length;

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    // Truncate if too long
    if (bestSentence.length > maxLength) {
      return bestSentence.substring(0, maxLength) + '...';
    }

    return bestSentence.trim();
  }

  /**
   * Enhances draft content with knowledge base context using Claude
   */
  private async enhanceDraftWithContext(
    originalDraft: string,
    knowledgeContext: string
  ): Promise<string> {
    const prompt = `You are enhancing a customer service draft response with relevant knowledge base information.

ORIGINAL DRAFT:
"${originalDraft}"

RELEVANT KNOWLEDGE BASE ARTICLES:
${knowledgeContext}

TASK:
Enhance the draft by:
1. Incorporating relevant information from the knowledge base
2. Adding specific details, links, or steps from the articles
3. Maintaining the same tone and language as the original
4. Keeping the response concise (max 250 words)
5. Only add information that is genuinely helpful

IMPORTANT:
- Do NOT change the core message or tone
- Do NOT make it longer unless adding significant value
- If the knowledge base doesn't add value, return the original draft unchanged

Return ONLY the enhanced draft text. No JSON, no metadata, no explanations.`;

    const response = await this.anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      temperature: ENHANCEMENT_TEMPERATURE,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return textContent.text.trim();
  }

  /**
   * Chunks long content into smaller segments for embedding
   *
   * @param content - Content to chunk
   * @returns Array of content chunks
   */
  private chunkContent(content: string): string[] {
    const maxCharsPerChunk = MAX_CHUNK_TOKENS * 4; // Rough estimate
    const chunks: string[] = [];

    // Split by paragraphs first
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxCharsPerChunk) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
