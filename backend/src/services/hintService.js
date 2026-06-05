const db     = require('../db');
const logger = require('../config/logger');

/**
 * Use a hint for a task.
 * Deducts XP, records usage, returns hint text.
 * Returns { hint, cost, alreadyUsed }
 */
async function useHint(userId, taskId, tier) {
  if (![1, 2, 3].includes(tier)) throw new Error('Hint tier must be 1, 2, or 3');

  // Fetch task hints
  const { rows: tasks } = await db.query(
    `SELECT hint_1, hint_1_cost, hint_2, hint_2_cost, hint_3, hint_3_cost, room_id
     FROM tasks WHERE id = $1`, [taskId]
  );
  if (!tasks.length) throw new Error('Task not found');
  const task = tasks[0];

  const hintText = task[`hint_${tier}`];
  const hintCost = task[`hint_${tier}_cost`];

  if (!hintText) return { hint: null, cost: 0, alreadyUsed: false, unavailable: true };

  // Check if already used
  const { rows: existing } = await db.query(
    `SELECT id FROM hint_usage WHERE user_id = $1 AND task_id = $2 AND hint_tier = $3`,
    [userId, taskId, tier]
  );
  if (existing.length) {
    return { hint: hintText, cost: 0, alreadyUsed: true };
  }

  // Deduct XP and record
  await db.transaction(async (client) => {
    await client.query(
      `INSERT INTO hint_usage (user_id, task_id, hint_tier, points_deducted) VALUES ($1, $2, $3, $4)`,
      [userId, taskId, tier, hintCost]
    );
    await client.query(
      `UPDATE users SET total_points = GREATEST(0, total_points - $1) WHERE id = $2`,
      [hintCost, userId]
    );
    await client.query(
      `UPDATE user_progress SET hints_used = hints_used + 1, hints_cost = hints_cost + $1
       WHERE user_id = $2 AND room_id = (SELECT room_id FROM tasks WHERE id = $3)`,
      [hintCost, userId, taskId]
    );
  });

  logger.info('Hint used', { userId, taskId, tier, cost: hintCost });
  return { hint: hintText, cost: hintCost, alreadyUsed: false };
}

module.exports = { useHint };
