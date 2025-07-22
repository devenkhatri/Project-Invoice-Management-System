import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { z } from 'zod';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
    return;
  }
  next();
};

/**
 * Sanitize HTML content to prevent XSS
 */
export const sanitizeHtml = (value: string): string => {
  // Remove HTML tags and potentially dangerous characters
  return value
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, (match) => {
      const htmlEntities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return htmlEntities[match] || match;
    });
};

/**
 * Custom sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize all string values in request body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj.trim());
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

// Zod schemas for validation
export const schemas = {
  // User registration schema
  register: z.object({
    email: z.string().email('Invalid email format').toLowerCase(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    role: z.enum(['admin', 'client']).optional()
  }),

  // User login schema
  login: z.object({
    email: z.string().email('Invalid email format').toLowerCase(),
    password: z.string().min(1, 'Password is required')
  }),

  // Project schema
  project: z.object({
    name: z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
    clientId: z.string().min(1, 'Client ID is required'),
    description: z.string().max(1000, 'Description too long').optional(),
    startDate: z.string().datetime('Invalid start date format').optional(),
    endDate: z.string().datetime('Invalid end date format').optional(),
    budget: z.number().positive('Budget must be positive').optional(),
    status: z.enum(['active', 'completed', 'on-hold']).optional()
  }),

  // Task schema
  task: z.object({
    title: z.string().min(1, 'Task title is required').max(200, 'Task title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    projectId: z.string().min(1, 'Project ID is required'),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['todo', 'in-progress', 'completed']).optional(),
    dueDate: z.string().datetime('Invalid due date format').optional(),
    estimatedHours: z.number().positive('Estimated hours must be positive').optional()
  }),

  // Client schema
  client: z.object({
    name: z.string().min(1, 'Client name is required').max(200, 'Client name too long'),
    email: z.string().email('Invalid email format').toLowerCase(),
    phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format').optional(),
    address: z.string().max(500, 'Address too long').optional(),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional()
  }),

  // Invoice schema
  invoice: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    projectId: z.string().min(1, 'Project ID is required').optional(),
    amount: z.number().positive('Amount must be positive'),
    taxAmount: z.number().min(0, 'Tax amount cannot be negative').optional(),
    dueDate: z.string().datetime('Invalid due date format').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    items: z.array(z.object({
      description: z.string().min(1, 'Item description is required'),
      quantity: z.number().positive('Quantity must be positive'),
      rate: z.number().positive('Rate must be positive'),
      amount: z.number().positive('Amount must be positive')
    })).optional()
  }),

  // Time entry schema
  timeEntry: z.object({
    taskId: z.string().min(1, 'Task ID is required'),
    projectId: z.string().min(1, 'Project ID is required'),
    hours: z.number().positive('Hours must be positive').max(24, 'Hours cannot exceed 24'),
    description: z.string().max(500, 'Description too long').optional(),
    date: z.string().datetime('Invalid date format')
  }),

  // Expense schema
  expense: z.object({
    projectId: z.string().min(1, 'Project ID is required').optional(),
    category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
    amount: z.number().positive('Amount must be positive'),
    description: z.string().max(500, 'Description too long').optional(),
    date: z.string().datetime('Invalid date format')
  })
};

/**
 * Zod validation middleware factory
 */
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
        return;
      }
      next(error);
    }
  };
};

// Express-validator validation chains
export const validationChains = {
  // Authentication validations
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'client'])
      .withMessage('Role must be admin or client')
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  // Project validations
  createProject: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Project name is required and must be less than 200 characters'),
    body('clientId')
      .notEmpty()
      .withMessage('Client ID is required'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('budget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),
    body('status')
      .optional()
      .isIn(['active', 'completed', 'on-hold'])
      .withMessage('Status must be active, completed, or on-hold')
  ],

  // Client validations
  createClient: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Client name is required and must be less than 200 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('gstin')
      .optional()
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .withMessage('Invalid GSTIN format')
  ],

  // Invoice validations
  createInvoice: [
    body('clientId')
      .notEmpty()
      .withMessage('Client ID is required'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('taxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Tax amount must be non-negative'),
    body('items')
      .optional()
      .isArray()
      .withMessage('Items must be an array'),
    body('items.*.description')
      .if(body('items').exists())
      .notEmpty()
      .withMessage('Item description is required'),
    body('items.*.quantity')
      .if(body('items').exists())
      .isFloat({ min: 0.01 })
      .withMessage('Item quantity must be greater than 0'),
    body('items.*.rate')
      .if(body('items').exists())
      .isFloat({ min: 0.01 })
      .withMessage('Item rate must be greater than 0')
  ],

  // Parameter validations
  mongoId: [
    param('id')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid ID format')
  ],

  // Query parameter validations
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort must be asc or desc')
  ]
};

// Declare global type for rate limit store
declare global {
  var rateLimitStore: Map<string, number[]> | undefined;
}

/**
 * Rate limiting validation
 */
export const validateRateLimit = (windowMs: number, max: number, message?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // This would typically integrate with a rate limiting service
    // For now, we'll implement a simple in-memory rate limiter
    const ip = req.ip;
    const now = Date.now();
    
    // In production, use Redis or similar for distributed rate limiting
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }
    
    const key = `${ip}:${req.route?.path || req.path}`;
    const requests = global.rateLimitStore.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter((timestamp: number) => now - timestamp < windowMs);
    
    if (validRequests.length >= max) {
      res.status(429).json({
        error: message || 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
      return;
    }
    
    // Add current request
    validRequests.push(now);
    global.rateLimitStore.set(key, validRequests);
    
    next();
  };
};