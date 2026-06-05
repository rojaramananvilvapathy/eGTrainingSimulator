const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db      = require('../db');

const router  = express.Router();

// GET /api/users/:id/profile — public profile
router.get('/:id/profile', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              u.total_points, u.global_rank, u.created_at,
              COUNT(DISTINCT f.task_id) FILTER (WHERE f.is_captured) AS flags_captured,
              COUNT(DISTINCT up.room_id) FILTER (WHERE up.is_completed) AS rooms_completed
       FROM users u
       LEFT JOIN flags f ON f.user_id = u.id
       LEFT JOIN user_progress up ON up.user_id = u.id
       WHERE u.id = $1 AND u.is_active = TRUE
       GROUP BY u.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const { rows: badges } = await db.query(
      `SELECT b.slug, b.name, b.description, b.icon_url, ub.awarded_at
       FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 ORDER BY ub.awarded_at DESC`,
      [req.params.id]
    );

    res.json({ user: rows[0], badges });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /api/users/me/progress — current user's room progress
router.get('/me/progress', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT up.*, r.slug, r.title, r.category, r.difficulty, r.points_total
       FROM user_progress up JOIN rooms r ON r.id = up.room_id
       WHERE up.user_id = $1 ORDER BY up.started_at DESC`,
      [req.user.id]
    );
    res.json({ progress: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// GET /api/users/me/badges
router.get('/me/badges', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT b.*, ub.awarded_at FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 ORDER BY ub.awarded_at DESC`,
      [req.user.id]
    );
    res.json({ badges: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// GET /api/users — list all users (admin)
router.get('/', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await db.query(
      `SELECT id, username, email, display_name, role, total_points,
              global_rank, is_active, last_login_at, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );
    const { rows: count } = await db.query('SELECT COUNT(*) FROM users');
    res.json({ users: rows, total: parseInt(count[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/users/:id/role — change role (superadmin only)
router.patch('/:id/role', authenticate, authorize('superadmin'), async (req, res) => {
  const { role } = req.body;
  if (!['learner', 'admin', 'superadmin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const { rows } = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, req.params.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
