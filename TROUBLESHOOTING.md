# Troubleshooting Guide - Project Invoice Management System

This guide helps you resolve common issues during setup and operation of the Project Invoice Management System.

## Quick Diagnostics

### System Health Check

Run these commands to check your system status:

```bash
# Check Node.js version
node --version  # Should be 18+

# Check npm version
npm --version

# Test backend API
curl http://localhost:5000/api/health

# Check if ports are available
lsof -i :5000  # Backend port
lsof -i :3000  # Frontend port
```

## Common Setup Issues

### 1. Node.js Version Issues

**Problem**: "Node.js version not supported" or compatibility errors

**Solutions**:
```bash
# Check current version
node --version

# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

### 2. npm Installation Failures

**Problem**: "npm install" fails with permission errors

**Solutions**:
```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use yarn as alternative
npm install -g yarn
yarn install
```

### 3. Environment Variable Issues

**Problem**: "Environment variables not loaded" or configuration errors

**Solutions**:
1. **Check file existence**:
   ```bash
   ls -la backend/.env
   ls -la frontend/.env
   ```

2. **Verify file format**:
   - No spaces around `=` sign
   - No quotes unless needed
   - Use `\n` for newlines in private keys

3. **Common fixes**:
   ```bash
   # Regenerate from template
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   
   # Check for hidden characters
   cat -A backend/.env
   ```

## Google Sheets API Issues

### 1. Authentication Errors

**Problem**: "The caller does not have permission" or "Invalid credentials"

**Solutions**:

1. **Verify service account setup**:
   ```bash
   # Check if service account email is correct
   grep GOOGLE_SERVICE_ACCOUNT_EMAIL backend/.env
   ```

2. **Check spreadsheet sharing**:
   - Open your Google Sheets spreadsheet
   - Click "Share" button
   - Add your service account email with "Editor" permissions
   - Verify the email matches exactly

3. **Validate private key format**:
   ```bash
   # Private key should start and end with these lines
   echo $GOOGLE_PRIVATE_KEY | grep "BEGIN PRIVATE KEY"
   echo $GOOGLE_PRIVATE_KEY | grep "END PRIVATE KEY"
   ```

4. **Test API access**:
   ```bash
   cd backend
   npm run test-sheets
   ```

### 2. Spreadsheet ID Issues

**Problem**: "Spreadsheet not found" or "Invalid spreadsheet ID"

**Solutions**:
1. **Extract correct ID from URL**:
   ```
   URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   ID:  1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
   ```

2. **Verify spreadsheet exists and is accessible**:
   - Open the spreadsheet URL in browser
   - Ensure it's not deleted or moved

### 3. API Quota Exceeded

**Problem**: "Quota exceeded" or rate limit errors

**Solutions**:
1. **Check API quotas**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Quotas"
   - Check Google Sheets API limits

2. **Implement retry logic** (already included in the system)

3. **Optimize API calls**:
   - Use batch operations when possible
   - Implement caching for frequently accessed data

## Payment Gateway Issues

### 1. Stripe Configuration

**Problem**: "Invalid API key" or webhook errors

**Solutions**:
1. **Verify API keys**:
   ```bash
   # Test keys start with sk_test_ or pk_test_
   # Live keys start with sk_live_ or pk_live_
   grep STRIPE_SECRET_KEY backend/.env
   ```

2. **Test webhook endpoint**:
   ```bash
   # Use Stripe CLI for local testing
   stripe listen --forward-to localhost:5000/api/payments/webhooks/stripe
   ```

3. **Check webhook configuration**:
   - Go to Stripe Dashboard > Developers > Webhooks
   - Verify endpoint URL is correct
   - Check webhook secret matches environment variable

### 2. PayPal Configuration

**Problem**: PayPal authentication or sandbox issues

**Solutions**:
1. **Verify sandbox mode**:
   ```bash
   grep PAYPAL_MODE backend/.env  # Should be 'sandbox' for testing
   ```

2. **Check credentials**:
   - Ensure using sandbox credentials for testing
   - Verify client ID and secret are correct

3. **Test API connection**:
   ```bash
   cd backend
   npm run test-paypal
   ```

### 3. Razorpay Configuration

**Problem**: Razorpay key errors or webhook issues

**Solutions**:
1. **Verify test keys**:
   ```bash
   # Test keys start with rzp_test_
   grep RAZORPAY_KEY_ID backend/.env
   ```

2. **Check webhook configuration**:
   - Go to Razorpay Dashboard > Settings > Webhooks
   - Add endpoint: `https://yourdomain.com/api/payments/webhooks/razorpay`

