"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const googleapis_1 = require("googleapis");
const config_1 = __importDefault(require("../config"));
class AuthService {
    constructor(sheetsService) {
        this.sheetsService = sheetsService;
        this.initializeGoogleOAuth();
    }
    initializeGoogleOAuth() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET, process.env.GOOGLE_OAUTH_REDIRECT_URI);
    }
    generateTokens(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, config_1.default.jwt.secret, { expiresIn: config_1.default.jwt.expiresIn });
        const refreshToken = jsonwebtoken_1.default.sign(payload, config_1.default.jwt.refreshSecret, { expiresIn: config_1.default.jwt.refreshExpiresIn });
        const expiresIn = this.getTokenExpirationTime(config_1.default.jwt.expiresIn);
        return {
            accessToken,
            refreshToken,
            expiresIn
        };
    }
    getTokenExpirationTime(timeString) {
        const unit = timeString.slice(-1);
        const value = parseInt(timeString.slice(0, -1));
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return 3600;
        }
    }
    async hashPassword(password) {
        const saltRounds = 12;
        return bcryptjs_1.default.hash(password, saltRounds);
    }
    async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    async register(userData) {
        const existingUser = await this.findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error('User already exists with this email');
        }
        const hashedPassword = await this.hashPassword(userData.password);
        const user = {
            id: this.generateUserId(),
            email: userData.email.toLowerCase(),
            password: hashedPassword,
            name: userData.name,
            role: userData.role || 'client',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await this.saveUser(user);
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        const tokens = this.generateTokens(userWithoutPassword);
        return { user: userWithoutPassword, tokens };
    }
    async login(credentials) {
        const user = await this.findUserByEmail(credentials.email);
        if (!user || !user.password) {
            throw new Error('Invalid credentials');
        }
        const isValidPassword = await this.verifyPassword(credentials.password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }
        user.updatedAt = new Date().toISOString();
        await this.updateUser(user);
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        const tokens = this.generateTokens(userWithoutPassword);
        return { user: userWithoutPassword, tokens };
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.default.jwt.refreshSecret);
            const user = await this.findUserById(decoded.id);
            if (!user) {
                throw new Error('User not found');
            }
            const userWithoutPassword = { ...user };
            delete userWithoutPassword.password;
            return this.generateTokens(userWithoutPassword);
        }
        catch (error) {
            throw new Error('Invalid refresh token');
        }
    }
    async googleLogin(authData) {
        try {
            const { tokens } = await this.oauth2Client.getToken(authData.code);
            this.oauth2Client.setCredentials(tokens);
            const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: this.oauth2Client });
            const { data } = await oauth2.userinfo.get();
            if (!data.email) {
                throw new Error('Unable to get user email from Google');
            }
            let user = await this.findUserByEmail(data.email);
            if (!user) {
                user = {
                    id: this.generateUserId(),
                    email: data.email.toLowerCase(),
                    name: data.name || data.email,
                    role: 'client',
                    googleId: data.id || undefined,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await this.saveUser(user);
            }
            else {
                if (!user.googleId && data.id) {
                    user.googleId = data.id;
                    user.updatedAt = new Date().toISOString();
                    await this.updateUser(user);
                }
            }
            const userWithoutPassword = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                googleId: user.googleId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
            const authTokens = this.generateTokens(userWithoutPassword);
            return { user: userWithoutPassword, tokens: authTokens };
        }
        catch (error) {
            throw new Error(`Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getGoogleAuthUrl(redirectUri) {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/spreadsheets'
        ];
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            redirect_uri: redirectUri
        });
    }
    async findUserByEmail(email) {
        try {
            const users = await this.sheetsService.query('Users', { email: email.toLowerCase() });
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }
    async findUserById(id) {
        try {
            const users = await this.sheetsService.query('Users', { id });
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }
    async saveUser(user) {
        await this.sheetsService.create('Users', user);
    }
    async updateUser(user) {
        await this.sheetsService.update('Users', user.id, user);
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    validateToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, config_1.default.jwt.secret);
            return { valid: true, payload };
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                return { valid: false, error: 'Token expired' };
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                return { valid: false, error: 'Invalid token' };
            }
            else {
                return { valid: false, error: 'Token verification failed' };
            }
        }
    }
    async logout(userId) {
        try {
            const user = await this.findUserById(userId);
            if (user) {
                user.updatedAt = new Date().toISOString();
                await this.updateUser(user);
            }
        }
        catch (error) {
            console.error('Error during logout:', error);
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map