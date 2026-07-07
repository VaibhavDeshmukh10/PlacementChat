const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Enhanced authentication security middleware
 * Implements JWT security best practices, session management, and token validation
 */

class AuthSecurityManager {
  constructor() {
    this.tokenBlacklist = new Set(); // In production, use Redis
    this.loginAttempts = new Map(); // Track failed login attempts
    this.activeSessions = new Map(); // Track active user sessions
  }

  /**
   * Generate secure JWT token with enhanced claims
   */
  generateToken(user, deviceInfo = {}) {
    const jti = crypto.randomUUID(); // JWT ID for token tracking
    const sessionId = crypto.randomUUID(); // Session tracking
    
    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      jti, // JWT ID for revocation
      sessionId,
      deviceFingerprint: this.generateDeviceFingerprint(deviceInfo),
      iat: Math.floor(Date.now() / 1000),
      iss: 'PlacementDesk', // Issuer
      aud: 'PlacementDesk-App' // Audience
    };

    const options = {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      algorithm: 'HS256',
      issuer: 'PlacementDesk',
      audience: 'PlacementDesk-App'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, options);
    
    // Store active session
    this.activeSessions.set(sessionId, {
      userId: user._id.toString(),
      createdAt: new Date(),
      lastActivity: new Date(),
      deviceFingerprint: payload.deviceFingerprint,
      jti
    });

    return { token, sessionId, jti };
  }

  /**
   * Generate device fingerprint for additional security
   */
  generateDeviceFingerprint(deviceInfo) {
    const components = [
      deviceInfo.userAgent || '',
      deviceInfo.acceptLanguage || '',
      deviceInfo.acceptEncoding || '',
      deviceInfo.ip || ''
    ].join('|');
    
    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
  }

  /**
   * Enhanced JWT verification with security checks
   */
  verifyToken(token, deviceInfo = {}) {
    try {
      // Verify JWT signature and claims
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'PlacementDesk',
        audience: 'PlacementDesk-App'
      });

      // Check if token is blacklisted
      if (this.tokenBlacklist.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify session exists and is active
      const session = this.activeSessions.get(decoded.sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }

      // Verify device fingerprint (optional, for enhanced security)
      if (process.env.ENABLE_DEVICE_FINGERPRINTING === 'true') {
        const currentFingerprint = this.generateDeviceFingerprint(deviceInfo);
        if (session.deviceFingerprint !== currentFingerprint) {
          console.warn('Device fingerprint mismatch:', {
            userId: decoded.id,
            expected: session.deviceFingerprint,
            actual: currentFingerprint
          });
        }
      }

      // Update last activity
      session.lastActivity = new Date();
      
      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Revoke token (add to blacklist)
   */
  revokeToken(jti, sessionId) {
    this.tokenBlacklist.add(jti);
    if (sessionId) {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Revoke all sessions for a user
   */
  revokeAllUserSessions(userId) {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.tokenBlacklist.add(session.jti);
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Track failed login attempts for brute force protection
   */
  recordFailedLogin(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.loginAttempts.get(key) || { count: 0, lastAttempt: new Date() };
    
    attempts.count++;
    attempts.lastAttempt = new Date();
    
    this.loginAttempts.set(key, attempts);
    
    // Auto-cleanup old attempts
    if (attempts.count === 1) {
      setTimeout(() => {
        this.loginAttempts.delete(key);
      }, 30 * 60 * 1000); // 30 minutes
    }
    
    return attempts;
  }

  /**
   * Check if login is allowed based on failed attempts
   */
  isLoginAllowed(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.loginAttempts.get(key);
    
    if (!attempts) return true;
    
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000; // 30 minutes
    
    if (attempts.count >= maxAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
      if (timeSinceLastAttempt < lockoutTime) {
        return false;
      } else {
        // Reset attempts after lockout period
        this.loginAttempts.delete(key);
        return true;
      }
    }
    
    return true;
  }

  /**
   * Clear failed login attempts on successful login
   */
  clearFailedLogins(identifier, ip) {
    const key = `${identifier}:${ip}`;
    this.loginAttempts.delete(key);
  }

  /**
   * Clean up expired sessions and tokens
   */
  cleanup() {
    const now = new Date();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > sessionTimeout) {
        this.activeSessions.delete(sessionId);
        this.tokenBlacklist.add(session.jti);
      }
    }
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId) {
    const sessions = [];
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        sessions.push({
          sessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          deviceFingerprint: session.deviceFingerprint
        });
      }
    }
    return sessions;
  }
}

// Global instance
const authManager = new AuthSecurityManager();

// Run cleanup every hour
setInterval(() => {
  authManager.cleanup();
}, 60 * 60 * 1000);

/**
 * Enhanced authentication middleware
 */
const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }

    // Extract device information for fingerprinting
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding'],
      ip: req.ip
    };

    const decoded = authManager.verifyToken(token, deviceInfo);
    req.user = decoded;
    req.sessionId = decoded.sessionId;
    
    next();
  } catch (error) {
    console.warn('Authentication failed:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or expired token' 
    });
  }
};

/**
 * Admin role requirement middleware
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin access required' 
    });
  }
  next();
};

/**
 * Brute force protection middleware
 */
const protectLogin = (req, res, next) => {
  const identifier = req.body.email || req.body.username || 'unknown';
  const ip = req.ip;

  if (!authManager.isLoginAllowed(identifier, ip)) {
    const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 30 * 60 * 1000;
    return res.status(429).json({
      error: 'Too many failed login attempts',
      message: `Account temporarily locked. Try again in ${Math.ceil(lockoutTime / 60000)} minutes.`,
      retryAfter: lockoutTime / 1000
    });
  }

  // Store original end function to intercept response
  const originalEnd = res.end;
  res.end = function(...args) {
    if (res.statusCode >= 400) {
      // Failed login
      authManager.recordFailedLogin(identifier, ip);
    } else if (res.statusCode < 400) {
      // Successful login
      authManager.clearFailedLogins(identifier, ip);
    }
    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Session management middleware
 */
const sessionManager = {
  // Logout specific session
  logout: (req, res, next) => {
    if (req.user && req.sessionId) {
      authManager.revokeToken(req.user.jti, req.sessionId);
    }
    next();
  },

  // Logout all sessions for user
  logoutAll: (req, res, next) => {
    if (req.user) {
      authManager.revokeAllUserSessions(req.user.id);
    }
    next();
  },

  // Get active sessions
  getSessions: (req, res) => {
    if (req.user) {
      const sessions = authManager.getUserSessions(req.user.id);
      res.json({ sessions });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  }
};

module.exports = {
  AuthSecurityManager,
  authManager,
  requireAuth,
  requireAdmin,
  protectLogin,
  sessionManager
};