## Email Service Issues

### 1. Gmail SMTP Errors

**Problem**: "Authentication failed" or "Less secure app access"

**Solutions**:
1. **Use App Passwords**:
   - Enable 2-factor authentication on Google account
   - Generate App Password: Google Account > Security > 2-Step Verification > App passwords
   - Use app password in `SMTP_PASS`, not regular password

2. **Check SMTP settings**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   ```

3. **Test email sending**:
   ```bash
   cd backend
   npm run test-email
   ```

### 2. SendGrid Issues

**Problem**: SendGrid API errors or delivery issues

**Solutions**:
1. **Verify API key**:
   ```bash
   # API key starts with SG.
   grep SENDGRID_API_KEY backend/.env
   ```

2. **Check sender verification**:
   - Verify sender email in SendGrid dashboard
   - Set up domain authentication for better deliverability

### 3. Email Delivery Problems

**Problem**: Emails not being delivered or going to spam

**Solutions**:
1. **Check spam folders**
2. **Verify sender reputation**
3. **Set up SPF, DKIM, and DMARC records**
4. **Use authenticated domains**

## Database and Data Issues

### 1. Google Sheets Structure

**Problem**: "Column not found" or data structure errors

**Solutions**:
1. **Reinitialize sheets structure**:
   ```bash
   cd backend
   npm run init-sheets
   ```

2. **Manually verify sheet structure**:
   - Check that all required sheets exist
   - Verify column headers match expected format

3. **Check sheet permissions**:
   - Ensure service account has "Editor" access
   - Verify sheets are not protected

### 2. Data Integrity Issues

**Problem**: Inconsistent data or referential integrity errors

**Solutions**:
1. **Run data validation**:
   ```bash
   cd backend
   npm run validate-data
   ```

2. **Check for orphaned records**:
   - Verify all foreign key relationships
   - Clean up any orphaned data

3. **Backup and restore**:
   ```bash
   cd backend
   npm run backup-data
   npm run restore-data
   ```

## Performance Issues

### 1. Slow API Responses

**Problem**: API calls taking too long

**Solutions**:
1. **Check network connectivity**:
   ```bash
   ping sheets.googleapis.com
   ```

2. **Monitor API performance**:
   ```bash
   cd backend
   npm run monitor-performance
   ```

3. **Optimize queries**:
   - Use batch operations
   - Implement caching
   - Reduce unnecessary API calls

### 2. Frontend Performance

**Problem**: Slow page loads or UI responsiveness

**Solutions**:
1. **Check bundle size**:
   ```bash
   cd frontend
   npm run analyze
   ```

2. **Optimize images and assets**
3. **Implement code splitting**
4. **Use React.memo and useMemo for expensive operations**

## Security Issues

### 1. CORS Errors

**Problem**: "Access to fetch blocked by CORS policy"

**Solutions**:
1. **Check CORS configuration**:
   ```bash
   grep FRONTEND_URL backend/.env
   grep ALLOWED_ORIGINS backend/.env
   ```

2. **Verify URLs match exactly**:
   - No trailing slashes
   - Correct protocol (http/https)
   - Correct port numbers

3. **Test CORS headers**:
   ```bash
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS \
        http://localhost:5000/api/projects
   ```

### 2. Authentication Issues

**Problem**: JWT token errors or session problems

**Solutions**:
1. **Check JWT configuration**:
   ```bash
   grep JWT_SECRET backend/.env
   ```

2. **Verify token expiration**:
   - Check if tokens are expiring too quickly
   - Implement proper token refresh logic

3. **Clear browser storage**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

## Testing Issues

### 1. Test Failures

**Problem**: Tests failing during setup or CI/CD

**Solutions**:
1. **Run tests in isolation**:
   ```bash
   cd backend
   npm test -- --runInBand
   ```

2. **Check test environment**:
   ```bash
   # Ensure test environment variables are set
   cat backend/.env.test
   ```

3. **Clear test cache**:
   ```bash
   npm test -- --clearCache
   ```

### 2. Mock Service Issues

**Problem**: External service mocks not working

**Solutions**:
1. **Enable mock mode**:
   ```env
   MOCK_PAYMENT_GATEWAYS=true
   MOCK_EMAIL_SERVICE=true
   MOCK_GST_API=true
   ```

2. **Verify mock implementations**:
   ```bash
   cd backend
   npm run test-mocks
   ```

## Production Deployment Issues

### 1. Build Failures

**Problem**: Production build fails

**Solutions**:
1. **Check build logs**:
   ```bash
   cd frontend
   npm run build 2>&1 | tee build.log
   ```

2. **Verify environment variables**:
   - Ensure all required variables are set
   - Check for production-specific configurations

3. **Clear build cache**:
   ```bash
   rm -rf build/ .cache/
   npm run build
   ```

### 2. SSL/HTTPS Issues

**Problem**: SSL certificate or HTTPS configuration errors

**Solutions**:
1. **Verify SSL certificate**:
   ```bash
   openssl s_client -connect yourdomain.com:443
   ```

2. **Check certificate expiration**:
   ```bash
   echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
   ```

3. **Update security headers**:
   - Ensure HSTS is enabled
   - Check CSP configuration

## Getting Help

### 1. Enable Debug Mode

```env
# Backend
DEBUG_MODE=true
LOG_LEVEL=debug

