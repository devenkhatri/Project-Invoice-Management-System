#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupData = backupData;
exports.restoreData = restoreData;
exports.listBackups = listBackups;
const googleSheets_1 = require("../services/googleSheets");
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, dotenv_1.config)();
async function backupData(outputPath) {
    console.log('💾 Starting Google Sheets backup...');
    const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
    if (!sheetsService) {
        throw new Error('Failed to create Google Sheets service. Check your environment variables.');
    }
    try {
        const connected = await sheetsService.testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Google Sheets');
        }
        const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
        const spreadsheetTitle = spreadsheetInfo.properties?.title || 'Unknown';
        console.log(`📊 Backing up spreadsheet: ${spreadsheetTitle}`);
        const backupData = {
            timestamp: new Date().toISOString(),
            spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
            spreadsheetTitle,
            sheets: {}
        };
        const sheetNames = ['Projects', 'Tasks', 'Clients', 'Invoices', 'Time_Entries', 'Expenses'];
        for (const sheetName of sheetNames) {
            console.log(`📄 Backing up sheet: ${sheetName}`);
            try {
                const data = await sheetsService.read(sheetName);
                backupData.sheets[sheetName] = data;
                console.log(`✅ Backed up ${data.length} records from ${sheetName}`);
            }
            catch (error) {
                console.warn(`⚠️  Warning: Could not backup sheet ${sheetName}:`, error);
                backupData.sheets[sheetName] = [];
            }
        }
        if (!outputPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            outputPath = path.join(process.cwd(), 'backups', `sheets-backup-${timestamp}.json`);
        }
        const backupDir = path.dirname(outputPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2));
        const totalRecords = Object.values(backupData.sheets).reduce((sum, records) => sum + records.length, 0);
        console.log(`\n🎉 Backup completed successfully!`);
        console.log(`📁 File: ${outputPath}`);
        console.log(`📊 Total records backed up: ${totalRecords}`);
        return outputPath;
    }
    catch (error) {
        console.error('❌ Error during backup:', error);
        throw error;
    }
}
async function restoreData(backupPath, options = {}) {
    console.log('🔄 Starting Google Sheets restore...');
    const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
    if (!sheetsService) {
        throw new Error('Failed to create Google Sheets service. Check your environment variables.');
    }
    try {
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        const backupData = JSON.parse(backupContent);
        console.log(`📁 Restoring from backup: ${backupPath}`);
        console.log(`📅 Backup timestamp: ${backupData.timestamp}`);
        console.log(`📊 Original spreadsheet: ${backupData.spreadsheetTitle}`);
        const connected = await sheetsService.testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Google Sheets');
        }
        const sheetsToRestore = options.sheetsToRestore || Object.keys(backupData.sheets);
        for (const sheetName of sheetsToRestore) {
            if (!backupData.sheets[sheetName]) {
                console.warn(`⚠️  Warning: Sheet ${sheetName} not found in backup, skipping`);
                continue;
            }
            console.log(`\n📄 Restoring sheet: ${sheetName}`);
            const records = backupData.sheets[sheetName];
            if (records.length === 0) {
                console.log(`ℹ️  No data to restore for ${sheetName}`);
                continue;
            }
            try {
                if (options.clearExisting) {
                    console.log(`🗑️  Clearing existing data in ${sheetName}...`);
                    const existingRecords = await sheetsService.read(sheetName);
                    for (const record of existingRecords) {
                        if (record.id) {
                            await sheetsService.delete(sheetName, record.id);
                        }
                    }
                }
                const batchSize = 50;
                let restoredCount = 0;
                for (let i = 0; i < records.length; i += batchSize) {
                    const batch = records.slice(i, i + batchSize);
                    const ids = await sheetsService.batchCreate(sheetName, batch);
                    restoredCount += ids.length;
                    console.log(`📝 Restored ${restoredCount}/${records.length} records to ${sheetName}`);
                }
                console.log(`✅ Successfully restored ${restoredCount} records to ${sheetName}`);
            }
            catch (error) {
                console.error(`❌ Error restoring sheet ${sheetName}:`, error);
                throw error;
            }
        }
        const totalRestored = sheetsToRestore.reduce((sum, sheetName) => {
            return sum + (backupData.sheets[sheetName]?.length || 0);
        }, 0);
        console.log(`\n🎉 Restore completed successfully!`);
        console.log(`📊 Total records restored: ${totalRestored}`);
    }
    catch (error) {
        console.error('❌ Error during restore:', error);
        throw error;
    }
}
function listBackups(backupDir = path.join(process.cwd(), 'backups')) {
    if (!fs.existsSync(backupDir)) {
        console.log('📁 No backup directory found');
        return [];
    }
    const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.json') && file.includes('sheets-backup'))
        .sort()
        .reverse();
    if (files.length === 0) {
        console.log('📁 No backup files found');
        return [];
    }
    console.log('📁 Available backup files:');
    files.forEach((file, index) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        console.log(`${index + 1}. ${file} (${stats.size} bytes, ${stats.mtime.toISOString()})`);
    });
    return files.map(file => path.join(backupDir, file));
}
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    try {
        switch (command) {
            case 'backup':
                const outputPath = args[1];
                await backupData(outputPath);
                break;
            case 'restore':
                const backupPath = args[1];
                if (!backupPath) {
                    console.error('❌ Please provide backup file path');
                    console.log('Usage: npm run backup-restore restore <backup-file-path>');
                    process.exit(1);
                }
                const clearExisting = args.includes('--clear');
                const sheetsArg = args.find(arg => arg.startsWith('--sheets='));
                const sheetsToRestore = sheetsArg ? sheetsArg.split('=')[1].split(',') : undefined;
                await restoreData(backupPath, { clearExisting, sheetsToRestore });
                break;
            case 'list':
                const backupDir = args[1] || path.join(process.cwd(), 'backups');
                listBackups(backupDir);
                break;
            default:
                console.log('🔧 Google Sheets Backup & Restore Utility');
                console.log('=========================================');
                console.log('');
                console.log('Commands:');
                console.log('  backup [output-path]           - Backup all sheets to JSON file');
                console.log('  restore <backup-path> [options] - Restore from backup file');
                console.log('  list [backup-dir]              - List available backup files');
                console.log('');
                console.log('Restore options:');
                console.log('  --clear                        - Clear existing data before restore');
                console.log('  --sheets=sheet1,sheet2         - Only restore specific sheets');
                console.log('');
                console.log('Examples:');
                console.log('  npm run backup-restore backup');
                console.log('  npm run backup-restore restore ./backups/sheets-backup-2024-01-20.json');
                console.log('  npm run backup-restore restore backup.json --clear --sheets=Projects,Tasks');
                console.log('  npm run backup-restore list');
                break;
        }
    }
    catch (error) {
        console.error('❌ Command failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=backupRestore.js.map