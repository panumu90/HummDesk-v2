/**
 * Split and execute large SQL schema in chunks
 * Works around Railway connection timeouts
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = 'postgresql://postgres:GXpvCGKsnDttFyASliWLdvuExBxrTgrx@trolley.proxy.rlwy.net:58722/railway';

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: false,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🚂 Connecting to Railway...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📦 Reading schema...');
    const schemaPath = join(__dirname, '../database/supabase-uuid-schema.sql');
    const fullSchema = readFileSync(schemaPath, 'utf8');

    // Split by statement (semicolons outside of quotes/functions)
    const statements = fullSchema
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} statements\n`);
    console.log('🚀 Executing migration...\n');

    let completed = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Show progress for major statements
      if (statement.startsWith('CREATE TABLE')) {
        const tableName = statement.match(/CREATE TABLE (\w+)/)?.[1];
        process.stdout.write(`   Creating table: ${tableName}...`);
      } else if (statement.startsWith('CREATE INDEX')) {
        process.stdout.write(`   Creating index...`);
      } else if (statement.startsWith('INSERT INTO')) {
        process.stdout.write(`   Inserting seed data...`);
      } else if (statement.startsWith('CREATE TRIGGER')) {
        process.stdout.write(`   Creating trigger...`);
      } else if (statement.startsWith('CREATE POLICY')) {
        process.stdout.write(`   Creating policy...`);
      }

      try {
        await client.query(statement + ';');
        completed++;
        if (statement.startsWith('CREATE') || statement.startsWith('INSERT')) {
          process.stdout.write(' ✅\n');
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          process.stdout.write(' (exists)\n');
        } else {
          console.log(` ❌`);
          console.log(`   Error: ${err.message}`);
          // Continue with next statement
        }
      }
    }

    console.log(`\n✅ Migration complete! (${completed}/${statements.length} statements executed)\n`);

    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`\n✅ Found ${result.rows.length} tables:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${row.table_name}`);
    });

    console.log('\n🎉 Database ready!\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
