const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db     = require('../db');
const logger = require('../config/logger');

const FLAG_SECRET = process.env.FLAG_SECRET;
const FLAG_PREFIX = process.env.FLAG_PREFIX || 'eGSIM';

if (!FLAG_SECRET) throw new Error('FLAG_SECRET must be set in environment variables');

/**
 * Generate a deterministic, session-scoped flag.
 * Format: eGSIM{<hmac_hex>}
 */
function generateFlag(userId, roomId, taskId, sessionId) {
  const data = `${userId}:${roomId}:${taskId}:${sessionId}`;
  const hmac = crypto.createHmac('sha256', FLAG_SECRET).update(data).digest('hex');
  return `${FLAG_PREFIX}{${hmac}}`;
}

function hashFlag(flagValue) {
  return crypto.createHash('sha256').update(flagValue + FLAG_SECRET).digest('hex');
}

/**
 * Provision a flag record for a user+task+session.
 * Called when a lab container starts.
 */
async function provisionFlag(userId, roomId, taskId, sessionId) {
  const flagValue = generateFlag(userId, roomId, taskId, sessionId);
  const flagHash  = hashFlag(flagValue);

  await db.query(
    `INSERT INTO flags (task_id, user_id, session_id, flag_hash, flag_value)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (task_id, user_id, session_id) DO NOTHING`,
    [taskId, userId, sessionId, flagHash, flagValue]
  );

  return flagValue;
}

/**
 * Verify a submitted flag string against the stored record.
 * Returns { success, points, firstBlood, message }
 */
async function verifyFlag(userId, taskId, submittedFlag, sessionId) {
  const { rows } = await db.query(
    `SELECT f.id, f.flag_value, f.is_captured, f.flag_hash,
            t.points, t.room_id, r.title as room_title
     FROM flags f
     JOIN tasks t ON t.id = f.task_id
     JOIN rooms r ON r.id = t.room_id
     WHERE f.task_id = $1 AND f.user_id = $2 AND f.session_id = $3`,
    [taskId, userId, sessionId]
  );

  if (!rows.length) {
    return { success: false, message: 'No active flag found for this task' };
  }

  const flag = rows[0];

  // Increment attempt counter
  await db.query('UPDATE flags SET attempts = attempts + 1 WHERE id = $1', [flag.id]);

  if (flag.is_captured) {
    return { success: false, message: 'Flag already captured' };
  }

  if (submittedFlag.trim() !== flag.flag_value) {
    logger.warn('Incorrect flag submission', { userId, taskId });
    return { success: false, message: 'Incorrect flag' };
  }

  // Check first blood
  const { rows: priorCaptures } = await db.query(
    `SELECT id FROM flags WHERE task_id = $1 AND is_captured = TRUE LIMIT 1`,
    [taskId]
  );
  const firstBlood = priorCaptures.length === 0;

  // Mark captured
  await db.query(
    `UPDATE flags SET is_captured = TRUE, captured_at = NOW(), first_blood = $1 WHERE id = $2`,
    [firstBlood, flag.id]
  );

  // Award points (with first-blood bonus)
  const basePoints  = flag.points;
  const bonusPoints = firstBlood ? Math.floor(basePoints * 0.5) : 0;
  const totalPoints = basePoints + bonusPoints;

  await db.query(
    `UPDATE users SET total_points = total_points + $1 WHERE id = $2`,
    [totalPoints, userId]
  );

  // Update user progress
  await db.query(
    `UPDATE user_progress
     SET points_earned = points_earned + $1, current_task_seq = current_task_seq + 1
     WHERE user_id = $2 AND room_id = $3`,
    [totalPoints, userId, flag.room_id]
  );

  logger.info('Flag captured', { userId, taskId, firstBlood, points: totalPoints });

  return {
    success:    true,
    points:     totalPoints,
    basePoints,
    bonusPoints,
    firstBlood,
    message:    firstBlood
      ? `🩸 FIRST BLOOD! +${totalPoints} XP (${basePoints} + ${bonusPoints} first-blood bonus)`
      : `✅ Correct! +${totalPoints} XP`,
  };
}

module.exports = { generateFlag, provisionFlag, verifyFlag };
