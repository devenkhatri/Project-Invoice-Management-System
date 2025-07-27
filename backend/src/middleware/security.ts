import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { SecurityUtils } from '../utils/security';

/**
 * Enhanced rate limiting configurations for different endpoints
 */
export const RateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  }),

  // Strict rate limiting for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: {
      error: 'Too Many Authentication Attempts',
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response) => {
      console.warn(`🚨 Auth rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too Many Authentication Attempts',
        message: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      });
    }
  }),

  // Password reset rate limiting
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset requests per hour
    message: {
      error: 'Too Many Password Reset Attempts',
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: '1 hour'
    }
  }),

  // File upload rate limiting
  fileUpload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 file uploads per minute
    message: {
      error: 'Too Many File Uploads',
      message: 'Too many file upload attempts, please try again later.',
      retryAfter: '1 minute'
    }
  })
};

/**
 * Request sanitization middleware to prevent XSS and injection attacks
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return SecurityUtils.sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = SecurityUtils.sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * MongoDB injection prevention middleware
 */
export const preventNoSQLInjection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`🚨 NoSQL injection attempt detected from IP: ${req.ip}, key: ${key}`);
  }
});

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
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

/**
 * Request logging middleware for security monitoring
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /vbscript:/i, // VBScript protocol
    /onload=/i, // Event handlers
    /onerror=/i
  ];

  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Check for suspicious patterns in URL and headers
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(fullUrl) || pattern.test(userAgent)
  );

  if (isSuspicious) {
    console.warn(`🚨 Suspicious request detected:`, {
      ip: req.ip,
      method: req.method,
      url: fullUrl,
      userAgent,
      timestamp: new Date().toISOString()
    });
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    console[logLevel](`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
  });

  next();
};

/**
 * IP whitelist middleware (optional)
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0) {
      next();
      return;
    }

    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (!SecurityUtils.isIPAllowed(clientIP, allowedIPs)) {
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

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET requests and API endpoints with proper authentication
  if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
    next();
    return;
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionToken = (req as any).session?.csrfToken;

  if (!csrfToken || !sessionToken || !SecurityUtils.validateCSRFToken(csrfToken, sessionToken)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid CSRF token'
    });
    return;
  }

  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
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

/**
 * API key validation middleware (for external integrations)
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    next(); // Skip if no API key is configured
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