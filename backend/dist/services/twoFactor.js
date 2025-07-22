"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
class TwoFactorService {
    constructor(sheetsService) {
        this.sheetsService = sheetsService;
        otplib_1.totp.options = {
            digits: 6,
            step: 30,
            window: 1
        };
    }
    async generateSecret(userId, email) {
        const existingSecret = await this.getUserSecret(userId);
        if (existingSecret && existingSecret.verified) {
            throw new Error('Two-factor authentication is already enabled for this user');
        }
        const secret = this.generateSecretKey();
        const uri = otplib_1.totp.keyuri(email, 'Invoice Management System', secret);
        await this.saveUserSecret(userId, secret);
        const qrCode = await qrcode_1.default.toDataURL(uri);
        return { secret, uri, qrCode };
    }
    async verifyToken(userId, token) {
        const userSecret = await this.getUserSecret(userId);
        if (!userSecret || !userSecret.secret) {
            throw new Error('Two-factor authentication is not set up for this user');
        }
        const isValid = otplib_1.totp.verify({
            token,
            secret: userSecret.secret
        });
        if (isValid && !userSecret.verified) {
            await this.markSecretAsVerified(userId);
        }
        return isValid;
    }
    async isTwoFactorEnabled(userId) {
        const userSecret = await this.getUserSecret(userId);
        return !!(userSecret && userSecret.verified);
    }
    async disableTwoFactor(userId) {
        try {
            const userSecret = await this.getUserSecret(userId);
            if (!userSecret) {
                return true;
            }
            await this.deleteUserSecret(userId);
            return true;
        }
        catch (error) {
            console.error('Error disabling 2FA:', error);
            return false;
        }
    }
    async generateRecoveryCode(userId) {
        const recoveryCode = crypto_1.default.randomBytes(10).toString('hex');
        const hashedCode = crypto_1.default.createHash('sha256').update(recoveryCode).digest('hex');
        await this.saveRecoveryCode(userId, hashedCode);
        return recoveryCode;
    }
    async verifyRecoveryCode(userId, code) {
        const storedCodes = await this.getRecoveryCodes(userId);
        if (!storedCodes || storedCodes.length === 0) {
            return false;
        }
        const hashedCode = crypto_1.default.createHash('sha256').update(code).digest('hex');
        const matchIndex = storedCodes.findIndex(c => c === hashedCode);
        if (matchIndex >= 0) {
            storedCodes.splice(matchIndex, 1);
            await this.updateRecoveryCodes(userId, storedCodes);
            return true;
        }
        return false;
    }
    generateSecretKey() {
        return crypto_1.default.randomBytes(20).toString('hex');
    }
    async getUserSecret(userId) {
        try {
            const results = await this.sheetsService.query('TwoFactorSecrets', { userId });
            return results.length > 0 ? results[0] : null;
        }
        catch (error) {
            console.error('Error getting user 2FA secret:', error);
            return null;
        }
    }
    async saveUserSecret(userId, secret) {
        const timestamp = new Date().toISOString();
        const existingSecret = await this.getUserSecret(userId);
        if (existingSecret) {
            await this.sheetsService.update('TwoFactorSecrets', existingSecret.userId, {
                ...existingSecret,
                secret,
                verified: false,
                updatedAt: timestamp
            });
        }
        else {
            await this.sheetsService.create('TwoFactorSecrets', {
                userId,
                secret,
                verified: false,
                createdAt: timestamp,
                updatedAt: timestamp
            });
        }
    }
    async markSecretAsVerified(userId) {
        const userSecret = await this.getUserSecret(userId);
        if (userSecret) {
            await this.sheetsService.update('TwoFactorSecrets', userId, {
                ...userSecret,
                verified: true,
                updatedAt: new Date().toISOString()
            });
        }
    }
    async deleteUserSecret(userId) {
        try {
            const userSecret = await this.getUserSecret(userId);
            if (userSecret) {
                await this.sheetsService.delete('TwoFactorSecrets', userId);
            }
        }
        catch (error) {
            console.error('Error deleting 2FA secret:', error);
            throw error;
        }
    }
    async saveRecoveryCode(userId, hashedCode) {
        const codes = await this.getRecoveryCodes(userId);
        codes.push(hashedCode);
        await this.updateRecoveryCodes(userId, codes);
    }
    async getRecoveryCodes(userId) {
        try {
            const results = await this.sheetsService.query('RecoveryCodes', { userId });
            if (results.length > 0) {
                return JSON.parse(results[0].codes || '[]');
            }
            return [];
        }
        catch (error) {
            console.error('Error getting recovery codes:', error);
            return [];
        }
    }
    async updateRecoveryCodes(userId, codes) {
        const timestamp = new Date().toISOString();
        const results = await this.sheetsService.query('RecoveryCodes', { userId });
        if (results.length > 0) {
            await this.sheetsService.update('RecoveryCodes', userId, {
                userId,
                codes: JSON.stringify(codes),
                updatedAt: timestamp
            });
        }
        else {
            await this.sheetsService.create('RecoveryCodes', {
                userId,
                codes: JSON.stringify(codes),
                createdAt: timestamp,
                updatedAt: timestamp
            });
        }
    }
}
exports.TwoFactorService = TwoFactorService;
//# sourceMappingURL=twoFactor.js.map