import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials missing. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Server-side, no session persistence needed
  },
});

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

export default supabase;
