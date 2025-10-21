/**
 * Deploy Minimal Email Schema via Supabase REST API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://zcexgexkyqwspuwzdkek.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZXhnZXhreXF3c3B1d3pka2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTczOTAsImV4cCI6MjA3NjU3MzM5MH0.cnM9zM2gCYsVpW9ybjv1kPuCfzo-lZMXw_vE05_a-pc';

async function deployMinimal() {
  try {
    console.log('📦 Reading minimal schema...');
    const schemaPath = join(__dirname, '../database/minimal-email-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    console.log(`✅ Loaded ${schema.length} bytes`);
    console.log('🚀 Deploying via Supabase REST API...');

    // Use Supabase's query endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: schema })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Schema deployed!');
    console.log(result);

  } catch (err) {
    console.error('❌ Error:', err.message);

    console.log('\n📋 Manual fallback: Copy and paste this in Supabase SQL Editor:');
    console.log('=' .repeat(80));
    const schema = readFileSync(join(__dirname, '../database/minimal-email-schema.sql'), 'utf8');
    console.log(schema);
    console.log('=' .repeat(80));
  }
}

deployMinimal();
