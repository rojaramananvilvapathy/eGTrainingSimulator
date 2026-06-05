const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const db      = require('../db');

const router  = express.Router();
const guard   = [authenticate, authorize('admin', 'superadmin')];

// GET /api/analytics/overview — platform-wide summary stats
router.get('/overview', guard, async (req, res) => {
  try {
    const [users, rooms, flags, activeLabs] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week,
                  COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '1 day') AS active_today
                FROM users WHERE role = 'learner'`),
      db.query(`SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status = 'published') AS published
                FROM rooms`),
      db.query(`SELECT COUNT(*) AS total_captured,
                  COUNT(*) FILTER (WHERE first_blood = TRUE) AS first_bloods,
                  COUNT(*) FILTER (WHERE captured_at > NOW() - INTERVAL '1 day') AS today
                FROM flags WHERE is_captured = TRUE`),
      db.query(`SELECT COUNT(*) AS active FROM lab_containers WHERE status = 'running'`),
    ]);

    res.json({
      users:      users.rows[0],
      rooms:      rooms.rows[0],
      flags:      flags.rows[0],
      activeLabs: activeLabs.rows[0].active,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/analytics/rooms — per-room completion + time stats
router.get('/rooms', guard, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        r.id, r.slug, r.title, r.category, r.difficulty, r.phase,
        r.points_total, r.estimated_minutes,
        COUNT(DISTINCT up.user_id)                                          AS started_count,
        COUNT(DISTINCT up.user_id) FILTER (WHERE up.is_completed = TRUE)   AS completed_count,
        ROUND(
          COUNT(DISTINCT up.user_id) FILTER (WHERE up.is_completed = TRUE)::numeric
          / NULLIF(COUNT(DISTINCT up.user_id), 0) * 100, 1
        )                                                                   AS completion_rate_pct,
        ROUND(AVG(up.time_spent_seconds) FILTER (WHERE up.is_completed = TRUE) / 60.0, 1)
                                                                            AS avg_completion_minutes,
        ROUND(MIN(up.time_spent_seconds) FILTER (WHERE up.is_completed = TRUE) / 60.0, 1)
                                                                            AS fastest_minutes,
        ROUND(AVG(up.hints_used), 1)                                        AS avg_hints_used
      FROM rooms r
      LEFT JOIN user_progress up ON up.room_id = r.id
      WHERE r.status = 'published'
      GROUP BY r.id
      ORDER BY r.phase, r.difficulty
    `);
    res.json({ rooms: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room analytics' });
  }
});

// GET /api/analytics/tasks — most-failed tasks (lowest capture rate)
router.get('/tasks', guard, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        t.id, t.sequence, t.title, t.points,
        r.title AS room_title, r.slug AS room_slug, r.category,
        COUNT(DISTINCT f.user_id)                                     AS attempts_unique_users,
        COUNT(DISTINCT f.user_id) FILTER (WHERE f.is_captured = TRUE) AS captures,
        ROUND(
          COUNT(DISTINCT f.user_id) FILTER (WHERE f.is_captured = TRUE)::numeric
          / NULLIF(COUNT(DISTINCT f.user_id), 0) * 100, 1
        )                                                             AS capture_rate_pct,
        ROUND(AVG(f.attempts), 1)                                     AS avg_attempts_per_user,
        COUNT(DISTINCT hu.user_id)                                    AS hint_users
      FROM tasks t
      JOIN rooms r ON r.id = t.room_id
      LEFT JOIN flags f ON f.task_id = t.id
      LEFT JOIN hint_usage hu ON hu.task_id = t.id
      WHERE r.status = 'published'
      GROUP BY t.id, r.id
      HAVING COUNT(DISTINCT f.user_id) > 0
      ORDER BY capture_rate_pct ASC NULLS LAST
      LIMIT 20
    `);
    res.json({ tasks: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task analytics' });
  }
});

// GET /api/analytics/activity — daily flag captures over last 30 days
router.get('/activity', guard, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        DATE(captured_at)           AS day,
        COUNT(*)                    AS flags_captured,
        COUNT(DISTINCT user_id)     AS active_users
      FROM flags
      WHERE is_captured = TRUE
        AND captured_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(captured_at)
      ORDER BY day ASC
    `);
    res.json({ activity: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/analytics/users/top — top performers with detailed stats
router.get('/users/top', guard, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.username, u.display_name, u.total_points, u.global_rank,
        COUNT(DISTINCT f.task_id) FILTER (WHERE f.is_captured = TRUE) AS flags_captured,
        COUNT(DISTINCT up.room_id) FILTER (WHERE up.is_completed = TRUE) AS rooms_completed,
        COUNT(DISTINCT ub.badge_id)                                    AS badges_earned,
        u.last_login_at
      FROM users u
      LEFT JOIN flags f ON f.user_id = u.id
      LEFT JOIN user_progress up ON up.user_id = u.id
      LEFT JOIN user_badges ub ON ub.user_id = u.id
      WHERE u.role = 'learner' AND u.is_active = TRUE
      GROUP BY u.id
      ORDER BY u.total_points DESC
      LIMIT 20
    `);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

module.exports = router;
