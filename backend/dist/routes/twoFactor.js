"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTwoFactorRoutes = void 0;
const express_1 = require("express");
const twoFactor_1 = require("../services/twoFactor");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
let twoFactorService;
const initializeTwoFactorRoutes = (sheetsService) => {
    twoFactorService = new twoFactor_1.TwoFactorService(sheetsService);
    return router;
};
exports.initializeTwoFactorRoutes = initializeTwoFactorRoutes;
router.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'User not authenticated',
                code: 'USER_NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const isEnabled = await twoFactorService.isTwoFactorEnabled(req.user.id);
        res.json({
            enabled: isEnabled,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('2FA status error:', error);
        res.status(500).json({
            error: 'Failed to get 2FA status',
            code: 'TWO_FACTOR_STATUS_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/setup', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'User not authenticated',
                code: 'USER_NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const { secret, uri, qrCode } = await twoFactorService.generateSecret(req.user.id, req.user.email);
        const recoveryCode = await twoFactorService.generateRecoveryCode(req.user.id);
        res.json({
            secret,
            uri,
            qrCode,
            recoveryCode,
            message: 'Two-factor authentication setup initiated',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('2FA setup error:', error);
        if (error instanceof Error && error.message.includes('already enabled')) {
            res.status(400).json({
                error: 'Two-factor authentication is already enabled',
                code: 'TWO_FACTOR_ALREADY_ENABLED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        res.status(500).json({
            error: 'Failed to setup two-factor authentication',
            code: 'TWO_FACTOR_SETUP_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/verify', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'User not authenticated',
                code: 'USER_NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const { token } = req.body;
        if (!token) {
            res.status(400).json({
                error: 'Token is required',
                code: 'TOKEN_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const isValid = await twoFactorService.verifyToken(req.user.id, token);
        if (isValid) {
            res.json({
                verified: true,
                message: 'Two-factor authentication enabled successfully',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(400).json({
                verified: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({
            error: 'Failed to verify token',
            code: 'TWO_FACTOR_VERIFICATION_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/disable', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: 'User not authenticated',
                code: 'USER_NOT_AUTHENTICATED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const { token } = req.body;
        if (!token) {
            res.status(400).json({
                error: 'Token is required',
                code: 'TOKEN_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const isValid = await twoFactorService.verifyToken(req.user.id, token);
        if (!isValid) {
            res.status(400).json({
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const success = await twoFactorService.disableTwoFactor(req.user.id);
        if (success) {
            res.json({
                disabled: true,
                message: 'Two-factor authentication disabled successfully',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(500).json({
                error: 'Failed to disable two-factor authentication',
                code: 'TWO_FACTOR_DISABLE_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            error: 'Failed to disable two-factor authentication',
            code: 'TWO_FACTOR_DISABLE_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/recovery', validation_1.sanitizeInput, async (req, res) => {
    try {
        const { userId, recoveryCode } = req.body;
        if (!userId || !recoveryCode) {
            res.status(400).json({
                error: 'User ID and recovery code are required',
                code: 'RECOVERY_PARAMS_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const isValid = await twoFactorService.verifyRecoveryCode(userId, recoveryCode);
        if (isValid) {
            await twoFactorService.disableTwoFactor(userId);
            res.json({
                verified: true,
                message: 'Recovery successful. Two-factor authentication has been disabled.',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(400).json({
                verified: false,
                error: 'Invalid recovery code',
                code: 'INVALID_RECOVERY_CODE',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('2FA recovery error:', error);
        res.status(500).json({
            error: 'Failed to process recovery code',
            code: 'TWO_FACTOR_RECOVERY_ERROR',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=twoFactor.js.map