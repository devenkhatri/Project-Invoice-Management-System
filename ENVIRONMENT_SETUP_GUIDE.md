# Environment Setup Guide - Project Invoice Management System

This guide provides detailed instructions for setting up all environment variables required to run the Project Invoice Management System for the first time.

## Prerequisites

Before setting up environment variables, ensure you have:
- Node.js 18+ installed
- npm or yarn package manager
- Google Cloud Platform account
- Access to required third-party services (payment gateways, email service)

## Quick Start Checklist

1. [ ] Clone the repository
2. [ ] Set up Google Sheets API credentials
3. [ ] Configure backend environment variables
4. [ ] Configure frontend environment variables
5. [ ] Install dependencies
6. [ ] Initialize Google Sheets structure
7. [ ] Run the application

## Backend Environment Variables

### 1. Create Backend Environment File

```bash
cd backend
cp .env.example .env
```

### 2. Configure Backend Variables

Edit `backend/.env` with the following variables:

#### **Core Application Settings**

```env
# Application Environment
NODE_ENV=development
PORT=5000
API_BASE_URL=http://localhost:5000

# CORS Settings
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Instructions:**
- `NODE_ENV`: Set to `development` for local development, `production` for live deployment
- `PORT`: Backend server port (default: 5000)
- `API_BASE_URL`: Full URL where your backend API will be accessible
- `FRONTEND_URL`: URL of your React frontend application
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS

#### **JWT Authentication**

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-long
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

**Instructions:**
- `JWT_SECRET`: Generate a strong secret key (minimum 32 characters)
  ```bash
  # Generate using Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `JWT_REFRESH_SECRET`: Different secret for refresh tokens
- `JWT_EXPIRES_IN`: Access token expiration time
- `JWT_REFRESH_EXPIRES_IN`: Refresh token expiration time

#### **Google Sheets API Configuration**

```env
# Google Sheets API
GOOGLE_SHEETS_SPREADSHEET_ID=your-google-sheets-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"
GOOGLE_PROJECT_ID=your-google-cloud-project-id
```

**Setup Instructions:**

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Note the Project ID

2. **Enable Google Sheets API:**
   - In Google Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and enable it
   - Also enable "Google Drive API" for file operations

3. **Create Service Account:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in service account details
   - Click "Create and Continue"
   - Skip role assignment for now, click "Done"

4. **Generate Service Account Key:**
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose "JSON" format and download

5. **Extract Credentials from JSON:**
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "key-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
     "client_id": "client-id",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token"
   }
   ```

6. **Create Google Sheets:**
   - Go to [Google Sheets](https://sheets.google.com/)
   - Create a new spreadsheet
   - Copy the spreadsheet ID from URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Share the spreadsheet with your service account email (give Editor access)

#### **Google Drive API (for File Management)**

```env
# Google Drive API
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
```

**Setup Instructions:**
1. Create a folder in Google Drive for file storage
2. Share the folder with your service account email
3. Copy folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID`

#### **Email Service Configuration**

```env
# Email Configuration (using Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Project Invoice Management
```

**Setup Instructions for Gmail:**
1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security > 2-Step Verification > App passwords
   - Generate password for "Mail"
   - Use this password in `SMTP_PASS`

**Alternative Email Services:**
```env
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com

# Mailgun
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
```

#### **Payment Gateway Configuration**

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your-webhook-id

# Razorpay (for Indian payments)
RAZORPAY_KEY_ID=rzp_test_your-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

**Setup Instructions:**

