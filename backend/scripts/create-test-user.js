/**
 * Create test user for HummDesk v2
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/hummdesk_v2'
});

async function createTestUser() {
  const client = await pool.connect();

  try {
    // Generate password hash
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log('Password hash generated:', passwordHash);

    // Check if account exists
    let accountResult = await client.query(
      'SELECT id FROM accounts WHERE subdomain = $1',
      ['test']
    );

    let accountId;

    if (accountResult.rows.length === 0) {
      // Create test account
      accountResult = await client.query(
        `INSERT INTO accounts (name, subdomain, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['Test Account', 'test', 'trial']
      );
      accountId = accountResult.rows[0].id;
      console.log('Created account with ID:', accountId);
    } else {
      accountId = accountResult.rows[0].id;
      console.log('Using existing account ID:', accountId);
    }

    // Delete existing test user if exists
    await client.query('DELETE FROM users WHERE email = $1', ['test@test.com']);
    console.log('Deleted old test user if it existed');

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['test@test.com', 'Test User', passwordHash]
    );

    const userId = userResult.rows[0].id;
    console.log('Created user with ID:', userId);

    // Link user to account
    await client.query(
      `INSERT INTO account_users (account_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (account_id, user_id) DO NOTHING`,
      [accountId, userId, 'owner']
    );
    console.log('Linked user to account');

    console.log('\n✅ Test user created successfully!');
    console.log('Email: test@test.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTestUser();
