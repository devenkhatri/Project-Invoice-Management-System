#!/usr/bin/env node

/**
 * Environment Test Script
 * 
 * This script tests if all required environment variables are properly configured
 * and if Google Sheets API access is working.
 */

const dotenv = require('dotenv');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

// Load environment variables
dotenv.config();

async function testEnvironment() {
  console.log('🧪 Testing Environment Configuration...\n');

  // Test 1: Check required environment variables
  console.log('1️⃣ Checking environment variables...');
  const requiredVars = [
    'GOOGLE_SHEETS_ID',
    'GOOGLE_SERVICE_ACCOUNT_KEY',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  let allVarsPresent = true;
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: Present`);
    } else {
      console.log(`   ❌ ${varName}: Missing`);
      allVarsPresent = false;
    }
  }

  if (!allVarsPresent) {
    console.log('\n❌ Some environment variables are missing. Please check your .env file.');
    process.exit(1);
  }

  // Test 2: Validate Google Service Account Key format
  console.log('\n2️⃣ Validating Google Service Account Key...');
  try {
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const requiredFields = ['client_email', 'private_key', 'project_id'];
    let keyValid = true;
    
    for (const field of requiredFields) {
      if (serviceAccountKey[field]) {
        console.log(`   ✅ ${field}: Present`);
      } else {
        console.log(`   ❌ ${field}: Missing`);
        keyValid = false;
      }
    }

    if (!keyValid) {
      console.log('\n❌ Service account key is missing required fields.');
      process.exit(1);
    }
  } catch (error) {
    console.log('   ❌ Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_KEY');
    console.log('   💡 Make sure the key is properly formatted JSON');
    process.exit(1);
  }

  // Test 3: Test Google Sheets API authentication
  console.log('\n3️⃣ Testing Google Sheets API authentication...');
  try {
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Try to access the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID
    });

    console.log(`   ✅ Successfully connected to spreadsheet: ${spreadsheet.data.properties?.title}`);
    console.log(`   📊 Spreadsheet URL: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_ID}`);
    
    // List existing sheets
    const existingSheets = spreadsheet.data.sheets?.map(sheet => sheet.properties?.title) || [];
    console.log(`   📄 Found ${existingSheets.length} sheets: ${existingSheets.join(', ')}`);

  } catch (error) {
    console.log('   ❌ Failed to connect to Google Sheets API');
    console.log('   💡 Common issues:');
    console.log('      - Spreadsheet not shared with service account email');
    console.log('      - Invalid spreadsheet ID');
    console.log('      - Google Sheets API not enabled');
    console.log(`   🔧 Error: ${error.message}`);
    process.exit(1);
  }

  // Test 4: Check JWT secrets
  console.log('\n4️⃣ Checking JWT secrets...');
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (jwtSecret && jwtSecret.length >= 32) {
    console.log('   ✅ JWT_SECRET: Valid length (32+ characters)');
  } else {
    console.log('   ❌ JWT_SECRET: Too short (should be 32+ characters)');
  }

  if (jwtRefreshSecret && jwtRefreshSecret.length >= 32) {
    console.log('   ✅ JWT_REFRESH_SECRET: Valid length (32+ characters)');
  } else {
    console.log('   ❌ JWT_REFRESH_SECRET: Too short (should be 32+ characters)');
  }

  // Test 5: Check optional environment variables
  console.log('\n5️⃣ Checking optional configurations...');
  const optionalVars = [
    'STRIPE_SECRET_KEY',
    'PAYPAL_CLIENT_ID',
    'RAZORPAY_KEY_ID',
    'SMTP_USER',
    'GOOGLE_DRIVE_FOLDER_ID'
  ];

  for (const varName of optionalVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: Configured`);
    } else {
      console.log(`   ⚠️  ${varName}: Not configured (optional)`);
    }
  }

  console.log('\n🎉 Environment test completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run setup-sheets:full');
  console.log('   2. Start backend: npm run dev');
  console.log('   3. Start frontend: cd ../frontend && npm start');
}

// Run the test
testEnvironment().catch(error => {
  console.error('\n❌ Environment test failed:', error);
  process.exit(1);
});