**Stripe:**
1. Create account at [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get API keys from Developers > API keys
3. Set up webhooks at Developers > Webhooks
4. Add endpoint: `https://yourdomain.com/api/payments/webhooks/stripe`

**PayPal:**
1. Create developer account at [PayPal Developer](https://developer.paypal.com/)
2. Create application in sandbox
3. Get Client ID and Secret
4. Set up webhooks for payment events

**Razorpay:**
1. Create account at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Get API keys from Settings > API Keys
3. Set up webhooks for payment events

#### **GST and E-Invoice Configuration**

```env
# GST Configuration
GST_API_BASE_URL=https://api.mastergst.com/einvoice/type/GENERATE/version/V1_03
GST_API_USERNAME=your-gst-api-username
GST_API_PASSWORD=your-gst-api-password
GST_API_CLIENT_ID=your-client-id
GST_API_CLIENT_SECRET=your-client-secret

# E-Invoice Configuration
EINVOICE_API_URL=https://gsp.adaequare.com/gsp/authenticate
EINVOICE_USERNAME=your-einvoice-username
EINVOICE_PASSWORD=your-einvoice-password
EINVOICE_CLIENT_ID=your-einvoice-client-id
EINVOICE_CLIENT_SECRET=your-einvoice-client-secret

# Business GST Details
BUSINESS_GSTIN=your-business-gstin
BUSINESS_STATE_CODE=27
BUSINESS_PAN=your-business-pan
```

**Setup Instructions:**
1. Register with a GST Suvidha Provider (GSP) like MasterGST or ClearTax
2. Get API credentials for e-invoice generation
3. Obtain your business GSTIN and other tax details

#### **Security and Monitoring**

```env
# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-session-secret-key

# Monitoring and Logging
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif
```

#### **Database and Caching**

```env
# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Database Backup
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

### 3. Complete Backend .env Example

```env
# Application
NODE_ENV=development
PORT=5000
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# JWT
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_REFRESH_SECRET=z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Google Services
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SERVICE_ACCOUNT_EMAIL=project-invoice@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
GOOGLE_PROJECT_ID=my-project-12345
GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@mycompany.com
SMTP_PASS=abcd-efgh-ijkl-mnop
EMAIL_FROM=noreply@mycompany.com
EMAIL_FROM_NAME=Project Invoice Management

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_51234567890abcdef
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdef
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef

PAYPAL_CLIENT_ID=AW1234567890abcdef
PAYPAL_CLIENT_SECRET=EL1234567890abcdef
PAYPAL_MODE=sandbox

RAZORPAY_KEY_ID=rzp_test_1234567890abcdef
RAZORPAY_KEY_SECRET=1234567890abcdef
RAZORPAY_WEBHOOK_SECRET=1234567890abcdef

# GST & E-Invoice
BUSINESS_GSTIN=27ABCDE1234F1Z5
BUSINESS_STATE_CODE=27
BUSINESS_PAN=ABCDE1234F

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-session-secret-key

# Optional
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOG_LEVEL=info
MAX_FILE_SIZE=10485760
```

## Frontend Environment Variables

### 1. Create Frontend Environment File

```bash
cd frontend
cp .env.example .env
```

### 2. Configure Frontend Variables

Edit `frontend/.env` with the following variables:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_BASE_URL=http://localhost:3000

# Payment Gateway Public Keys
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
REACT_APP_PAYPAL_CLIENT_ID=your-paypal-client-id
REACT_APP_RAZORPAY_KEY_ID=rzp_test_your-razorpay-key-id

# Google Services
REACT_APP_GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Application Settings
REACT_APP_APP_NAME=Project Invoice Management
REACT_APP_APP_VERSION=1.0.0
REACT_APP_COMPANY_NAME=Your Company Name
REACT_APP_SUPPORT_EMAIL=support@yourcompany.com

# Feature Flags
REACT_APP_ENABLE_PWA=true
REACT_APP_ENABLE_OFFLINE_MODE=true
REACT_APP_ENABLE_NOTIFICATIONS=true
REACT_APP_ENABLE_ANALYTICS=false

# Monitoring
REACT_APP_SENTRY_DSN=your-frontend-sentry-dsn
REACT_APP_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX

# Development
GENERATE_SOURCEMAP=true
REACT_APP_DEBUG_MODE=true
```

**Setup Instructions:**

#### **Google OAuth (for Google Sign-In)**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click "Create Credentials" > "OAuth 2.0 Client IDs"
4. Choose "Web application"
5. Add authorized origins: `http://localhost:3000`
6. Copy the Client ID

#### **Payment Gateway Public Keys**
- Use the same public/publishable keys from your payment gateway accounts
- These are safe to expose in frontend code

### 3. Complete Frontend .env Example

```env
# API
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_BASE_URL=http://localhost:3000

# Payment Gateways
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdef
REACT_APP_PAYPAL_CLIENT_ID=AW1234567890abcdef
REACT_APP_RAZORPAY_KEY_ID=rzp_test_1234567890abcdef

# Google Services
REACT_APP_GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com

# App Configuration
REACT_APP_APP_NAME=Project Invoice Management
REACT_APP_APP_VERSION=1.0.0
REACT_APP_COMPANY_NAME=Your Company Name
REACT_APP_SUPPORT_EMAIL=support@yourcompany.com

# Features
REACT_APP_ENABLE_PWA=true
REACT_APP_ENABLE_OFFLINE_MODE=true
REACT_APP_ENABLE_NOTIFICATIONS=true

# Development
GENERATE_SOURCEMAP=true
REACT_APP_DEBUG_MODE=true
```

## Initial Setup and Installation

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Documentation (optional)
cd ../docs
npm install
```

### 2. Initialize Google Sheets Structure

```bash
cd backend
npm run init-sheets
```

This script will create the necessary sheets and columns in your Google Sheets spreadsheet.

### 3. Run Database Migrations (if any)

```bash
cd backend
npm run migrate
```

### 4. Start the Application

```bash
# Start backend (in one terminal)
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm start

# Start documentation (optional, in third terminal)
cd docs
npm start
```

## Testing the Setup

### 1. Verify Backend API

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "services": {
    "database": "connected",
    "email": "configured",
    "payments": "configured"
  }
}
```

### 2. Verify Frontend

Open `http://localhost:3000` in your browser. You should see the login page.

### 3. Test Google Sheets Connection

```bash
cd backend
npm run test-sheets
```

### 4. Run Test Suite

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Troubleshooting

### Common Issues

#### **Google Sheets API Errors**
- **Error**: "The caller does not have permission"
  - **Solution**: Ensure the spreadsheet is shared with your service account email
  
- **Error**: "Invalid credentials"
  - **Solution**: Check that your private key is properly formatted with `\n` characters

#### **Payment Gateway Errors**
- **Error**: "Invalid API key"
  - **Solution**: Verify you're using the correct test/live keys for your environment

#### **Email Service Errors**
- **Error**: "Authentication failed"
  - **Solution**: For Gmail, ensure you're using an App Password, not your regular password

#### **CORS Errors**
- **Error**: "Access to fetch blocked by CORS policy"
  - **Solution**: Check that `FRONTEND_URL` in backend matches your frontend URL

### Environment-Specific Configurations

#### **Development Environment**
```env
NODE_ENV=development
LOG_LEVEL=debug
REACT_APP_DEBUG_MODE=true
```

#### **Staging Environment**
```env
NODE_ENV=staging
LOG_LEVEL=info
REACT_APP_DEBUG_MODE=false
```

#### **Production Environment**
```env
NODE_ENV=production
LOG_LEVEL=warn
REACT_APP_DEBUG_MODE=false
GENERATE_SOURCEMAP=false
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for JWT and session keys
3. **Regularly rotate API keys** and passwords
4. **Use environment-specific configurations** for different deployment stages
5. **Enable HTTPS** in production environments
6. **Implement proper CORS policies**
7. **Use secure headers** and middleware

## Next Steps

After successful setup:

1. **Create your first admin user** through the registration flow
2. **Set up your company profile** and branding
3. **Configure invoice templates** and email templates
4. **Import existing client data** (if any)
5. **Test the complete workflow** from project creation to payment
6. **Set up monitoring and alerts** for production deployment

## Support

If you encounter issues during setup:

1. Check the troubleshooting section above
2. Review the application logs for detailed error messages
3. Consult the [API documentation](docs/docs/api/overview.md)
4. Refer to the [user manual](docs/docs/user-guide/complete-user-manual.md)

For additional support, contact: support@yourcompany.com