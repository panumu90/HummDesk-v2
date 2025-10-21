/**
 * Conversation Domain Types
 *
 * Conversations represent support tickets/threads between customers and agents.
 * AI classification data is stored separately but referenced here.
 */

/**
 * Conversation status enum
 */
export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  SNOOZED = 'snoozed'
}

/**
 * Conversation priority enum
 * Set by AI classification or manually by agents
 */
export enum ConversationPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

/**
 * SLA (Service Level Agreement) policy
 */
export interface SLAPolicy {
  id: number;
  account_id: number;
  name: string;
  /** First response time target in minutes */
  first_response_minutes: number;
  /** Resolution time target in hours */
  resolution_hours: number;
  /** Business hours only */
  business_hours_only: boolean;
}

/**
 * Main Conversation entity
 */
export interface Conversation {
  id: number;
  /** Multi-tenant isolation - ALWAYS filter by this */
  account_id: number;
  inbox_id: number;
  contact_id: number;
  team_id?: number;
  /** Assigned agent (account_user_id) */
  assignee_id?: number;
  status: ConversationStatus;
  priority: ConversationPriority;
  /** AI-determined category (billing/technical/sales/other) */
  ai_category?: string;
  /** AI confidence score (0.0 - 1.0) */
  ai_confidence?: number;
  /** Sentiment analysis (positive/neutral/negative/angry) */
  sentiment?: string;
  sla_policy_id?: number;
  /** Custom subject/title */
  subject?: string;
  /** Conversation metadata */
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  /** Time of first agent reply */
  first_reply_at?: Date;
  /** Time conversation was resolved */
  resolved_at?: Date;
  /** Time conversation was snoozed until */
  snoozed_until?: Date;
}

/**
 * Conversation with related entities (for display)
 */
export interface ConversationWithRelations {
  id: number;
  account_id: number;
  status: ConversationStatus;
  priority: ConversationPriority;
  ai_category?: string;
  ai_confidence?: number;
  sentiment?: string;
  subject?: string;
  metadata?: Record<string, any>;
  /** Contact information */
  contact: {
    id: number;
    name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
    custom_attributes: Record<string, any>;
  };
  /** Inbox information */
  inbox: {
    id: number;
    name: string;
    channel_type: string;
  };
  /** Assigned team (if any) */
  team?: {
    id: number;
    name: string;
    settings: Record<string, any>;
  };
  /** Assigned agent (if any) */
  assignee?: {
    id: number;
    name: string;
    email: string;
    avatar_url?: string;
  };
  /** Message count */
  message_count: number;
  /** Unread message count */
  unread_count: number;
  /** Last message preview */
  last_message?: {
    content: string;
    created_at: Date;
    sender_type: string;
  };
  created_at: Date;
  updated_at: Date;
  first_reply_at?: Date;
  resolved_at?: Date;
  snoozed_until?: Date;
}

/**
 * Request payload for creating a conversation
 */
export interface CreateConversationRequest {
  account_id: number;
  inbox_id: number;
  contact_id: number;
  subject?: string;
  priority?: ConversationPriority;
  metadata?: Record<string, any>;
}

/**
 * Request payload for updating a conversation
 */
export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  team_id?: number;
  assignee_id?: number;
  subject?: string;
  snoozed_until?: Date;
  metadata?: Record<string, any>;
}

/**
 * Conversation assignment request
 */
export interface AssignConversationRequest {
  assignee_id: number;
  team_id?: number;
}

/**
 * Conversation filters for listing
 */
export interface ConversationFilters {
  status?: ConversationStatus | ConversationStatus[];
  priority?: ConversationPriority | ConversationPriority[];
  team_id?: number;
  assignee_id?: number;
  inbox_id?: number;
  contact_id?: number;
  ai_category?: string;
  sentiment?: string;
  created_after?: Date;
  created_before?: Date;
  has_unread?: boolean;
  query?: string;
}

/**
 * Conversation statistics
 */
export interface ConversationStats {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  snoozed: number;
  avg_first_response_time: number;
  avg_resolution_time: number;
  sla_compliance_rate: number;
}