# Frontend
REACT_APP_DEBUG_MODE=true
```

### 2. Check Logs

```bash
# Backend logs
tail -f backend/logs/app.log

# Frontend console
# Open browser developer tools > Console
```

### 3. Collect System Information

```bash
# System info script
cat > debug-info.sh << 'EOF'
#!/bin/bash
echo "=== System Information ==="
echo "OS: $(uname -a)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo ""
echo "=== Environment Check ==="
echo "Backend .env exists: $(test -f backend/.env && echo 'Yes' || echo 'No')"
echo "Frontend .env exists: $(test -f frontend/.env && echo 'Yes' || echo 'No')"
echo ""
echo "=== Port Check ==="
echo "Port 5000: $(lsof -i :5000 | wc -l) processes"
echo "Port 3000: $(lsof -i :3000 | wc -l) processes"
echo ""
echo "=== Recent Logs ==="
echo "Backend logs:"
tail -n 10 backend/logs/app.log 2>/dev/null || echo "No backend logs found"
EOF

chmod +x debug-info.sh
./debug-info.sh
```

### 4. Contact Support

If you're still experiencing issues:

1. **Gather information**:
   - Error messages (full stack traces)
   - System information (OS, Node.js version)
   - Steps to reproduce the issue
   - Environment configuration (without sensitive data)

2. **Check documentation**:
   - [Environment Setup Guide](ENVIRONMENT_SETUP_GUIDE.md)
   - [System Testing Guide](docs/docs/user-guide/system-testing-guide.md)
   - [API Documentation](docs/docs/api/overview.md)

3. **Create an issue**:
   - Include all relevant information
   - Use the debug info script output
   - Describe expected vs actual behavior

## Prevention Tips

### 1. Regular Maintenance

```bash
# Update dependencies regularly
npm update

# Check for security vulnerabilities
npm audit
npm audit fix

# Clean up old files
npm run cleanup
```

### 2. Monitoring

```bash
# Set up health checks
curl http://localhost:5000/api/health

# Monitor logs
tail -f backend/logs/app.log

# Check system resources
top
df -h
```

### 3. Backup Strategy

```bash
# Regular data backups
npm run backup-data

# Environment configuration backup
cp backend/.env backend/.env.backup
cp frontend/.env frontend/.env.backup
```

Remember: Always test changes in a development environment before applying to production!