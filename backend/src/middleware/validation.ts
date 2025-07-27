import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { SecurityUtils } from '../utils/security';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
    return;
  }
  
  next();
};

/**
 * Middleware to validate request and handle errors
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  
  next();
};

/**
 * Common validation rules
 */
export const ValidationRules = {
  // User validation
  email: () => 
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
      .custom((value) => {
        if (!SecurityUtils.isValidEmail(value)) {
          throw new Error('Invalid email format');
        }
        return true;
      }),

  password: () =>
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .custom((value) => {
        const validation = SecurityUtils.validatePasswordStrength(value);
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }
        return true;
      }),

  name: () =>
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),

  // Project validation
  projectName: () =>
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Project name is required and must be less than 200 characters')
      .custom((value) => SecurityUtils.sanitizeInput(value)),

  projectStatus: () =>
    body('status')
      .isIn(['active', 'completed', 'on-hold'])
      .withMessage('Status must be active, completed, or on-hold'),

  projectBudget: () =>
    body('budget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),

  projectDates: () => [
    body('start_date')
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('end_date')
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.start_date)) {
          throw new Error('End date must be after start date');
        }
        return true;
      })
  ],

  // Client validation
  clientName: () =>
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Client name is required and must be less than 200 characters'),

  phone: () =>
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Invalid phone number format'),

  gstin: () =>
    body('gstin')
      .optional()
      .custom((value) => {
        if (value && !SecurityUtils.validateGSTIN(value)) {
          throw new Error('Invalid GSTIN format');
        }
        return true;
      }),

  pan: () =>
    body('pan')
      .optional()
      .custom((value) => {
        if (value && !SecurityUtils.validatePAN(value)) {
          throw new Error('Invalid PAN format');
        }
        return true;
      }),

  // Task validation
  taskTitle: () =>
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Task title is required and must be less than 200 characters'),

  taskStatus: () =>
    body('status')
      .isIn(['todo', 'in-progress', 'completed'])
      .withMessage('Status must be todo, in-progress, or completed'),

  taskPriority: () =>
    body('priority')
      .isIn(['low', 'medium', 'high'])
      .withMessage('Priority must be low, medium, or high'),

  hours: () =>
    body('hours')
      .isFloat({ min: 0, max: 24 })
      .withMessage('Hours must be between 0 and 24'),

  // Invoice validation
  invoiceAmount: () =>
    body('amount')
      .isFloat({ min: 0 })
      .withMessage('Amount must be a positive number'),

  invoiceStatus: () =>
    body('status')
      .isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
      .withMessage('Invalid invoice status'),

  currency: () =>
    body('currency')
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Currency must be uppercase letters only'),

  // Common validation
  id: (paramName: string = 'id') =>
    param(paramName)
      .notEmpty()
      .withMessage(`${paramName} is required`),

  optionalId: (fieldName: string) =>
    body(fieldName)
      .optional()
      .notEmpty()
      .withMessage(`${fieldName} must not be empty if provided`),

  dateRange: () => [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (req.query?.start_date && new Date(value) <= new Date(req.query.start_date as string)) {
          throw new Error('End date must be after start date');
        }
        return true;
      })
  ],

  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],

  // Sanitization middleware
  sanitizeBody: () =>
    body('*')
      .customSanitizer((value) => {
        if (typeof value === 'string') {
          return SecurityUtils.sanitizeInput(value);
        }
        return value;
      })
};

/**
 * Validation rule sets for different endpoints
 */
export const ValidationSets = {
  // Authentication
  register: [
    ValidationRules.name(),
    ValidationRules.email(),
    ValidationRules.password(),
    body('role')
      .optional()
      .isIn(['admin', 'client'])
      .withMessage('Role must be admin or client'),
    handleValidationErrors
  ],

  login: [
    ValidationRules.email(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
    handleValidationErrors
  ],

  // Projects
  createProject: [
    ValidationRules.projectName(),
    ValidationRules.projectStatus(),
    ValidationRules.optionalId('client_id'),
    ValidationRules.projectBudget(),
    ...ValidationRules.projectDates(),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    handleValidationErrors
  ],

  updateProject: [
    ValidationRules.id(),
    ValidationRules.projectName(),
    ValidationRules.projectStatus(),
    ValidationRules.projectBudget(),
    handleValidationErrors
  ],

  // Clients
  createClient: [
    ValidationRules.clientName(),
    ValidationRules.email(),
    ValidationRules.phone(),
    ValidationRules.gstin(),
    ValidationRules.pan(),
    body('address')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Address must be less than 500 characters'),
    body('payment_terms')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Payment terms must be less than 200 characters'),
    handleValidationErrors
  ],

  updateClient: [
    ValidationRules.id(),
    ValidationRules.clientName(),
    ValidationRules.phone(),
    ValidationRules.gstin(),
    ValidationRules.pan(),
    handleValidationErrors
  ],

  // Tasks
  createTask: [
    ValidationRules.taskTitle(),
    ValidationRules.taskStatus(),
    ValidationRules.taskPriority(),
    ValidationRules.optionalId('project_id'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('due_date')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('estimated_hours')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Estimated hours must be a positive number'),
    handleValidationErrors
  ],

  updateTask: [
    ValidationRules.id(),
    ValidationRules.taskTitle(),
    ValidationRules.taskStatus(),
    ValidationRules.taskPriority(),
    handleValidationErrors
  ],

  // Time entries
  createTimeEntry: [
    ValidationRules.optionalId('task_id'),
    ValidationRules.optionalId('project_id'),
    ValidationRules.hours(),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('date')
      .isISO8601()
      .withMessage('Date must be a valid ISO 8601 date'),
    handleValidationErrors
  ],

  // Invoices
  createInvoice: [
    ValidationRules.optionalId('client_id'),
    ValidationRules.optionalId('project_id'),
    ValidationRules.invoiceAmount(),
    ValidationRules.currency(),
    ValidationRules.invoiceStatus(),
    body('due_date')
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    handleValidationErrors
  ],

  // Common
  getById: [
    ValidationRules.id(),
    handleValidationErrors
  ],

  queryWithPagination: [
    ...ValidationRules.pagination(),
    ...ValidationRules.dateRange(),
    handleValidationErrors
  ]
};

/**
 * Custom validation middleware for file uploads
 */
export const validateFileUpload = (
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf'],
  maxSize: number = 5 * 1024 * 1024 // 5MB
) => {
  return (req: Request & { file?: any }, res: Response, next: NextFunction): void => {
    if (!req.file) {
      next();
      return;
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({
        error: 'Invalid File Type',
        message: `Allowed file types: ${allowedTypes.join(', ')}`
      });
      return;
    }

    // Check file size
    if (req.file.size > maxSize) {
      res.status(400).json({
        error: 'File Too Large',
        message: `Maximum file size: ${maxSize / (1024 * 1024)}MB`
      });
      return;
    }

    next();
  };
};