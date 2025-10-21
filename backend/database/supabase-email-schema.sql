-- ============================================================================
-- Email Inboxes & Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_inboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,

  -- IMAP Settings (receiving)
  imap_enabled BOOLEAN DEFAULT TRUE,
  imap_host VARCHAR(255),
  imap_port INTEGER DEFAULT 993,
  imap_username VARCHAR(255),
  imap_password TEXT, -- Encrypted in production!
  imap_use_ssl BOOLEAN DEFAULT TRUE,

  -- SMTP Settings (sending)
  smtp_enabled BOOLEAN DEFAULT TRUE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_username VARCHAR(255),
  smtp_password TEXT, -- Encrypted in production!
  smtp_use_tls BOOLEAN DEFAULT TRUE,
  smtp_from_name VARCHAR(255),

  -- Webhook Alternative (e.g., SendGrid Inbound Parse)
  webhook_url TEXT,
  webhook_secret TEXT,

  -- Auto-reply settings
  auto_reply_enabled BOOLEAN DEFAULT FALSE,
  auto_reply_message TEXT,

  -- Routing
  default_team_id UUID REFERENCES teams(id),
  default_agent_id UUID REFERENCES agents(id),

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, paused, error
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_inboxes_email ON email_inboxes(email_address);
CREATE INDEX idx_email_inboxes_status ON email_inboxes(status);

-- ============================================================================
-- Email Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inbox_id UUID NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Email Identifiers
  message_id VARCHAR(500) UNIQUE NOT NULL, -- RFC Message-ID header
  in_reply_to VARCHAR(500), -- For threading
  references TEXT[], -- Array of Message-IDs for thread tracking

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
  status VARCHAR(50) DEFAULT 'received', -- received, sent, failed, bounced
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,

  -- Thread Info
  thread_id VARCHAR(255), -- Calculated thread identifier
  is_thread_start BOOLEAN DEFAULT FALSE,

  -- Spam Detection
  spam_score FLOAT,
  is_spam BOOLEAN DEFAULT FALSE,

  -- Tracking (for outbound)
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Raw Email
  raw_email TEXT, -- Full raw email for debugging

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

-- ============================================================================
-- Email Attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,

  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(255),
  size_bytes INTEGER,

  -- Storage (could be S3, Supabase Storage, or base64)
  storage_type VARCHAR(50) DEFAULT 'supabase', -- supabase, s3, base64
  storage_path TEXT, -- Path or URL
  storage_bucket VARCHAR(255),

  -- Inline attachments (images in HTML)
  content_id VARCHAR(255), -- For <img cid:...>
  is_inline BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_message ON email_attachments(email_message_id);
CREATE INDEX idx_email_attachments_content_id ON email_attachments(content_id);

-- ============================================================================
-- Email Templates (for outbound)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  html_body TEXT,
  text_body TEXT,

  -- Template Variables (e.g., {{customer_name}}, {{order_number}})
  variables JSONB DEFAULT '[]',

  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_name ON email_templates(name);

-- ============================================================================
-- Email Routing Rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inbox_id UUID NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher priority rules run first
  enabled BOOLEAN DEFAULT TRUE,

  -- Conditions (JSON query for flexibility)
  conditions JSONB NOT NULL,
  /*
    Example conditions:
    {
      "from_contains": "vip@company.com",
      "subject_contains": "urgent",
      "to_contains": "support@",
      "has_attachment": true
    }
  */

  -- Actions
  assign_to_team_id UUID REFERENCES teams(id),
  assign_to_agent_id UUID REFERENCES agents(id),
  set_priority VARCHAR(50), -- low, normal, high, urgent
  add_tags TEXT[],
  trigger_ai_classification BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_routing_inbox ON email_routing_rules(inbox_id);
CREATE INDEX idx_email_routing_priority ON email_routing_rules(priority DESC);

-- ============================================================================
-- Email Bounces & Complaints
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,

  bounce_type VARCHAR(50) NOT NULL, -- hard, soft, complaint
  bounce_reason TEXT,

  -- Block future emails?
  should_block BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_bounces_recipient ON email_bounces(recipient_email);
CREATE INDEX idx_email_bounces_type ON email_bounces(bounce_type);

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================

-- Public access for demo (remove in production!)
ALTER TABLE email_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_inboxes_public ON email_inboxes FOR ALL USING (true);
CREATE POLICY email_messages_public ON email_messages FOR ALL USING (true);
CREATE POLICY email_attachments_public ON email_attachments FOR ALL USING (true);
CREATE POLICY email_templates_public ON email_templates FOR ALL USING (true);
CREATE POLICY email_routing_rules_public ON email_routing_rules FOR ALL USING (true);
CREATE POLICY email_bounces_public ON email_bounces FOR ALL USING (true);

-- ============================================================================
-- Seed Data: Demo Email Inbox
-- ============================================================================

INSERT INTO email_inboxes (
  name,
  email_address,
  imap_enabled,
  smtp_enabled,
  status,
  smtp_from_name
) VALUES
(
  'Customer Support',
  'support@hummdesk.demo',
  FALSE, -- IMAP disabled for demo, use webhook instead
  FALSE, -- SMTP disabled for demo
  'active',
  'HummDesk Support Team'
) ON CONFLICT (email_address) DO NOTHING;

-- ============================================================================
-- Email Templates
-- ============================================================================

INSERT INTO email_templates (name, subject, html_body, text_body, variables) VALUES
(
  'welcome_reply',
  'Re: {{subject}}',
  '<p>Hei {{customer_name}},</p>
  <p>Kiitos yhteydenotostasi! Olemme vastaanottaneet viestisi ja autamme sinua mahdollisimman pian.</p>
  <p>Tiketinnumero: {{ticket_number}}</p>
  <p>Ystävällisin terveisin,<br/>
  {{agent_name}}<br/>
  HummDesk Support</p>',
  'Hei {{customer_name}},\n\nKiitos yhteydenotostasi! Olemme vastaanottaneet viestisi ja autamme sinua mahdollisimman pian.\n\nTiketinnumero: {{ticket_number}}\n\nYstävällisin terveisin,\n{{agent_name}}\nHummDesk Support',
  '["customer_name", "subject", "ticket_number", "agent_name"]'::jsonb
),
(
  'resolved_notification',
  'Tikettiäsi #{{ticket_number}} on päivitetty',
  '<p>Hei {{customer_name}},</p>
  <p>Hienoa! Ongelmasi on ratkaistu.</p>
  <p><strong>Yhteenveto:</strong><br/>{{resolution_summary}}</p>
  <p>Jos sinulla on vielä kysyttävää, vastaa tähän viestiin.</p>
  <p>Ystävällisin terveisin,<br/>
  {{agent_name}}</p>',
  'Hei {{customer_name}},\n\nHienoa! Ongelmasi on ratkaistu.\n\nYhteenveto:\n{{resolution_summary}}\n\nJos sinulla on vielä kysyttävää, vastaa tähän viestiin.\n\nYstävällisin terveisin,\n{{agent_name}}',
  '["customer_name", "ticket_number", "resolution_summary", "agent_name"]'::jsonb
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE email_inboxes IS 'Email inbox configurations with IMAP/SMTP credentials';
COMMENT ON TABLE email_messages IS 'All sent and received emails with threading support';
COMMENT ON TABLE email_attachments IS 'Email attachments stored separately';
COMMENT ON TABLE email_templates IS 'Reusable email templates with variable substitution';
COMMENT ON TABLE email_routing_rules IS 'Automated email routing based on conditions';
COMMENT ON TABLE email_bounces IS 'Track bounced emails and complaints';
