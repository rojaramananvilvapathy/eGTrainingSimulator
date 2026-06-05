require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const morgan     = require('morgan');
const { Server } = require('socket.io');

const logger     = require('./config/logger');
const { defaultLimiter, authLimiter } = require('./middleware/rateLimiter');

// ── Routes ────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const roomRoutes        = require('./routes/rooms');
const flagRoutes        = require('./routes/flags');
const leaderboardRoutes = require('./routes/leaderboard');
const containerRoutes   = require('./routes/containers');
const userRoutes        = require('./routes/users');
const adminRoutes       = require('./routes/admin');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO (terminal WebSocket) ───────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  path: '/socket.io',
});
require('./services/terminalService')(io);
require('./services/windowsSimService').attachWindowsSimService(io);

// ── Global middleware ─────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(defaultLimiter);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/rooms',       roomRoutes);
app.use('/api/flags',       flagRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/containers',  containerRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/analytics',   require('./routes/analytics'));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000');
server.listen(PORT, () => {
  logger.info(`eG Sim Platform backend running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = { app, server, io };
