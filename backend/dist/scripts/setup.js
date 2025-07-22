#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGoogleSheetsBackend = setupGoogleSheetsBackend;
exports.healthCheck = healthCheck;
const googleSheets_1 = require("../services/googleSheets");
const initializeSheets_1 = require("./initializeSheets");
const sheetConfig_1 = require("./sheetConfig");
const backupRestore_1 = require("./backupRestore");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
async function setupGoogleSheetsBackend() {
    console.log('🚀 Starting Complete Google Sheets Backend Setup');
    console.log('================================================');
    try {
        console.log('\n📡 Step 1: Testing Google Sheets connection...');
        const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
        if (!sheetsService) {
            throw new Error('Failed to create Google Sheets service. Please check your environment variables.');
        }
        const connected = await sheetsService.testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Google Sheets. Please check your credentials and permissions.');
        }
        console.log('✅ Connection successful!');
        console.log('\n📋 Step 2: Initializing sheets with sample data...');
        await (0, initializeSheets_1.initializeSheets)(true);
        console.log('✅ Sheets initialized successfully!');
        console.log('\n🔍 Step 3: Validating sheet structure...');
        const isValid = await (0, sheetConfig_1.validateSheetStructure)();
        if (!isValid) {
            throw new Error('Sheet validation failed. Please check the logs above.');
        }
        console.log('✅ Sheet structure validated!');
        console.log('\n💾 Step 4: Creating initial backup...');
        const backupPath = await (0, backupRestore_1.backupData)();
        console.log(`✅ Initial backup created: ${backupPath}`);
        console.log('\n📊 Step 5: Displaying system statistics...');
        await (0, sheetConfig_1.getSheetStatistics)();
        console.log('\n🎉 Setup Complete!');
        console.log('==================');
        console.log('');
        console.log('Your Google Sheets backend is now ready for use!');
        console.log('');
        console.log('📋 What was set up:');
        console.log('  ✅ 6 data sheets with proper headers');
        console.log('  ✅ Sample data for development and testing');
        console.log('  ✅ Initial backup for data safety');
        console.log('  ✅ Structure validation completed');
        console.log('');
        console.log('🔗 Next steps:');
        console.log('  1. Start your backend server: npm run dev');
        console.log('  2. Test API endpoints with the sample data');
        console.log('  3. Set up regular backups: npm run sheets:backup');
        console.log('  4. Monitor with: npm run sheets:config stats');
        console.log('');
        console.log('📚 Available commands:');
        console.log('  npm run sheets:init          - Initialize sheets');
        console.log('  npm run sheets:backup        - Create backup');
        console.log('  npm run sheets:config stats  - View statistics');
        console.log('  npm run sheets:config validate - Validate structure');
        console.log('');
        console.log(`🔗 Google Sheets URL: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_ID}`);
    }
    catch (error) {
        console.error('\n❌ Setup failed:', error);
        console.log('\n🔧 Troubleshooting:');
        console.log('  1. Check your environment variables (.env file)');
        console.log('  2. Verify Google Sheets API is enabled');
        console.log('  3. Ensure service account has access to the spreadsheet');
        console.log('  4. Check Google Cloud Console for API quotas');
        console.log('');
        console.log('📚 For detailed help, see: backend/src/scripts/README.md');
        process.exit(1);
    }
}
async function healthCheck() {
    console.log('🏥 Google Sheets Backend Health Check');
    console.log('=====================================');
    try {
        console.log('\n📡 Testing connection...');
        const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
        if (!sheetsService) {
            throw new Error('Failed to create Google Sheets service');
        }
        const connected = await sheetsService.testConnection();
        if (!connected) {
            throw new Error('Connection failed');
        }
        console.log('✅ Connection: OK');
        console.log('\n🔍 Validating structure...');
        const isValid = await (0, sheetConfig_1.validateSheetStructure)();
        console.log(`${isValid ? '✅' : '❌'} Structure: ${isValid ? 'OK' : 'ISSUES FOUND'}`);
        console.log('\n📊 Quick statistics...');
        await (0, sheetConfig_1.getSheetStatistics)();
        console.log('\n🎉 Health check completed!');
    }
    catch (error) {
        console.error('\n❌ Health check failed:', error);
        process.exit(1);
    }
}
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    switch (command) {
        case 'setup':
            await setupGoogleSheetsBackend();
            break;
        case 'health':
            await healthCheck();
            break;
        default:
            console.log('🔧 Google Sheets Backend Setup Utility');
            console.log('=======================================');
            console.log('');
            console.log('Commands:');
            console.log('  setup    - Complete setup process with sample data');
            console.log('  health   - Quick health check of the system');
            console.log('');
            console.log('Examples:');
            console.log('  npm run sheets:setup');
            console.log('  npm run sheets:health');
            break;
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=setup.js.map