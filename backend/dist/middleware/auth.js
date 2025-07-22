"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorizeOwnership = exports.authorizeRoles = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({
            error: 'Access token required',
            code: 'TOKEN_MISSING'
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
            return;
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                error: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
            return;
        }
        else {
            res.status(500).json({
                error: 'Token verification failed',
                code: 'TOKEN_VERIFICATION_ERROR'
            });
            return;
        }
    }
};
exports.authenticateToken = authenticateToken;
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: roles,
                current: req.user.role
            });
            return;
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const authorizeOwnership = (resourceIdParam = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }
        if (req.user.role === 'admin') {
            next();
            return;
        }
        const resourceId = req.params[resourceIdParam];
        if (req.user.role === 'client' && req.user.id !== resourceId) {
            res.status(403).json({
                error: 'Access denied - can only access own resources',
                code: 'OWNERSHIP_REQUIRED'
            });
            return;
        }
        next();
    };
};
exports.authorizeOwnership = authorizeOwnership;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };
    }
    catch (error) {
    }
    next();
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map