const validator = require('validator');
const xss = require('xss');

/**
 * Comprehensive input validation and sanitization middleware
 */

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * Sanitize input to prevent XSS attacks
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    // Remove dangerous HTML/JS while preserving basic formatting
    return xss(input, {
      whiteList: {
        // Allow only safe HTML tags
        p: [],
        br: [],
        strong: [],
        em: [],
        u: [],
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
        ul: [], ol: [], li: [],
        blockquote: []
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    }).trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized = Array.isArray(input) ? [] : {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

/**
 * Validate email address
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }
  
  if (!validator.isEmail(email)) {
    throw new ValidationError('Invalid email format', 'email');
  }
  
  if (email.length > 254) {
    throw new ValidationError('Email address too long', 'email');
  }
  
  return email.toLowerCase().trim();
};

/**
 * Validate user name
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Name is required', 'name');
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    throw new ValidationError('Name must be at least 2 characters', 'name');
  }
  
  if (trimmed.length > 100) {
    throw new ValidationError('Name must be less than 100 characters', 'name');
  }
  
  // Allow letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
    throw new ValidationError('Name contains invalid characters', 'name');
  }
  
  return trimmed;
};

/**
 * Validate room slug
 */
const validateRoomSlug = (slug) => {
  if (!slug || typeof slug !== 'string') {
    throw new ValidationError('Room slug is required', 'slug');
  }
  
  const trimmed = slug.trim().toLowerCase();
  
  if (trimmed.length < 3) {
    throw new ValidationError('Room slug must be at least 3 characters', 'slug');
  }
  
  if (trimmed.length > 50) {
    throw new ValidationError('Room slug must be less than 50 characters', 'slug');
  }
  
  // Allow only letters, numbers, hyphens
  if (!/^[a-z0-9\-]+$/.test(trimmed)) {
    throw new ValidationError('Room slug can only contain letters, numbers, and hyphens', 'slug');
  }
  
  return trimmed;
};

/**
 * Validate message content
 */
const validateMessage = (content) => {
  if (!content || typeof content !== 'string') {
    throw new ValidationError('Message content is required', 'content');
  }
  
  const trimmed = content.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError('Message cannot be empty', 'content');
  }
  
  if (trimmed.length > 2000) {
    throw new ValidationError('Message must be less than 2000 characters', 'content');
  }
  
  return sanitizeInput(trimmed);
};

/**
 * Validate ObjectId format
 */
const validateObjectId = (id, fieldName = 'id') => {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
  
  // MongoDB ObjectId is 24 character hex string
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }
  
  return id;
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  
  if (pageNum < 1) {
    throw new ValidationError('Page number must be positive', 'page');
  }
  
  if (limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100', 'limit');
  }
  
  return { page: pageNum, limit: limitNum };
};

/**
 * Validate file upload
 */
const validateFileUpload = (file) => {
  if (!file) {
    throw new ValidationError('No file provided', 'file');
  }
  
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif').split(',');
  
  if (file.size > maxSize) {
    throw new ValidationError(`File size exceeds ${Math.floor(maxSize / 1024 / 1024)}MB limit`, 'file');
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new ValidationError(`File type ${file.mimetype} not allowed`, 'file');
  }
  
  // Validate file name
  const filename = file.originalname;
  if (filename.length > 255) {
    throw new ValidationError('Filename too long', 'file');
  }
  
  // Check for dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.jar'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (dangerousExtensions.includes(extension)) {
    throw new ValidationError('File type not allowed for security reasons', 'file');
  }
  
  return file;
};

/**
 * General purpose input sanitization middleware
 */
const sanitizeMiddleware = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    
    // Sanitize route parameters
    if (req.params) {
      req.params = sanitizeInput(req.params);
    }
    
    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(500).json({ error: 'Input processing error' });
  }
};

/**
 * Validation middleware factory
 */
const createValidationMiddleware = (validators) => {
  return (req, res, next) => {
    try {
      const validated = {};
      
      for (const [field, validator] of Object.entries(validators)) {
        const value = req.body[field] ?? req.query[field] ?? req.params[field];
        
        if (validator.required && (value === undefined || value === null)) {
          throw new ValidationError(`${field} is required`, field);
        }
        
        if (value !== undefined && value !== null) {
          validated[field] = validator.validate(value);
        }
      }
      
      // Add validated data to request
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          field: error.field
        });
      }
      
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Validation processing error' });
    }
  };
};

/**
 * Common validation schemas
 */
const validationSchemas = {
  createRoom: {
    name: { required: true, validate: validateName },
    description: { required: false, validate: validateMessage }
  },
  
  createMessage: {
    content: { required: true, validate: validateMessage }
  },
  
  updateUser: {
    name: { required: false, validate: validateName },
    email: { required: false, validate: validateEmail }
  },
  
  pagination: {
    page: { required: false, validate: (val) => validatePagination(val, 20).page },
    limit: { required: false, validate: (val) => validatePagination(1, val).limit }
  }
};

module.exports = {
  ValidationError,
  sanitizeInput,
  validateEmail,
  validateName,
  validateRoomSlug,
  validateMessage,
  validateObjectId,
  validatePagination,
  validateFileUpload,
  sanitizeMiddleware,
  createValidationMiddleware,
  validationSchemas
};