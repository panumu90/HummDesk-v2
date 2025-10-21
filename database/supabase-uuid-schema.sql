-- HummDesk v2 - PostgreSQL Database Schema (UUID Version)
-- Multi-tenant AI-native customer service platform
-- PostgreSQL 16 with pgvector extension
-- PRODUCTION-READY: UUID for security, scalability, and multi-region support

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- Supabase uses 'vector' not 'pgvector'

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent', 'viewer');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'trial', 'expired');
CREATE TYPE availability_status AS ENUM ('online', 'offline', 'busy', 'away');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'snoozed', 'closed');
CREATE TYPE priority_level AS ENUM ('urgent', 'high', 'normal', 'low');
CREATE TYPE ai_category AS ENUM ('billing', 'technical', 'sales', 'general', 'other');
CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative', 'angry', 'frustrated');
CREATE TYPE channel_type AS ENUM ('web', 'email', 'whatsapp', 'facebook', 'slack', 'api');
CREATE TYPE message_type AS ENUM ('incoming', 'outgoing', 'private_note', 'activity');
CREATE TYPE sender_type AS ENUM ('User', 'Contact', 'AgentBot');
CREATE TYPE content_type AS ENUM ('text', 'image', 'file', 'card', 'rich_media');
CREATE TYPE draft_status AS ENUM ('pending', 'accepted', 'rejected', 'edited', 'expired');
CREATE TYPE language_code AS ENUM ('fi', 'en', 'sv', 'de', 'fr', 'es', 'it', 'no', 'da');

-- ============================================================================
-- ACCOUNTS (Root tenant entity)
-- ============================================================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,

    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) UNIQUE NOT NULL, -- e.g., "k-rauta" for hummdesk.humm.fi/k-rauta
    domain VARCHAR(255), -- Optional custom domain

    settings JSONB DEFAULT '{}'::jsonb, -- Branding, features, limits
    -- Example: {"logo_url": "...", "primary_color": "#007bff", "features": {"ai_drafts": true}}

    status account_status DEFAULT 'trial',

    -- Subscription
    plan VARCHAR(50) DEFAULT 'trial', -- trial/starter/professional/enterprise
    max_agents INTEGER DEFAULT 2,
    max_conversations_per_month INTEGER DEFAULT 500,

    -- Billing
    billing_email VARCHAR(255),
    billing_address JSONB,

    -- Timestamps
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_subdomain ON accounts(subdomain);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_created_at ON accounts(created_at DESC);
CREATE INDEX idx_accounts_display_id ON accounts(display_id);

-- ============================================================================
-- USERS (Shared entity - can belong to multiple accounts)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    avatar_url VARCHAR(512),
    phone VARCHAR(50),
    locale VARCHAR(10) DEFAULT 'fi',
    timezone VARCHAR(50) DEFAULT 'Europe/Helsinki',

    -- Authentication
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX idx_users_display_id ON users(display_id);

-- ============================================================================
-- ACCOUNT_USERS (RBAC join table with agent metadata)
-- ============================================================================

CREATE TABLE account_users (
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role user_role NOT NULL DEFAULT 'agent',

    -- Agent-specific fields
    availability availability_status DEFAULT 'offline',
    current_load INTEGER DEFAULT 0, -- Number of active conversations
    max_capacity INTEGER DEFAULT 8, -- Max concurrent conversations

    -- Skills and languages
    skills TEXT[] DEFAULT '{}', -- e.g., {'billing', 'technical', 'swedish'}
    languages language_code[] DEFAULT '{fi}',

    -- Performance metrics (updated periodically)
    avg_response_time_seconds INTEGER DEFAULT 0,
    csat_score NUMERIC(3,2) DEFAULT 0.00, -- 0.00 to 5.00
    resolution_rate NUMERIC(5,2) DEFAULT 0.00, -- 0.00 to 100.00
    total_conversations_handled INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (account_id, user_id)
);

CREATE INDEX idx_account_users_account ON account_users(account_id);
CREATE INDEX idx_account_users_user ON account_users(user_id);
CREATE INDEX idx_account_users_availability ON account_users(account_id, availability) WHERE availability = 'online';
CREATE INDEX idx_account_users_load ON account_users(account_id, current_load, max_capacity);

