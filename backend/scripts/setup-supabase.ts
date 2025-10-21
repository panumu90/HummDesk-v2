/**
 * Supabase Setup Script
 *
 * This script creates the database schema and seed data in Supabase.
 * Run with: npx tsx scripts/setup-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Create Supabase client from env vars
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

async function setupSupabase() {
  console.log('🚀 Starting Supabase setup...\n');

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '../database/supabase-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📝 Executing Supabase schema...');

    // Split the SQL file by statement (simplified approach)
    // Note: Supabase's JS client doesn't support running raw SQL directly
    // We'll need to use the Supabase SQL Editor or create tables via client API

    console.log('\n⚠️  MANUAL STEP REQUIRED:');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Go to your project: https://zcexgexkyqwspuwzdkek.supabase.co');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Click "New Query"');
    console.log('5. Paste the contents of: backend/database/supabase-schema.sql');
    console.log('6. Click "Run" to execute the schema');
    console.log('──────────────────────────────────────────────────────────────\n');

    // Test connection
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase.from('teams').select('count');

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Tables not found. Please run the SQL schema in Supabase SQL Editor first.');
        console.log('   See instructions above.');
      } else {
        console.error('❌ Connection error:', error.message);
      }
      return;
    }

    console.log('✅ Supabase connection successful!');

    // Check if data exists
    const { data: teams } = await supabase.from('teams').select('*');
    const { data: agents } = await supabase.from('agents').select('*');
    const { data: conversations } = await supabase.from('conversations').select('*');

    console.log('\n📊 Database Status:');
    console.log(`   - Teams: ${teams?.length || 0}`);
    console.log(`   - Agents: ${agents?.length || 0}`);
    console.log(`   - Conversations: ${conversations?.length || 0}`);

    if (teams && teams.length > 0) {
      console.log('\n✅ Database is ready!');
      console.log('   Run `npm run dev` to start the backend server.');
    } else {
      console.log('\n⚠️  No data found. The schema has been created but seed data is missing.');
      console.log('   Run the full SQL script in Supabase SQL Editor to add seed data.');
    }

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupSupabase();
