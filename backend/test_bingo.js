const { Client } = require('pg');

async function test() {
  const c = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgrespassword',
    database: 'postgres'
  });
  try {
    await c.connect();
    console.log('BINGO! CONNECTED WITH postgrespassword!');
    const res = await c.query('SELECT current_database(), current_user, version()');
    console.log('INFO:', res.rows[0]);
    await c.end();
  } catch (e) {
    console.error('FAIL:', e.message);
  }
}

test();
