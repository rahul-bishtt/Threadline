const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// TODO:
// Connect to the Postgres database using pool.
// Read the schema.sql file content.
// Execute the schema.sql commands to initialize tables.
// Seed initial fallback data for clusters and articles if needed.
// Exit cleanly on success or log/raise database connection errors.

async function initDb() {
  console.log('Initializing database schema...');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Run schema commands
    await pool.query(schemaSql);
    console.log('Database tables and indices created successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDb();
}
