const { Pool } = require('pg');
const logger   = require('../config/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'eg_sim_platform',
  user:     process.env.DB_USER     || 'eg_sim_user',
  password: process.env.DB_PASSWORD,
  max:      20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('connect', () => logger.debug('DB pool: new client connected'));
pool.on('error',   (err) => logger.error('DB pool error', { error: err.message }));

/**
 * Run a parameterised query.
 * @param {string} text  SQL string with $1, $2 … placeholders
 * @param {Array}  params
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug('query executed', { text, duration: Date.now() - start, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('query error', { text, error: err.message });
    throw err;
  }
}

/** Execute multiple statements in a single transaction. */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
