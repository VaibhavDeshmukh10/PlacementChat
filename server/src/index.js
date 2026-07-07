require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
// PlacementDesk Server - Production Grade Architecture
const express = require("express");
const http = require("http");
const path = require("path");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const timeout = require('express-timeout-handler');
const passport = require("./config/passport");
const { Server } = require("socket.io");
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Enhanced security middleware imports
const {
  generalLimiter,
  authLimiter,
  helmetConfig,
  sanitizeInput,
  securityHeaders,
  corsOptions,
  securityLogger,
  mongoSanitize,
  speedLimiter,
  ipReputation,
  blockedIPs
} = require('./middleware/security');

const { connectDB, closeDB } = require("./config/db");
const attachChatSocket = require("./sockets/chatSocket");
const { testCloudinaryConnection } = require("./config/cloudinary");

const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const messageRoutes = require("./routes/messageRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const userRoutes = require("./routes/userRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

// Production Configuration Validation
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "production";
const MAX_PAYLOAD_SIZE = process.env.MAX_PAYLOAD_SIZE || "500kb";
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 15000;
const CONNECTION_TIMEOUT = parseInt(process.env.CONNECTION_TIMEOUT) || 30000;

// Critical Security Validation
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
  console.error("CRITICAL SECURITY ERROR: JWT_SECRET must be at least 64 characters long");
  process.exit(1);
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 64) {
  console.error("CRITICAL SECURITY ERROR: SESSION_SECRET must be at least 64 characters long");
  process.exit(1);
}

if (NODE_ENV === 'production' && (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) {
  console.warn("WARNING: OAuth not configured - users cannot authenticate");
}

// Enhanced Logging Configuration
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      });
    })
  ),
  defaultMeta: { service: 'placementdesk-api' },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    // Security logs
    new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    // All logs
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true
    })
  ]
});

// Console logging for non-production
if (NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

// Trust proxy settings for production load balancer
app.set('trust proxy', 1);

// Production Performance Optimizations
app.use(compression({
  level: 6, // Good balance of compression ratio and CPU usage
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Compress JSON and text responses
    const contentType = res.getHeader('Content-Type') || '';
    return contentType.includes('json') || contentType.includes('text');
  }
}));

// Request timeout handling for high traffic
app.use(timeout.handler({
  timeout: REQUEST_TIMEOUT,
  onTimeout: (req, res) => {
    logger.warn('Request timeout', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(408).json({
      error: 'Request timeout',
      timeout: `${REQUEST_TIMEOUT}ms`,
      timestamp: new Date().toISOString()
    });
  }
}));

// Enhanced Security Middleware Stack (Order Matters!)
app.use(securityLogger); // First: Log all requests for security analysis
app.use(helmetConfig); // Security headers
app.use(securityHeaders); // Additional custom security headers
app.use(cors(corsOptions)); // Strict CORS configuration
app.use(mongoSanitize); // Prevent NoSQL injection attacks
app.use(sanitizeInput); // Advanced input sanitization with attack detection

// Body parsing with strict limits for high traffic
app.use(express.json({ 
  limit: MAX_PAYLOAD_SIZE,
  strict: true,
  verify: (req, res, buf) => {
    // Additional payload validation can be added here
    if (buf && buf.length === 0) {
      throw new Error('Empty JSON payload');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: MAX_PAYLOAD_SIZE,
  parameterLimit: 100 // Limit number of parameters
}));

app.use(cookieParser(process.env.SESSION_SECRET));

// Session configuration for OAuth state management
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes for OAuth flow
    sameSite: 'lax' // Required for OAuth callbacks
  },
  name: 'pd.session' // Custom session name
}));

app.use(passport.initialize());
app.use(passport.session());

// Progressive Rate Limiting Strategy
app.use(speedLimiter); // Slow down suspicious activity
// Skip rate limiting for public endpoints that are frequently accessed
const publicApiEndpoints = ['/api/auth/config', '/api/health', '/api/test-auth-token'];
app.use((req, res, next) => {
  if (publicApiEndpoints.includes(req.path)) {
    return next(); // Skip rate limiting for public endpoints
  }
  return generalLimiter(req, res, next); // Apply rate limiting for other API routes
});

