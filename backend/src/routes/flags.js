const express = require('express');
const { authenticate } = require('../middleware/auth');
const { flagLimiter }  = require('../middleware/rateLimiter');
const { verifyFlag }   = require('../services/flagService');
const { useHint }      = require('../services/hintService');
const { checkAndAwardBadges, refreshGlobalRanks } = require('../services/badgeService');
const db     = require('../db');
const logger = require('../config/logger');

const router = express.Router();

// POST /api/flags/submit
router.post('/submit', authenticate, flagLimiter, async (req, res) => {
  const { taskId, flag, sessionId } = req.body;
  if (!taskId || !flag || !sessionId)
    return res.status(400).json({ error: 'taskId, flag, and sessionId are required' });

  try {
    const result = await verifyFlag(req.user.id, taskId, flag, sessionId);

    if (result.success) {
      // Get roomId for badge checks
      const { rows } = await db.query('SELECT room_id FROM tasks WHERE id = $1', [taskId]);
      const roomId   = rows[0]?.room_id;

      // Check room completion
      if (roomId) {
        const { rows: allTasks } = await db.query(
          'SELECT COUNT(*) AS cnt FROM tasks WHERE room_id = $1', [roomId]
        );
        const { rows: captured } = await db.query(
          `SELECT COUNT(*) AS cnt FROM flags
           WHERE user_id = $1 AND is_captured = TRUE
             AND task_id IN (SELECT id FROM tasks WHERE room_id = $2)`,
          [req.user.id, roomId]
        );
        if (parseInt(captured[0].cnt) >= parseInt(allTasks[0].cnt)) {
          await db.query(
            `UPDATE user_progress SET is_completed = TRUE, completed_at = NOW()
             WHERE user_id = $1 AND room_id = $2 AND is_completed = FALSE`,
            [req.user.id, roomId]
          );
        }
      }

      const newBadges = await checkAndAwardBadges(req.user.id, roomId, taskId);
      await refreshGlobalRanks();
      result.newBadges = newBadges;
    }

    res.json(result);
  } catch (err) {
    logger.error('Flag submit error', { error: err.message });
    res.status(500).json({ error: 'Flag verification failed' });
  }
});

// POST /api/flags/hint
router.post('/hint', authenticate, async (req, res) => {
  const { taskId, tier } = req.body;
  if (!taskId || !tier)
    return res.status(400).json({ error: 'taskId and tier are required' });
  try {
    const result = await useHint(req.user.id, taskId, parseInt(tier));
    if (result.unavailable) return res.status(404).json({ error: 'Hint not available for this task' });
    res.json(result);
  } catch (err) {
    logger.error('Hint error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flags/task/:taskId
router.get('/task/:taskId', authenticate, async (req, res) => {
  const { sessionId } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT is_captured, attempts, captured_at, first_blood
       FROM flags WHERE task_id = $1 AND user_id = $2 AND session_id = $3`,
      [req.params.taskId, req.user.id, sessionId]
    );
    res.json(rows[0] || { is_captured: false, attempts: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch flag status' });
  }
});

// POST /api/flags/evaluate — check if command output meets flag condition
router.post('/evaluate', authenticate, async (req, res) => {
  const { taskId, sessionId, command, output } = req.body;
  if (!taskId || !sessionId) return res.status(400).json({ error: 'taskId and sessionId required' });
  try {
    const { rows: tasks } = await db.query(
      'SELECT flag_condition, flag_trigger FROM tasks WHERE id = $1', [taskId]
    );
    if (!tasks.length) return res.json({ matched: false });
    const { flag_condition, flag_trigger } = tasks[0];
    const combined = (command || '') + '\n' + (output || '');
    let matched = false;
    if (flag_condition === 'output_contains') {
      matched = new RegExp(flag_trigger, 'i').test(combined);
    } else if (flag_condition === 'output_does_not_contain') {
      matched = !new RegExp(flag_trigger, 'i').test(output || '');
    } else if (flag_condition === 'command_matches') {
      matched = new RegExp(flag_trigger, 'i').test(command || '');
    }
    if (!matched) return res.json({ matched: false });
    const { rows: flags } = await db.query(
      'SELECT flag_value, is_captured FROM flags WHERE task_id = $1 AND user_id = $2 AND session_id = $3',
      [taskId, req.user.id, sessionId]
    );
    if (!flags.length) return res.json({ matched: false });
    if (flags[0].is_captured) return res.json({ matched: true, alreadyCaptured: true });
    res.json({ matched: true, flag: flags[0].flag_value });
  } catch (err) {
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

module.exports = router;
