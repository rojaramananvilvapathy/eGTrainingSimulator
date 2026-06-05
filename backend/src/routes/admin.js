const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { generateTroubleshootingLab, VALID_SCENARIO_TYPES } = require('../../../scenario-engine/engine/dynamicLabGenerator');
const { generateLabFromScreenshot } = require('../services/screenshotLabService');
const db      = require('../db');
const logger  = require('../config/logger');
const yaml    = require('js-yaml');

const router = express.Router();
const guard  = [authenticate, authorize('admin', 'superadmin')];

// POST /api/admin/generate-lab
router.post('/generate-lab', guard, async (req, res) => {
  try {
    const result = await generateTroubleshootingLab(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/generate-from-screenshot
router.post('/generate-from-screenshot', guard, async (req, res) => {
  const { base64Image, mediaType, context } = req.body;
  if (!base64Image || !mediaType)
    return res.status(400).json({ error: 'base64Image and mediaType are required' });
  try {
    const result = await generateLabFromScreenshot(base64Image, mediaType, context || {}, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Screenshot lab generation failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/scenario-types
router.get('/scenario-types', guard, (req, res) => {
  res.json({ types: VALID_SCENARIO_TYPES });
});

// GET /api/admin/users
router.get('/users', guard, async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const wherePart = search ? `WHERE (u.username ILIKE $3 OR u.email ILIKE $3 OR u.display_name ILIKE $3)` : '';
    const params = search ? [parseInt(limit), offset, `%${search}%`] : [parseInt(limit), offset];
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.role,
              u.total_points, u.global_rank, u.is_active, u.last_login_at, u.created_at,
              COUNT(DISTINCT f.task_id) FILTER (WHERE f.is_captured) AS flags_captured,
              COUNT(DISTINCT up.room_id) FILTER (WHERE up.is_completed) AS rooms_completed
       FROM users u
       LEFT JOIN flags f ON f.user_id = u.id
       LEFT JOIN user_progress up ON up.user_id = u.id
       ${wherePart}
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, params
    );
    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) FROM users ${wherePart}`, search ? [`%${search}%`] : []
    );
    res.json({ users: rows, total: parseInt(cnt[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', guard, async (req, res) => {
  const { role, is_active } = req.body;
  const updates = [], params = [];
  if (role      !== undefined) updates.push(`role = $${params.push(role)}`);
  if (is_active !== undefined) updates.push(`is_active = $${params.push(is_active)}`);
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, username, role, is_active`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    logger.info('User updated by admin', { admin: req.user.id, target: req.params.id });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/admin/rooms — create room with optional YAML
router.post('/rooms', guard, async (req, res) => {
  const { yaml_definition, ...meta } = req.body;
  try {
    let room = null;
    if (yaml_definition) {
      const { loadRoom } = require('../../../scenario-engine/engine/parser');
      room = loadRoom(yaml_definition);
    }
    const { rows } = await db.query(
      `INSERT INTO rooms (slug, title, description, os, difficulty, phase, category,
         component_type, yaml_definition, points_total, estimated_minutes, docker_image, author_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, slug, title, status`,
      [
        meta.slug || room?.id, meta.title || room?.title,
        meta.description || room?.description || '',
        meta.os || room?.os || 'linux',
        meta.difficulty || room?.difficulty || 'medium',
        meta.phase || room?.phase || 3,
        meta.category || room?.category || 'prerequisites',
        meta.component_type || room?.component_type || null,
        yaml_definition || null,
        meta.points_total || room?.points_total || 0,
        meta.estimated_minutes || room?.estimated_minutes || 30,
        meta.docker_image || room?.docker_image || null,
        req.user.id,
      ]
    );
    if (room?.tasks?.length) {
      for (const t of room.tasks) {
        await db.query(
          `INSERT INTO tasks (room_id, sequence, title, description, task_type, points,
             hint_1, hint_1_cost, hint_2, hint_2_cost, hint_3, hint_3_cost, answer_explanation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [rows[0].id, t.sequence, t.title, t.description || '',
           t.type || 'terminal', t.points || 10,
           t.hints?.[0]?.text, t.hints?.[0]?.cost || 10,
           t.hints?.[1]?.text, t.hints?.[1]?.cost || 20,
           t.hints?.[2]?.text, t.hints?.[2]?.cost || 30,
           t.answer_explanation || '']
        );
      }
    }
    res.status(201).json({ room: rows[0], taskCount: room?.tasks?.length || 0 });
  } catch (err) {
    logger.error('Admin room create error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
