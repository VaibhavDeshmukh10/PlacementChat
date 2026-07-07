const Joi = require('joi');

// User validation schemas
const userSchemas = {
  devLogin: Joi.object({
    email: Joi.string()
      .email()
      .max(254)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email must be less than 254 characters',
        'any.required': 'Email is required'
      }),
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.min': 'Name must not be empty',
        'string.max': 'Name must be less than 100 characters',
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens and apostrophes',
        'any.required': 'Name is required'
      })
  }),
  
  updateProfile: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .optional(),
    email: Joi.string()
      .email()
      .max(254)
      .optional(),
    role: Joi.string()
      .valid('admin', 'student')
      .optional()
  })
};

// Room validation schemas
const roomSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-&.]+$/)
      .required()
      .messages({
        'string.min': 'Room name must not be empty',
        'string.max': 'Room name must be less than 100 characters',
        'string.pattern.base': 'Room name can only contain letters, numbers, spaces, hyphens, ampersands and periods',
        'any.required': 'Room name is required'
      }),
    domain: Joi.string()
      .domain()
      .max(255)
      .optional()
      .allow('')
      .messages({
        'string.domain': 'Please provide a valid domain name',
        'string.max': 'Domain must be less than 255 characters'
      }),
    cities: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.string()
            .min(1)
            .max(50)
            .pattern(/^[a-zA-Z\s\-']+$/)
        ),
        Joi.string()
      )
      .required()
      .messages({
        'alternatives.match': 'Cities must be an array of strings or a comma-separated string',
        'any.required': 'Cities are required'
      }),
    status: Joi.string()
      .valid('Active', 'Hidden')
      .default('Active')
      .optional()
  }),
  
  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-&.]+$/)
      .optional(),
    domain: Joi.string()
      .domain()
      .max(255)
      .optional()
      .allow(''),
    cities: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.string()
            .min(1)
            .max(50)
            .pattern(/^[a-zA-Z\s\-']+$/)
        ),
        Joi.string()
      )
      .optional(),
    status: Joi.string()
      .valid('Active', 'Hidden')
      .optional(),
    memberCount: Joi.number()
      .integer()
      .min(0)
      .optional()
  })
};

// Message validation schemas
const messageSchemas = {
  send: Joi.object({
    text: Joi.string()
      .min(1)
      .max(2000)
      .required()
      .messages({
        'string.min': 'Message cannot be empty',
        'string.max': 'Message must be less than 2000 characters',
        'any.required': 'Message text is required'
      })
  }),
  
  experience: Joi.object({
    role: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-/.]+$/)
      .required()
      .messages({
        'string.min': 'Role cannot be empty',
        'string.max': 'Role must be less than 100 characters',
        'string.pattern.base': 'Role can only contain letters, numbers, spaces, hyphens, slashes and periods',
        'any.required': 'Role is required'
      }),
    city: Joi.string()
      .min(1)
      .max(50)
      .pattern(/^[a-zA-Z\s\-']+$/)
      .required()
      .messages({
        'string.min': 'City cannot be empty',
        'string.max': 'City must be less than 50 characters',
        'string.pattern.base': 'City can only contain letters, spaces, hyphens and apostrophes',
        'any.required': 'City is required'
      }),
    verdict: Joi.string()
      .valid('Selected', 'Rejected', 'In progress')
      .required()
      .messages({
        'any.only': 'Verdict must be Selected, Rejected, or In progress',
        'any.required': 'Verdict is required'
      }),
    summary: Joi.string()
      .min(10)
      .max(5000)
      .required()
      .messages({
        'string.min': 'Summary must be at least 10 characters',
        'string.max': 'Summary must be less than 5000 characters',
        'any.required': 'Summary is required'
      }),
    rounds: Joi.array()
      .items(
        Joi.object({
          title: Joi.string()
            .min(1)
            .max(200)
            .pattern(/^[a-zA-Z0-9\s\-/.()]+$/)
            .required(),
          note: Joi.string()
            .max(1000)
            .pattern(/^[a-zA-Z0-9\s\-/.(),:;!?'"]+$/)
            .allow('')
            .optional()
        })
      )
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 rounds are allowed'
      })
  })
};

// Feedback validation schemas
const feedbackSchemas = {
  submit: Joi.object({
    type: Joi.string()
      .valid('bug', 'feature', 'improvement', 'other')
      .required()
      .messages({
        'any.only': 'Feedback type must be bug, feature, improvement, or other',
        'any.required': 'Feedback type is required'
      }),
    subject: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Subject cannot be empty',
        'string.max': 'Subject must be less than 200 characters',
        'any.required': 'Subject is required'
      }),
    message: Joi.string()
      .min(10)
      .max(2000)
      .required()
      .messages({
        'string.min': 'Message must be at least 10 characters',
        'string.max': 'Message must be less than 2000 characters',
        'any.required': 'Message is required'
      }),
    email: Joi.string()
      .email()
      .max(254)
      .optional()
  }),
  
  update: Joi.object({
    status: Joi.string()
      .valid('Open', 'In Progress', 'Resolved', 'Closed')
      .required()
      .messages({
        'any.only': 'Status must be Open, In Progress, Resolved, or Closed',
        'any.required': 'Status is required'
      })
  })
};

// Socket.io message validation
const socketSchemas = {
  joinRoom: Joi.object({
    room: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\-_]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Room name can only contain letters, numbers, hyphens and underscores',
        'any.required': 'Room name is required'
      })
  }),
  
  typing: Joi.object({
    slug: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\-_]+$/)
      .required(),
    name: Joi.string()
      .min(1)
      .max(100)
      .required(),
    isTyping: Joi.boolean()
      .default(true)
  })
};

// Parameter validation schemas
const paramSchemas = {
  mongoId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid ID format'
    }),
  
  slug: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z0-9\-_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid slug format'
    })
};

module.exports = {
  userSchemas,
  roomSchemas,
  messageSchemas,
  feedbackSchemas,
  socketSchemas,
  paramSchemas
};