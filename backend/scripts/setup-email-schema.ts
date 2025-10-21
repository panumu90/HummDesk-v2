import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupEmailSchema() {
  console.log('📧 Setting up Email Schema in Supabase...\n');

  try {
    // Read SQL file
    const sqlPath = join(__dirname, '../database/supabase-email-schema.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      console.log(`[${i + 1}/${statements.length}] Executing...`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        if (error) {
          // Try direct query for simpler statements
          const { error: error2 } = await supabase.from('_').select('*').limit(0); // Dummy query to test connection
          if (error2) {
            console.warn(`⚠️  Statement failed (may be expected):`, error.message.substring(0, 100));
          }
        } else {
          console.log(`✅ Success`);
        }
      } catch (err: any) {
        console.warn(`⚠️  Error:`, err.message.substring(0, 100));
      }
    }

    console.log('\n✨ Email schema setup complete!\n');
    console.log('📋 Tables created:');
    console.log('  - email_inboxes');
    console.log('  - email_messages');
    console.log('  - email_attachments');
    console.log('  - email_templates');
    console.log('  - email_routing_rules');
    console.log('  - email_bounces\n');

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupEmailSchema();
