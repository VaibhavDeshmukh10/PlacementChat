const cors = require('cors');

/**
 * Secure CORS configuration for PlacementDesk
 * Implements strict origin validation and request handling
 */

// Allowed origins based on environment
const getAllowedOrigins = () => {
  const origins = [];
  
  // Add configured client URLs
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }
  
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== process.env.CLIENT_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Development origins (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173');
  }
  
  // Production origins
  if (process.env.NODE_ENV === 'production') {
    // Add your production domains here
    const productionOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    origins.push(...productionOrigins);
  }
  
  return origins.filter(Boolean);
};

// Custom origin validation function
const originValidator = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();
  
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // Additional validation for development
  if (process.env.NODE_ENV !== 'production') {
    // Allow localhost with any port for development
    const localhostRegex = /^http:\/\/localhost:\d+$/;
    if (localhostRegex.test(origin)) {
      console.warn(`CORS: Allowing development origin: ${origin}`);
      return callback(null, true);
    }
  }
  
  // Log rejected origins for security monitoring
  console.warn(`CORS: Blocked origin: ${origin}`);
  
  const error = new Error(`Origin ${origin} not allowed by CORS policy`);
  error.statusCode = 403;
  callback(error, false);
};

// Secure CORS configuration
const corsOptions = {
  origin: originValidator,
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  maxAge: 86400, // Cache preflight for 24 hours
  optionsSuccessStatus: 200, // For legacy browser support
  preflightContinue: false
};

// Enhanced CORS middleware with logging
const secureCors = cors({
  ...corsOptions,
  origin: (origin, callback) => {
    // Log all CORS requests for monitoring
    if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
      console.log(`CORS request from origin: ${origin || 'no-origin'}`);
    }
    
    originValidator(origin, callback);
  }
});

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    console.error('CORS Error:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Your request origin is not allowed'
    });
  }
  
  next(err);
};

// Socket.io CORS configuration
const socketCorsOptions = {
  origin: originValidator,
  methods: ['GET', 'POST'],
  credentials: true,
  allowEIO3: true // Allow Engine.IO v3 clients
};

// Validation middleware to ensure CORS headers are properly set
const validateCorsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Skip validation for same-origin requests
  if (!origin) {
    return next();
  }
  
  // Ensure the origin header matches allowed origins
  const allowedOrigins = getAllowedOrigins();
  
  if (!allowedOrigins.includes(origin)) {
    console.warn('CORS validation failed:', {
      origin,
      allowedOrigins,
      path: req.path
    });
    
    return res.status(403).json({
      error: 'Origin not allowed',
      message: 'Your request origin is not in the allowed list'
    });
  }
  
  next();
};

// Development CORS bypass (use with extreme caution)
const developmentCors = cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

module.exports = {
  secureCors,
  corsErrorHandler,
  socketCorsOptions,
  validateCorsHeaders,
  developmentCors,
  getAllowedOrigins,
  corsOptions
};