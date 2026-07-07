const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const passport = require("../config/passport");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { validateRequest } = require("../middleware/security");
const { userSchemas } = require("../validation/schemas");
const { getOAuthCallbackUrl } = require("../utils/oauthConfig");

const router = express.Router();

// Development-only request logger for auth routes to aid debugging
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    try {
      console.log('DEBUG Auth route incoming:', {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: {
          host: req.get('host'),
          origin: req.get('origin'),
          referer: req.get('referer'),
          cookie: req.get('cookie') ? '[present]' : '[none]'
        },
        sessionId: req.session?.id
      });
    } catch (err) {
      console.error('DEBUG logger error:', err);
    }
    next();
  });
}

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const JWT_EXPIRE_TIME = process.env.JWT_EXPIRE_TIME || "1h";
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || "7d";

function parseQueryStringPreservingPlus(rawQueryString) {
  if (!rawQueryString || typeof rawQueryString !== 'string') {
    return {};
  }

  return rawQueryString.split('&').reduce((query, pair) => {
    if (!pair) return query;
    const separatorIndex = pair.indexOf('=');
    const rawKey = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
    const rawValue = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : '';
    const key = decodeURIComponent(rawKey || '').trim();
    const value = rawValue.replace(/\+/g, '%2B');

    try {
      query[key] = decodeURIComponent(value);
    } catch (err) {
      query[key] = value;
    }

    return query;
  }, {});
}

function normalizeOAuthCode(code) {
  if (!code || typeof code !== 'string') {
    return code;
  }

  let normalized = code.trim();
  normalized = normalized.replace(/[\s\n\r]+/g, '+');
  normalized = normalized.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  normalized = normalized.replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  normalized = normalized.replace(/&amp;/g, '&');
  return normalized;
}

function recoverOAuthCode(rawQueryString, currentCode) {
  if (currentCode && typeof currentCode === 'string' && currentCode.length > 0) {
    return currentCode;
  }

  if (!rawQueryString || typeof rawQueryString !== 'string') {
    return currentCode;
  }

  const match = rawQueryString.match(/(?:^|&)code=([^&]+)/);
  if (!match || !match[1]) {
    return currentCode;
  }

  let rawCode = match[1].replace(/\+/g, '%2B');
  try {
    rawCode = decodeURIComponent(rawCode);
  } catch (err) {
    console.warn('Unable to decode raw OAuth code from query string:', err.message);
  }

  if (typeof rawCode === 'string') {
    rawCode = rawCode.replace(/[\s\n\r]+/g, '+');
  }

  return rawCode;
}

function getGoogleCallbackUrl(req) {
  return getOAuthCallbackUrl(req, 'google');
}

// Production security: Warn if JWT/SESSION secrets are not configured.
// Avoid throwing during module load so the host app can decide how to handle startup.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
  console.warn("WARNING: JWT_SECRET is not set or is too short. Ensure a secure secret in production.");
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 64) {
  console.warn("WARNING: SESSION_SECRET is not set or is too short. Ensure a secure secret in production.");
}

// Secure token generation with additional claims
function signToken(user, type = 'access') {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
    type: type,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID() // Unique token ID for tracking
  };

  const options = {
    expiresIn: type === 'refresh' ? JWT_REFRESH_EXPIRE : JWT_EXPIRE_TIME,
    issuer: 'placementdesk-api',
    audience: 'placementdesk-users',
    algorithm: 'HS256'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
}

