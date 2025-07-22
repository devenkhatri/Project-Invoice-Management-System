"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importStar(require("./config"));
const googleSheets_1 = require("./services/googleSheets");
const auth_1 = require("./routes/auth");
const twoFactor_1 = require("./routes/twoFactor");
const projects_1 = require("./routes/projects");
const tasks_1 = require("./routes/tasks");
const timeEntries_1 = require("./routes/timeEntries");
const validation_1 = require("./middleware/validation");
const app = (0, express_1.default)();
const PORT = config_1.default.server.port;
const configValidation = (0, config_1.validateConfig)();
if (!configValidation.isValid) {
    console.error('❌ Missing required environment variables:', configValidation.missingVars);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}
const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
if (!sheetsService) {
    console.error('❌ Failed to initialize Google Sheets service');
    process.exit(1);
}
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.default.server.frontendUrl,
    credentials: true
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(validation_1.sanitizeInput);
app.get('/health', async (req, res) => {
    try {
        const sheetsConnected = await sheetsService.testConnection();
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: config_1.default.server.nodeEnv,
            services: {
                googleSheets: sheetsConnected ? 'connected' : 'disconnected'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            environment: config_1.default.server.nodeEnv,
            services: {
                googleSheets: 'error'
            }
        });
    }
});
app.post('/api/init-sheets', async (req, res) => {
    try {
        const success = await sheetsService.initializeProjectSheets();
        if (success) {
            res.json({
                message: 'Google Sheets initialized successfully',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(500).json({
                error: 'Failed to initialize Google Sheets',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        res.status(500).json({
            error: 'Error initializing Google Sheets',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
const authRoutes = (0, auth_1.initializeAuthRoutes)(sheetsService);
app.use('/api/auth', authRoutes);
const twoFactorRoutes = (0, twoFactor_1.initializeTwoFactorRoutes)(sheetsService);
app.use('/api/2fa', twoFactorRoutes);
const projectRoutes = (0, projects_1.initializeProjectRoutes)(sheetsService);
app.use('/api/projects', projectRoutes);
const taskRoutes = (0, tasks_1.initializeTaskRoutes)(sheetsService);
app.use('/api/tasks', taskRoutes);
const timeEntryRoutes = (0, timeEntries_1.initializeTimeEntryRoutes)(sheetsService);
app.use('/api/time-entries', timeEntryRoutes);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${config_1.default.server.nodeEnv}`);
    console.log(`🌐 Frontend URL: ${config_1.default.server.frontendUrl}`);
    console.log('🔗 Testing Google Sheets connection...');
    const connected = await sheetsService.testConnection();
    if (connected) {
        console.log('✅ Google Sheets connection successful');
    }
    else {
        console.log('❌ Google Sheets connection failed - check your configuration');
    }
});
exports.default = app;
//# sourceMappingURL=index.js.map