/**
 * Deploy UUID Schema to Supabase via Direct PostgreSQL Connection
 *
 * Run with: node scripts/deploy-schema.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase PostgreSQL connection string (direct connection)
const connectionString = 'postgresql://postgres:einokavipaskalla@db.zcexgexkyqwspuwzdkek.supabase.co:5432/postgres';

async function deploySchema() {
  const client = new Client({ connectionString });

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    console.log('📦 Reading schema file...');
    const schemaPath = join(__dirname, '../database/supabase-uuid-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    console.log(`✅ Loaded schema (${(schema.length / 1024).toFixed(1)} KB)`);

    console.log('🚀 Executing schema...');
    await client.query(schema);
    console.log('✅ Schema deployed successfully!');

    console.log('\n🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${result.rows.length} tables:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${row.table_name}`);
    });

    if (result.rows.length === 23) {
      console.log('\n🎉 All 23 tables created successfully!');
    } else {
      console.warn(`\n⚠️  Expected 23 tables, found ${result.rows.length}`);
    }

  } catch (err) {
    console.error('\n❌ Deployment failed:');
    console.error(err.message);
    if (err.position) {
      console.error(`   Position in SQL: ${err.position}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

deploySchema();
