const { verifyAccessToken } = require('../services/tokenService');
const logger = require('../config/logger');

/**
 * Verify JWT from Authorization: Bearer <token> header.
 * Attaches req.user = { id, role, username } on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
    next();
  } catch (err) {
    logger.warn('Invalid JWT', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role guard — use after authenticate().
 * authorize('admin') or authorize('admin', 'superadmin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
