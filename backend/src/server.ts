import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import and initialize automation service
import { AutomationService } from './services/automation';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Project Invoice Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Import routes
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import timeEntryRoutes from './routes/time-entries';
import analyticsRoutes from './routes/analytics';
import clientRoutes from './routes/clients';
import clientPortalRoutes from './routes/client-portal';
import invoiceRoutes from './routes/invoices';
import paymentRoutes from './routes/payments';
import automationRoutes from './routes/automation';
import fileRoutes from './routes/files';
import integrationRoutes from './routes/integrations';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/integrations', integrationRoutes);

// API root endpoint
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
      automation: '/api/automation',
      files: '/api/files',
      integrations: '/api/integrations'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// Start server with error handling
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
  
  // Initialize and start automation service
  try {
    const automationService = AutomationService.getInstance();
    await automationService.start();
    console.log('🤖 Automation service started successfully');
  } catch (error) {
    console.error('❌ Failed to start automation service:', error);
    // Don't exit the process, just log the error
  }
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('💡 Solutions:');
    console.error('   1. Kill the process using the port:');
    console.error(`      lsof -ti:${PORT} | xargs kill -9`);
    console.error('   2. Use a different port:');
    console.error(`      PORT=5001 npm run dev`);
    console.error('   3. Check if another instance is running');
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;