"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSheetStructure = validateSheetStructure;
exports.clearSheetData = clearSheetData;
exports.getSheetStatistics = getSheetStatistics;
const googleSheets_1 = require("../services/googleSheets");
const initializeSheets_1 = require("./initializeSheets");
async function validateSheetStructure() {
    console.log('🔍 Validating sheet structure...');
    const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
    if (!sheetsService) {
        throw new Error('Failed to initialize Google Sheets service');
    }
    try {
        const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
        const existingSheets = spreadsheetInfo.sheets?.map((sheet) => sheet.properties.title) || [];
        console.log(`📊 Found ${existingSheets.length} sheets in spreadsheet`);
        for (const config of initializeSheets_1.SHEET_CONFIGURATIONS) {
            if (existingSheets.includes(config.name)) {
                console.log(`✅ Sheet "${config.name}" exists`);
                try {
                    const data = await sheetsService.read(config.name);
                    console.log(`   📄 ${data.length} records found`);
                }
                catch (error) {
                    console.log(`   ⚠️  Could not read data: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            else {
                console.log(`❌ Sheet "${config.name}" missing`);
            }
        }
    }
    catch (error) {
        console.error('❌ Error validating sheet structure:', error);
        throw error;
    }
}
async function clearSheetData(sheetNames) {
    const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
    if (!sheetsService) {
        throw new Error('Failed to initialize Google Sheets service');
    }
    const sheetsToClean = sheetNames || initializeSheets_1.SHEET_CONFIGURATIONS.map(config => config.name);
    console.log(`🧹 Clearing data from ${sheetsToClean.length} sheets...`);
    for (const sheetName of sheetsToClean) {
        try {
            const records = await sheetsService.read(sheetName);
            if (records.length === 0) {
                console.log(`📄 ${sheetName}: Already empty`);
                continue;
            }
            for (const record of records) {
                await sheetsService.delete(sheetName, record.id);
            }
            console.log(`✅ ${sheetName}: Cleared ${records.length} records`);
        }
        catch (error) {
            console.error(`❌ Error clearing ${sheetName}:`, error);
        }
    }
}
async function getSheetStatistics() {
    const sheetsService = (0, googleSheets_1.createGoogleSheetsService)();
    if (!sheetsService) {
        throw new Error('Failed to initialize Google Sheets service');
    }
    try {
        const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
        console.log(`\n📊 Spreadsheet: ${spreadsheetInfo.properties?.title}`);
        console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_ID}`);
        let totalRecords = 0;
        const stats = {};
        for (const sheetConfig of initializeSheets_1.SHEET_CONFIGURATIONS) {
            try {
                const records = await sheetsService.read(sheetConfig.name);
                const recordCount = records.length;
                totalRecords += recordCount;
                stats[sheetConfig.name] = {
                    records: recordCount,
                    headers: sheetConfig.headers.length
                };
                if (recordCount > 0) {
                    if (sheetConfig.name === 'Projects') {
                        const activeProjects = records.filter((r) => r.status === 'active').length;
                        stats[sheetConfig.name].active = activeProjects;
                    }
                    else if (sheetConfig.name === 'Invoices') {
                        const paidInvoices = records.filter((r) => r.status === 'paid').length;
                        const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
                        stats[sheetConfig.name].paid = paidInvoices;
                        stats[sheetConfig.name].totalAmount = totalAmount;
                    }
                    else if (sheetConfig.name === 'Tasks') {
                        const completedTasks = records.filter((r) => r.status === 'completed').length;
                        stats[sheetConfig.name].completed = completedTasks;
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error getting stats for ${sheetConfig.name}:`, error);
                stats[sheetConfig.name] = { records: 0, error: true };
            }
        }
        console.log('\n📈 Sheet Statistics:');
        console.log('===================');
        Object.entries(stats).forEach(([sheetName, data]) => {
            if (data.error) {
                console.log(`❌ ${sheetName}: Error retrieving data`);
            }
            else {
                let line = `📄 ${sheetName}: ${data.records} records`;
                if (sheetName === 'Projects' && data.active !== undefined) {
                    line += ` (${data.active} active)`;
                }
                else if (sheetName === 'Invoices' && data.totalAmount !== undefined) {
                    line += ` (${data.paid} paid, ₹${data.totalAmount.toLocaleString()})`;
                }
                else if (sheetName === 'Tasks' && data.completed !== undefined) {
                    line += ` (${data.completed} completed)`;
                }
                console.log(line);
            }
        });
        console.log(`\n📊 Total Records: ${totalRecords}`);
    }
    catch (error) {
        console.error('❌ Error gathering statistics:', error);
        throw error;
    }
}
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    try {
        switch (command) {
            case 'validate':
                await validateSheetStructure();
                break;
            case 'clear':
                const sheetsToClean = args.slice(1);
                if (sheetsToClean.length === 0) {
                    console.log('⚠️  This will clear ALL data from ALL sheets. Are you sure?');
                    console.log('Use: npm run sheets:clear <sheet1> <sheet2> ... to clear specific sheets');
                    console.log('Or add --all flag to clear all sheets');
                    if (!args.includes('--all')) {
                        process.exit(0);
                    }
                }
                await clearSheetData(sheetsToClean.length > 0 ? sheetsToClean : undefined);
                break;
            case 'stats':
                await getSheetStatistics();
                break;
            default:
                console.log('🔧 Google Sheets Configuration Utility');
                console.log('======================================');
                console.log('');
                console.log('Commands:');
                console.log('  validate                       - Validate sheet structure and headers');
                console.log('  clear [sheet1] [sheet2] ...    - Clear data from specific sheets');
                console.log('  clear --all                    - Clear data from all sheets');
                console.log('  stats                          - Show statistics for all sheets');
                console.log('');
                console.log('Examples:');
                console.log('  npm run sheets:config validate');
                console.log('  npm run sheets:config clear Projects Tasks');
                console.log('  npm run sheets:config clear --all');
                console.log('  npm run sheets:config stats');
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
//# sourceMappingURL=sheetConfig.js.map