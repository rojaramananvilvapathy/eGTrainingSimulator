require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(200) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM schema_migrations WHERE filename = $1', [file]
      );
      if (rows.length > 0) {
        console.log(`  ✓ already applied: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)', [file]
      );
      console.log(`  ✔ applied: ${file}`);
    }
    console.log('\nAll migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
