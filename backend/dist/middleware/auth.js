"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeResourceAccess = exports.requireRole = exports.authorizeRoles = exports.authenticateToken = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sheets_service_1 = require("../services/sheets.service");
class AuthService {
    constructor() {
        this.ACCESS_TOKEN_EXPIRY = '15m';
        this.REFRESH_TOKEN_EXPIRY = '7d';
        this.sheetsService = sheets_service_1.SheetsService.getInstance();
        this.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
            console.warn('⚠️  JWT secrets not set in environment variables. Using default values for development.');
        }
    }
    static getInstance() {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }
    generateTokens(user) {
        const accessTokenPayload = { ...user, type: 'access' };
        const refreshTokenPayload = { ...user, type: 'refresh' };
        const accessToken = jsonwebtoken_1.default.sign(accessTokenPayload, this.JWT_ACCESS_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
            issuer: 'project-invoice-api',
            audience: 'project-invoice-client'
        });
        const refreshToken = jsonwebtoken_1.default.sign(refreshTokenPayload, this.JWT_REFRESH_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRY,
            issuer: 'project-invoice-api',
            audience: 'project-invoice-client'
        });
        return { accessToken, refreshToken };
    }
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_ACCESS_SECRET, {
                issuer: 'project-invoice-api',
                audience: 'project-invoice-client'
            });
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }
    verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_REFRESH_SECRET, {
                issuer: 'project-invoice-api',
                audience: 'project-invoice-client'
            });
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }
    async refreshAccessToken(refreshToken) {
        const decoded = this.verifyRefreshToken(refreshToken);
        const users = await this.sheetsService.query('Users', {
            filters: [
                { column: 'id', operator: 'eq', value: decoded.id },
                { column: 'is_active', operator: 'eq', value: true }
            ]
        });
        if (users.length === 0) {
            throw new Error('User not found or inactive');
        }
        const user = users[0];
        return this.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        });
    }
    async revokeRefreshToken(refreshToken) {
        try {
            const decoded = this.verifyRefreshToken(refreshToken);
            console.log(`Refresh token revoked for user: ${decoded.email}`);
        }
        catch (error) {
            console.log('Attempted to revoke invalid refresh token');
        }
    }
}
exports.AuthService = AuthService;
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Access token is required'
            });
            return;
        }
        const authService = AuthService.getInstance();
        const decoded = authService.verifyAccessToken(token);
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const users = await sheetsService.query('Users', {
            filters: [
                { column: 'id', operator: 'eq', value: decoded.id },
                { column: 'is_active', operator: 'eq', value: true }
            ]
        });
        if (users.length === 0) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found or inactive'
            });
            return;
        }
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name
        };
        next();
    }
    catch (error) {
        res.status(401).json({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid token'
        });
    }
};
exports.authenticateToken = authenticateToken;
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                error: 'Forbidden',
                message: `Access denied. Required roles: ${roles.join(', ')}`
            });
            return;
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const requireRole = (roles) => {
    return (0, exports.authorizeRoles)(...roles);
};
exports.requireRole = requireRole;
const authorizeResourceAccess = (resourceType) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required'
                });
                return;
            }
            if (req.user.role === 'admin') {
                next();
                return;
            }
            const resourceId = req.params.id;
            if (!resourceId) {
                res.status(400).json({
                    error: 'Bad Request',
                    message: 'Resource ID is required'
                });
                return;
            }
            const sheetsService = sheets_service_1.SheetsService.getInstance();
            let hasAccess = false;
            switch (resourceType) {
                case 'client':
                    const clients = await sheetsService.query('Clients', {
                        filters: [
                            { column: 'id', operator: 'eq', value: resourceId },
                            { column: 'email', operator: 'eq', value: req.user.email }
                        ]
                    });
                    hasAccess = clients.length > 0;
                    break;
                case 'project':
                    const projects = await sheetsService.query('Projects', {
                        filters: [
                            { column: 'id', operator: 'eq', value: resourceId }
                        ]
                    });
                    if (projects.length > 0) {
                        const clientProjects = await sheetsService.query('Clients', {
                            filters: [
                                { column: 'id', operator: 'eq', value: projects[0].client_id },
                                { column: 'email', operator: 'eq', value: req.user.email }
                            ]
                        });
                        hasAccess = clientProjects.length > 0;
                    }
                    break;
                case 'invoice':
                    const invoices = await sheetsService.query('Invoices', {
                        filters: [
                            { column: 'id', operator: 'eq', value: resourceId }
                        ]
                    });
                    if (invoices.length > 0) {
                        const clientInvoices = await sheetsService.query('Clients', {
                            filters: [
                                { column: 'id', operator: 'eq', value: invoices[0].client_id },
                                { column: 'email', operator: 'eq', value: req.user.email }
                            ]
                        });
                        hasAccess = clientInvoices.length > 0;
                    }
                    break;
            }
            if (!hasAccess) {
                res.status(403).json({
                    error: 'Forbidden',
                    message: 'Access denied to this resource'
                });
                return;
            }
            next();
        }
        catch (error) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Error checking resource access'
            });
        }
    };
};
exports.authorizeResourceAccess = authorizeResourceAccess;
//# sourceMappingURL=auth.js.map