// Secure token verification
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'placementdesk-api',
      audience: 'placementdesk-users',
      algorithms: ['HS256']
    });
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Enhanced OAuth redirect with security checks
function issueTokenAndRedirect(req, res) {
  try {
    const user = req.user || req.session?.user;
    if (!user || !user._id) {
      console.error("OAuth callback: No user data available");
      return res.redirect(`${CLIENT_URL}/login?error=oauth_user_data_missing`);
    }

    const accessToken = signToken(user, 'access');
    const refreshToken = signToken(user, 'refresh');
    
    // Security: Log successful OAuth login with details
    console.log(`OAuth login successful: ${user.email} (${user.provider}) from IP: ${req.ip}`);
    
    // Update user's last login
    User.findByIdAndUpdate(user._id, { 
      lastLogin: new Date(),
      lastIP: req.ip 
    }).catch(err => console.error('Error updating user login info:', err));
    
    // Secure redirect with tokens
    const redirectUrl = `${CLIENT_URL}/auth/callback?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Token generation error:", error);
    res.redirect(`${CLIENT_URL}/login?error=token_generation_failed`);
  }
}

// GET /api/auth/config — tells the client which login methods are available (no rate limiting)
router.get("/config", (req, res) => {
  try {
    const config = {
      google: passport.providers.google,
      github: passport.providers.github,
      // NO DEMO LOGIN IN PRODUCTION
      devLogin: false,
      demoAdmin: false,
      refreshTokenSupport: true,
      tokenExpiry: JWT_EXPIRE_TIME
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

// GET /api/auth/me — return the current user from their token
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-__v -providerId")
      .lean();
      
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        timestamp: new Date().toISOString()
      });
    }
    
    // Update last activity with security info
    await User.findByIdAndUpdate(user._id, { 
      lastActivity: new Date(),
      lastIP: req.ip 
    });
    
    // Return sanitized user data
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isActive: true
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ 
      error: "Failed to get user information",
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/refresh — refresh access token using refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        error: "Refresh token required",
        timestamp: new Date().toISOString()
      });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ 
        error: "Invalid refresh token",
        timestamp: new Date().toISOString()
      });
    }
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        error: "Invalid token type",
        timestamp: new Date().toISOString()
      });
    }
    
    // Get user and validate
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        error: "User not found",
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate new access token
    const newAccessToken = signToken(user, 'access');
    
    console.log(`Token refreshed for user: ${user.email} from IP: ${req.ip}`);
    
    res.json({
      accessToken: newAccessToken,
      expiresIn: JWT_EXPIRE_TIME,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ 
      error: "Token refresh failed",
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/logout — invalidate tokens
router.post("/logout", requireAuth, async (req, res) => {
  try {
    // Security: Log logout with session info
    console.log(`User logout: ${req.user.email} (ID: ${req.user.id}) from IP: ${req.ip}`);
    
    // Update user's last activity
    await User.findByIdAndUpdate(req.user.id, { 
      lastActivity: new Date(),
      lastLogout: new Date()
    });
    
    // In production, you would invalidate tokens in a blacklist/database
    // For now, we rely on client-side token removal and short token expiry
    
    res.json({ 
      message: "Logged out successfully",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ 
      error: "Logout failed",
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/revoke — revoke all user sessions (security feature)
router.post("/revoke-all", requireAuth, async (req, res) => {
  try {
    // In production, implement token blacklisting here
    // Update user's security timestamp to invalidate all existing tokens
    await User.findByIdAndUpdate(req.user.id, { 
      securityTimestamp: new Date(),
      lastSecurityAction: 'revoke_all_sessions'
    });
    
    console.log(`All sessions revoked for user: ${req.user.email} from IP: ${req.ip}`);
    
    res.json({ 
      message: "All sessions revoked successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Session revocation error:", error);
    res.status(500).json({ 
      error: "Session revocation failed",
      timestamp: new Date().toISOString()
    });
  }
});

// Google OAuth - Production ready
if (passport.providers.google) {
  router.get(
    "/google",
    (req, res, next) => {
      // Add state parameter for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      
      console.log(`OAuth initiation - Setting state: ${state}, Session ID: ${req.session.id}`);
      
      // Ensure session is saved before redirecting to provider
      req.session.save((err) => {
        if (err) console.error('Session save error before Google auth redirect:', err);
        const callbackURL = getGoogleCallbackUrl(req);
        console.log('Initiating Google OAuth with callback URL:', callbackURL);
        passport.authenticate("google", { 
          scope: ["profile", "email"],
          state: state,
          session: false,
          callbackURL
        })(req, res, next);
      });
    }
  );
  
  router.get(
    "/google/callback",
    (req, res, next) => {
      const rawQueryString = (req.originalUrl || req.url || '').split('?')[1] || '';
      const parsedRawQuery = parseQueryStringPreservingPlus(rawQueryString);
      if (Object.keys(parsedRawQuery).length) {
        req.query = { ...req.query, ...parsedRawQuery };
      }

      // Verify state parameter
      const receivedState = req.query.state;
      const expectedState = req.session?.oauthState;
      
      if (!receivedState || receivedState !== expectedState) {
        console.error(`OAuth state mismatch from IP: ${req.ip}. Expected: ${expectedState}, Received: ${receivedState}`);
        return res.redirect(`${CLIENT_URL}/login?error=oauth_state_mismatch`);
      }
      
      // Clear the state from session
      delete req.session.oauthState;
      
      // DEBUG: log incoming query for troubleshooting malformed auth code
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG OAuth callback raw query:', rawQueryString);
        console.log('DEBUG OAuth callback parsed query:', { path: req.path, query: req.query });
      }

      // Recover or normalize auth code if it was corrupted by URL parsing
      const recoveredCode = recoverOAuthCode(rawQueryString, req.query.code);
      if (typeof recoveredCode === 'string' && recoveredCode.length > 0) {
        const original = String(req.query.code || '');
        const normalizedCode = normalizeOAuthCode(recoveredCode);

        if (normalizedCode !== req.query.code) {
          console.warn('Auth code recovered/normalized for callback', {
            path: req.path,
            original: req.query.code,
            recoveredCode,
            normalizedCode
          });
          req.query.code = normalizedCode;
        }

        // Remove development-only callback dump so Passport can proceed.
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG OAuth callback code resolved:', {
          path: req.path,
          rawQueryString,
          originalQueryCode: original,
          recoveredCode,
          normalizedCode,
          state: req.query.state,
          sessionId: req.session?.id
        });
      }
      }

      const googleCallbackUrl = getGoogleCallbackUrl(req);
      console.log('Google OAuth callback URL used for token exchange:', googleCallbackUrl);

      passport.authenticate("google", { 
        session: false, 
        callbackURL: googleCallbackUrl,
        failureRedirect: `${CLIENT_URL}/login?error=google_auth_failed`
      }, (err, user, info) => {
        if (err) {
          console.error("Google OAuth error:", err);
          return res.redirect(`${CLIENT_URL}/login?error=oauth_error`);
        }
        if (!user) {
          console.warn("Google OAuth failed:", info);
          return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
        }
        
        req.user = user;
        next();
      })(req, res, next);
    },
    issueTokenAndRedirect
  );
}

// GitHub OAuth - Production ready
if (passport.providers.github) {
  router.get(
    "/github",
    (req, res, next) => {
      // Add state parameter for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      
      // Ensure session is saved before redirecting to provider
      req.session.save((err) => {
        if (err) console.error('Session save error before GitHub auth redirect:', err);
        const callbackURL = getOAuthCallbackUrl(req, 'github');
        console.log('Initiating GitHub OAuth with callback URL:', callbackURL);
        passport.authenticate("github", { 
          scope: ["user:email"],
          state: state,
          session: false,
          callbackURL
        })(req, res, next);
      });
    }
  );
  
  router.get(
    "/github/callback",
    (req, res, next) => {
      // Verify state parameter
      const receivedState = req.query.state;
      const expectedState = req.session?.oauthState;
      
      if (!receivedState || receivedState !== expectedState) {
        console.error(`OAuth state mismatch from IP: ${req.ip}. Expected: ${expectedState}, Received: ${receivedState}`);
        return res.redirect(`${CLIENT_URL}/login?error=oauth_state_mismatch`);
      }
      
      // Clear the state from session
      delete req.session.oauthState;
      
      // DEBUG: log incoming query for troubleshooting malformed auth code
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG OAuth callback query:', { path: req.path, query: req.query });
      }

      passport.authenticate("github", { 
        session: false, 
        callbackURL: getOAuthCallbackUrl(req, 'github'),
        failureRedirect: `${CLIENT_URL}/login?error=github_auth_failed`
      }, (err, user, info) => {
        if (err) {
          console.error("GitHub OAuth error:", err);
          return res.redirect(`${CLIENT_URL}/login?error=oauth_error`);
        }
        if (!user) {
          console.warn("GitHub OAuth failed:", info);
          return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
        }
        
        req.user = user;
        next();
      })(req, res, next);
    },
    issueTokenAndRedirect
  );
}

// Security: Handle disabled provider access attempts
router.get("/:provider", (req, res) => {
  const { provider } = req.params;
  
  if (["google", "github"].includes(provider)) {
    if (!passport.providers[provider]) {
      console.warn(`Attempt to access disabled provider: ${provider} from IP: ${req.ip}`);
      return res.redirect(`${CLIENT_URL}/login?error=${provider}_not_configured`);
    }
  }
  
  // Log suspicious route access
  console.warn(`Unknown auth route accessed: ${req.path} from IP: ${req.ip}`);
  res.status(404).json({ 
    error: "Authentication method not found",
    timestamp: new Date().toISOString()
  });
});

// Security: Block common attack patterns
router.all("*", (req, res) => {
  console.warn(`Blocked auth route attempt: ${req.method} ${req.path} from IP: ${req.ip}`);
  res.status(404).json({ 
    error: "Route not found",
    timestamp: new Date().toISOString()
  });
});

// Export router for mounting in the main app
module.exports = router;

module.exports = router;
