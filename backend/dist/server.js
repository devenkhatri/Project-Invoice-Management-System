"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const automation_1 = require("./services/automation");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Project Invoice Management API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
const auth_1 = __importDefault(require("./routes/auth"));
const projects_1 = __importDefault(require("./routes/projects"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const time_entries_1 = __importDefault(require("./routes/time-entries"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const clients_1 = __importDefault(require("./routes/clients"));
const client_portal_1 = __importDefault(require("./routes/client-portal"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const payments_1 = __importDefault(require("./routes/payments"));
const automation_2 = __importDefault(require("./routes/automation"));
app.use('/api/auth', auth_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/time-entries', time_entries_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/clients', clients_1.default);
app.use('/api/client-portal', client_portal_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/automation', automation_2.default);
app.get('/api', (req, res) => {
    res.json({
        message: 'Project Invoice Management API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            projects: '/api/projects',
            tasks: '/api/tasks',
            timeEntries: '/api/time-entries',
            analytics: '/api/analytics',
            clients: '/api/clients',
            clientPortal: '/api/client-portal',
            invoices: '/api/invoices',
            payments: '/api/payments',
            automation: '/api/automation'
        }
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found on this server.'
    });
});
app.use((err, req, res, _next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
    });
});
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API base: http://localhost:${PORT}/api`);
    try {
        const automationService = automation_1.AutomationService.getInstance();
        await automationService.start();
        console.log('🤖 Automation service started successfully');
    }
    catch (error) {
        console.error('❌ Failed to start automation service:', error);
    }
});
exports.default = app;
//# sourceMappingURL=server.js.map