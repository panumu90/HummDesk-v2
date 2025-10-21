-- Minimal Email Schema for HummDesk v2
-- Only essential tables to get email system working

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- Email Inboxes
CREATE TABLE email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  resend_api_key TEXT,
  resend_domain VARCHAR(255),
  webhook_secret TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Messages
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES email_inboxes(id) ON DELETE CASCADE,

  message_id VARCHAR(500) UNIQUE NOT NULL,
  in_reply_to VARCHAR(500),
  references_header TEXT[],

  from_address VARCHAR(255) NOT NULL,
  to_addresses TEXT[] NOT NULL,
  subject TEXT,
  html_body TEXT,
  text_body TEXT,

  direction VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'received',
  thread_id VARCHAR(255),

  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_messages_inbox ON email_messages(inbox_id);
CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_from ON email_messages(from_address);

-- Email Templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(500),
  html_body TEXT,
  text_body TEXT,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO email_inboxes (name, email_address, resend_domain, status)
VALUES ('Customer Support', 'support@hummdesk.com', 'hummdesk.com', 'active')
ON CONFLICT (email_address) DO NOTHING;

INSERT INTO email_templates (name, subject, html_body, text_body, variables) VALUES
(
  'welcome_reply',
  'Re: {{subject}}',
  '<p>Hei {{customer_name}},</p><p>Kiitos yhteydenotostasi!</p>',
  'Hei {{customer_name}},\n\nKiitos yhteydenotostasi!',
  '["customer_name", "subject"]'::jsonb
)
ON CONFLICT (name) DO NOTHING;
