"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRateLimit = exports.validationChains = exports.validateSchema = exports.schemas = exports.sanitizeInput = exports.sanitizeHtml = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const zod_1 = require("zod");
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.handleValidationErrors = handleValidationErrors;
const sanitizeHtml = (value) => {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>'"&]/g, (match) => {
        const htmlEntities = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        };
        return htmlEntities[match] || match;
    });
};
exports.sanitizeHtml = sanitizeHtml;
const sanitizeInput = (req, res, next) => {
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return (0, exports.sanitizeHtml)(obj.trim());
        }
        else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        else if (obj && typeof obj === 'object') {
            const sanitized = {};
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
exports.sanitizeInput = sanitizeInput;
exports.schemas = {
    register: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format').toLowerCase(),
        password: zod_1.z.string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
        role: zod_1.z.enum(['admin', 'client']).optional()
    }),
    login: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format').toLowerCase(),
        password: zod_1.z.string().min(1, 'Password is required')
    }),
    project: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
        clientId: zod_1.z.string().min(1, 'Client ID is required'),
        description: zod_1.z.string().max(1000, 'Description too long').optional(),
        startDate: zod_1.z.string().datetime('Invalid start date format').optional(),
        endDate: zod_1.z.string().datetime('Invalid end date format').optional(),
        budget: zod_1.z.number().positive('Budget must be positive').optional(),
        status: zod_1.z.enum(['active', 'completed', 'on-hold']).optional()
    }),
    task: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Task title is required').max(200, 'Task title too long'),
        description: zod_1.z.string().max(1000, 'Description too long').optional(),
        projectId: zod_1.z.string().min(1, 'Project ID is required'),
        priority: zod_1.z.enum(['low', 'medium', 'high']).optional(),
        status: zod_1.z.enum(['todo', 'in-progress', 'completed']).optional(),
        dueDate: zod_1.z.string().datetime('Invalid due date format').optional(),
        estimatedHours: zod_1.z.number().positive('Estimated hours must be positive').optional()
    }),
    client: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Client name is required').max(200, 'Client name too long'),
        email: zod_1.z.string().email('Invalid email format').toLowerCase(),
        phone: zod_1.z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format').optional(),
        address: zod_1.z.string().max(500, 'Address too long').optional(),
        gstin: zod_1.z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional()
    }),
    invoice: zod_1.z.object({
        clientId: zod_1.z.string().min(1, 'Client ID is required'),
        projectId: zod_1.z.string().min(1, 'Project ID is required').optional(),
        amount: zod_1.z.number().positive('Amount must be positive'),
        taxAmount: zod_1.z.number().min(0, 'Tax amount cannot be negative').optional(),
        dueDate: zod_1.z.string().datetime('Invalid due date format').optional(),
        description: zod_1.z.string().max(1000, 'Description too long').optional(),
        items: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string().min(1, 'Item description is required'),
            quantity: zod_1.z.number().positive('Quantity must be positive'),
            rate: zod_1.z.number().positive('Rate must be positive'),
            amount: zod_1.z.number().positive('Amount must be positive')
        })).optional()
    }),
    timeEntry: zod_1.z.object({
        taskId: zod_1.z.string().min(1, 'Task ID is required'),
        projectId: zod_1.z.string().min(1, 'Project ID is required'),
        hours: zod_1.z.number().positive('Hours must be positive').max(24, 'Hours cannot exceed 24'),
        description: zod_1.z.string().max(500, 'Description too long').optional(),
        date: zod_1.z.string().datetime('Invalid date format')
    }),
    expense: zod_1.z.object({
        projectId: zod_1.z.string().min(1, 'Project ID is required').optional(),
        category: zod_1.z.string().min(1, 'Category is required').max(100, 'Category too long'),
        amount: zod_1.z.number().positive('Amount must be positive'),
        description: zod_1.z.string().max(500, 'Description too long').optional(),
        date: zod_1.z.string().datetime('Invalid date format')
    })
};
const validateSchema = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.body);
            req.body = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: error.issues.map((err) => ({
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
exports.validateSchema = validateSchema;
exports.validationChains = {
    register: [
        (0, express_validator_1.body)('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
        (0, express_validator_1.body)('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Password must contain uppercase, lowercase, number, and special character'),
        (0, express_validator_1.body)('name')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters'),
        (0, express_validator_1.body)('role')
            .optional()
            .isIn(['admin', 'client'])
            .withMessage('Role must be admin or client')
    ],
    login: [
        (0, express_validator_1.body)('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
        (0, express_validator_1.body)('password')
            .notEmpty()
            .withMessage('Password is required')
    ],
    createProject: [
        (0, express_validator_1.body)('name')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Project name is required and must be less than 200 characters'),
        (0, express_validator_1.body)('clientId')
            .notEmpty()
            .withMessage('Client ID is required'),
        (0, express_validator_1.body)('description')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Description must be less than 1000 characters'),
        (0, express_validator_1.body)('budget')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Budget must be a positive number'),
        (0, express_validator_1.body)('status')
            .optional()
            .isIn(['active', 'completed', 'on-hold'])
            .withMessage('Status must be active, completed, or on-hold')
    ],
    createClient: [
        (0, express_validator_1.body)('name')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Client name is required and must be less than 200 characters'),
        (0, express_validator_1.body)('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
        (0, express_validator_1.body)('phone')
            .optional()
            .isMobilePhone('any')
            .withMessage('Valid phone number is required'),
        (0, express_validator_1.body)('gstin')
            .optional()
            .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
            .withMessage('Invalid GSTIN format')
    ],
    createInvoice: [
        (0, express_validator_1.body)('clientId')
            .notEmpty()
            .withMessage('Client ID is required'),
        (0, express_validator_1.body)('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be greater than 0'),
        (0, express_validator_1.body)('taxAmount')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Tax amount must be non-negative'),
        (0, express_validator_1.body)('items')
            .optional()
            .isArray()
            .withMessage('Items must be an array'),
        (0, express_validator_1.body)('items.*.description')
            .if((0, express_validator_1.body)('items').exists())
            .notEmpty()
            .withMessage('Item description is required'),
        (0, express_validator_1.body)('items.*.quantity')
            .if((0, express_validator_1.body)('items').exists())
            .isFloat({ min: 0.01 })
            .withMessage('Item quantity must be greater than 0'),
        (0, express_validator_1.body)('items.*.rate')
            .if((0, express_validator_1.body)('items').exists())
            .isFloat({ min: 0.01 })
            .withMessage('Item rate must be greater than 0')
    ],
    mongoId: [
        (0, express_validator_1.param)('id')
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('Invalid ID format')
    ],
    pagination: [
        (0, express_validator_1.query)('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        (0, express_validator_1.query)('sort')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Sort must be asc or desc')
    ]
};
const validateRateLimit = (windowMs, max, message) => {
    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        if (!global.rateLimitStore) {
            global.rateLimitStore = new Map();
        }
        const key = `${ip}:${req.route?.path || req.path}`;
        const requests = global.rateLimitStore.get(key) || [];
        const validRequests = requests.filter((timestamp) => now - timestamp < windowMs);
        if (validRequests.length >= max) {
            res.status(429).json({
                error: message || 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(windowMs / 1000)
            });
            return;
        }
        validRequests.push(now);
        global.rateLimitStore.set(key, validRequests);
        next();
    };
};
exports.validateRateLimit = validateRateLimit;
//# sourceMappingURL=validation.js.map