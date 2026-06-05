const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../db');
const logger = require('../config/logger');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN         || '7d';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXP, issuer: 'eg-sim-platform' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function saveRefreshToken(userId, rawToken) {
  const hash       = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
}

async function rotateRefreshToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const { rows } = await db.query(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
    [hash]
  );
  if (!rows.length)              throw new Error('Invalid refresh token');
  if (rows[0].revoked_at)       throw new Error('Refresh token revoked');
  if (new Date() > rows[0].expires_at) throw new Error('Refresh token expired');

  // Revoke old token
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [rows[0].id]);

  // Issue new pair
  const newRaw = generateRefreshToken();
  await saveRefreshToken(rows[0].user_id, newRaw);
  return { userId: rows[0].user_id, rawRefreshToken: newRaw };
}

async function revokeAllUserTokens(userId) {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  logger.info('All refresh tokens revoked for user', { userId });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'eg-sim-platform' });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  verifyAccessToken,
};
