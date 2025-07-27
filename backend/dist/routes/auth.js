"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const security_1 = require("../utils/security");
const sheets_service_1 = require("../services/sheets.service");
const validation_1 = require("../middleware/validation");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const authService = auth_1.AuthService.getInstance();
const sheetsService = sheets_service_1.SheetsService.getInstance();
router.post('/register', validation_1.ValidationSets.register, async (req, res) => {
    try {
        const { name, email, password, role = 'client' } = req.body;
        const existingUsers = await sheetsService.query('Users', {
            filters: [{ column: 'email', operator: 'eq', value: email }]
        });
        if (existingUsers.length > 0) {
            res.status(409).json({
                error: 'Conflict',
                message: 'User with this email already exists'
            });
            return;
        }
        const hashedPassword = await security_1.SecurityUtils.hashPassword(password);
        const userId = (0, uuid_1.v4)();
        const userData = {
            id: userId,
            name: security_1.SecurityUtils.sanitizeInput(name),
            email: email.toLowerCase(),
            password_hash: hashedPassword,
            role,
            is_active: true,
            email_verified: false,
            last_login: null,
            failed_login_attempts: 0,
            locked_until: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await sheetsService.create('Users', userData);
        const tokens = authService.generateTokens({
            id: userId,
            email,
            role,
            name
        });
        console.log(`✅ User registered successfully: ${email} (${role})`);
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: userId,
                name,
                email,
                role,
                is_active: true
            },
            tokens
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to register user'
        });
    }
});
router.post('/login', validation_1.ValidationSets.login, async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await sheetsService.query('Users', {
            filters: [{ column: 'email', operator: 'eq', value: email.toLowerCase() }]
        });
        if (users.length === 0) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
            return;
        }
        const user = users[0];
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            res.status(423).json({
                error: 'Account Locked',
                message: 'Account is temporarily locked due to multiple failed login attempts'
            });
            return;
        }
        if (!user.is_active) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Account is deactivated'
            });
            return;
        }
        const isPasswordValid = await security_1.SecurityUtils.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            const failedAttempts = (user.failed_login_attempts || 0) + 1;
            const updateData = {
                failed_login_attempts: failedAttempts,
                updated_at: new Date().toISOString()
            };
            if (failedAttempts >= 5) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + 30);
                updateData.locked_until = lockUntil.toISOString();
            }
            await sheetsService.update('Users', user.id, updateData);
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
            return;
        }
        await sheetsService.update('Users', user.id, {
            failed_login_attempts: 0,
            locked_until: null,
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        const tokens = authService.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        });
        console.log(`✅ User logged in successfully: ${user.email} (${user.role})`);
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                is_active: user.is_active
            },
            tokens
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to authenticate user'
        });
    }
});
router.post('/refresh', validation_1.ValidationSets.refreshToken, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshAccessToken(refreshToken);
        res.json({
            message: 'Token refreshed successfully',
            tokens
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid refresh token'
        });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await authService.revokeRefreshToken(refreshToken);
        }
        res.json({
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.json({
            message: 'Logged out successfully'
        });
    }
});
router.get('/profile', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
            return;
        }
        const users = await sheetsService.query('Users', {
            filters: [{ column: 'id', operator: 'eq', value: req.user.id }]
        });
        if (users.length === 0) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
            return;
        }
        const user = users[0];
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                is_active: user.is_active,
                email_verified: user.email_verified,
                last_login: user.last_login,
                created_at: user.created_at
            }
        });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch user profile'
        });
    }
});
router.post('/change-password', [
    (0, express_validator_1.body)('currentPassword').notEmpty().withMessage('Current password is required'),
    validation_1.ValidationRules.password(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
            return;
        }
        const { currentPassword, newPassword } = req.body;
        const users = await sheetsService.query('Users', {
            filters: [{ column: 'id', operator: 'eq', value: req.user.id }]
        });
        if (users.length === 0) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
            return;
        }
        const user = users[0];
        const isCurrentPasswordValid = await security_1.SecurityUtils.verifyPassword(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Current password is incorrect'
            });
            return;
        }
        const hashedNewPassword = await security_1.SecurityUtils.hashPassword(newPassword);
        await sheetsService.update('Users', user.id, {
            password_hash: hashedNewPassword,
            updated_at: new Date().toISOString()
        });
        console.log(`✅ Password changed successfully for user: ${user.email}`);
        res.json({
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to change password'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map