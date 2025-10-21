import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hummdesk_v2',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export interface TenantContext {
  accountId: string;
}

/**
 * Set tenant context for Row Level Security
 * This sets the app.current_account_id variable that RLS policies use
 */
export async function setTenantContext(
  client: PoolClient,
  accountId: string
): Promise<void> {
  await client.query('SET app.current_account_id = $1', [accountId]);
}

/**
 * Execute a query with tenant context
 * Ensures account_id is always validated
 */
export async function tenantQuery<T extends QueryResultRow = any>(
  accountId: string,
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    await setTenantContext(client, accountId);
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction with tenant context
 */
export async function tenantTransaction<T>(
  accountId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setTenantContext(client, accountId);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client from the pool for custom operations
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Close all connections (for graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
