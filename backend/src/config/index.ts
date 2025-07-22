import dotenv from 'dotenv';
import productionConfig from './production';

// Load environment variables
dotenv.config();

export interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
    frontendUrl: string;
  };
  googleSheets: {
    spreadsheetId: string;
    serviceAccountEmail: string;
    privateKey: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  paymentGateways: {
    stripe: {
      secretKey: string;
      publishableKey: string;
    };
    paypal: {
      clientId: string;
      clientSecret: string;
    };
    razorpay: {
      keyId: string;
      keySecret: string;
    };
  };
  email: {
    service: string;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  gst: {
    apiBaseUrl: string;
    apiKey: string;
  };
}

// Base configuration
const baseConfig: AppConfig = {
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
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  },
  gst: {
    apiBaseUrl: process.env.GST_API_BASE_URL || 'https://api.gst.gov.in',
    apiKey: process.env.GST_API_KEY || ''
  }
};

// Merge with environment-specific configuration
const config: AppConfig = process.env.NODE_ENV === 'production'
  ? { ...baseConfig, ...productionConfig } as AppConfig
  : baseConfig;

// Validation function to check required environment variables
export function validateConfig(): { isValid: boolean; missingVars: string[] } {
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

export default config;