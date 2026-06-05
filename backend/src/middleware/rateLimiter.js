const rateLimit = require('express-rate-limit');

const defaultLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),  // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 10,                    // 10 auth attempts per window
  message: { error: 'Too many authentication attempts' },
});

const flagLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 min
  max: 20,                   // 20 flag submissions per minute
  message: { error: 'Flag submission rate limit exceeded' },
});

module.exports = { defaultLimiter, authLimiter, flagLimiter };
