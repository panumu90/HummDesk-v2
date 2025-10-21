/**
 * AI Domain Types
 *
 * AI-related entities for classification, draft generation, and knowledge base.
 * Core to the AI-first architecture of HummDesk v2.
 */

/**
 * AI classification category enum
 */
export enum AICategory {
  BILLING = 'billing',
  TECHNICAL = 'technical',
  SALES = 'sales',
  GENERAL = 'general',
  OTHER = 'other'
}

/**
 * AI-detected sentiment enum
 */
export enum AISentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  ANGRY = 'angry',
  FRUSTRATED = 'frustrated'
}

/**
 * Conversation priority (set by AI)
 */
export enum AIPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

/**
 * Language detection
 */
export enum AILanguage {
  FI = 'fi', // Finnish
  EN = 'en', // English
  SV = 'sv', // Swedish
  DE = 'de', // German
  FR = 'fr', // French
  ES = 'es', // Spanish
  UNKNOWN = 'unknown'
}

/**
 * Main AIClassification entity
 * Stores AI analysis metadata for messages and conversations
 */
export interface AIClassification {
  id: number;
  message_id: number;
  conversation_id: number;
  /** AI-determined category */
  category: AICategory;
  /** Priority level */
  priority: AIPriority;
  /** Detected sentiment */
  sentiment: AISentiment;
  /** Detected language */
  language: AILanguage;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Claude's reasoning for the classification */
  reasoning: string;
  /** Suggested team for routing */
  suggested_team_id?: number;
  /** Suggested agent for assignment */
  suggested_agent_id?: number;
  /** Full AI response (for debugging/audit) */
  raw_response?: Record<string, any>;
  created_at: Date;
}

/**
 * AIClassification with team/agent details
 */
export interface AIClassificationWithDetails {
  id: number;
  message_id: number;
  conversation_id: number;
  category: AICategory;
  priority: AIPriority;
  sentiment: AISentiment;
  language: AILanguage;
  confidence: number;
  reasoning: string;
  /** Suggested team details */
  suggested_team?: {
    id: number;
    name: string;
    online_agents: number;
    utilization: number;
  };
  /** Suggested agent details */
  suggested_agent?: {
    id: number;
    name: string;
    current_load: number;
    max_capacity: number;
    csat_score: number;
  };
  raw_response?: Record<string, any>;
  created_at: Date;
}

/**
 * AI draft status enum
 */
export enum AIDraftStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EDITED = 'edited'
}

/**
 * Main AIDraft entity
 * Stores AI-generated reply suggestions for agents
 */
export interface AIDraft {
  id: number;
  conversation_id: number;
  /** Message this draft is replying to */
  message_id: number;
  /** AI-generated reply content */
  draft_content: string;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Claude's reasoning for this draft */
  reasoning: string;
  /** Draft status (accepted/rejected/edited) */
  status: AIDraftStatus;
  /** Agent who used/reviewed this draft */
  used_by_agent_id?: number;
  /** If agent edited the draft, store original here */
  original_content?: string;
  /** Time agent accepted/rejected */
  reviewed_at?: Date;
  /** Full AI response (for debugging) */
  raw_response?: Record<string, any>;
  created_at: Date;
}

/**
 * Request payload for AI classification
 */
export interface ClassifyMessageRequest {
  message_id: number;
  conversation_id: number;
  /** Optional context to improve classification */
  context?: {
    customer_tier?: string;
    previous_conversations?: number;
    account_age_days?: number;
    is_business_hours?: boolean;
  };
}

/**
 * Response payload for AI classification
 */
export interface ClassifyMessageResponse {
  classification: AIClassification;
  /** Whether auto-assignment was triggered */
  auto_assigned: boolean;
  /** Assigned team and agent (if auto-assigned) */
  assignment?: {
    team_id: number;
    agent_id: number;
  };
}

/**
 * Request payload for AI draft generation
 */
export interface GenerateDraftRequest {
  message_id: number;
  conversation_id: number;
  /** Optional parameters to guide draft generation */
  params?: {
    tone?: 'professional' | 'friendly' | 'empathetic' | 'urgent';
    max_length?: number;
    include_greeting?: boolean;
    include_signature?: boolean;
    language?: AILanguage;
  };
}

/**
 * Response payload for AI draft generation
 */
export interface GenerateDraftResponse {
  draft: AIDraft;
  /** Alternative drafts (if requested) */
  alternatives?: Array<{
    content: string;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * Knowledge base article for RAG (Retrieval-Augmented Generation)
 */
export interface KnowledgeBaseArticle {
  id: number;
  account_id: number;
  title: string;
  content: string;
  category: string;
  /** pgvector embedding for semantic search */
  embedding?: number[];
  /** Tags for filtering */
  tags: string[];
  /** Article visibility */
  is_public: boolean;
  /** View count */
  view_count: number;
  /** Helpful rating */
  helpful_count: number;
  not_helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for knowledge base search
 */
export interface SearchKnowledgeBaseRequest {
  query: string;
  /** Semantic search using embeddings */
  use_semantic_search?: boolean;
  /** Limit results */
  limit?: number;
  /** Filter by category */
  category?: string;
  /** Filter by tags */
  tags?: string[];
}

/**
 * Knowledge base search result
 */
export interface KnowledgeBaseSearchResult {
  article: KnowledgeBaseArticle;
  /** Relevance score (0.0 - 1.0) */
  relevance: number;
  /** Matched excerpt */
  excerpt: string;
}

/**
 * AI performance metrics
 */
export interface AIPerformanceMetrics {
  /** Time period for metrics */
  period: {
    start: Date;
    end: Date;
  };
  /** Classification accuracy (based on agent feedback) */
  classification_accuracy: number;
  /** Draft acceptance rate */
  draft_acceptance_rate: number;
  /** Draft edit rate (agent modified the draft) */
  draft_edit_rate: number;
  /** Average confidence score */
  avg_confidence: number;
  /** Auto-assignment success rate */
  auto_assignment_success_rate: number;
  /** Time saved by AI (estimated) */
  time_saved_minutes: number;
  /** Cost savings (estimated) */
  cost_savings_eur: number;
}

/**
 * AI training feedback
 * Agents can provide feedback to improve AI over time
 */
export interface AIFeedback {
  id: number;
  classification_id?: number;
  draft_id?: number;
  agent_id: number;
  /** Was the AI correct? */
  is_correct: boolean;
  /** Expected category (if classification was wrong) */
  expected_category?: AICategory;
  /** Expected priority (if wrong) */
  expected_priority?: AIPriority;
  /** Agent comments */
  comments?: string;
  created_at: Date;
}
