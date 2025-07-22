"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    },
    googleSheets: {
        spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
        privateKey: process.env.GOOGLE_PRIVATE_KEY || ''
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'fallback_jwt_secret_change_in_production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_change_in_production',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    paymentGateways: {
        stripe: {
            secretKey: process.env.STRIPE_SECRET_KEY || '',
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID || '',
            clientSecret: process.env.PAYPAL_CLIENT_SECRET || ''
        },
        razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID || '',
            keySecret: process.env.RAZORPAY_KEY_SECRET || ''
        }
    },
    email: {
        service: process.env.EMAIL_SERVICE || 'gmail',
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    },
    gst: {
        apiBaseUrl: process.env.GST_API_BASE_URL || 'https://api.gst.gov.in',
        apiKey: process.env.GST_API_KEY || ''
    }
};
function validateConfig() {
    const requiredVars = [
        'GOOGLE_SHEETS_ID',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY'
    ];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    return {
        isValid: missingVars.length === 0,
        missingVars
    };
}
exports.default = config;
//# sourceMappingURL=index.js.map