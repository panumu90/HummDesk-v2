/**
 * Deploy UUID Schema to Railway PostgreSQL
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Railway PostgreSQL connection
const connectionString = 'postgresql://postgres:FnZPVhiVYsuejeWvBTLtuKoLYrcLEZLs@postgres-production-3f4c.up.railway.app:5432/railway';

async function deployToRailway() {
  const client = new Client({ connectionString });

  try {
    console.log('🚂 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📦 Reading UUID schema...');
    const schemaPath = join(__dirname, '../database/supabase-uuid-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    console.log(`✅ Loaded ${(schema.length / 1024).toFixed(1)} KB\n`);

    console.log('🚀 Deploying schema to Railway...');
    console.log('⏳ This will take 10-15 seconds...\n');

    await client.query(schema);

    console.log('✅ Schema deployed successfully!\n');

    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${result.rows.length} tables:\n`);
    result.rows.forEach((row, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${row.table_name}`);
    });

    if (result.rows.length === 23) {
      console.log('\n🎉 SUCCESS! All 23 tables created!');
      console.log('\n📋 Next steps:');
      console.log('   1. Update backend/.env with Railway DATABASE_URL');
      console.log('   2. Test email system with: npm run email:test');
      console.log('   3. Start backend: npm run dev');
    } else {
      console.warn(`\n⚠️  Expected 23 tables, found ${result.rows.length}`);
    }

  } catch (err) {
    console.error('\n❌ Deployment failed:');
    console.error(`   Error: ${err.message}`);
    if (err.position) {
      console.error(`   Position in SQL: ${err.position}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Connection closed');
  }
}

deployToRailway();
