import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

// PostgreSQL connection pool (Neon or any PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

// Export pool as default and named export for compatibility
export const db = pool;

// Database types
export interface Conversation {
  id: string;
  customer_name: string;
  customer_email: string;
  subject?: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ai_category?: string;
  ai_confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  assigned_team?: string;
  assigned_agent?: string;
  assigned_agent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  sender: 'customer' | 'agent' | 'system';
  sender_name?: string;
  created_at: string;
}

export interface AIDraft {
  id: string;
  conversation_id: string;
  message_id: string;
  draft_content: string;
  confidence?: number;
  reasoning?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  team_id?: string;
  avatar_url?: string;
  current_load: number;
  max_capacity: number;
  status: 'online' | 'away' | 'busy' | 'offline';
  created_at: string;
}
