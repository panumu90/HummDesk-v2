/**
 * Inbox Domain Types
 *
 * Inboxes represent communication channels (web chat, email, WhatsApp, etc.).
 * Each inbox can be configured with different settings and routing rules.
 */

/**
 * Channel type enum
 * Defines the type of communication channel
 */
export enum ChannelType {
  WEB = 'web',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  FACEBOOK = 'facebook',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  SMS = 'sms',
  WEBHOOK = 'webhook'
}

/**
 * Channel-specific configuration stored as JSONB
 * Structure varies based on channel_type
 */
export interface ChannelConfig {
  // Web widget configuration
  web?: {
    widget_color?: string;
    position?: 'left' | 'right';
    welcome_message?: string;
    pre_chat_form?: {
      enabled: boolean;
      fields: Array<{
        name: string;
        type: 'text' | 'email' | 'select';
        required: boolean;
        options?: string[];
      }>;
    };
  };

  // Email configuration
  email?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    smtp_password?: string;
    imap_host?: string;
    imap_port?: number;
    email_address?: string;
  };

  // WhatsApp Business API configuration
  whatsapp?: {
    phone_number_id?: string;
    business_account_id?: string;
    access_token?: string;
  };

  // Facebook Messenger configuration
  facebook?: {
    page_id?: string;
    access_token?: string;
    verify_token?: string;
  };

  // Slack configuration
  slack?: {
    bot_token?: string;
    channel_id?: string;
    workspace_id?: string;
  };

  // Webhook configuration
  webhook?: {
    url?: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
  };
}

/**
 * Main Inbox entity
 */
export interface Inbox {
  id: number;
  account_id: number;
  name: string;
  channel_type: ChannelType;
  channel_config: ChannelConfig;
  /** Welcome/greeting message shown to customers */
  greeting_message?: string;
  /** Enable automatic assignment to agents */
  enable_auto_assignment: boolean;
  /** Enable AI-powered features for this inbox */
  enable_ai_features: boolean;
  /** Widget embed token (for web channel) */
  widget_token?: string;
  /** Inbox is active and accepting messages */
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Inbox with statistics (for dashboard views)
 */
export interface InboxWithStats {
  id: number;
  account_id: number;
  name: string;
  channel_type: ChannelType;
  channel_config: ChannelConfig;
  greeting_message?: string;
  enable_auto_assignment: boolean;
  enable_ai_features: boolean;
  is_active: boolean;
  /** Total conversations in this inbox */
  total_conversations: number;
  /** Open conversations count */
  open_conversations: number;
  /** Average response time in seconds */
  avg_response_time: number;
  /** CSAT score for this inbox */
  csat_score: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request payload for creating an inbox
 */
export interface CreateInboxRequest {
  account_id: number;
  name: string;
  channel_type: ChannelType;
  channel_config?: Partial<ChannelConfig>;
  greeting_message?: string;
  enable_auto_assignment?: boolean;
  enable_ai_features?: boolean;
}

/**
 * Request payload for updating an inbox
 */
export interface UpdateInboxRequest {
  name?: string;
  channel_config?: Partial<ChannelConfig>;
  greeting_message?: string;
  enable_auto_assignment?: boolean;
  enable_ai_features?: boolean;
  is_active?: boolean;
}

/**
 * Widget configuration for web channel
 */
export interface WidgetConfig {
  inbox_id: number;
  widget_token: string;
  base_url: string;
  settings: {
    color?: string;
    position?: 'left' | 'right';
    locale?: string;
    welcome_message?: string;
  };
}
