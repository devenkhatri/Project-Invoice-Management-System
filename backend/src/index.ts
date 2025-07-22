import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config, { validateConfig } from './config';
import { createGoogleSheetsService } from './services/googleSheets';
import { initializeRecurringInvoices, scheduleOverdueCheck } from './services/recurringInvoices';
import { createPaymentProcessingService } from './services/paymentProcessing';
import { automationService } from './services/automation';
import { initializeAuthRoutes } from './routes/auth';
import { initializeTwoFactorRoutes } from './routes/twoFactor';
import { initializeProjectRoutes } from './routes/projects';
import { initializeTaskRoutes } from './routes/tasks';
import { initializeTimeEntryRoutes } from './routes/timeEntries';
import { initializeClientRoutes } from './routes/clients';
import { initializeClientPortalRoutes } from './routes/clientPortal';
import { initializeInvoiceRoutes } from './routes/invoices';
import { initializeInvoiceItemRoutes } from './routes/invoiceItems';
import { initializePaymentRoutes } from './routes/payments';
import { sanitizeInput } from './middleware/validation';
import financialReportingRoutes from './routes/financialReporting';
import expenseRoutes from './routes/expenses';
import automationRoutes from './routes/automation';
import filesRoutes from './routes/files';
import integrationsRoutes from './routes/api/integrations';
import { ErrorMonitor, ErrorSeverity } from './utils/errorMonitoring';
import { monitoringService, performanceMonitoringMiddleware } from './services/monitoring';

const app = express();
const PORT = config.server.port;

// Validate configuration
const configValidation = validateConfig();
if (!configValidation.isValid) {
  console.error('❌ Missing required environment variables:', configValidation.missingVars);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Initialize Google Sheets service
const sheetsService = createGoogleSheetsService();
if (!sheetsService) {
  console.error('❌ Failed to initialize Google Sheets service');
  process.exit(1);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.server.frontendUrl,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization middleware
app.use(sanitizeInput);

// Initialize error monitoring
const errorMonitor = ErrorMonitor.getInstance();
app.use(errorMonitor.requestLogger());

// Initialize performance monitoring
app.use(performanceMonitoringMiddleware());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const sheetsConnected = await sheetsService.testConnection();
    const systemHealth = monitoringService.getSystemHealth();
    
    res.json({ 
      status: systemHealth.status, 
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      services: {
        googleSheets: sheetsConnected ? 'connected' : 'disconnected'
      },
      system: {
        memory: {
          usedPercent: Math.round(systemHealth.metrics.memory.usedPercent),
          total: Math.round(systemHealth.metrics.memory.total / (1024 * 1024)) + 'MB'
        },
        disk: {
          usedPercent: Math.round(systemHealth.metrics.disk.usedPercent),
          total: Math.round(systemHealth.metrics.disk.total / (1024 * 1024)) + 'MB'
        },
        uptime: Math.round(systemHealth.metrics.uptime / 60) + ' minutes'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      services: {
        googleSheets: 'error'
      }
    });
  }
});

// Google Sheets initialization endpoint
app.post('/api/init-sheets', async (req, res) => {
  try {
    const success = await sheetsService.initializeProjectSheets();
    if (success) {
      res.json({ 
        message: 'Google Sheets initialized successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to initialize Google Sheets',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Error initializing Google Sheets',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize and mount authentication routes
const authRoutes = initializeAuthRoutes(sheetsService);
app.use('/api/auth', authRoutes);

// Initialize and mount two-factor authentication routes
const twoFactorRoutes = initializeTwoFactorRoutes(sheetsService);
app.use('/api/2fa', twoFactorRoutes);

// Initialize and mount project management routes
const projectRoutes = initializeProjectRoutes(sheetsService);
app.use('/api/projects', projectRoutes);

// Initialize and mount task management routes
const taskRoutes = initializeTaskRoutes(sheetsService);
app.use('/api/tasks', taskRoutes);

// Initialize and mount time entry routes
const timeEntryRoutes = initializeTimeEntryRoutes(sheetsService);
app.use('/api/time-entries', timeEntryRoutes);

// Initialize and mount client management routes
const clientRoutes = initializeClientRoutes(sheetsService);
app.use('/api/clients', clientRoutes);

// Initialize and mount client portal routes
const clientPortalRoutes = initializeClientPortalRoutes(sheetsService);
app.use('/api/client-portal', clientPortalRoutes);

// Initialize and mount invoice management routes
const invoiceRoutes = initializeInvoiceRoutes(sheetsService);
app.use('/api/invoices', invoiceRoutes);

// Initialize and mount invoice items routes
const invoiceItemRoutes = initializeInvoiceItemRoutes(sheetsService);
app.use('/api/invoice-items', invoiceItemRoutes);

// Initialize payment processing service
const paymentService = createPaymentProcessingService(sheetsService);

// Initialize and mount payment routes
const paymentRoutes = initializePaymentRoutes(sheetsService, paymentService);
app.use('/api/payments', paymentRoutes);

// Mount financial reporting routes
app.use('/api/financial', financialReportingRoutes);

// Mount expense routes
app.use('/api/expenses', expenseRoutes);

// Mount automation routes
app.use('/api/automation', automationRoutes);

// Mount file management routes
app.use('/api/files', filesRoutes);

// Mount integrations routes
app.use('/api/integrations', integrationsRoutes);

// Error handling middleware
app.use(errorMonitor.errorHandler());

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.server.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.server.frontendUrl}`);
  
  // Test Google Sheets connection on startup
  console.log('🔗 Testing Google Sheets connection...');
  const connected = await sheetsService.testConnection();
  if (connected) {
    console.log('✅ Google Sheets connection successful');
    
    // Initialize recurring invoices system
    console.log('📅 Initializing recurring invoices system...');
    initializeRecurringInvoices();
    
    // Schedule daily check for overdue invoices
    console.log('⏰ Setting up overdue invoice checker...');
    scheduleOverdueCheck();
    
    // Initialize automation service
    console.log('🤖 Initializing automation service...');
    await automationService.initialize();
    
    // Initialize advanced automation service
    console.log('🚀 Initializing advanced automation service...');
    const { createAdvancedAutomationService } = require('./services/advancedAutomation');
    const { createGSTReportingService } = require('./services/gstReporting');
    const { createEInvoicingService } = require('./services/eInvoicing');
    const { createFinancialReportingService } = require('./services/financialReporting');
    
    const financialReportingService = createFinancialReportingService(sheetsService);
    const gstReportingService = createGSTReportingService(sheetsService, financialReportingService);
    const eInvoicingService = createEInvoicingService(sheetsService);
    const advancedAutomationService = createAdvancedAutomationService(
      sheetsService,
      automationService,
      gstReportingService,
      eInvoicingService
    );
    
    await advancedAutomationService.initialize();
  } else {
    console.log('❌ Google Sheets connection failed - check your configuration');
  }
});

export default app;