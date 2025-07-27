"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFileUpload = exports.ValidationSets = exports.ValidationRules = exports.validateRequest = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const security_1 = require("../utils/security");
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.handleValidationErrors = handleValidationErrors;
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            error: 'Validation failed',
            errors: errors.array()
        });
        return;
    }
    next();
};
exports.validateRequest = validateRequest;
exports.ValidationRules = {
    email: () => (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
        .custom((value) => {
        if (!security_1.SecurityUtils.isValidEmail(value)) {
            throw new Error('Invalid email format');
        }
        return true;
    }),
    password: () => (0, express_validator_1.body)('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .custom((value) => {
        const validation = security_1.SecurityUtils.validatePasswordStrength(value);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }
        return true;
    }),
    name: () => (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    projectName: () => (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Project name is required and must be less than 200 characters')
        .custom((value) => security_1.SecurityUtils.sanitizeInput(value)),
    projectStatus: () => (0, express_validator_1.body)('status')
        .isIn(['active', 'completed', 'on-hold'])
        .withMessage('Status must be active, completed, or on-hold'),
    projectBudget: () => (0, express_validator_1.body)('budget')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Budget must be a positive number'),
    projectDates: () => [
        (0, express_validator_1.body)('start_date')
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        (0, express_validator_1.body)('end_date')
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date')
            .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
    ],
    clientName: () => (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Client name is required and must be less than 200 characters'),
    phone: () => (0, express_validator_1.body)('phone')
        .optional()
        .matches(/^[\+]?[1-9][\d]{0,15}$/)
        .withMessage('Invalid phone number format'),
    gstin: () => (0, express_validator_1.body)('gstin')
        .optional()
        .custom((value) => {
        if (value && !security_1.SecurityUtils.validateGSTIN(value)) {
            throw new Error('Invalid GSTIN format');
        }
        return true;
    }),
    pan: () => (0, express_validator_1.body)('pan')
        .optional()
        .custom((value) => {
        if (value && !security_1.SecurityUtils.validatePAN(value)) {
            throw new Error('Invalid PAN format');
        }
        return true;
    }),
    taskTitle: () => (0, express_validator_1.body)('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Task title is required and must be less than 200 characters'),
    taskStatus: () => (0, express_validator_1.body)('status')
        .isIn(['todo', 'in-progress', 'completed'])
        .withMessage('Status must be todo, in-progress, or completed'),
    taskPriority: () => (0, express_validator_1.body)('priority')
        .isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be low, medium, or high'),
    hours: () => (0, express_validator_1.body)('hours')
        .isFloat({ min: 0, max: 24 })
        .withMessage('Hours must be between 0 and 24'),
    invoiceAmount: () => (0, express_validator_1.body)('amount')
        .isFloat({ min: 0 })
        .withMessage('Amount must be a positive number'),
    invoiceStatus: () => (0, express_validator_1.body)('status')
        .isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
        .withMessage('Invalid invoice status'),
    currency: () => (0, express_validator_1.body)('currency')
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Currency must be uppercase letters only'),
    id: (paramName = 'id') => (0, express_validator_1.param)(paramName)
        .notEmpty()
        .withMessage(`${paramName} is required`),
    optionalId: (fieldName) => (0, express_validator_1.body)(fieldName)
        .optional()
        .notEmpty()
        .withMessage(`${fieldName} must not be empty if provided`),
    dateRange: () => [
        (0, express_validator_1.query)('start_date')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        (0, express_validator_1.query)('end_date')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date')
            .custom((value, { req }) => {
            if (req.query?.start_date && new Date(value) <= new Date(req.query.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
    ],
    pagination: () => [
        (0, express_validator_1.query)('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
    ],
    sanitizeBody: () => (0, express_validator_1.body)('*')
        .customSanitizer((value) => {
        if (typeof value === 'string') {
            return security_1.SecurityUtils.sanitizeInput(value);
        }
        return value;
    })
};
exports.ValidationSets = {
    register: [
        exports.ValidationRules.name(),
        exports.ValidationRules.email(),
        exports.ValidationRules.password(),
        (0, express_validator_1.body)('role')
            .optional()
            .isIn(['admin', 'client'])
            .withMessage('Role must be admin or client'),
        exports.handleValidationErrors
    ],
    login: [
        exports.ValidationRules.email(),
        (0, express_validator_1.body)('password')
            .notEmpty()
            .withMessage('Password is required'),
        exports.handleValidationErrors
    ],
    refreshToken: [
        (0, express_validator_1.body)('refreshToken')
            .notEmpty()
            .withMessage('Refresh token is required'),
        exports.handleValidationErrors
    ],
    createProject: [
        exports.ValidationRules.projectName(),
        exports.ValidationRules.projectStatus(),
        exports.ValidationRules.optionalId('client_id'),
        exports.ValidationRules.projectBudget(),
        ...exports.ValidationRules.projectDates(),
        (0, express_validator_1.body)('description')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Description must be less than 1000 characters'),
        exports.handleValidationErrors
    ],
    updateProject: [
        exports.ValidationRules.id(),
        exports.ValidationRules.projectName(),
        exports.ValidationRules.projectStatus(),
        exports.ValidationRules.projectBudget(),
        exports.handleValidationErrors
    ],
    createClient: [
        exports.ValidationRules.clientName(),
        exports.ValidationRules.email(),
        exports.ValidationRules.phone(),
        exports.ValidationRules.gstin(),
        exports.ValidationRules.pan(),
        (0, express_validator_1.body)('address')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Address must be less than 500 characters'),
        (0, express_validator_1.body)('payment_terms')
            .optional()
            .isLength({ max: 200 })
            .withMessage('Payment terms must be less than 200 characters'),
        exports.handleValidationErrors
    ],
    updateClient: [
        exports.ValidationRules.id(),
        exports.ValidationRules.clientName(),
        exports.ValidationRules.phone(),
        exports.ValidationRules.gstin(),
        exports.ValidationRules.pan(),
        exports.handleValidationErrors
    ],
    createTask: [
        exports.ValidationRules.taskTitle(),
        exports.ValidationRules.taskStatus(),
        exports.ValidationRules.taskPriority(),
        exports.ValidationRules.optionalId('project_id'),
        (0, express_validator_1.body)('description')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Description must be less than 1000 characters'),
        (0, express_validator_1.body)('due_date')
            .optional()
            .isISO8601()
            .withMessage('Due date must be a valid ISO 8601 date'),
        (0, express_validator_1.body)('estimated_hours')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Estimated hours must be a positive number'),
        exports.handleValidationErrors
    ],
    updateTask: [
        exports.ValidationRules.id(),
        exports.ValidationRules.taskTitle(),
        exports.ValidationRules.taskStatus(),
        exports.ValidationRules.taskPriority(),
        exports.handleValidationErrors
    ],
    createTimeEntry: [
        exports.ValidationRules.optionalId('task_id'),
        exports.ValidationRules.optionalId('project_id'),
        exports.ValidationRules.hours(),
        (0, express_validator_1.body)('description')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Description must be less than 500 characters'),
        (0, express_validator_1.body)('date')
            .isISO8601()
            .withMessage('Date must be a valid ISO 8601 date'),
        exports.handleValidationErrors
    ],
    createInvoice: [
        exports.ValidationRules.optionalId('client_id'),
        exports.ValidationRules.optionalId('project_id'),
        exports.ValidationRules.invoiceAmount(),
        exports.ValidationRules.currency(),
        exports.ValidationRules.invoiceStatus(),
        (0, express_validator_1.body)('due_date')
            .isISO8601()
            .withMessage('Due date must be a valid ISO 8601 date'),
        exports.handleValidationErrors
    ],
    getById: [
        exports.ValidationRules.id(),
        exports.handleValidationErrors
    ],
    queryWithPagination: [
        ...exports.ValidationRules.pagination(),
        ...exports.ValidationRules.dateRange(),
        exports.handleValidationErrors
    ]
};
const validateFileUpload = (allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'], maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
        if (!req.file) {
            next();
            return;
        }
        if (!allowedTypes.includes(req.file.mimetype)) {
            res.status(400).json({
                error: 'Invalid File Type',
                message: `Allowed file types: ${allowedTypes.join(', ')}`
            });
            return;
        }
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
exports.validateFileUpload = validateFileUpload;
//# sourceMappingURL=validation.js.map