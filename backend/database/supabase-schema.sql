-- ========================================
-- HummDesk v2 - Supabase Schema
-- ========================================
--
-- This schema creates tables for HummDesk v2 in Supabase
-- Run this in Supabase SQL Editor
--

-- Drop existing tables (if any)
DROP TABLE IF EXISTS ai_drafts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- ========================================
-- Teams Table
-- ========================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- Agents Table
-- ========================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  team_id UUID REFERENCES teams(id),
  avatar_url TEXT,
  current_load INT DEFAULT 0,
  max_capacity INT DEFAULT 10,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- Conversations Table
-- ========================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ai_category TEXT,
  ai_confidence NUMERIC(3,2),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  assigned_team TEXT,
  assigned_agent TEXT,
  assigned_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- Messages Table
-- ========================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'agent', 'system')),
  sender_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- AI Drafts Table
-- ========================================
CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  draft_content TEXT NOT NULL,
  confidence NUMERIC(3,2),
  reasoning TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'edited')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- Indexes for Performance
-- ========================================
CREATE INDEX idx_conversations_customer_email ON conversations(customer_email);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_ai_drafts_conversation_id ON ai_drafts(conversation_id);
CREATE INDEX idx_agents_team_id ON agents(team_id);

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================
-- For demo purposes, allow public access
-- In production, you'd want proper auth rules

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- Public read/write for demo (CHANGE IN PRODUCTION!)
CREATE POLICY "Enable all for teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for ai_drafts" ON ai_drafts FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- Seed Data
-- ========================================

-- Teams
INSERT INTO teams (id, name, description, color) VALUES
('00000000-0000-4000-8000-000000000001', 'Billing Team', 'Handles billing and payment inquiries', '#10B981'),
('00000000-0000-4000-8000-000000000002', 'Technical Support', 'Technical issues and product support', '#3B82F6'),
('00000000-0000-4000-8000-000000000003', 'Sales Team', 'Sales and business development', '#F59E0B');

-- Agents
INSERT INTO agents (id, name, email, team_id, current_load, max_capacity, status) VALUES
('10000000-0000-4000-8000-000000000001', 'Maria Korhonen', 'maria@hummdesk.com', '00000000-0000-4000-8000-000000000001', 3, 8, 'online'),
('10000000-0000-4000-8000-000000000002', 'Mikko Järvinen', 'mikko@hummdesk.com', '00000000-0000-4000-8000-000000000001', 2, 8, 'online'),
('10000000-0000-4000-8000-000000000003', 'Laura Virtanen', 'laura@hummdesk.com', '00000000-0000-4000-8000-000000000002', 5, 10, 'online'),
('10000000-0000-4000-8000-000000000004', 'Jukka Laine', 'jukka@hummdesk.com', '00000000-0000-4000-8000-000000000002', 4, 10, 'away'),
('10000000-0000-4000-8000-000000000005', 'Sanna Mäkinen', 'sanna@hummdesk.com', '00000000-0000-4000-8000-000000000003', 1, 6, 'online');

-- Sample Conversation
INSERT INTO conversations (id, customer_name, customer_email, subject, status, priority, assigned_team, assigned_agent, assigned_agent_id, created_at) VALUES
('20000000-0000-4000-8000-000000000001', 'Matti Meikäläinen', 'matti@example.com', 'Laskutus ongelma', 'open', 'normal', 'Billing Team', 'Maria Korhonen', '10000000-0000-4000-8000-000000000001', now() - interval '2 hours');

-- Sample Message
INSERT INTO messages (conversation_id, content, sender, sender_name, created_at) VALUES
('20000000-0000-4000-8000-000000000001', 'Hei, sain tuplalaskun kuluvan kuun maksuista. Voitteko auttaa?', 'customer', 'Matti Meikäläinen', now() - interval '2 hours');

-- Sample AI Draft
INSERT INTO ai_drafts (conversation_id, message_id, draft_content, confidence, reasoning, status) VALUES
('20000000-0000-4000-8000-000000000001',
 (SELECT id FROM messages WHERE conversation_id = '20000000-0000-4000-8000-000000000001' LIMIT 1),
 'Hei Matti! Pahoittelut tuplalaskutuksesta. Tarkistan tilanteen ja korjaan sen välittömästi. Palautamme yhdestä laskusta maksetun summan 3-5 arkipäivässä. Voitko vahvistaa laskujen numerot?',
 0.92,
 'Customer reports duplicate billing. Response acknowledges issue, promises investigation and refund timeline.',
 'pending');

-- ========================================
-- Success Message
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ HummDesk v2 schema created successfully!';
  RAISE NOTICE '📊 Sample data inserted:';
  RAISE NOTICE '   - 3 teams';
  RAISE NOTICE '   - 5 agents';
  RAISE NOTICE '   - 1 conversation';
  RAISE NOTICE '   - 1 message';
  RAISE NOTICE '   - 1 AI draft';
END $$;