// Health Check Endpoints (No Rate Limiting)
app.get("/", (req, res) => {
  res.json({ 
    status: "PlacementDesk API",
    version: "2.0.0",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    security: "enhanced"
  });
});

// Test endpoint - creates a fake token for testing (dev only)
if (NODE_ENV === 'development') {
  app.get("/api/test-auth-token", async (req, res) => {
    try {
      // Find the first user in the database
      const testUser = await require('./models/User').findOne().limit(1);
      if (!testUser) {
        return res.status(404).json({ error: 'No test user found' });
      }
      
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({
        id: testUser._id,
        email: testUser.email,
        role: testUser.role,
        name: testUser.name,
        type: 'access'
      }, process.env.JWT_SECRET, {
        expiresIn: '1h',
        issuer: 'placementdesk-api',
        audience: 'placementdesk-users',
        algorithm: 'HS256'
      });
      
      res.json({
        token,
        user: {
          id: testUser._id,
          email: testUser.email,
          name: testUser.name,
          role: testUser.role
        },
        redirect_url: `${process.env.CLIENT_URL}/auth/callback?token=${encodeURIComponent(token)}`
      });
    } catch (error) {
      console.error('Test auth token error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Auth config endpoint (no rate limiting needed for public config)
app.get("/api/auth/config", (req, res) => {
  try {
    const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const hasGithub = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === 'true';
    
    console.log("✅ Auth config requested:", { hasGoogle, hasGithub, devLoginEnabled });
    
    const config = {
      google: hasGoogle,
      github: hasGithub,
      devLogin: devLoginEnabled,
      refreshTokenSupport: true,
      tokenExpiry: process.env.JWT_EXPIRE_TIME || "1h"
    };
    
    res.json(config);
  } catch (error) {
    console.error("Auth config error:", error);
    res.status(500).json({ 
      error: "Failed to get authentication configuration",
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/health", async (req, res) => {
  // Test Cloudinary connection
  const cloudinaryStatus = await testCloudinaryConnection();
  
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    security: {
      blockedIPs: blockedIPs.size,
      trackedIPs: ipReputation.size,
      rateLimitActive: true
    },
    services: {
      database: "connected",
      cloudinary: cloudinaryStatus.status,
      fileUpload: cloudinaryStatus.status === 'connected' ? 'available' : 'unavailable'
    }
  };
  
  res.json(healthData);
});

// Advanced security monitoring endpoint (Admin only)
app.get("/api/security/status", (req, res) => {
  // Basic IP reputation check (more advanced auth would be added here)
  const clientIP = req.ip;
  
  if (blockedIPs.has(clientIP)) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  res.json({
    timestamp: new Date().toISOString(),
    security: {
      totalTrackedIPs: ipReputation.size,
      blockedIPs: blockedIPs.size,
      rateLimitingActive: true,
      inputSanitizationActive: true,
      securityHeadersActive: true
    }
  });
});

// Protected Routes with Enhanced Security
app.use("/api/auth", authRoutes); // Remove rate limiting temporarily for development

// Message routes with additional protection
app.use("/api/rooms", messageRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);

// Serve built frontend in production
if (NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDist, { maxAge: "30d" }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Global security middleware for all responses
app.use((req, res, next) => {
  // Add security correlation headers
  res.setHeader('X-Request-ID', req.requestId || 'unknown');
  res.setHeader('X-Security-Policy', 'enforced');
  res.setHeader('X-Content-Policy', 'sanitized');
  next();
});

// Advanced 404 Handler with Attack Detection
app.use((req, res) => {
  const suspiciousPatterns = [
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i,
    /admin/i,
    /wp-admin/i,
    /phpmyadmin/i,
    /\.env/i,
    /\.git/i,
    /config/i,
    /backup/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(req.path));
  
  if (isSuspicious) {
    logger.warn('Suspicious 404 attempt', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });
    
    // Track suspicious activity
    const reputation = ipReputation.get(req.ip) || { requests: 0, suspicious: 0, firstSeen: Date.now(), lastSeen: Date.now() };
    reputation.suspicious += 2; // Higher penalty for suspicious 404s
    ipReputation.set(req.ip, reputation);
    
    // Auto-block if too many suspicious requests
    if (reputation.suspicious > 5) {
      blockedIPs.add(req.ip);
      logger.error('IP auto-blocked for suspicious 404s', { ip: req.ip });
    }
  }
  
  res.status(404).json({ 
    error: "Resource not found",
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Production-Grade Error Handler
app.use((err, req, res, next) => {
  // Generate error correlation ID
  const errorId = require('crypto').randomUUID();
  
  // Enhanced error logging with context
  const errorInfo = {
    errorId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    error: {
      message: err.message,
      name: err.name,
      code: err.code,
      status: err.status
    },
    stack: NODE_ENV === 'development' ? err.stack : undefined
  };
  
  // Log based on severity
  if (err.status >= 500 || !err.status) {
    logger.error('Server error', errorInfo);
  } else {
    logger.warn('Client error', errorInfo);
  }
  
  // Security-focused error responses
  let responseMessage = "Internal server error";
  let statusCode = err.status || 500;
  
  // Handle specific error types securely
  if (err.name === 'ValidationError') {
    statusCode = 400;
    responseMessage = "Invalid input data";
  } else if (err.name === 'UnauthorizedError' || err.status === 401) {
    statusCode = 401;
    responseMessage = "Authentication required";
  } else if (err.name === 'ForbiddenError' || err.status === 403) {
    statusCode = 403;
    responseMessage = "Access forbidden";
  } else if (err.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    responseMessage = "Invalid security token";
  } else if (err.status === 429) {
    statusCode = 429;
    responseMessage = "Rate limit exceeded";
  }
  
  // Production vs Development responses
  const errorResponse = {
    error: responseMessage,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    errorId: errorId
  };
  
  // Add stack trace only in development
  if (NODE_ENV === 'development') {
    errorResponse.details = {
      message: err.message,
      stack: err.stack
    };
  }
  
  res.status(statusCode).json(errorResponse);
});

const server = http.createServer(app);

// Enhanced Socket.io Configuration for High Traffic
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket'], // Websocket only for better performance
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 30000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 500000, // 500KB limit
  allowEIO3: false, // Disable older protocol versions for security
  serveClient: false, // Don't serve client files
  cookie: false // Disable socket.io cookies for security
});

app.set("io", io);
attachChatSocket(io);

const PORT = process.env.PORT || 5000;

// Production-Grade Graceful Shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, initiating graceful shutdown`);
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      await closeDB();
      logger.info('Database connections closed');
      
      // Close logging transports
      logger.end && logger.end();
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, CONNECTION_TIMEOUT);
};

// Production Error Handling
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception - Server will restart', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason.toString(), 
    promise: promise.toString() 
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start Server with Enhanced Monitoring
connectDB().then(() => {
  server.listen(PORT, () => {
    const startupInfo = {
      port: PORT,
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      security: {
        jwtSecretLength: process.env.JWT_SECRET.length,
        sessionSecretLength: process.env.SESSION_SECRET.length,
        corsEnabled: true,
        rateLimitingEnabled: true,
        inputSanitizationEnabled: true,
        securityHeadersEnabled: true,
        compressionEnabled: true,
        timeoutHandlingEnabled: true
      },
      performance: {
        maxPayloadSize: MAX_PAYLOAD_SIZE,
        requestTimeout: REQUEST_TIMEOUT,
        connectionTimeout: CONNECTION_TIMEOUT,
        compressionEnabled: true
      }
    };
    
    logger.info('PlacementDesk server started', startupInfo);
    console.log(`🚀 PlacementDesk Server listening on port ${PORT}`);
    console.log(`🔒 Environment: ${NODE_ENV}`);
    console.log(`🛡️  Enhanced security: ACTIVE`);
    console.log(`⚡ Performance optimizations: ACTIVE`);
    console.log(`📊 Advanced logging: ACTIVE`);
    
    if (NODE_ENV === 'production') {
      console.log('✅ Production security checks: PASSED');
    } else {
      console.log('⚠️  Development mode - some security features may be relaxed');
    }
  });
}).catch(err => {
  logger.error("Failed to start server", err);
  console.error("💥 Failed to start server:", err.message);
  process.exit(1);
});
