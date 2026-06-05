const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { startLabContainer, stopLabContainer } = require('../services/containerService');
const db      = require('../db');
const logger  = require('../config/logger');

const router = express.Router();

// POST /api/containers/start — spin up a lab container for a room
router.post('/start', authenticate, async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  try {
    const { rows } = await db.query(
      `SELECT * FROM rooms WHERE id = $1 AND status = 'published'`, [roomId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found' });

    const result = await startLabContainer(req.user.id, rows[0]);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Container start error', { error: err.message });
    res.status(err.message.includes('Maximum') ? 429 : 500).json({ error: err.message });
  }
});

// POST /api/containers/stop — stop and remove a running lab container
router.post('/stop', authenticate, async (req, res) => {
  const { sessionId, containerId } = req.body;
  if (!containerId && !sessionId) return res.status(400).json({ error: 'containerId is required' });

  try {
    await stopLabContainer(req.user.id, containerId);
    res.json({ message: 'Lab stopped successfully' });
  } catch (err) {
    logger.error('Container stop error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/active — list user's active containers
router.get('/active', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT lc.id, lc.container_id, lc.status, lc.started_at,
              lc.timeout_at, lc.last_active_at,
              r.slug, r.title, r.category
       FROM lab_containers lc
       JOIN rooms r ON r.id = lc.room_id
       WHERE lc.user_id = $1 AND lc.status = 'running'
       ORDER BY lc.started_at DESC`,
      [req.user.id]
    );
    res.json({ containers: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active containers' });
  }
});

// GET /api/containers/admin/all — all running containers (admin only)
router.get('/admin/all', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT lc.*, u.username, r.title as room_title
       FROM lab_containers lc
       JOIN users u ON u.id = lc.user_id
       JOIN rooms r ON r.id = lc.room_id
       WHERE lc.status = 'running'
       ORDER BY lc.started_at DESC`
    );
    res.json({ containers: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch containers' });
  }
});

module.exports = router;
