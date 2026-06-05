const express = require('express');
const { authenticate } = require('../middleware/auth');
const db      = require('../db');

const router  = express.Router();

// GET /api/leaderboard/global — top 50 global
router.get('/global', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              u.total_points, u.global_rank,
              COUNT(DISTINCT f.task_id) FILTER (WHERE f.is_captured) AS flags_captured
       FROM users u
       LEFT JOIN flags f ON f.user_id = u.id
       WHERE u.role = 'learner' AND u.is_active = TRUE
       GROUP BY u.id
       ORDER BY u.total_points DESC
       LIMIT 50`
    );
    // Inject current user's rank if not in top 50
    const userInList = rows.find(r => r.id === req.user.id);
    let myEntry = null;
    if (!userInList) {
      const { rows: me } = await db.query(
        `SELECT id, username, display_name, avatar_url, total_points, global_rank FROM users WHERE id = $1`,
        [req.user.id]
      );
      myEntry = me[0] || null;
    }
    res.json({ leaderboard: rows, myEntry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboard/room/:roomId — room-specific leaderboard
router.get('/room/:roomId', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              up.points_earned, up.time_spent_seconds, up.completed_at, up.is_completed
       FROM user_progress up
       JOIN users u ON u.id = up.user_id
       WHERE up.room_id = $1 AND up.is_completed = TRUE
       ORDER BY up.points_earned DESC, up.time_spent_seconds ASC
       LIMIT 50`,
      [req.params.roomId]
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room leaderboard' });
  }
});

module.exports = router;
