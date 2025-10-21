/**
 * HummDesk v2 - Database Client
 *
 * Initializes Drizzle ORM with postgres.js driver.
 * Exports database instance and all tables for use throughout the application.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USER || 'postgres'}:${process.env.DATABASE_PASSWORD || 'postgres'}@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'hummdesk_v2'}`;

// Create postgres.js client
// For production, consider using a connection pool with max connections
const queryClient = postgres(DATABASE_URL, {
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: true, // Enable prepared statements for better performance
});

// Initialize Drizzle ORM
export const db = drizzle(queryClient, { schema });

// ============================================================================
// EXPORTS
// ============================================================================

// Export all tables and relations
export * from './schema';

// Export database instance as default
export default db;

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeConnection(): Promise<void> {
  await queryClient.end();
  console.log('Database connection closed');
}

/**
 * Set current account ID for row-level security
 * Call this at the beginning of each request to enforce multi-tenancy
 */
export async function setCurrentAccountId(accountId: number): Promise<void> {
  await queryClient`SET LOCAL app.current_account_id = ${accountId}`;
}
