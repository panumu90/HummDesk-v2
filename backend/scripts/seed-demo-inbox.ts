/**
 * Demo Inbox Seed Script
 *
 * Run this to create a demo inbox for testing conversation creation
 * Usage: npx tsx scripts/seed-demo-inbox.ts
 */

import pool from '../src/config/database';
import fs from 'fs';
import path from 'path';

async function seedDemoInbox() {
  console.log('🌱 Seeding demo inbox...\n');

  try {
    // Read and execute the SQL seed file
    const sqlPath = path.join(__dirname, '..', 'src', 'db', 'seeds', 'demo-inbox.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    await pool.query(sql);

    console.log('✅ Demo inbox seeded successfully!\n');
    console.log('📋 Next steps:');
    console.log('   1. Use inbox_id = 1 when creating conversations via AddConversationModal');
    console.log('   2. Account ID: 1 (Humm Demo Account)');
    console.log('   3. Channel: Web');
    console.log('   4. AI features: Enabled ✨\n');

  } catch (error) {
    console.error('❌ Error seeding demo inbox:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed
seedDemoInbox()
  .then(() => {
    console.log('🎉 Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
