/**
 * Message Domain Types
 *
 * Messages are the core communication units within conversations.
 * Can be sent by customers, agents, or AI bots.
 */

/**
 * Message sender type enum
 */
export enum MessageSenderType {
  USER = 'User',
  CONTACT = 'Contact',
  AGENT_BOT = 'AgentBot'
}

/**
 * Message type enum
 */
export enum MessageType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  PRIVATE_NOTE = 'private_note',
  ACTIVITY = 'activity'
}

/**
 * Message content type enum
 */
export enum MessageContentType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  CARD = 'card',
  LOCATION = 'location'
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
}

/**
 * Message content attributes stored as JSONB
 */
export interface MessageContentAttributes {
  /** Attachments (images, files, etc.) */
  attachments?: MessageAttachment[];
  /** Rich content for cards */
  card?: {
    title?: string;
    description?: string;
    image_url?: string;
    buttons?: Array<{
      label: string;
      url?: string;
      action?: string;
    }>;
  };
  /** Location data */
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  /** Email metadata (for email channel) */
  email?: {
    subject?: string;
    cc?: string[];
    bcc?: string[];
    in_reply_to?: string;
    message_id?: string;
  };
  /** External message ID (from channel) */
  external_id?: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Sentiment analysis data stored as JSONB
 */
export interface MessageSentiment {
  score: number; // -1.0 (very negative) to 1.0 (very positive)
  label: 'positive' | 'neutral' | 'negative' | 'angry';
  confidence: number; // 0.0 to 1.0
  emotions?: {
    joy?: number;
    sadness?: number;
    anger?: number;
    fear?: number;
    surprise?: number;
  };
}

/**
 * Main Message entity
 */
export interface Message {
  id: number;
  conversation_id: number;
  /** Denormalized for faster queries */
  account_id: number;
  sender_type: MessageSenderType;
  /** ID of the user or contact who sent this */
  sender_id: number;
  content: string;
  content_type: MessageContentType;
  content_attributes: MessageContentAttributes;
  message_type: MessageType;
  /** Reference to AI draft if this message was AI-generated */
  ai_draft_id?: number;
  /** Sentiment analysis of this message */
  sentiment?: MessageSentiment;
  /** Message has been read by assignee */
  is_read: boolean;
  /** External source identifier */
  source_id?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Message with sender information (for display)
 */
export interface MessageWithSender {
  id: number;
  conversation_id: number;
  account_id: number;
  sender_type: MessageSenderType;
  sender_id: number;
  content: string;
  content_type: MessageContentType;
  content_attributes: MessageContentAttributes;
  message_type: MessageType;
  ai_draft_id?: number;
  sentiment?: MessageSentiment;
  is_read: boolean;
  /** Sender details */
  sender: {
    id: number;
    name: string;
    email?: string;
    avatar_url?: string;
    type: MessageSenderType;
  };
  /** AI draft details (if applicable) */
  ai_draft?: {
    id: number;
    confidence: number;
    reasoning: string;
    status: string;
  };
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for creating a message
 */
export interface CreateMessageRequest {
  conversation_id: number;
  content: string;
  content_type?: MessageContentType;
  content_attributes?: Partial<MessageContentAttributes>;
  message_type?: MessageType;
  /** If sending from AI draft, reference it */
  ai_draft_id?: number;
}

/**
 * Request payload for updating a message
 */
export interface UpdateMessageRequest {
  content?: string;
  content_attributes?: Partial<MessageContentAttributes>;
  is_read?: boolean;
}

/**
 * Message filters for querying
 */
export interface MessageFilters {
  conversation_id?: number;
  sender_type?: MessageSenderType;
  sender_id?: number;
  message_type?: MessageType;
  content_type?: MessageContentType;
  is_read?: boolean;
  created_after?: Date;
  created_before?: Date;
}

/**
 * Private note (internal agent communication)
 */
export interface PrivateNote extends Omit<Message, 'message_type'> {
  message_type: MessageType.PRIVATE_NOTE;
  /** Only visible to team members */
  visible_to_team_only: boolean;
}

/**
 * Activity message (system-generated events)
 */
export interface ActivityMessage extends Omit<Message, 'message_type' | 'sender_type'> {
  message_type: MessageType.ACTIVITY;
  sender_type: MessageSenderType.AGENT_BOT;
  /** Activity type (assigned, resolved, etc.) */
  activity_type: 'assigned' | 'resolved' | 'reopened' | 'priority_changed' | 'team_changed';
  /** Activity metadata */
  activity_data?: Record<string, any>;
}
