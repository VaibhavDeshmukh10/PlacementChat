const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
const crypto = require('crypto');

// Production security configuration - hardened for high traffic
const SECURITY_CONFIG = {
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60, // Reduced for production
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    message: {
      error: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    handler: (req, res) => {
      console.warn(`Rate limit exceeded: IP ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(SECURITY_CONFIG.rateLimit.windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  },
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 50 : parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 3, // More lenient in dev
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: {
      error: 'Too many authentication attempts. Account temporarily locked.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    handler: (req, res) => {
      console.error(`Auth rate limit exceeded: IP ${req.ip}, Email: ${req.body?.email}, Time: ${new Date().toISOString()}`);
      res.status(429).json({
        error: 'Authentication rate limit exceeded',
        retryAfter: process.env.NODE_ENV === 'development' ? 60 : 900, // Shorter wait in dev
        timestamp: new Date().toISOString()
      });
    }
  },
  fileUploadLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.FILE_UPLOAD_RATE_LIMIT) || 2,
    message: {
      error: 'File upload rate limit exceeded. Please wait before uploading again.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    }
  },
  socketConnectionLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.SOCKET_CONNECTION_LIMIT) || 5,
    message: 'Too many socket connections from this IP'
  }
};

// Enhanced helmet configuration with strict production CSP
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
    reportOnly: false
  },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: {
    maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: []
  }
});

// Comprehensive rate limiters with different strategies
const generalLimiter = rateLimit(SECURITY_CONFIG.rateLimit);
const authLimiter = rateLimit(SECURITY_CONFIG.authRateLimit);
const uploadLimiter = rateLimit(SECURITY_CONFIG.fileUploadLimit);

// Advanced progressive speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 30, // allow 30 requests per windowMs without delay
  delayMs: () => 1000, // add 1 second delay per request after delayAfter (new syntax)
  maxDelayMs: 10000, // max delay of 10 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  validate: { delayMs: false } // Disable deprecation warning
});

// IP reputation tracking and blocking
const ipReputation = new Map();
const blockedIPs = new Set();
const suspiciousPatterns = [
  /admin/i,
  /hack/i,
  /exploit/i,
  /injection/i,
  /script/i,
  /<.*>/,
  /javascript:/i,
  /vbscript:/i,
  /onload/i,
  /onerror/i
];

// Enhanced input sanitization with attack pattern detection
const sanitizeInput = (req, res, next) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check if IP is blocked
    if (blockedIPs.has(clientIP)) {
      console.error(`Blocked IP attempted access: ${clientIP}`);
      return res.status(403).json({ 
        error: 'Access denied', 
        timestamp: new Date().toISOString() 
      });
    }

    // Track IP reputation
    if (!ipReputation.has(clientIP)) {
      ipReputation.set(clientIP, { 
        requests: 0, 
        suspicious: 0, 
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
    
    const reputation = ipReputation.get(clientIP);
    reputation.requests++;
    reputation.lastSeen = Date.now();

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      const result = sanitizeObject(req.body, clientIP, reputation);
      req.body = result.sanitized;
      if (result.suspicious) {
        reputation.suspicious++;
        console.warn(`Suspicious input from IP ${clientIP}:`, result.issues);
      }
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      const result = sanitizeObject(req.query, clientIP, reputation);
      req.query = result.sanitized;
      if (result.suspicious) {
        reputation.suspicious++;
      }
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      const result = sanitizeObject(req.params, clientIP, reputation);
      req.params = result.sanitized;
      if (result.suspicious) {
        reputation.suspicious++;
      }
    }

    // Auto-block IPs with high suspicious activity
    if (reputation.suspicious > 10) {
      blockedIPs.add(clientIP);
      console.error(`IP auto-blocked for suspicious activity: ${clientIP}`);
      return res.status(403).json({ 
        error: 'Access denied due to suspicious activity',
        timestamp: new Date().toISOString()
      });
    }

    ipReputation.set(clientIP, reputation);
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({ 
      error: 'Invalid request format',
      timestamp: new Date().toISOString()
    });
  }
};

// Enhanced recursive object sanitization with pattern detection
function sanitizeObject(obj, clientIP, reputation) {
  const sanitized = {};
  let suspicious = false;
  const issues = [];
  
  for (const [key, value] of Object.entries(obj)) {
    // Validate key
    const cleanKey = validator.escape(String(key).substring(0, 100));
    
    if (typeof value === 'string') {
      // Check for suspicious patterns
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          suspicious = true;
          issues.push(`Suspicious pattern in ${key}: ${pattern}`);
          console.warn(`Attack pattern detected from IP ${clientIP}: ${pattern} in field ${key}`);
        }
      }
      
      // Enhanced XSS protection
      let cleanValue = xss(value, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
        css: false
      });
      
      // Additional sanitization
      cleanValue = validator.escape(cleanValue.substring(0, 10000)); // Limit length
      sanitized[cleanKey] = cleanValue;
      
    } else if (Array.isArray(value)) {
      sanitized[cleanKey] = value.slice(0, 100).map(item => {
        if (typeof item === 'string') {
          return validator.escape(item.substring(0, 1000));
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item, clientIP, reputation).sanitized;
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      const result = sanitizeObject(value, clientIP, reputation);
      sanitized[cleanKey] = result.sanitized;
      if (result.suspicious) {
        suspicious = true;
        issues.push(...result.issues);
      }
    } else {
      sanitized[cleanKey] = value;
    }
  }
  
  return { sanitized, suspicious, issues };
}

// Enhanced security headers with nonce support
const securityHeaders = (req, res, next) => {
  // Generate nonce for CSP
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  
  // Enhanced security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  // Remove information disclosure headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.removeHeader('X-AspNet-Version');
  res.removeHeader('X-AspNetMvc-Version');
  
  // Add custom security headers
  res.setHeader('X-Security-Policy', 'enabled');
  res.setHeader('X-Request-ID', crypto.randomUUID());
  
  next();
};

// Production-grade CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      "https://placement-chat-client-12m2.vercel.app"
    ].filter(Boolean);

    // Allow requests without Origin
    // (Render health checks, browser direct access, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("CORS blocked origin:", origin);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-ID"
  ],

  exposedHeaders: [
    "X-Request-ID"
  ],

  maxAge: 86400,
  optionsSuccessStatus: 200
};
// Request validation with enhanced security checks
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // Additional security checks before validation
      const clientIP = req.ip || req.connection.remoteAddress;
      
      // Check payload size
      const payloadSize = JSON.stringify(req.body || {}).length;
      const maxSize = parseInt(process.env.MAX_PAYLOAD_SIZE?.replace('kb', '')) * 1024 || 512000;
      
      if (payloadSize > maxSize) {
        console.warn(`Payload too large from IP ${clientIP}: ${payloadSize} bytes`);
        return res.status(413).json({ 
          error: 'Payload too large',
          maxSize: `${maxSize / 1024}KB`,
          timestamp: new Date().toISOString()
        });
      }
      
      const { error, value } = schema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });
      
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/"/g, '')
        }));
        
        console.warn(`Validation failed from IP ${clientIP}:`, errors);
        
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        });
      }
      
      req.validatedBody = value;
      next();
    } catch (err) {
      console.error('Validation error:', err);
      res.status(500).json({ 
        error: 'Internal validation error',
        timestamp: new Date().toISOString()
      });
    }
  };
};

// Enhanced security logging with threat detection
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Enhanced request logging
  const logData = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentLength: req.get('Content-Length'),
    contentType: req.get('Content-Type'),
    xForwardedFor: req.get('X-Forwarded-For')
  };
  
  // Detect potential attacks
  const userAgent = req.get('User-Agent') || '';
  const maliciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /nessus/i,
    /openvas/i,
    /w3af/i,
    /dirbuster/i,
    /gobuster/i
  ];
  
  if (maliciousUserAgents.some(pattern => pattern.test(userAgent))) {
    console.error('Potential attack tool detected:', logData);
    blockedIPs.add(logData.ip);
  }
  
  // Log sensitive endpoints
  if (req.path.includes('/auth/') || req.path.includes('/admin')) {
    console.log('Sensitive endpoint access:', logData);
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log suspicious activity
    if (res.statusCode === 429) {
      console.error('Rate limit exceeded:', { ...logData, statusCode: res.statusCode, duration });
    }
    
    if (res.statusCode >= 400) {
      console.warn('Failed request:', { ...logData, statusCode: res.statusCode, duration });
    }
    
    // Log slow requests
    if (duration > 5000) {
      console.warn('Slow request:', { ...logData, statusCode: res.statusCode, duration });
    }
  });
  
  req.requestId = requestId;
  next();
};

// Cleanup function for memory management
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean up old IP reputation data
  for (const [ip, data] of ipReputation.entries()) {
    if (now - data.lastSeen > maxAge) {
      ipReputation.delete(ip);
    }
  }
  
  // Clean up old blocked IPs (after 24 hours)
  // In production, you might want to use a more sophisticated approach
  if (ipReputation.size === 0) {
    blockedIPs.clear();
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  speedLimiter,
  helmetConfig,
  sanitizeInput,
  securityHeaders,
  corsOptions,
  validateRequest,
  securityLogger,
  mongoSanitize: mongoSanitize({
    replaceWith: '_',
    onSanitize: (key, value) => {
      console.warn(`MongoDB injection attempt blocked: ${key} = ${value}`);
    }
  }),
  // Export security utilities
  ipReputation,
  blockedIPs
};