-- ============================================================================
-- TEAMS
-- ============================================================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL, -- e.g., "Billing Team", "Technical Support"
    description TEXT,

    settings JSONB DEFAULT '{}'::jsonb,
    -- Example: {"auto_assignment": true, "sla_policy_id": "uuid"}

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(account_id, name)
);

CREATE INDEX idx_teams_account ON teams(account_id);
CREATE INDEX idx_teams_display_id ON teams(display_id);

-- Team members (many-to-many)
CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_account ON team_members(account_id);

-- ============================================================================
-- INBOXES (Communication channels)
-- ============================================================================

CREATE TABLE inboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL, -- e.g., "Website Chat", "Support Email"
    channel_type channel_type NOT NULL,

    channel_config JSONB DEFAULT '{}'::jsonb,
    -- Example for email: {"email": "support@example.com", "smtp_config": {...}}
    -- Example for web: {"widget_color": "#007bff", "position": "right"}

    greeting_message TEXT,
    greeting_enabled BOOLEAN DEFAULT true,

    enable_auto_assignment BOOLEAN DEFAULT true,
    enable_ai_classification BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inboxes_account ON inboxes(account_id);
CREATE INDEX idx_inboxes_channel_type ON inboxes(account_id, channel_type);
CREATE INDEX idx_inboxes_display_id ON inboxes(display_id);

-- Inbox team assignments
CREATE TABLE inbox_teams (
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    PRIMARY KEY (inbox_id, team_id)
);

-- ============================================================================
-- CONTACTS (Customers)
-- ============================================================================

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),

    avatar_url VARCHAR(512),

    custom_attributes JSONB DEFAULT '{}'::jsonb,
    -- Example: {"company": "Acme Inc", "tier": "premium", "country": "FI"}

    -- Social profiles
    social_profiles JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    last_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(account_id, email);
CREATE INDEX idx_contacts_phone ON contacts(account_id, phone);
CREATE INDEX idx_contacts_created_at ON contacts(account_id, created_at DESC);
CREATE INDEX idx_contacts_display_id ON contacts(display_id);

-- ============================================================================
-- SLA POLICIES
-- ============================================================================

CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    first_response_time_minutes INTEGER, -- e.g., 60 = 1 hour
    resolution_time_hours INTEGER, -- e.g., 24 = 1 day

    business_hours_only BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sla_policies_account ON sla_policies(account_id);
CREATE INDEX idx_sla_policies_display_id ON sla_policies(display_id);

-- ============================================================================
-- CONVERSATIONS (Support tickets/threads)
-- ============================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Assignment
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Status
    status conversation_status DEFAULT 'open',
    priority priority_level DEFAULT 'normal',

    -- AI classification results (denormalized for quick filtering)
    ai_category ai_category,
    ai_confidence NUMERIC(4,3), -- 0.000 to 1.000
    sentiment sentiment_type,

    -- SLA tracking
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    sla_first_response_due_at TIMESTAMP WITH TIME ZONE,
    sla_resolution_due_at TIMESTAMP WITH TIME ZONE,
    sla_first_response_breached BOOLEAN DEFAULT false,
    sla_resolution_breached BOOLEAN DEFAULT false,

    -- Metadata
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,

    labels TEXT[] DEFAULT '{}',
    custom_attributes JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    first_reply_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Critical indexes for multi-tenant queries
