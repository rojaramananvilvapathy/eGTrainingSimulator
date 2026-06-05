const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db       = require('../db');
const tokens   = require('../services/tokenService');
const { authenticate } = require('../middleware/auth');
const logger   = require('../config/logger');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────
const registerRules = [
  body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('display_name').optional().trim().isLength({ max: 100 }),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validationGuard(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', registerRules, validationGuard, async (req, res) => {
  const { username, email, password, display_name } = req.body;
  try {
    // Check uniqueness
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, role, total_points, created_at`,
      [username, email, password_hash, display_name || username]
    );
    const user = rows[0];

    const accessToken  = tokens.generateAccessToken(user);
    const rawRefresh   = tokens.generateRefreshToken();
    await tokens.saveRefreshToken(user.id, rawRefresh);

    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address) VALUES ($1, 'register', $2)`,
      [user.id, req.ip]
    );

    logger.info('New user registered', { userId: user.id, username: user.username });

    res.status(201).json({
      user,
      accessToken,
      refreshToken: rawRefresh,
    });
  } catch (err) {
    logger.error('Register error', { error: err.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', loginRules, validationGuard, async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT id, username, email, display_name, role, total_points, password_hash, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn('Failed login attempt', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const accessToken = tokens.generateAccessToken(user);
    const rawRefresh  = tokens.generateRefreshToken();
    await tokens.saveRefreshToken(user.id, rawRefresh);

    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address) VALUES ($1, 'login', $2)`,
      [user.id, req.ip]
    );

    const { password_hash: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken: rawRefresh });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const { userId, rawRefreshToken } = await tokens.rotateRefreshToken(refreshToken);
    const { rows } = await db.query(
      'SELECT id, username, email, role, total_points FROM users WHERE id = $1',
      [userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    const accessToken = tokens.generateAccessToken(rows[0]);
    res.json({ accessToken, refreshToken: rawRefreshToken });
  } catch (err) {
    logger.warn('Token refresh failed', { error: err.message });
    res.status(401).json({ error: err.message });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    await tokens.revokeAllUserTokens(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, email, display_name, role, total_points, global_rank,
              avatar_url, email_verified, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    logger.error('Profile fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
