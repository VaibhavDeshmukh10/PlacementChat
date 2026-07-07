const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
// Note: Redis integration commented out for now, using memory store
// const redis = require('redis');

/**
 * Comprehensive rate limiting middleware for PlacementDesk
 * Implements different limits for various endpoint categories
 */

// Configuration from environment with secure defaults
const config = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10, // Stricter for auth
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  standardHeaders: true,
  legacyHeaders: false
};

// Custom key generator that includes user ID for authenticated requests
const keyGenerator = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  const userId = req.user?.id || 'anonymous';
  return `${ip}:${userId}`;
};

// Enhanced error handler with security logging
const onLimitReached = (req, res) => {
  const clientInfo = {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id || 'anonymous'
  };
  
  console.warn('Rate limit exceeded:', clientInfo);
  
  // Log for security monitoring (implement with your logging system)
  if (global.securityLogger) {
    global.securityLogger.warn('RATE_LIMIT_EXCEEDED', clientInfo);
  }
};

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: config.windowMs,
  max: config.authMax,
  keyGenerator,
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: Math.ceil(config.windowMs / 1000)
  },
  // Skip rate limiting for successful authentication (optional)
  skip: (req, res) => {
    // Don't count successful logins against the limit
    return res.statusCode < 400;
  }
});

// Moderate rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: config.windowMs,
  max: config.maxRequests,
  keyGenerator,
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached,
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later',
    retryAfter: Math.ceil(config.windowMs / 1000)
  }
});

// Very strict rate limiting for expensive operations
const strictLimiter = rateLimit({
  windowMs: config.windowMs,
  max: Math.floor(config.authMax / 2), // Even more restrictive
  keyGenerator,
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached,
  message: {
    error: 'Too many resource-intensive requests',
    message: 'This endpoint is rate limited. Please try again later.',
    retryAfter: Math.ceil(config.windowMs / 1000)
  }
});

// Lenient rate limiting for public endpoints
const publicLimiter = rateLimit({
  windowMs: config.windowMs,
  max: config.maxRequests * 2, // More generous for public endpoints
  keyGenerator: (req) => req.ip, // Only use IP for public endpoints
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached,
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: Math.ceil(config.windowMs / 1000)
  }
});

// File upload specific rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window for file uploads
  max: 20, // Limit file uploads per hour
  keyGenerator,
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached,
  message: {
    error: 'Too many file uploads',
    message: 'Upload limit reached. Please try again later.',
    retryAfter: 3600
  }
});

// Real-time connection rate limiting (for Socket.io)
const connectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 connection attempts per minute
  keyGenerator: (req) => req.ip,
  standardHeaders: config.standardHeaders,
  legacyHeaders: config.legacyHeaders,
  onLimitReached: (req, res) => {
    console.warn('Socket connection rate limit exceeded:', { ip: req.ip });
  },
  message: {
    error: 'Too many connection attempts',
    message: 'Please wait before reconnecting'
  }
});

// Brute force protection for login attempts
const createLoginLimiter = () => {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000; // 30 minutes
  
  return rateLimit({
    windowMs: lockoutTime,
    max: maxAttempts,
    keyGenerator: (req) => {
      // Use email + IP for login attempts
      const email = req.body?.email || 'unknown';
      return `login:${req.ip}:${email}`;
    },
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    onLimitReached: (req, res) => {
      console.warn('Login brute force attempt detected:', {
        ip: req.ip,
        email: req.body?.email,
        userAgent: req.headers['user-agent']
      });
    },
    message: {
      error: 'Too many login attempts',
      message: `Account temporarily locked. Please try again in ${Math.ceil(lockoutTime / 60000)} minutes.`
    }
  });
};

module.exports = {
  authLimiter,
  apiLimiter,
  strictLimiter,
  publicLimiter,
  uploadLimiter,
  connectionLimiter,
  createLoginLimiter,
  config
};