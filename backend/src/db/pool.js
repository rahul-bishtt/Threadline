const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('Warning: DATABASE_URL environment variable is missing.');
}

/**
 * PostgreSQL connection pool manager.
 */
const pool = new Pool({
  connectionString: databaseUrl,
});

/**
 * Tests the database connection pool by running a simple query.
 * 
 * @async
 * @function testConnection
 * @returns {Promise<boolean>} Resolves to true if the connection was successful.
 * @throws {Error} If connection fails or query execution encounters a database error.
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT now()');
    console.log(`Database connection verified. Server time: ${res.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    throw error;
  }
}

/**
 * Executes a callback function containing database actions inside a SQL transaction block.
 * Handles BEGIN, COMMIT, and ROLLBACK automatically.
 * 
 * @async
 * @function withTransaction
 * @param {function(object): Promise<any>} callback - Async function that performs query operations. Takes checked out PG client as argument.
 * @returns {Promise<any>} The resolved result from the callback.
 * @throws {Error} Propagates any error encountered during query operations, triggering a ROLLBACK.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    console.error('Transaction failed. Rolling back...', error.message);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Shuts down the PostgreSQL connection pool gracefully, waiting for all checked-out clients to return.
 * 
 * @async
 * @function closePool
 * @returns {Promise<void>}
 * @throws {Error} If pool shutdown encounters errors.
 */
async function closePool() {
  console.log('Shutting down database connection pool...');
  await pool.end();
  console.log('Database pool shutdown complete.');
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
  withTransaction,
  closePool,
};
