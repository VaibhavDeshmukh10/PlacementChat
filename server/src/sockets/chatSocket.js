const jwt = require("jsonwebtoken");
const { socketSchemas } = require("../validation/schemas");

// Track active users per room with enhanced security
const roomUsers = new Map(); // roomSlug -> Set of socket IDs
const userSockets = new Map(); // userId -> Set of socket IDs
const suspiciousIPs = new Map(); // IP -> { count, lastAttempt }

// Security configuration
const SOCKET_CONFIG = {
  maxConnectionsPerIP: 10,
  maxRoomsPerUser: 5,
  messageRateLimit: {
    windowMs: 60000, // 1 minute
    maxMessages: 30
  },
  suspiciousActivityThreshold: 5
};

// Message rate limiting per user
const messageRateLimiter = new Map(); // userId -> { count, resetTime }

function attachChatSocket(io) {
  // Enhanced authentication middleware with security checks
  io.use((socket, next) => {
    const clientIP = socket.handshake.address;
    
    // Check for IP-based rate limiting
    const ipActivity = suspiciousIPs.get(clientIP) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    
    // Reset counter if more than 15 minutes passed
    if (now - ipActivity.lastAttempt > 15 * 60 * 1000) {
      ipActivity.count = 0;
    }
    
    // Block suspicious IPs
    if (ipActivity.count > SOCKET_CONFIG.suspiciousActivityThreshold) {
      console.warn(`Blocked suspicious IP: ${clientIP}`);
      return next(new Error('Connection blocked due to suspicious activity'));
    }
    
    // Check connection limit per IP
    let connectionsFromIP = 0;
    for (const [socketId, socketObj] of io.sockets.sockets) {
      if (socketObj.handshake.address === clientIP) {
        connectionsFromIP++;
      }
    }
    
    if (connectionsFromIP >= SOCKET_CONFIG.maxConnectionsPerIP) {
      console.warn(`Too many connections from IP: ${clientIP}`);
      ipActivity.count++;
      suspiciousIPs.set(clientIP, { count: ipActivity.count, lastAttempt: now });
      return next(new Error('Too many connections from this IP'));
    }
    
    // Optional auth: attach user info to the socket if a token was sent
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        socket.userId = decoded.id;
        
        // Track user's sockets
        if (!userSockets.has(socket.userId)) {
          userSockets.set(socket.userId, new Set());
        }
        userSockets.get(socket.userId).add(socket.id);
        
        console.log(`Socket authenticated for user: ${socket.user.name} (${socket.user.email})`);
      } catch (err) {
        console.log(`Socket connection with invalid token: ${err.message} from IP: ${clientIP}`);
        // Invalid token — allow the connection but treat as unauthenticated
        socket.user = null;
        socket.userId = null;
      }
    }
    
    // Security logging
    console.log(`Socket connection: ${socket.id} from ${clientIP} ${socket.user ? `(${socket.user.name})` : '(anonymous)'}`);
    
    next();
  });

  // Helper function to validate socket message
  function validateSocketMessage(data, schema) {
    try {
      const { error, value } = schema.validate(data);
      if (error) {
        return { isValid: false, error: error.details[0].message };
      }
      return { isValid: true, data: value };
    } catch (err) {
      return { isValid: false, error: 'Validation failed' };
    }
  }

  // Helper function to check message rate limit
  function checkMessageRateLimit(userId) {
    const now = Date.now();
    const userLimit = messageRateLimiter.get(userId) || { count: 0, resetTime: now + SOCKET_CONFIG.messageRateLimit.windowMs };
    
    // Reset counter if window expired
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + SOCKET_CONFIG.messageRateLimit.windowMs;
    }
    
    userLimit.count++;
    messageRateLimiter.set(userId, userLimit);
    
    return userLimit.count <= SOCKET_CONFIG.messageRateLimit.maxMessages;
  }

  // Helper function to get room member count
  function getRoomMemberCount(roomSlug) {
    return roomUsers.get(roomSlug)?.size || 0;
  }

  // Helper function to emit member count update to room
  function emitMemberCountUpdate(roomSlug) {
    const count = getRoomMemberCount(roomSlug);
    io.to(roomSlug).emit("member-count-update", { memberCount: count });
  }

  // Helper function to validate room access
  function validateRoomAccess(socket, roomSlug) {
    // Basic room name validation
    if (!roomSlug || typeof roomSlug !== 'string' || roomSlug.length > 100) {
      return false;
    }
    
    // Check if user has too many active rooms
    if (socket.userId) {
      const userRoomCount = Array.from(socket.rooms).filter(room => room !== socket.id).length;
      if (userRoomCount >= SOCKET_CONFIG.maxRoomsPerUser) {
        return false;
      }
    }
    
    return true;
  }

  io.on("connection", (socket) => {
    const clientIP = socket.handshake.address;

    // Client calls socket.emit("join-room", "amazon") after opening a room
    socket.on("join-room", (slug) => {
      try {
        // Validate room access
        if (!validateRoomAccess(socket, slug)) {
          socket.emit("error", { message: "Invalid room or access denied" });
          return;
        }
        
        // Validate slug format
        const validation = validateSocketMessage({ room: slug }, socketSchemas.joinRoom);
        if (!validation.isValid) {
          socket.emit("error", { message: "Invalid room name format" });
          return;
        }
        
        const roomSlug = validation.data.room;
        
        socket.join(roomSlug);
        socket.currentRoom = roomSlug;
        
        // Add user to room tracking
        if (!roomUsers.has(roomSlug)) {
          roomUsers.set(roomSlug, new Set());
        }
        roomUsers.get(roomSlug).add(socket.id);
        
        // Notify room of new member and update count
        if (socket.user) {
          socket.to(roomSlug).emit("user-joined", { 
            name: socket.user.name, 
            id: socket.user.id 
          });
        }
        
        // Emit updated member count to all users in the room
        emitMemberCountUpdate(roomSlug);
        
        console.log(`User ${socket.user?.name || socket.id} joined room: ${roomSlug} (${getRoomMemberCount(roomSlug)} members)`);
      } catch (error) {
        console.error(`Join room error for ${socket.id}:`, error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", (slug) => {
      try {
        if (!slug || typeof slug !== 'string') return;
        
        socket.leave(slug);
        
        // Remove user from room tracking
        if (roomUsers.has(slug)) {
          roomUsers.get(slug).delete(socket.id);
          if (roomUsers.get(slug).size === 0) {
            roomUsers.delete(slug);
          }
        }
        
        if (socket.currentRoom === slug) {
          socket.currentRoom = null;
        }
        
        // Notify room of member leaving
        if (socket.user) {
          socket.to(slug).emit("user-left", { 
            name: socket.user.name, 
            id: socket.user.id 
          });
        }
        
        // Emit updated member count to remaining users in the room
        emitMemberCountUpdate(slug);
        
        console.log(`User ${socket.user?.name || socket.id} left room: ${slug} (${getRoomMemberCount(slug)} members)`);
      } catch (error) {
        console.error(`Leave room error for ${socket.id}:`, error);
      }
    });

    // Enhanced typing indicator with rate limiting
    socket.on("typing", (data) => {
      try {
        // Validate typing message
        const validation = validateSocketMessage(data, socketSchemas.typing);
        if (!validation.isValid) {
          socket.emit("error", { message: "Invalid typing data" });
          return;
        }
        
        const { slug, name, isTyping } = validation.data;
        
        // Rate limit typing indicators
        if (socket.userId && !checkMessageRateLimit(socket.userId)) {
          return; // Silently ignore excessive typing indicators
        }
        
        // Validate user can send to this room
        if (!socket.rooms.has(slug)) {
          socket.emit("error", { message: "Not authorized for this room" });
          return;
        }
        
        socket.to(slug).emit("typing", { 
          name, 
          isTyping,
          userId: socket.user?.id 
        });
      } catch (error) {
        console.error(`Typing error for ${socket.id}:`, error);
      }
    });

    // Handle real-time message broadcasting (called from message routes)
    socket.on("new-message", (data) => {
      try {
        if (!data || typeof data !== 'object') {
          socket.emit("error", { message: "Invalid message data" });
          return;
        }
        
        const { roomSlug, message } = data;
        
        // Validate message structure
        if (!roomSlug || !message || typeof roomSlug !== 'string') {
          socket.emit("error", { message: "Invalid message format" });
          return;
        }
        
        // Check if user can broadcast to this room
        if (!socket.rooms.has(roomSlug)) {
          console.warn(`Unauthorized message broadcast attempt from ${socket.id} to room ${roomSlug}`);
          return;
        }
        
        // Rate limit messages
        if (socket.userId && !checkMessageRateLimit(socket.userId)) {
          socket.emit("error", { message: "Message rate limit exceeded" });
          return;
        }
        
        socket.to(roomSlug).emit("message-received", message);
      } catch (error) {
        console.error(`Message broadcast error for ${socket.id}:`, error);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason}) ${socket.user ? `User: ${socket.user.name}` : ''}`);
      
      try {
        // Clean up from all rooms
        if (socket.currentRoom) {
          if (roomUsers.has(socket.currentRoom)) {
            roomUsers.get(socket.currentRoom).delete(socket.id);
            if (roomUsers.get(socket.currentRoom).size === 0) {
              roomUsers.delete(socket.currentRoom);
            }
          }
          
          // Notify room of member leaving
          if (socket.user) {
            socket.to(socket.currentRoom).emit("user-left", { 
              name: socket.user.name, 
              id: socket.user.id 
            });
          }
          
          // Emit updated member count
          emitMemberCountUpdate(socket.currentRoom);
        }
        
        // Clean up user socket tracking
        if (socket.userId && userSockets.has(socket.userId)) {
          userSockets.get(socket.userId).delete(socket.id);
          if (userSockets.get(socket.userId).size === 0) {
            userSockets.delete(socket.userId);
          }
        }
        
        // Clean up rate limiting data for disconnected users
        if (socket.userId) {
          messageRateLimiter.delete(socket.userId);
        }
      } catch (error) {
        console.error(`Disconnect cleanup error for ${socket.id}:`, error);
      }
    });

    // Enhanced error handling
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id} from ${clientIP}:`, error);
      
      // Track suspicious activity
      const ipActivity = suspiciousIPs.get(clientIP) || { count: 0, lastAttempt: 0 };
      ipActivity.count++;
      ipActivity.lastAttempt = Date.now();
      suspiciousIPs.set(clientIP, ipActivity);
      
      // Disconnect if too many errors
      if (ipActivity.count > SOCKET_CONFIG.suspiciousActivityThreshold) {
        socket.disconnect(true);
      }
    });

    // Handle connection timeout
    socket.on("timeout", () => {
      console.log(`Socket timeout: ${socket.id}`);
      socket.disconnect(true);
    });
  });

  // Expose helper function for external use
  io.getRoomMemberCount = getRoomMemberCount;
  
  // Periodic cleanup of old rate limiting data
  setInterval(() => {
    const now = Date.now();
    
    // Clean up old message rate limits
    for (const [userId, data] of messageRateLimiter.entries()) {
      if (now > data.resetTime) {
        messageRateLimiter.delete(userId);
      }
    }
    
    // Clean up old suspicious IP records (24 hours old)
    for (const [ip, data] of suspiciousIPs.entries()) {
      if (now - data.lastAttempt > 24 * 60 * 60 * 1000) {
        suspiciousIPs.delete(ip);
      }
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
}

module.exports = attachChatSocket;
