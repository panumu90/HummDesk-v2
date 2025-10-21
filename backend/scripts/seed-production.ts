#!/usr/bin/env tsx

/**
 * Production Database Seed Script
 *
 * Seeds initial data into Railway PostgreSQL:
 * - Admin account + user
 * - Demo teams (Billing, Technical Support, Sales)
 * - Demo agents
 * - Sample Knowledge Base articles
 *
 * Usage:
 *   Local: tsx scripts/seed-production.ts
 *   Railway: railway run npm run seed:production
 *
 * IMPORTANT: This script is idempotent - it will skip existing data.
 *
 * Environment Variables Required:
 *   - DATABASE_URL (Railway provides this automatically)
 *   - ADMIN_EMAIL (default: admin@hummdesk.com)
 *   - ADMIN_PASSWORD (default: HummDesk2025!)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

// Import schema (you'll need to adjust the import path)
// For now, I'll create inline types - in production you'd import from schema.ts

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'hummdesk_v2';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function seedDatabase() {
  const startTime = Date.now();

  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║          HummDesk v2 - Database Seed Script            ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  const nodeEnv = process.env.NODE_ENV || 'development';
  log(`Environment: ${nodeEnv}`, 'blue');
  log(`Timestamp: ${new Date().toISOString()}\n`, 'blue');

  // Connect to database
  const connectionString = getConnectionString();
  log('Connecting to database...', 'yellow');

  const sql = postgres(connectionString, {
    max: 1,
    ssl: nodeEnv === 'production' ? 'require' : false,
  });

  const db = drizzle(sql);

  try {
    // Test connection
    const result = await sql`SELECT version()`;
    log(`✓ Connected to PostgreSQL ${result[0].version.split(' ')[1]}\n`, 'green');

    // ======================
    // 1. Seed Admin Account
    // ======================
    log('Seeding admin account...', 'yellow');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@hummdesk.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'HummDesk2025!';

    // Check if account already exists
    const existingAccount = await sql`
      SELECT id FROM accounts WHERE name = 'HummDesk Admin' LIMIT 1
    `;

    let accountId: number;

    if (existingAccount.length > 0) {
      accountId = existingAccount[0].id;
      log('⊙ Admin account already exists, skipping', 'yellow');
    } else {
      const account = await sql`
        INSERT INTO accounts (name, plan, status, created_at, updated_at)
        VALUES ('HummDesk Admin', 'enterprise', 'active', NOW(), NOW())
        RETURNING id
      `;
      accountId = account[0].id;
      log(`✓ Created admin account (ID: ${accountId})`, 'green');
    }

    // ======================
    // 2. Seed Admin User
    // ======================
    log('Seeding admin user...', 'yellow');

    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
    `;

    let adminUserId: number;

    if (existingUser.length > 0) {
      adminUserId = existingUser[0].id;
      log('⊙ Admin user already exists, skipping', 'yellow');
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const user = await sql`
        INSERT INTO users (account_id, email, name, password_hash, role, created_at, updated_at)
        VALUES (${accountId}, ${adminEmail}, 'Admin User', ${hashedPassword}, 'admin', NOW(), NOW())
        RETURNING id
      `;
      adminUserId = user[0].id;
      log(`✓ Created admin user (${adminEmail})`, 'green');
    }

    // ======================
    // 3. Seed Default Inbox
    // ======================
    log('Seeding default inbox...', 'yellow');

    const existingInbox = await sql`
      SELECT id FROM inboxes WHERE account_id = ${accountId} LIMIT 1
    `;

    let inboxId: number;

    if (existingInbox.length > 0) {
      inboxId = existingInbox[0].id;
      log('⊙ Default inbox already exists, skipping', 'yellow');
    } else {
      const inbox = await sql`
        INSERT INTO inboxes (account_id, name, channel_type, created_at, updated_at)
        VALUES (${accountId}, 'General Support', 'web', NOW(), NOW())
        RETURNING id
      `;
      inboxId = inbox[0].id;
      log(`✓ Created default inbox (ID: ${inboxId})`, 'green');
    }

    // ======================
    // 4. Seed Teams
    // ======================
    log('Seeding teams...', 'yellow');

    const teams = [
      { name: 'Billing Team', description: 'Handles billing and payment issues' },
      { name: 'Technical Support', description: 'Resolves technical problems' },
      { name: 'Sales Team', description: 'Manages sales inquiries and partnerships' },
    ];

    const teamIds: Record<string, number> = {};

    for (const team of teams) {
      const existing = await sql`
        SELECT id FROM teams WHERE account_id = ${accountId} AND name = ${team.name} LIMIT 1
      `;

      if (existing.length > 0) {
        teamIds[team.name] = existing[0].id;
        log(`⊙ Team "${team.name}" already exists, skipping`, 'yellow');
      } else {
        const result = await sql`
          INSERT INTO teams (account_id, name, description, created_at, updated_at)
          VALUES (${accountId}, ${team.name}, ${team.description}, NOW(), NOW())
          RETURNING id
        `;
        teamIds[team.name] = result[0].id;
        log(`✓ Created team "${team.name}" (ID: ${result[0].id})`, 'green');
      }
    }

    // ======================
    // 5. Seed Demo Agents
    // ======================
    log('Seeding demo agents...', 'yellow');

    const demoAgents = [
      { name: 'Maria Korhonen', email: 'maria@hummdesk.com', team: 'Billing Team' },
      { name: 'Mikko Järvinen', email: 'mikko@hummdesk.com', team: 'Billing Team' },
      { name: 'Anni Virtanen', email: 'anni@hummdesk.com', team: 'Technical Support' },
      { name: 'Jukka Laine', email: 'jukka@hummdesk.com', team: 'Technical Support' },
      { name: 'Sanna Koskinen', email: 'sanna@hummdesk.com', team: 'Technical Support' },
      { name: 'Timo Nieminen', email: 'timo@hummdesk.com', team: 'Sales Team' },
      { name: 'Laura Mäkinen', email: 'laura@hummdesk.com', team: 'Sales Team' },
    ];

    for (const agent of demoAgents) {
      const existing = await sql`
        SELECT id FROM users WHERE email = ${agent.email} LIMIT 1
      `;

      if (existing.length > 0) {
        log(`⊙ Agent ${agent.name} already exists, skipping`, 'yellow');
      } else {
        const hashedPassword = await bcrypt.hash('Demo1234!', 10);
        const user = await sql`
          INSERT INTO users (account_id, email, name, password_hash, role, created_at, updated_at)
          VALUES (${accountId}, ${agent.email}, ${agent.name}, ${hashedPassword}, 'agent', NOW(), NOW())
          RETURNING id
        `;

        // Assign agent to team
        const teamId = teamIds[agent.team];
        if (teamId) {
          await sql`
            INSERT INTO team_members (team_id, user_id, created_at)
            VALUES (${teamId}, ${user[0].id}, NOW())
          `;
        }

        log(`✓ Created agent ${agent.name}`, 'green');
      }
    }

    // ======================
    // 6. Seed Knowledge Base Articles
    // ======================
    log('Seeding Knowledge Base articles...', 'yellow');

    const articles = [
      {
        title: 'How to Process a Refund',
        content: `# Refund Processing Guide\n\nFollow these steps to process a customer refund:\n\n1. Verify the purchase date and amount\n2. Check if the item is within the return window (30 days)\n3. Confirm the refund method with the customer\n4. Process the refund in the payment system\n5. Send confirmation email to customer\n\n**Important:** Refunds typically take 5-7 business days to appear in the customer's account.`,
        category: 'billing',
        tags: ['refund', 'payment', 'billing'],
      },
      {
        title: 'Troubleshooting Product Defects',
        content: `# Product Defect Resolution\n\nWhen a customer reports a defective product:\n\n1. Ask for photos/videos of the defect\n2. Verify the purchase date and warranty status\n3. Determine if repair or replacement is appropriate\n4. Create a service ticket if repair is needed\n5. Arrange for product exchange if replacement is needed\n\n**Warranty Period:** Most products have a 12-month warranty from purchase date.`,
        category: 'technical',
        tags: ['warranty', 'defect', 'replacement'],
      },
      {
        title: 'Bulk Order Discounts',
        content: `# Bulk Order Pricing\n\nWe offer discounts for bulk orders:\n\n- 10-49 units: 5% discount\n- 50-99 units: 10% discount\n- 100-499 units: 15% discount\n- 500+ units: 20% discount (custom pricing available)\n\n**How to apply:**\n1. Add items to cart\n2. Enter quantity\n3. Discount applies automatically at checkout\n\nFor orders over 500 units, contact our sales team for custom pricing.`,
        category: 'sales',
        tags: ['bulk', 'discount', 'pricing'],
      },
    ];

    for (const article of articles) {
      const existing = await sql`
        SELECT id FROM knowledge_base_articles
        WHERE account_id = ${accountId} AND title = ${article.title}
        LIMIT 1
      `;

      if (existing.length > 0) {
        log(`⊙ Article "${article.title}" already exists, skipping`, 'yellow');
      } else {
        // Generate simple embedding (in production, use Claude)
        const embedding = new Array(1536).fill(0).map(() => Math.random());

        await sql`
          INSERT INTO knowledge_base_articles
          (account_id, title, content, category, tags, published, embedding, created_at, updated_at)
          VALUES (
            ${accountId},
            ${article.title},
            ${article.content},
            ${article.category},
            ${article.tags},
            true,
            ${JSON.stringify(embedding)},
            NOW(),
            NOW()
          )
        `;
        log(`✓ Created article "${article.title}"`, 'green');
      }
    }

    // Close connection
    await sql.end({ timeout: 5 });
    log('\n✓ Database connection closed', 'green');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n${'='.repeat(56)}`, 'cyan');
    log(`Seeding completed in ${duration}s`, 'cyan');
    log(`${'='.repeat(56)}\n`, 'cyan');

    log('Login credentials:', 'yellow');
    log(`  Email: ${adminEmail}`, 'blue');
    log(`  Password: ${adminPassword}`, 'blue');
    log(`  Demo agents password: Demo1234!\n`, 'blue');

    process.exit(0);
  } catch (error) {
    log('\n✗ Seeding failed:', 'red');
    log((error as Error).message, 'red');

    if ((error as Error).stack) {
      console.error((error as Error).stack);
    }

    await sql.end({ timeout: 5 });
    process.exit(1);
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  log('\n✗ Uncaught exception:', 'red');
  log(error.message, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('\n✗ Unhandled promise rejection:', 'red');
  console.error(reason);
  process.exit(1);
});

// Run seeding
seedDatabase();
