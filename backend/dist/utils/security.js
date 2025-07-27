"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityUtils = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
class SecurityUtils {
    static async hashPassword(password) {
        try {
            const salt = await bcrypt_1.default.genSalt(this.SALT_ROUNDS);
            return await bcrypt_1.default.hash(password, salt);
        }
        catch (error) {
            throw new Error('Failed to hash password');
        }
    }
    static async verifyPassword(password, hash) {
        try {
            return await bcrypt_1.default.compare(password, hash);
        }
        catch (error) {
            throw new Error('Failed to verify password');
        }
    }
    static generateSecureToken(length = this.TOKEN_LENGTH) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
    static generateSecurePassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto_1.default.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        return password;
    }
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static validatePasswordStrength(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static generateDataHash(data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
    static verifyDataHash(data, hash) {
        const computedHash = this.generateDataHash(data);
        return computedHash === hash;
    }
    static encryptData(data, key) {
        const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key';
        const cipher = crypto_1.default.createCipher('aes-256-cbc', encryptionKey);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    static decryptData(encryptedData, key) {
        const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key';
        const decipher = crypto_1.default.createDecipher('aes-256-cbc', encryptionKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    static isActionAllowed(lastActionTime, minIntervalMs) {
        const now = new Date();
        const timeDiff = now.getTime() - lastActionTime.getTime();
        return timeDiff >= minIntervalMs;
    }
    static generateCSRFToken() {
        return this.generateSecureToken(32);
    }
    static validateCSRFToken(token, sessionToken) {
        return token === sessionToken;
    }
    static maskSensitiveData(data, visibleChars = 4) {
        if (data.length <= visibleChars) {
            return '*'.repeat(data.length);
        }
        const masked = '*'.repeat(data.length - visibleChars);
        return masked + data.slice(-visibleChars);
    }
    static validateGSTIN(gstin) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return gstinRegex.test(gstin);
    }
    static validatePAN(pan) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan);
    }
    static generateSessionId() {
        return this.generateSecureToken(64);
    }
    static isIPAllowed(ip, allowedIPs = []) {
        if (allowedIPs.length === 0) {
            return true;
        }
        return allowedIPs.includes(ip);
    }
}
exports.SecurityUtils = SecurityUtils;
SecurityUtils.SALT_ROUNDS = 12;
SecurityUtils.TOKEN_LENGTH = 32;
//# sourceMappingURL=security.js.map