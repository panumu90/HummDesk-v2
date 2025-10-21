/**
 * Setup Neon Database for HummDesk v2 Production
 *
 * Prerequisites:
 * 1. Create Neon account: https://neon.tech
 * 2. Create new project: HummDesk-v2-production
 * 3. Copy connection string
 * 4. Set environment variable: NEON_DATABASE_URL
 *
 * Run: node scripts/setup-neon.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get from environment or prompt user
const connectionString = process.env.NEON_DATABASE_URL || process.argv[2];

if (!connectionString) {
  console.error('❌ Error: NEON_DATABASE_URL not provided\n');
  console.log('Usage:');
  console.log('  node scripts/setup-neon.mjs <connection_string>');
  console.log('  OR');
  console.log('  NEON_DATABASE_URL="..." node scripts/setup-neon.mjs\n');
  console.log('Get your connection string from: https://console.neon.tech\n');
  process.exit(1);
}

async function setupNeon() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🐘 Connecting to Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📦 Reading UUID schema...');
    const schemaPath = join(__dirname, '../database/supabase-uuid-schema.sql');
    let schema = readFileSync(schemaPath, 'utf8');

    // Neon uses 'vector' extension like Supabase
    console.log('✅ Schema loaded\n');

    console.log('🚀 Deploying full UUID schema to Neon...');
    console.log('⏳ This will take 15-20 seconds...\n');

    // Execute full schema
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

    // Group tables by category
    const emailTables = result.rows.filter(r => r.table_name.startsWith('email_'));
    const coreTables = result.rows.filter(r => !r.table_name.startsWith('email_'));

    console.log('   📧 Email Tables:');
    emailTables.forEach(row => console.log(`      • ${row.table_name}`));

    console.log('\n   📊 Core Tables:');
    coreTables.forEach(row => console.log(`      • ${row.table_name}`));

    if (result.rows.length === 23) {
      console.log('\n🎉 SUCCESS! All 23 tables created!\n');
      console.log('📋 Next steps:');
      console.log('   1. Update backend/.env:');
      console.log(`      DATABASE_URL="${connectionString}"\n`);
      console.log('   2. Deploy backend to Railway:');
      console.log('      railway up\n');
      console.log('   3. Deploy frontend to Vercel:');
      console.log('      vercel --prod\n');
      console.log('   4. Test production:');
      console.log('      curl https://hummdesk-v2.vercel.app/api/health\n');
    } else {
      console.warn(`\n⚠️  Expected 23 tables, found ${result.rows.length}`);
      console.log('Some tables may have failed. Check errors above.');
    }

  } catch (err) {
    console.error('\n❌ Deployment failed:');
    console.error(`   Error: ${err.message}`);
    if (err.position) {
      console.error(`   Position in SQL: ${err.position}`);
    }
    if (err.hint) {
      console.error(`   Hint: ${err.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Connection closed\n');
  }
}

setupNeon();
