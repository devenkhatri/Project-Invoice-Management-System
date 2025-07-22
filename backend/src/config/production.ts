/**
 * Production environment configuration
 * 
 * This file contains specific configuration overrides for the production environment.
 */

import { AppConfig } from './index';

// Production-specific configuration overrides
const productionConfig: Partial<AppConfig> = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: 'production',
    frontendUrl: process.env.FRONTEND_URL || 'https://invoice.example.com'
  },
  
  // In production, we use a separate Google Sheets document
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || ''
  }
};

export default productionConfig;