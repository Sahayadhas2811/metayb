const fs = require('fs');
const path = require('path');
const { pool, ensureDatabaseExists } = require('../config/db');

async function setup() {
  try {
    console.log('Connecting to PostgreSQL and verifying database...');
    await ensureDatabaseExists();

    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    const seedPath = path.join(__dirname, '../sql/seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Applying schema migrations...');
    await pool.query(schemaSql);
    console.log('Schema applied successfully.');

    console.log('Applying seed data (products, distributors, historical orders)...');
    await pool.query(seedSql);
    console.log('Seed data inserted successfully.');

    console.log('Database setup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  }
}

setup();
