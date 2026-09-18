const { Pool, Client } = require('pg');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'metayb_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Dhas&subi',
};

async function ensureDatabaseExists() {
  const adminClient = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: 'postgres',
    user: dbConfig.user,
    password: dbConfig.password,
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbConfig.database]
    );

    if (res.rowCount === 0) {
      console.log(`Database "${dbConfig.database}" does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`Database "${dbConfig.database}" created successfully.`);
    }
  } catch (err) {
    console.error('Error ensuring database exists:', err.message);
    throw err;
  } finally {
    await adminClient.end();
  }
}

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  pool,
  dbConfig,
  ensureDatabaseExists,
};
