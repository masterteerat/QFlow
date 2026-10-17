const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

// An idle client dropping (DB restart) must not crash the process
pool.on('error', (err) => console.error('Postgres pool error:', err.message));

module.exports = pool;
