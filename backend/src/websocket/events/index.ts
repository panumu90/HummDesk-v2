/**
 * WebSocket Event Type Definitions
 * All Socket.IO events used in HummDesk v2
 */

// ============================================================================
// Client -> Server Events
// ============================================================================

export interface ClientToServerEvents {
  // Connection & Authentication
  authenticate: (token: string) => void;
  join_account: (accountId: string) => void;
  leave_account: (accountId: string) => void;

  // Conversation Management
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;

  // Messaging
  send_message: (data: SendMessageData) => void;
  message_read: (data: MessageReadData) => void;

  // Typing Indicators
  typing_start: (data: TypingData) => void;
  typing_stop: (data: TypingData) => void;

  // Presence
  agent_online: () => void;
  agent_offline: () => void;

  // Conversation Actions
  update_conversation_status: (data: UpdateConversationStatusData) => void;
  assign_conversation: (data: AssignConversationData) => void;
  unassign_conversation: (data: UnassignConversationData) => void;
}

// ============================================================================
// Server -> Client Events
// ============================================================================

export interface ServerToClientEvents {
  // Authentication
  authenticated: (data: AuthenticatedData) => void;
  authentication_error: (error: string) => void;

  // Messaging
  new_message: (data: NewMessageData) => void;
  message_sent: (data: MessageSentData) => void;
  message_error: (error: string) => void;
  message_read: (data: MessageReadNotification) => void;

  // Conversation Updates
  conversation_created: (data: ConversationData) => void;
  conversation_updated: (data: ConversationData) => void;
  conversation_status_changed: (data: ConversationStatusChangedData) => void;
  conversation_assigned: (data: ConversationAssignedData) => void;
  conversation_unassigned: (data: ConversationUnassignedData) => void;

  // AI Events
  ai_classification: (data: AIClassificationData) => void;
  ai_draft: (data: AIDraftData) => void;
  ai_processing_started: (data: AIProcessingData) => void;
  ai_processing_completed: (data: AIProcessingData) => void;
  ai_error: (data: AIErrorData) => void;

  // Typing Indicators
  typing_start: (data: TypingNotification) => void;
  typing_stop: (data: TypingNotification) => void;

  // Presence
  agent_online: (data: AgentPresenceData) => void;
  agent_offline: (data: AgentPresenceData) => void;
  agent_status_changed: (data: AgentStatusChangedData) => void;

  // System Events
  error: (error: ErrorData) => void;
  disconnect_reason: (reason: string) => void;
}

// ============================================================================
// Event Data Interfaces
// ============================================================================

// Authentication
export interface AuthenticatedData {
  userId: string;
  accountId: string;
  email: string;
  role: 'admin' | 'agent' | 'viewer';
}

// Messaging
export interface SendMessageData {
  conversationId: string;
  content: string;
  contentType?: 'text' | 'html';
  attachments?: Array<{
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  metadata?: Record<string, any>;
}

export interface NewMessageData {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderType: 'agent' | 'customer' | 'system';
  content: string;
  contentType: 'text' | 'html';
  attachments?: Array<{
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface MessageSentData {
  messageId: string;
  conversationId: string;
  timestamp: string;
}

export interface MessageReadData {
  messageId: string;
  conversationId: string;
}

export interface MessageReadNotification {
  messageId: string;
  conversationId: string;
  readBy: string;
  readByType: 'agent' | 'customer';
  timestamp: string;
}

// Conversation
export interface ConversationData {
  conversationId: string;
  accountId: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  assignedTeam?: string;
  customer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  lastMessage?: {
    content: string;
    timestamp: string;
    senderType: 'agent' | 'customer' | 'system';
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface UpdateConversationStatusData {
  conversationId: string;
  status: 'open' | 'pending' | 'closed';
  reason?: string;
}

export interface ConversationStatusChangedData {
  conversationId: string;
  oldStatus: 'open' | 'pending' | 'closed';
  newStatus: 'open' | 'pending' | 'closed';
  changedBy: string;
  reason?: string;
  timestamp: string;
}

export interface AssignConversationData {
  conversationId: string;
  agentId: string;
  teamId?: string;
}

export interface UnassignConversationData {
  conversationId: string;
  reason?: string;
}

export interface ConversationAssignedData {
  conversationId: string;
  assignedTo: string;
  assignedTeam?: string;
  assignedBy: string;
  timestamp: string;
}

export interface ConversationUnassignedData {
  conversationId: string;
  unassignedFrom: string;
  unassignedBy: string;
  reason?: string;
  timestamp: string;
}

// AI Events
export interface AIClassificationData {
  conversationId: string;
  messageId?: string;
  classification: {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    urgency: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    language: string;
    tags: string[];
    suggestedTeam?: string;
    suggestedAgent?: string;
  };
  confidence: number;
  processingTime: number;
  timestamp: string;
}

export interface AIDraftData {
  conversationId: string;
  messageId?: string;
  draft: {
    content: string;
    tone: 'formal' | 'friendly' | 'empathetic' | 'professional';
    suggestedActions?: string[];
  };
  confidence: number;
  reasoning?: string;
  timestamp: string;
}

export interface AIProcessingData {
  conversationId: string;
  messageId?: string;
  processingType: 'classification' | 'draft' | 'sentiment' | 'translation';
  timestamp: string;
}

export interface AIErrorData {
  conversationId: string;
  messageId?: string;
  error: string;
  processingType: 'classification' | 'draft' | 'sentiment' | 'translation';
  timestamp: string;
}

// Typing Indicators
export interface TypingData {
  conversationId: string;
}

export interface TypingNotification {
  conversationId: string;
  userId: string;
  userType: 'agent' | 'customer';
  userName: string;
  timestamp: string;
}

// Presence
export interface AgentPresenceData {
  agentId: string;
  accountId: string;
  name: string;
  email: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeenAt?: string;
  timestamp: string;
}

export interface AgentStatusChangedData {
  agentId: string;
  oldStatus: 'online' | 'offline' | 'away' | 'busy';
  newStatus: 'online' | 'offline' | 'away' | 'busy';
  timestamp: string;
}

// System
export interface ErrorData {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// ============================================================================
// Socket Data (stored in socket.data)
// ============================================================================

export interface SocketData {
  userId?: string;
  accountId?: string;
  email?: string;
  role?: 'admin' | 'agent' | 'viewer';
  authenticated: boolean;
  connectedAt: string;
  lastActivity: string;
}
