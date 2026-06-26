const { Pool } = require('pg');
require('dotenv').config();

// TODO:
// Read DATABASE_URL from process.env with fallback configurations.
// Initialize pg.Pool instance to manage connections.
// Export query function and pool client checkout logic for database access.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
