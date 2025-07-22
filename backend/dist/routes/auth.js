"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAuthRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../services/auth");
const auth_2 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
let authService;
const initializeAuthRoutes = (sheetsService) => {
    authService = new auth_1.AuthService(sheetsService);
    return router;
};
exports.initializeAuthRoutes = initializeAuthRoutes;
router.post('/register', validation_1.sanitizeInput, (0, validation_1.validateSchema)(validation_1.schemas.register), async (req, res) => {
    try {
        const { user, tokens } = await authService.register(req.body);
        res.status(201).json({
            message: 'User registered successfully',
            user,
            tokens,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        if (error instanceof Error) {
            if (error.message.includes('already exists')) {
                res.status(409).json({
                    error: 'User already exists',
                    code: 'USER_EXISTS',
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }
        res.status(500).json({
            error: 'Registration failed',
            code: 'REGISTRATION_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/login', validation_1.sanitizeInput, (0, validation_1.validateSchema)(validation_1.schemas.login), async (req, res) => {
    try {
        const { user, tokens } = await authService.login(req.body);
        res.json({
            message: 'Login successful',
            user,
            tokens,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/refresh', validation_1.sanitizeInput, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token is required',
                code: 'REFRESH_TOKEN_REQUIRED',
                timestamp: new Date().toISOString()
            });
        }
        const tokens = await authService.refreshToken(refreshToken);
        res.json({
            message: 'Token refreshed successfully',
            tokens,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            error: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/google/url', (req, res) => {
    try {
        const redirectUri = req.query.redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
        if (!redirectUri) {
            res.status(400).json({
                error: 'Redirect URI is required',
                code: 'REDIRECT_URI_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const authUrl = authService.getGoogleAuthUrl(redirectUri);
        res.json({
            authUrl,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Google OAuth URL error:', error);
        res.status(500).json({
            error: 'Failed to generate Google OAuth URL',
            code: 'GOOGLE_OAUTH_URL_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/google/callback', validation_1.sanitizeInput, async (req, res) => {
    try {
        const { code, redirectUri } = req.body;
        if (!code || !redirectUri) {
            res.status(400).json({
                error: 'Authorization code and redirect URI are required',
                code: 'GOOGLE_AUTH_PARAMS_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const { user, tokens } = await authService.googleLogin({ code, redirectUri });
        res.json({
            message: 'Google login successful',
            user,
            tokens,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Google OAuth callback error:', error);
        res.status(401).json({
            error: 'Google authentication failed',
            code: 'GOOGLE_AUTH_FAILED',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Authentication failed',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/profile', auth_2.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'User not authenticated',
                code: 'USER_NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        res.json({
            user: req.user,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            error: 'Failed to get user profile',
            code: 'PROFILE_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/logout', auth_2.authenticateToken, async (req, res) => {
    try {
        if (req.user) {
            await authService.logout(req.user.id);
        }
        res.json({
            message: 'Logout successful',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Logout failed',
            code: 'LOGOUT_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/validate', validation_1.sanitizeInput, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({
                error: 'Token is required',
                code: 'TOKEN_REQUIRED',
                timestamp: new Date().toISOString()
            });
        }
        const validation = authService.validateToken(token);
        if (validation.valid) {
            res.json({
                valid: true,
                payload: validation.payload,
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(401).json({
                valid: false,
                error: validation.error,
                code: 'TOKEN_INVALID',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            valid: false,
            error: 'Token validation failed',
            code: 'TOKEN_VALIDATION_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map