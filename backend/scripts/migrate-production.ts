#!/usr/bin/env tsx

/**
 * Production Database Migration Script
 *
 * Runs all pending Drizzle ORM migrations on Railway PostgreSQL.
 *
 * Usage:
 *   Local: tsx scripts/migrate-production.ts
 *   Railway: railway run npm run migrate:production
 *
 * Environment Variables Required:
 *   - DATABASE_URL (Railway provides this automatically)
 *   OR
 *   - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for pretty logging
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getConnectionString(): string {
  // Railway provides DATABASE_URL automatically
  if (process.env.DATABASE_URL) {
    log('✓ Using DATABASE_URL from environment', 'green');
    return process.env.DATABASE_URL;
  }

  // Fallback to individual connection parameters
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'hummdesk_v2';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  log('⚠ DATABASE_URL not found, constructing from individual env vars', 'yellow');
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function runMigrations() {
  const startTime = Date.now();

  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║        HummDesk v2 - Database Migration Script        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  // Validate environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  log(`Environment: ${nodeEnv}`, 'blue');
  log(`Timestamp: ${new Date().toISOString()}`, 'blue');

  // Get connection string
  const connectionString = getConnectionString();
  log(`Database: ${connectionString.replace(/:[^:@]+@/, ':****@')}`, 'blue'); // Hide password in logs

  // Check if migrations directory exists
  const migrationsPath = path.join(__dirname, '..', 'src', 'db', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    log(`\n✗ Migrations directory not found: ${migrationsPath}`, 'red');
    log('Run "npm run db:generate" to create migrations first.', 'yellow');
    process.exit(1);
  }

  // Count migration files
  const migrationFiles = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
  log(`Found ${migrationFiles.length} migration file(s)\n`, 'blue');

  // Create PostgreSQL connection
  let sql: postgres.Sql;
  try {
    log('Connecting to database...', 'yellow');
    sql = postgres(connectionString, {
      max: 1, // Single connection for migrations
      ssl: nodeEnv === 'production' ? 'require' : false,
      connect_timeout: 10, // 10 seconds
      idle_timeout: 20,
      max_lifetime: 60 * 30, // 30 minutes
    });

    // Test connection
    const result = await sql`SELECT version()`;
    log(`✓ Connected to PostgreSQL ${result[0].version.split(' ')[1]}`, 'green');
  } catch (error) {
    log('\n✗ Database connection failed:', 'red');
    log((error as Error).message, 'red');
    process.exit(1);
  }

  // Run migrations
  try {
    log('\nRunning migrations...', 'yellow');
    const db = drizzle(sql);

    await migrate(db, {
      migrationsFolder: migrationsPath,
    });

    log('✓ Migrations completed successfully!', 'green');
  } catch (error) {
    log('\n✗ Migration failed:', 'red');
    log((error as Error).message, 'red');

    if ((error as Error).stack) {
      log('\nStack trace:', 'red');
      console.error((error as Error).stack);
    }

    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  // Close connection
  try {
    await sql.end({ timeout: 5 });
    log('✓ Database connection closed', 'green');
  } catch (error) {
    log('⚠ Warning: Could not close database connection cleanly', 'yellow');
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n${'='.repeat(56)}`, 'cyan');
  log(`Migration completed in ${duration}s`, 'cyan');
  log(`${'='.repeat(56)}\n`, 'cyan');

  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log('\n✗ Uncaught exception:', 'red');
  log(error.message, 'red');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('\n✗ Unhandled promise rejection:', 'red');
  console.error(reason);
  process.exit(1);
});

// Run migrations
runMigrations();
