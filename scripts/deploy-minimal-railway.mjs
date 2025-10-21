import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = 'postgresql://postgres:GXpvCGKsnDttFyASliWLdvuExBxrTgrx@trolley.proxy.rlwy.net:58722/railway';

async function deploy() {
  const client = new Client({ connectionString });

  try {
    console.log('🚂 Connecting...');
    await client.connect();
    console.log('✅ Connected!\n');

    const schemaPath = join(__dirname, '../database/minimal-email-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    // Remove vector extension (Railway doesn't have it)
    const cleanSchema = schema.replace('CREATE EXTENSION IF NOT EXISTS "vector";', '-- vector extension not needed');

    console.log('🚀 Deploying minimal email schema...\n');
    await client.query(cleanSchema);

    console.log('✅ Schema deployed!\n');

    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(`✅ Tables created: ${result.rows.map(r => r.table_name).join(', ')}\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

deploy();
