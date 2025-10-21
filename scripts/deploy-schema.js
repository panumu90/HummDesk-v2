/**
 * Deploy UUID Schema to Supabase
 *
 * Run with: node scripts/deploy-schema.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase connection
const supabaseUrl = 'https://zcexgexkyqwspuwzdkek.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXhnZXhreXF3c3B1d3pka2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTczOTAsImV4cCI6MjA3NjU3MzM5MH0.cnM9zM2gCYsVpW9ybjv1kPuCfzo-lZMXw_vE05_a-pc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deploySchema() {
  try {
    console.log('📦 Reading schema file...');
    const schemaPath = join(__dirname, '../database/supabase-uuid-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    console.log(`✅ Loaded schema (${schema.length} characters)`);
    console.log('🚀 Deploying to Supabase...');

    // Execute using Supabase's RPC (this bypasses the web UI limitations)
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }

    console.log('✅ Schema deployed successfully!');
    console.log('\n🔍 Verifying tables...');

    // Verify tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.warn('⚠️  Could not verify tables:', tablesError);
    } else {
      console.log(`✅ Found ${tables?.length || 0} tables`);
      tables?.forEach(t => console.log(`   - ${t.table_name}`));
    }

  } catch (err) {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  }
}

deploySchema();
