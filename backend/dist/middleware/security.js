"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = exports.requestSizeLimit = exports.csrfProtection = exports.ipWhitelist = exports.securityLogger = exports.securityHeaders = exports.preventNoSQLInjection = exports.sanitizeRequest = exports.RateLimiters = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const security_1 = require("../utils/security");
exports.RateLimiters = {
    general: (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: {
            error: 'Too Many Requests',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            });
        }
    }),
    auth: (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
            error: 'Too Many Authentication Attempts',
            message: 'Too many authentication attempts, please try again later.',
            retryAfter: '15 minutes'
        },
        skipSuccessfulRequests: true,
        handler: (req, res) => {
            console.warn(`🚨 Auth rate limit exceeded for IP: ${req.ip} on ${req.path}`);
            res.status(429).json({
                error: 'Too Many Authentication Attempts',
                message: 'Too many authentication attempts, please try again later.',
                retryAfter: '15 minutes'
            });
        }
    }),
    passwordReset: (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000,
        max: 3,
        message: {
            error: 'Too Many Password Reset Attempts',
            message: 'Too many password reset attempts, please try again later.',
            retryAfter: '1 hour'
        }
    }),
    fileUpload: (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 10,
        message: {
            error: 'Too Many File Uploads',
            message: 'Too many file upload attempts, please try again later.',
            retryAfter: '1 minute'
        }
    })
};
const sanitizeRequest = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    next();
};
exports.sanitizeRequest = sanitizeRequest;
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        return security_1.SecurityUtils.sanitizeInput(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = security_1.SecurityUtils.sanitizeInput(key);
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
}
exports.preventNoSQLInjection = (0, express_mongo_sanitize_1.default)({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`🚨 NoSQL injection attempt detected from IP: ${req.ip}, key: ${key}`);
    }
});
const securityHeaders = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'"
    ].join('; '));
    next();
};
exports.securityHeaders = securityHeaders;
const securityLogger = (req, res, next) => {
    const startTime = Date.now();
    const suspiciousPatterns = [
        /\.\.\//,
        /<script/i,
        /union.*select/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i
    ];
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(fullUrl) || pattern.test(userAgent));
    if (isSuspicious) {
        console.warn(`🚨 Suspicious request detected:`, {
            ip: req.ip,
            method: req.method,
            url: fullUrl,
            userAgent,
            timestamp: new Date().toISOString()
        });
    }
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        console[logLevel](`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
    });
    next();
};
exports.securityLogger = securityLogger;
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            next();
            return;
        }
        const clientIP = req.ip || req.connection.remoteAddress || '';
        if (!security_1.SecurityUtils.isIPAllowed(clientIP, allowedIPs)) {
            console.warn(`🚨 Blocked request from unauthorized IP: ${clientIP}`);
            res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied from this IP address'
            });
            return;
        }
        next();
    };
};
exports.ipWhitelist = ipWhitelist;
const csrfProtection = (req, res, next) => {
    if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
        next();
        return;
    }
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    if (!csrfToken || !sessionToken || !security_1.SecurityUtils.validateCSRFToken(csrfToken, sessionToken)) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid CSRF token'
        });
        return;
    }
    next();
};
exports.csrfProtection = csrfProtection;
const requestSizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxSizeBytes = parseSize(maxSize);
        if (contentLength > maxSizeBytes) {
            res.status(413).json({
                error: 'Payload Too Large',
                message: `Request size exceeds maximum allowed size of ${maxSize}`
            });
            return;
        }
        next();
    };
};
exports.requestSizeLimit = requestSizeLimit;
function parseSize(size) {
    const units = {
        'b': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
    if (!match) {
        throw new Error('Invalid size format');
    }
    const [, value, unit] = match;
    return parseFloat(value) * units[unit];
}
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;
    if (!validApiKey) {
        next();
        return;
    }
    if (!apiKey || apiKey !== validApiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid API key is required'
        });
        return;
    }
    next();
};
exports.validateApiKey = validateApiKey;
//# sourceMappingURL=security.js.map