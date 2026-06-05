/**
 * badgeService.js
 * Evaluates badge conditions after flag captures and awards badges automatically.
 * All checks are idempotent — calling twice never double-awards.
 */

const db     = require('../db');
const logger = require('../config/logger');

/**
 * Award a badge to a user (no-op if already awarded).
 * Returns { awarded, badge } — awarded=false if already had it.
 */
async function awardBadge(userId, badgeSlug) {
  const { rows: badges } = await db.query(
    'SELECT id, name, points_bonus FROM badges WHERE slug = $1', [badgeSlug]
  );
  if (!badges.length) return { awarded: false };

  const badge = badges[0];
  const { rows: existing } = await db.query(
    'SELECT id FROM user_badges WHERE user_id = $1 AND badge_id = $2',
    [userId, badge.id]
  );
  if (existing.length) return { awarded: false, badge };

  await db.transaction(async (client) => {
    await client.query(
      'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)',
      [userId, badge.id]
    );
    if (badge.points_bonus > 0) {
      await client.query(
        'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
        [badge.points_bonus, userId]
      );
    }
  });

  logger.info('Badge awarded', { userId, badge: badgeSlug, bonus: badge.points_bonus });
  return { awarded: true, badge };
}

/**
 * Run all badge checks after a flag is captured.
 * Call this from flagService after verifyFlag succeeds.
 */
async function checkAndAwardBadges(userId, roomId, taskId) {
  const awarded = [];

  // ── First flag ever ────────────────────────────────────────
  const { rows: allFlags } = await db.query(
    'SELECT COUNT(*) AS cnt FROM flags WHERE user_id = $1 AND is_captured = TRUE',
    [userId]
  );
  if (parseInt(allFlags[0].cnt) === 1) {
    const r = await awardBadge(userId, 'first-flag');
    if (r.awarded) awarded.push(r.badge);
  }

  // ── First blood ────────────────────────────────────────────
  const { rows: fb } = await db.query(
    'SELECT first_blood FROM flags WHERE task_id = $1 AND user_id = $2 AND is_captured = TRUE',
    [taskId, userId]
  );
  if (fb[0]?.first_blood) {
    const r = await awardBadge(userId, 'first-blood');
    if (r.awarded) awarded.push(r.badge);
  }

  // ── Room completion checks ─────────────────────────────────
  const { rows: room } = await db.query(
    'SELECT category, estimated_minutes FROM rooms WHERE id = $1', [roomId]
  );
  if (!room.length) return awarded;

  const { rows: progress } = await db.query(
    `SELECT up.is_completed, up.time_spent_seconds, up.hints_used, up.started_at, up.completed_at
     FROM user_progress up WHERE up.user_id = $1 AND up.room_id = $2`,
    [userId, roomId]
  );

  if (progress[0]?.is_completed) {
    const { category } = room[0];

    // ── Category-specific completion badges ──────────────────
    if (category === 'installation') {
      const r = await awardBadge(userId, 'first-install');
      if (r.awarded) awarded.push(r.badge);
    }

    // ── No-hints completion (Prereq Pro) ─────────────────────
    if (category === 'prerequisites' && progress[0].hints_used === 0) {
      const r = await awardBadge(userId, 'prereq-pro');
      if (r.awarded) awarded.push(r.badge);
    }

    // ── Speed Demon — finished in < 50% estimated time ───────
    const estimatedSecs = room[0].estimated_minutes * 60;
    if (progress[0].time_spent_seconds > 0 &&
        progress[0].time_spent_seconds < estimatedSecs * 0.5) {
      const r = await awardBadge(userId, 'speed-demon');
      if (r.awarded) awarded.push(r.badge);
    }

    // ── Log Whisperer — first-attempt log analysis ────────────
    if (category === 'troubleshooting') {
      const { rows: attempts } = await db.query(
        `SELECT SUM(f.attempts) AS total_attempts
         FROM flags f JOIN tasks t ON t.id = f.task_id
         WHERE f.user_id = $1 AND t.room_id = $2`,
        [userId, roomId]
      );
      const taskCount = await db.query(
        'SELECT COUNT(*) AS cnt FROM tasks WHERE room_id = $1', [roomId]
      );
      const minAttempts = parseInt(taskCount.rows[0].cnt);
      if (parseInt(attempts[0].total_attempts) <= minAttempts) {
        const r = await awardBadge(userId, 'log-whisperer');
        if (r.awarded) awarded.push(r.badge);
      }

      // ── All troubleshooting rooms complete ───────────────────
      const { rows: troubleRooms } = await db.query(
        `SELECT r.id FROM rooms r WHERE r.category = 'troubleshooting' AND r.status = 'published'`
      );
      const { rows: completedTrouble } = await db.query(
        `SELECT up.room_id FROM user_progress up
         JOIN rooms r ON r.id = up.room_id
         WHERE up.user_id = $1 AND r.category = 'troubleshooting' AND up.is_completed = TRUE`,
        [userId]
      );
      if (troubleRooms.length > 0 && completedTrouble.length === troubleRooms.length) {
        const r = await awardBadge(userId, 'troubleshooter');
        if (r.awarded) awarded.push(r.badge);
      }
    }

    // ── eG Master — all rooms complete ───────────────────────
    const { rows: allRooms } = await db.query(
      `SELECT COUNT(*) AS cnt FROM rooms WHERE status = 'published'`
    );
    const { rows: completedAll } = await db.query(
      `SELECT COUNT(*) AS cnt FROM user_progress WHERE user_id = $1 AND is_completed = TRUE`,
      [userId]
    );
    if (parseInt(allRooms[0].cnt) > 0 &&
        parseInt(completedAll[0].cnt) >= parseInt(allRooms[0].cnt)) {
      const r = await awardBadge(userId, 'eG-master');
      if (r.awarded) awarded.push(r.badge);
    }
  }

  return awarded;
}

/**
 * Refresh global leaderboard ranks.
 * Run after any points change.
 */
async function refreshGlobalRanks() {
  await db.query(`
    UPDATE users u
    SET global_rank = ranked.rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY total_points DESC) AS rank
      FROM users WHERE role = 'learner' AND is_active = TRUE
    ) ranked
    WHERE u.id = ranked.id
  `);
}

module.exports = { awardBadge, checkAndAwardBadges, refreshGlobalRanks };
