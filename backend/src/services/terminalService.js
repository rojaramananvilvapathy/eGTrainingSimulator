/**
 * terminalService.js
 * Bridges browser xterm.js (via Socket.IO) ↔ Docker container PTY.
 * Events:
 *   client → server : 'terminal:input'  { data: string }
 *   server → client : 'terminal:output' { data: string }
 *   client → server : 'terminal:resize' { cols, rows }
 *   server → client : 'terminal:error'  { message }
 */
const Docker = require('dockerode');
const { verifyAccessToken } = require('./tokenService');
const db     = require('../db');
const logger = require('../config/logger');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

module.exports = function attachTerminalService(io) {
  const termNS = io.of('/terminal');

  termNS.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  termNS.on('connection', (socket) => {
    logger.info('Terminal socket connected', { userId: socket.userId, socketId: socket.id });
    let exec = null;
    let stream = null;

    socket.on('terminal:start', async ({ containerId, sessionId }) => {
      try {
        // Validate user owns this container
        const { rows } = await db.query(
          `SELECT id FROM lab_containers
           WHERE container_id = $1 AND user_id = $2 AND status = 'running'`,
          [containerId, socket.userId]
        );
        if (!rows.length) {
          return socket.emit('terminal:error', { message: 'Container not found or not running' });
        }

        const container = docker.getContainer(containerId);
        exec = await container.exec({
          AttachStdin:  true,
          AttachStdout: true,
          AttachStderr: true,
          Tty:          true,
          Cmd:          ['/bin/bash'],
        });

        stream = await exec.start({ hijack: true, stdin: true });

        stream.on('data', (chunk) => {
          socket.emit('terminal:output', { data: chunk.toString('utf8') });
        });

        stream.on('end', () => {
          socket.emit('terminal:output', { data: '\r\n[Session ended]\r\n' });
        });

        stream.on('error', (err) => {
          logger.error('Terminal stream error', { error: err.message });
          socket.emit('terminal:error', { message: 'Terminal stream error' });
        });

        // Update last_active_at
        await db.query(
          'UPDATE lab_containers SET last_active_at = NOW() WHERE container_id = $1',
          [containerId]
        );

        socket.emit('terminal:ready', { message: 'Terminal connected' });
        logger.info('Terminal attached', { containerId, userId: socket.userId });
      } catch (err) {
        logger.error('Terminal start error', { error: err.message });
        socket.emit('terminal:error', { message: 'Failed to attach terminal' });
      }
    });

    socket.on('terminal:input', ({ data }) => {
      if (stream) stream.write(data);
    });

    socket.on('terminal:resize', async ({ containerId, cols, rows }) => {
      if (exec) {
        try {
          await exec.resize({ h: rows, w: cols });
        } catch (err) {
          logger.warn('Terminal resize error', { error: err.message });
        }
      }
    });

    socket.on('disconnect', () => {
      if (stream) { try { stream.destroy(); } catch {} }
      logger.info('Terminal socket disconnected', { userId: socket.userId });
    });
  });
};
