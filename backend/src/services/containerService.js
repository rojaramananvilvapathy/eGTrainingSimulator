const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');
const db     = require('../db');
const { provisionFlag } = require('./flagService');
const logger = require('../config/logger');

const docker  = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
const TIMEOUT = parseInt(process.env.LAB_CONTAINER_TIMEOUT_MINUTES || '60') * 60 * 1000;
const MAX_PER_USER = parseInt(process.env.LAB_MAX_CONTAINERS_PER_USER || '2');

/**
 * Start a lab container for a user+room session.
 * Returns { sessionId, containerId, wsToken }
 */
async function startLabContainer(userId, room) {
  // Check user container quota
  const { rows: active } = await db.query(
    `SELECT id FROM lab_containers WHERE user_id = $1 AND status = 'running'`,
    [userId]
  );
  if (active.length >= MAX_PER_USER) {
    throw new Error(`Maximum of ${MAX_PER_USER} active labs reached. Stop an existing lab first.`);
  }

  const sessionId   = uuidv4();
  const containerName = `eg-sim-${userId.slice(0,8)}-${room.id.slice(0,8)}-${Date.now()}`;
  const image       = room.docker_image || process.env.LAB_IMAGE_LINUX;

  logger.info('Starting lab container', { userId, roomId: room.id, image });

  const container = await docker.createContainer({
    Image: image,
    name:  containerName,
    Env: [
      `EG_SIM_SESSION_ID=${sessionId}`,
      `EG_SIM_ROOM_ID=${room.id}`,
      `EG_SIM_USER_ID=${userId}`,
    ],
    HostConfig: {
      Memory:    512 * 1024 * 1024,   // 512 MB
      CpuQuota:  50000,                // 50% of one CPU
      NetworkMode: 'eg-sim-lab-net',
      AutoRemove: false,
    },
    Labels: { 'eg-sim': 'true', 'eg-sim-session': sessionId },
  });

  await container.start();
  const info = await container.inspect();

  const timeoutAt = new Date(Date.now() + TIMEOUT);
  const { rows } = await db.query(
    `INSERT INTO lab_containers
       (user_id, room_id, container_id, container_name, status, started_at, timeout_at)
     VALUES ($1, $2, $3, $4, 'running', NOW(), $5)
     RETURNING id`,
    [userId, room.id, info.Id, containerName, timeoutAt]
  );

  // Initialise progress row
  await db.query(
    `INSERT INTO user_progress (user_id, room_id) VALUES ($1, $2)
     ON CONFLICT (user_id, room_id) DO NOTHING`,
    [userId, room.id]
  );

  // Provision flags for all tasks in the room
  const { rows: tasks } = await db.query(
    'SELECT id FROM tasks WHERE room_id = $1 ORDER BY sequence',
    [room.id]
  );
  for (const task of tasks) {
    await provisionFlag(userId, room.id, task.id, sessionId);
  }

  logger.info('Lab container started', { containerId: info.Id, sessionId });
  return { sessionId, containerId: info.Id, containerDbId: rows[0].id };
}

/**
 * Stop and remove a lab container by session ID.
 */
async function stopLabContainer(userId, containerId) {
  if (!containerId) throw new Error('containerId is required');
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 5 });
    await container.remove();
  } catch (err) {
    logger.warn('Container stop/remove error (may already be stopped)', { error: err.message });
  }

  await db.query(
    `UPDATE lab_containers SET status = 'stopped', terminated_at = NOW() WHERE container_id = $1`,
    [containerId]
  );

  logger.info('Lab container stopped', { containerId, userId });
}

/**
 * Periodic cleanup — stop containers that have exceeded their timeout.
 * Run this on a cron (every 5 minutes).
 */
async function cleanupTimedOutContainers() {
  const { rows } = await db.query(
    `SELECT container_id FROM lab_containers WHERE status = 'running' AND timeout_at < NOW()`
  );
  for (const row of rows) {
    try {
      const container = docker.getContainer(row.container_id);
      await container.stop({ t: 5 }).catch(() => {});
      await container.remove().catch(() => {});
      await db.query(
        `UPDATE lab_containers SET status = 'timeout', terminated_at = NOW() WHERE container_id = $1`,
        [row.container_id]
      );
      logger.info('Timed-out container cleaned up', { containerId: row.container_id });
    } catch (err) {
      logger.error('Cleanup error', { containerId: row.container_id, error: err.message });
    }
  }
}

// Schedule cleanup every 5 minutes
setInterval(cleanupTimedOutContainers, 5 * 60 * 1000);

module.exports = { startLabContainer, stopLabContainer, cleanupTimedOutContainers };