CREATE INDEX idx_conversations_account ON conversations(account_id);
CREATE INDEX idx_conversations_account_status ON conversations(account_id, status, created_at DESC);
CREATE INDEX idx_conversations_account_assignee ON conversations(account_id, assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_conversations_account_team ON conversations(account_id, team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_conversations_inbox ON conversations(inbox_id, created_at DESC);
CREATE INDEX idx_conversations_contact ON conversations(contact_id, created_at DESC);
CREATE INDEX idx_conversations_priority ON conversations(account_id, priority, status);
CREATE INDEX idx_conversations_ai_category ON conversations(account_id, ai_category) WHERE ai_category IS NOT NULL;
CREATE INDEX idx_conversations_updated ON conversations(account_id, updated_at DESC);
CREATE INDEX idx_conversations_display_id ON conversations(display_id);

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, -- Denormalized for queries

    -- Sender
    sender_type sender_type NOT NULL,
    sender_id UUID NOT NULL, -- References users(id) or contacts(id) depending on sender_type

    -- Content
    content TEXT NOT NULL,
    content_type content_type DEFAULT 'text',
    content_attributes JSONB DEFAULT '{}'::jsonb,
    -- Example: {"attachments": [{"url": "...", "type": "image/png"}]}

    message_type message_type DEFAULT 'incoming',

    -- AI metadata
    ai_draft_id UUID, -- References ai_drafts(id) if this message was AI-generated
    sentiment JSONB, -- Detailed sentiment analysis

    -- Status
    is_read BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_account ON messages(account_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- ============================================================================
-- AI CLASSIFICATIONS
-- ============================================================================

CREATE TABLE ai_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, -- Denormalized

    -- Classification results
    category ai_category NOT NULL,
    priority priority_level NOT NULL,
    sentiment sentiment_type NOT NULL,
    language language_code NOT NULL,

    confidence NUMERIC(4,3) NOT NULL, -- 0.000 to 1.000
    reasoning TEXT, -- Claude's explanation

    -- Routing suggestions
    suggested_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    suggested_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Metadata
    model_version VARCHAR(50), -- e.g., "claude-sonnet-4-20250514"
    processing_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_classifications_message ON ai_classifications(message_id);
CREATE INDEX idx_ai_classifications_conversation ON ai_classifications(conversation_id);
CREATE INDEX idx_ai_classifications_account ON ai_classifications(account_id);
CREATE INDEX idx_ai_classifications_category ON ai_classifications(category, confidence DESC);
CREATE INDEX idx_ai_classifications_created ON ai_classifications(created_at DESC);

-- ============================================================================
-- AI DRAFTS (AI-generated reply suggestions)
-- ============================================================================

CREATE TABLE ai_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE, -- Message this is replying to
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, -- Denormalized

    draft_content TEXT NOT NULL,

    confidence NUMERIC(4,3) NOT NULL,
    reasoning TEXT, -- Why this draft was generated

    status draft_status DEFAULT 'pending',

    -- Usage tracking
    used_by_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,

    -- Agent feedback
    agent_edited BOOLEAN DEFAULT false,
    agent_feedback JSONB, -- {"rating": 4, "comment": "Good but needed minor edits"}

    -- Metadata
    model_version VARCHAR(50),
    processing_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_drafts_conversation ON ai_drafts(conversation_id, created_at DESC);
CREATE INDEX idx_ai_drafts_message ON ai_drafts(message_id);
CREATE INDEX idx_ai_drafts_account ON ai_drafts(account_id);
CREATE INDEX idx_ai_drafts_status ON ai_drafts(status, created_at DESC);
CREATE INDEX idx_ai_drafts_confidence ON ai_drafts(confidence DESC);

-- ============================================================================
-- KNOWLEDGE BASE (for RAG)
-- ============================================================================

CREATE TABLE knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id VARCHAR(20) UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    title VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,

    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',

    -- Vector embedding for semantic search
    embedding vector(1536), -- OpenAI ada-002 or Claude embeddings

    -- Metadata
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,

    published BOOLEAN DEFAULT true,
    published_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_articles_account ON knowledge_base_articles(account_id);
CREATE INDEX idx_kb_articles_category ON knowledge_base_articles(account_id, category);
CREATE INDEX idx_kb_articles_published ON knowledge_base_articles(account_id, published) WHERE published = true;
CREATE INDEX idx_kb_articles_display_id ON knowledge_base_articles(display_id);

-- Vector similarity search index
CREATE INDEX idx_kb_articles_embedding ON knowledge_base_articles USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- AUDIT LOGS (for compliance and debugging)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL, -- e.g., "conversation.assigned", "message.sent"
    entity_type VARCHAR(50) NOT NULL, -- e.g., "Conversation", "Message"
    entity_id UUID NOT NULL,

    changes JSONB, -- Before/after values
    metadata JSONB DEFAULT '{}'::jsonb,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_account ON audit_logs(account_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- SESSIONS (for JWT refresh tokens)
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    refresh_token_hash VARCHAR(255) NOT NULL,

    device_info JSONB,
    ip_address INET,

    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- EMAIL SYSTEM TABLES (Resend.com Integration)
-- ============================================================================

-- Email Inboxes (Resend Configuration)
CREATE TABLE email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id VARCHAR(20) UNIQUE NOT NULL,

  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,

  -- Resend.com Configuration
  resend_api_key TEXT,
  resend_domain VARCHAR(255),
  webhook_secret TEXT,

  -- Routing
  default_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  default_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_inboxes_display_id ON email_inboxes(display_id);

-- Email Messages (with Threading Support)
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES email_inboxes(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- RFC 5322 Email Headers for Threading
  message_id VARCHAR(500) UNIQUE NOT NULL,
  in_reply_to VARCHAR(500),
  references_header TEXT[],  -- Renamed from 'references' (reserved keyword)

  -- Headers
  from_address VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  reply_to VARCHAR(255),
  subject TEXT,

  -- Content
  html_body TEXT,
  text_body TEXT,

  -- Metadata
  direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
  status VARCHAR(50) DEFAULT 'received', -- received, sent, delivered, bounced, failed
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,

  -- Thread Info
  thread_id VARCHAR(255),
  is_thread_start BOOLEAN DEFAULT FALSE,

  -- AI Classification
  ai_category VARCHAR(100),
  ai_sentiment VARCHAR(50),
  ai_priority VARCHAR(50),
  ai_confidence FLOAT,

  -- Tracking (for outbound)
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_messages_inbox ON email_messages(inbox_id);
CREATE INDEX idx_email_messages_conversation ON email_messages(conversation_id);
CREATE INDEX idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX idx_email_messages_in_reply_to ON email_messages(in_reply_to);
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_email_messages_from ON email_messages(from_address);
CREATE INDEX idx_email_messages_direction ON email_messages(direction);
CREATE INDEX idx_email_messages_received ON email_messages(received_at DESC);

-- Email Attachments
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,

  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(255),
  size_bytes INTEGER,

  -- Supabase Storage
  storage_path TEXT,
  storage_bucket VARCHAR(255) DEFAULT 'email-attachments',

  -- Inline Images
  content_id VARCHAR(255),
  is_inline BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_message ON email_attachments(email_message_id);

-- Email Templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id VARCHAR(20) UNIQUE NOT NULL,

  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(500),
  html_body TEXT,
  text_body TEXT,

  -- Template Variables: {{customer_name}}, {{ticket_number}}, etc.
  variables JSONB DEFAULT '[]',

  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_display_id ON email_templates(display_id);

-- Email Routing Rules
CREATE TABLE email_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,

  -- Conditions (JSON for flexibility)
  conditions JSONB NOT NULL,
  -- Example: {"from_contains": "vip@", "subject_contains": "urgent"}

  -- Actions
  assign_to_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  assign_to_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  set_priority VARCHAR(50),
  add_tags TEXT[],
  trigger_ai_classification BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Bounces & Complaints
CREATE TABLE email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,

  bounce_type VARCHAR(50) NOT NULL, -- hard, soft, complaint
  bounce_reason TEXT,
  should_block BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_bounces_recipient ON email_bounces(recipient_email);

-- ============================================================================
-- DISPLAY ID GENERATION TRIGGERS
-- ============================================================================

-- Function to generate display IDs with specific prefixes
CREATE OR REPLACE FUNCTION generate_display_id(prefix TEXT, random_length INTEGER DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
    random_str TEXT;
    exists_check INTEGER;
    new_id TEXT;
BEGIN
    LOOP
        -- Generate random alphanumeric string (uppercase)
        random_str := UPPER(substring(md5(random()::text || clock_timestamp()::text) from 1 for random_length));
        new_id := prefix || '-' || random_str;

        -- Check if exists (this is a simplified check, adjust table name as needed)
        RETURN new_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for accounts
CREATE OR REPLACE FUNCTION set_account_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('ACC');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_account_display_id
BEFORE INSERT ON accounts
FOR EACH ROW EXECUTE FUNCTION set_account_display_id();

-- Trigger function for users
CREATE OR REPLACE FUNCTION set_user_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('USR');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_display_id
BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION set_user_display_id();

-- Trigger function for conversations
CREATE OR REPLACE FUNCTION set_conversation_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('CONV');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversation_display_id
BEFORE INSERT ON conversations
FOR EACH ROW EXECUTE FUNCTION set_conversation_display_id();

-- Trigger function for teams
CREATE OR REPLACE FUNCTION set_team_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('TEAM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_team_display_id
BEFORE INSERT ON teams
FOR EACH ROW EXECUTE FUNCTION set_team_display_id();

-- Trigger function for contacts
CREATE OR REPLACE FUNCTION set_contact_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('CONT');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contact_display_id
BEFORE INSERT ON contacts
FOR EACH ROW EXECUTE FUNCTION set_contact_display_id();

-- Trigger function for inboxes
CREATE OR REPLACE FUNCTION set_inbox_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('INB');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inbox_display_id
BEFORE INSERT ON inboxes
FOR EACH ROW EXECUTE FUNCTION set_inbox_display_id();

-- Trigger function for SLA policies
CREATE OR REPLACE FUNCTION set_sla_policy_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('SLA');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sla_policy_display_id
BEFORE INSERT ON sla_policies
FOR EACH ROW EXECUTE FUNCTION set_sla_policy_display_id();

-- Trigger function for knowledge base articles
CREATE OR REPLACE FUNCTION set_kb_article_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('KB');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kb_article_display_id
BEFORE INSERT ON knowledge_base_articles
FOR EACH ROW EXECUTE FUNCTION set_kb_article_display_id();

-- Trigger function for email inboxes
CREATE OR REPLACE FUNCTION set_email_inbox_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('EINB');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_inbox_display_id
BEFORE INSERT ON email_inboxes
FOR EACH ROW EXECUTE FUNCTION set_email_inbox_display_id();

-- Trigger function for email templates
CREATE OR REPLACE FUNCTION set_email_template_display_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_id IS NULL THEN
        NEW.display_id := generate_display_id('TMPL');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_template_display_id
BEFORE INSERT ON email_templates
FOR EACH ROW EXECUTE FUNCTION set_email_template_display_id();

-- ============================================================================
-- ROW-LEVEL SECURITY (Multi-tenant isolation)
-- ============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

-- Public access for demo (REPLACE with proper auth in production!)
CREATE POLICY conversations_public ON conversations FOR ALL USING (true);
CREATE POLICY messages_public ON messages FOR ALL USING (true);
CREATE POLICY contacts_public ON contacts FOR ALL USING (true);
CREATE POLICY teams_public ON teams FOR ALL USING (true);
CREATE POLICY inboxes_public ON inboxes FOR ALL USING (true);
CREATE POLICY ai_classifications_public ON ai_classifications FOR ALL USING (true);
CREATE POLICY ai_drafts_public ON ai_drafts FOR ALL USING (true);
CREATE POLICY knowledge_base_articles_public ON knowledge_base_articles FOR ALL USING (true);
CREATE POLICY email_inboxes_public ON email_inboxes FOR ALL USING (true);
CREATE POLICY email_messages_public ON email_messages FOR ALL USING (true);
CREATE POLICY email_attachments_public ON email_attachments FOR ALL USING (true);
CREATE POLICY email_templates_public ON email_templates FOR ALL USING (true);
CREATE POLICY email_routing_rules_public ON email_routing_rules FOR ALL USING (true);
CREATE POLICY email_bounces_public ON email_bounces FOR ALL USING (true);

-- ============================================================================
-- TRIGGERS (Auto-update timestamps, counters, etc.)
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inboxes_updated_at BEFORE UPDATE ON inboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update conversation message_count when messages are added
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_message_count AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- Update contact last_activity_at when message is received
CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_type = 'Contact' THEN
        UPDATE contacts
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE id = NEW.sender_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_activity AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_contact_last_activity();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get available agents for assignment
CREATE OR REPLACE FUNCTION get_available_agents(
    p_account_id UUID,
    p_team_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    user_name VARCHAR(255),
    current_load INTEGER,
    max_capacity INTEGER,
    utilization NUMERIC,
    csat_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        au.user_id,
        u.name,
        au.current_load,
        au.max_capacity,
        ROUND((au.current_load::NUMERIC / NULLIF(au.max_capacity, 0)) * 100, 2) as utilization,
        au.csat_score
    FROM account_users au
    JOIN users u ON u.id = au.user_id
    WHERE au.account_id = p_account_id
        AND au.availability = 'online'
        AND au.current_load < au.max_capacity
        AND (p_team_id IS NULL OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.user_id = au.user_id
            AND tm.team_id = p_team_id
        ))
    ORDER BY
        (au.current_load::NUMERIC / NULLIF(au.max_capacity, 0)) ASC,
        au.csat_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Demo Account
INSERT INTO accounts (display_id, name, subdomain, status, plan, max_agents, max_conversations_per_month)
VALUES ('ACC-DEMO01', 'K-Rauta Customer Service', 'k-rauta', 'active', 'professional', 10, 5000)
ON CONFLICT (subdomain) DO NOTHING;

-- Demo Email Inbox
INSERT INTO email_inboxes (display_id, name, email_address, resend_domain, status)
VALUES ('EINB-DEMO1', 'Customer Support', 'support@hummdesk.com', 'hummdesk.com', 'active')
ON CONFLICT (email_address) DO NOTHING;

-- Email Templates (Finnish)
INSERT INTO email_templates (display_id, name, subject, html_body, text_body, variables) VALUES
(
  'TMPL-WELC1',
  'welcome_reply',
  'Re: {{subject}}',
  '<p>Hei {{customer_name}},</p>
  <p>Kiitos yhteydenotostasi! Olemme vastaanottaneet viestisi ja autamme sinua mahdollisimman pian.</p>
  <p><strong>Tiketti:</strong> #{{ticket_number}}</p>
  <p>Ystävällisin terveisin,<br/>
  {{agent_name}}<br/>
  HummDesk Support</p>',
  'Hei {{customer_name}},\n\nKiitos yhteydenotostasi! Olemme vastaanottaneet viestisi ja autamme sinua mahdollisimman pian.\n\nTiketti: #{{ticket_number}}\n\nYstävällisin terveisin,\n{{agent_name}}\nHummDesk Support',
  '["customer_name", "subject", "ticket_number", "agent_name"]'::jsonb
),
(
  'TMPL-RESV1',
  'resolved_notification',
  'Tikettiäsi #{{ticket_number}} on päivitetty',
  '<p>Hei {{customer_name}},</p>
  <p>Hienoa! Ongelmasi on ratkaistu.</p>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <strong>Yhteenveto:</strong><br/>
    {{resolution_summary}}
  </div>
  <p>Jos sinulla on vielä kysyttävää, vastaa tähän viestiin.</p>
  <p>Ystävällisin terveisin,<br/>{{agent_name}}</p>',
  'Hei {{customer_name}},\n\nHienoa! Ongelmasi on ratkaistu.\n\nYhteenveto:\n{{resolution_summary}}\n\nJos sinulla on vielä kysyttävää, vastaa tähän viestiin.\n\nYstävällisin terveisin,\n{{agent_name}}',
  '["customer_name", "ticket_number", "resolution_summary", "agent_name"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES ('v2.1.0-uuid')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE accounts IS 'Multi-tenant account entities with UUID primary keys';
COMMENT ON TABLE conversations IS 'Support conversations with display_id (CONV-XXXXXX) for UI';
COMMENT ON TABLE email_inboxes IS 'Email inboxes configured with Resend.com API';
COMMENT ON TABLE email_messages IS 'All emails with RFC 5322 threading support';
COMMENT ON COLUMN accounts.display_id IS 'Human-friendly ID shown in UI (ACC-XXXXXX)';
COMMENT ON COLUMN conversations.display_id IS 'Human-friendly ticket number (CONV-XXXXXX)';
COMMENT ON COLUMN users.display_id IS 'Human-friendly agent ID (USR-XXXXXX)';
