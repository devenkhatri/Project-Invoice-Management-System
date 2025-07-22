# Deployment Documentation

This document provides comprehensive instructions for deploying and maintaining the Project Invoice Management System in a production environment.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Initial Setup](#initial-setup)
3. [Deployment Process](#deployment-process)
4. [Environment Configuration](#environment-configuration)
5. [Google Sheets Setup](#google-sheets-setup)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Backup and Recovery](#backup-and-recovery)
8. [Performance Optimization](#performance-optimization)
9. [Maintenance Tasks](#maintenance-tasks)
10. [Troubleshooting](#troubleshooting)

## System Requirements

### Recommended Server Specifications

- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 20GB SSD minimum
- **OS**: Ubuntu 20.04 LTS or newer
- **Node.js**: v16.x or newer
- **Database**: None (Google Sheets is used as the database)

### Required Software

- Node.js and npm
- PM2 process manager (`npm install -g pm2`)
- Nginx web server
- Certbot (for SSL certificates)
- Git

## Initial Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Application Directory Setup

```bash
# Create application directory
sudo mkdir -p /var/www/invoice-management
sudo chown -R $USER:$USER /var/www/invoice-management

# Create backup directory
sudo mkdir -p /var/backups/invoice-management
sudo chown -R $USER:$USER /var/backups/invoice-management
```

### 3. Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/project-invoice-management.git /var/www/invoice-management
cd /var/www/invoice-management
```

## Deployment Process

### Automated Deployment

The system includes an automated deployment script that handles the entire deployment process:

```bash
# Run the deployment script
cd /var/www/invoice-management
npm run deploy
```

The deployment script performs the following tasks:
- Creates a backup of the current deployment
- Backs up Google Sheets data
- Pulls the latest code from the repository
- Installs dependencies for both backend and frontend
- Builds the application
- Updates environment configuration
- Restarts the application with PM2

### Manual Deployment

If you prefer to deploy manually, follow these steps:

#### Backend Deployment

```bash
# Navigate to backend directory
cd /var/www/invoice-management/backend

# Install dependencies
npm ci --production

# Build the application
npm run build

# Start or restart the application with PM2
pm2 restart project-invoice-management || pm2 start dist/index.js --name "project-invoice-management" --env production
```

#### Frontend Deployment

```bash
# Navigate to frontend directory
cd /var/www/invoice-management/frontend

# Install dependencies
npm ci --production

# Build the application
npm run build

# The built files will be in the 'build' directory, which should be served by Nginx
```

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
# Server Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://invoice.example.com

# Google Sheets Configuration
GOOGLE_SHEETS_ID=your_production_google_sheets_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_jwt_refresh_secret_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Payment Gateway Configuration
STRIPE_API_KEY=sk_live_your_stripe_secret_key
STRIPE_API_SECRET=your_stripe_api_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Configuration
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your_email_user
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@example.com

# Monitoring Configuration
ALERT_EMAIL=admin@example.com
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK
```

### Nginx Configuration

Create an Nginx configuration file for the application:

```bash
sudo nano /etc/nginx/sites-available/invoice-management
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name invoice.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name invoice.example.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/invoice.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/invoice.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Frontend static files
    location / {
        root /var/www/invoice-management/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

Enable the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/invoice-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate

Obtain an SSL certificate using Certbot:

```bash
sudo certbot --nginx -d invoice.example.com
```

## Google Sheets Setup

### Production Google Sheets Configuration

1. Create a new Google Sheets document specifically for production use
2. Create a service account with appropriate permissions
3. Share the Google Sheets document with the service account email
4. Update the environment variables with the production Google Sheets ID and service account credentials

### Initialize Production Sheets

```bash
# Initialize the production Google Sheets structure
cd /var/www/invoice-management/backend
npm run sheets:setup
```

## Monitoring and Alerting

### Monitoring Setup

The system includes built-in monitoring capabilities through the MonitoringService:

1. **Error Monitoring**: Logs errors with different severity levels (low, medium, high, critical)
2. **Performance Monitoring**: Tracks API response times and Google Sheets operations
3. **System Monitoring**: Monitors CPU, memory, and disk usage at regular intervals
4. **Alerting**: Sends notifications for critical errors and system issues via email and Slack
5. **Metrics Collection**: Collects and stores system and performance metrics for analysis

### Alert Configuration

Configure alerts by updating the following environment variables:

```
ALERT_EMAIL=admin@example.com
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK
```

The monitoring service will automatically:
- Send email alerts for critical errors using the configured SMTP settings
- Send Slack notifications using the configured webhook URL
- Apply throttling to prevent alert fatigue (default: max 1 alert per hour for the same error)

### Monitoring Dashboard

To view system health and performance metrics:

```bash
# Run the health check
npm run maintenance:health

# Get performance statistics for the last day
curl http://localhost:3001/api/monitoring/performance?timeframe=day

# Get current system health status
curl http://localhost:3001/api/monitoring/health
```

### Performance Monitoring Middleware

The system includes a performance monitoring middleware that automatically:
- Tracks API response times for all endpoints
- Logs slow operations based on configurable thresholds
- Collects user agent and status code information
- Stores performance metrics for analysis

## Backup and Recovery

### Automated Backups

The system includes automated backup functionality:

```bash
# Create a backup manually
npm run maintenance:backup

# List available backups
npm run sheets:list-backups
```

### Backup Retention Policy

The default backup retention policy is:
- Daily backups: 7 days
- Weekly backups: 30 days
- Monthly backups: 365 days

### Restore from Backup

To restore data from a backup:

```bash
# List available backups
npm run sheets:list-backups

# Restore from a specific backup
npm run sheets:restore /path/to/backup/file.json
```

## Performance Optimization

### Google Sheets Optimization

1. **Batch Operations**: Use batch operations for multiple records
2. **Caching**: Implement caching for frequently accessed data
3. **Connection Pooling**: Limit the number of concurrent connections

### API Performance

1. **Response Compression**: Enable gzip compression in Nginx
2. **Rate Limiting**: Configure rate limiting to prevent abuse
3. **Caching Headers**: Set appropriate caching headers for static assets

## Maintenance Tasks

### Daily Maintenance

Run the daily maintenance task to perform all maintenance operations:

```bash
npm run maintenance:daily
```

This task performs:
- Creating daily backups
- Cleaning up old backups based on retention policy
- Rotating log files
- Performing system health checks

### Log Rotation

Log files are automatically rotated and cleaned up after 30 days.

### Database Maintenance

Google Sheets data is automatically backed up and maintained through the maintenance tasks.

## Troubleshooting

### Common Issues

#### Application Not Starting

1. Check the PM2 logs:
   ```bash
   pm2 logs project-invoice-management
   ```

2. Verify environment variables:
   ```bash
   cat /var/www/invoice-management/backend/.env
   ```

#### Google Sheets Connection Issues

1. Verify Google Sheets credentials:
   ```bash
   npm run sheets:health
   ```

2. Check service account permissions:
   - Ensure the service account has edit access to the Google Sheets document
   - Verify the Google Sheets API is enabled in the Google Cloud Console

#### Performance Issues

1. Run performance tests:
   ```bash
   npm run test:performance
   ```

2. Check system resources:
   ```bash
   npm run maintenance:health
   ```

3. Analyze performance metrics:
   ```bash
   # View recent performance metrics
   curl http://localhost:3001/api/monitoring/performance?timeframe=hour
   
   # Check the performance metrics log file
   cat /var/www/invoice-management/backend/logs/metrics/performance-metrics-YYYY-MM-DD.json
   ```

4. Review system metrics:
   ```bash
   # Check the system metrics log file
   cat /var/www/invoice-management/backend/logs/metrics/system-metrics-YYYY-MM-DD.json
   ```

### Support Resources

For additional support:
- Check the application logs in `/var/www/invoice-management/backend/logs`
- Review the error logs for detailed error information
- Contact the development team at support@example.com