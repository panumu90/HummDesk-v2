-- ============================================================================
-- MODERN EMAIL SYSTEM SCHEMA (2025)
-- Using Resend.com API - No IMAP/SMTP needed!
-- ============================================================================

-- Email Inboxes (Resend Configuration)
CREATE TABLE IF NOT EXISTS email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,

  -- Resend.com Configuration
  resend_api_key TEXT,
  resend_domain VARCHAR(255),
  webhook_secret TEXT,

  -- Routing
  default_team_id UUID,
  default_agent_id UUID,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Messages (with Threading Support)
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES email_inboxes(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- RFC 5322 Email Headers for Threading
  message_id VARCHAR(500) UNIQUE NOT NULL,
  in_reply_to VARCHAR(500),
  references TEXT[],

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

-- Email Attachments
CREATE TABLE IF NOT EXISTS email_attachments (
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

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Email Routing Rules
CREATE TABLE IF NOT EXISTS email_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,

  -- Conditions (JSON for flexibility)
  conditions JSONB NOT NULL,
  -- Example: {"from_contains": "vip@", "subject_contains": "urgent"}

  -- Actions
  assign_to_team_id UUID,
  assign_to_agent_id UUID,
  set_priority VARCHAR(50),
  add_tags TEXT[],
  trigger_ai_classification BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Bounces & Complaints
CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,

  bounce_type VARCHAR(50) NOT NULL, -- hard, soft, complaint
  bounce_reason TEXT,
  should_block BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_messages_inbox ON email_messages(inbox_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_conversation ON email_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_in_reply_to ON email_messages(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from ON email_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_received ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_bounces_recipient ON email_bounces(recipient_email);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE email_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

-- Public access for demo (REPLACE with proper auth in production!)
CREATE POLICY IF NOT EXISTS email_inboxes_public ON email_inboxes FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS email_messages_public ON email_messages FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS email_attachments_public ON email_attachments FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS email_templates_public ON email_templates FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS email_routing_rules_public ON email_routing_rules FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS email_bounces_public ON email_bounces FOR ALL USING (true);

-- ============================================================================
-- Seed Data
-- ============================================================================

-- Demo Inbox
INSERT INTO email_inboxes (name, email_address, resend_domain, status)
VALUES ('Customer Support', 'support@hummdesk.com', 'hummdesk.com', 'active')
ON CONFLICT (email_address) DO NOTHING;

-- Email Templates (Finnish)
INSERT INTO email_templates (name, subject, html_body, text_body, variables) VALUES
(
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
-- Comments
-- ============================================================================

COMMENT ON TABLE email_inboxes IS 'Email inboxes configured with Resend.com API';
COMMENT ON TABLE email_messages IS 'All emails with RFC 5322 threading support';
COMMENT ON TABLE email_attachments IS 'Email attachments stored in Supabase Storage';
COMMENT ON TABLE email_templates IS 'Reusable templates with variable substitution';
COMMENT ON TABLE email_routing_rules IS 'Automated routing based on conditions';
COMMENT ON TABLE email_bounces IS 'Track bounced emails and complaints';
