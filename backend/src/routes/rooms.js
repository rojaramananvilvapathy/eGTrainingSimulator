const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db      = require('../db');
const logger  = require('../config/logger');

const router = express.Router();

// GET /api/rooms — list published rooms (with optional filters)
router.get('/', authenticate, async (req, res) => {
  const { category, difficulty, os, phase } = req.query;
  const conditions = ['r.status = $1'];
  const params     = ['published'];
  let idx = 2;

  if (category)   { conditions.push(`r.category = $${idx++}`);   params.push(category); }
  if (difficulty) { conditions.push(`r.difficulty = $${idx++}`); params.push(difficulty); }
  if (os)         { conditions.push(`(r.os = $${idx++} OR r.os = 'both')`); params.push(os); }
  if (phase)      { conditions.push(`r.phase = $${idx++}`);      params.push(parseInt(phase)); }

  try {
    const { rows } = await db.query(
      `SELECT r.id, r.slug, r.title, r.description, r.os, r.difficulty,
              r.category, r.component_type, r.phase, r.points_total,
              r.estimated_minutes, r.thumbnail_url,
              COALESCE(up.is_completed, FALSE) AS completed,
              COALESCE(up.points_earned, 0)    AS points_earned,
              COUNT(DISTINCT t.id)::int        AS task_count
       FROM rooms r
       LEFT JOIN tasks t ON t.room_id = r.id
       LEFT JOIN user_progress up ON up.room_id = r.id AND up.user_id = $${idx}
       WHERE ${conditions.join(' AND ')}
       GROUP BY r.id, up.is_completed, up.points_earned
       ORDER BY r.phase, r.difficulty, r.title`,
      [...params, req.user.id]
    );
    res.json({ rooms: rows });
  } catch (err) {
    logger.error('Rooms list error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/:slug — room detail with tasks
router.get('/:slug', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, up.is_completed, up.points_earned, up.current_task_seq,
              up.started_at as progress_started_at
       FROM rooms r
       LEFT JOIN user_progress up ON up.room_id = r.id AND up.user_id = $1
       WHERE r.slug = $2 AND r.status = 'published'`,
      [req.user.id, req.params.slug]
    );

    if (!rows.length) return res.status(404).json({ error: 'Room not found' });
    const room = rows[0];

    const { rows: tasks } = await db.query(
      `SELECT t.id, t.sequence, t.title, t.description, t.task_type, t.points, t.flag_required,
              f.is_captured, f.attempts, f.captured_at
       FROM tasks t
       LEFT JOIN flags f ON f.task_id = t.id AND f.user_id = $1
       WHERE t.room_id = $2
       ORDER BY t.sequence`,
      [req.user.id, room.id]
    );

    // Strip YAML from non-admin response
    if (req.user.role === 'learner') delete room.yaml_definition;

    res.json({ room, tasks });
  } catch (err) {
    logger.error('Room detail error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /api/rooms — create room (admin)
router.post('/', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
  const {
    slug, title, description, os, difficulty, phase,
    category, component_type, yaml_definition,
    points_total, estimated_minutes, docker_image,
  } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO rooms (slug, title, description, os, difficulty, phase, category,
        component_type, yaml_definition, points_total, estimated_minutes, docker_image, author_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [slug, title, description, os, difficulty, phase, category,
       component_type, yaml_definition, points_total, estimated_minutes, docker_image, req.user.id]
    );
    logger.info('Room created', { roomId: rows[0].id, admin: req.user.id });
    res.status(201).json({ room: rows[0] });
  } catch (err) {
    logger.error('Room create error', { error: err.message });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PATCH /api/rooms/:id/publish — publish / unpublish (admin)
router.patch('/:id/publish', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
  const { status } = req.body; // 'published' | 'draft' | 'archived'
  try {
    const { rows } = await db.query(
      `UPDATE rooms SET status = $1 WHERE id = $2 RETURNING id, slug, title, status`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json({ room: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update room status' });
  }
});

module.exports = router;
