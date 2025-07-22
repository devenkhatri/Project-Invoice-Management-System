/**
 * Production Deployment Configuration
 * 
 * This file contains configuration settings for the production deployment
 * of the Project Invoice Management System.
 */

module.exports = {
  // PM2 Application Configuration
  pm2: {
    name: 'project-invoice-management',
    script: 'dist/index.js',
    instances: 'max', // Use maximum number of CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  },
  
  // Nginx Configuration
  nginx: {
    serverName: 'invoice.example.com',
    port: 80,
    sslPort: 443,
    proxyPass: 'http://localhost:3001',
    staticPath: '/var/www/invoice-management/frontend/build'
  },
  
  // Backup Configuration
  backup: {
    schedule: '0 0 * * *', // Daily at midnight
    retention: {
      daily: 7,   // Keep daily backups for 7 days
      weekly: 4,  // Keep weekly backups for 4 weeks
      monthly: 6  // Keep monthly backups for 6 months
    },
    storage: {
      local: '/var/backups/invoice-management',
      remote: 's3://invoice-management-backups'
    }
  },
  
  // Monitoring Configuration
  monitoring: {
    errorAlertThreshold: 5, // Number of errors before alerting
    performanceThresholds: {
      apiResponseTime: 1000, // ms
      sheetsOperationTime: 2000, // ms
      databaseOperationTime: 500, // ms
      memoryUsage: 400 // MB
    },
    metricsCollection: {
      interval: 300000, // 5 minutes in milliseconds
      retention: {
        systemMetrics: 288, // Keep 24 hours of system metrics (at 5-minute intervals)
        performanceMetrics: 1000 // Keep last 1000 performance metrics entries
      }
    },
    alertThrottleTime: 3600000, // 1 hour in milliseconds
    contactEmail: 'admin@example.com',
    slackWebhook: 'https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK'
  },
  
  // Google Sheets Configuration
  googleSheets: {
    maxConcurrentConnections: 5,
    retryAttempts: 3,
    retryDelay: 1000, // ms
    cacheExpiry: 300 // seconds
  }
};