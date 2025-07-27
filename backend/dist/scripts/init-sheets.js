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
const dotenv = __importStar(require("dotenv"));
const sheets_service_1 = require("../services/sheets.service");
const types_1 = require("../types");
dotenv.config();
const sampleProjects = [
    {
        name: 'E-commerce Website',
        client_id: 'client_1',
        status: types_1.ProjectStatus.ACTIVE,
        start_date: '2024-01-15',
        end_date: '2024-03-15',
        budget: 50000,
        description: 'Complete e-commerce solution with payment integration'
    },
    {
        name: 'Mobile App Development',
        client_id: 'client_2',
        status: types_1.ProjectStatus.ACTIVE,
        start_date: '2024-02-01',
        end_date: '2024-05-01',
        budget: 75000,
        description: 'Cross-platform mobile application'
    },
    {
        name: 'Website Redesign',
        client_id: 'client_1',
        status: types_1.ProjectStatus.COMPLETED,
        start_date: '2023-11-01',
        end_date: '2023-12-15',
        budget: 25000,
        description: 'Complete website redesign and optimization'
    }
];
const sampleClients = [
    {
        name: 'Tech Solutions Pvt Ltd',
        email: 'contact@techsolutions.com',
        phone: '+91-9876543210',
        address: '123 Business Park, Mumbai, Maharashtra 400001',
        gstin: '27ABCDE1234F1Z5',
        payment_terms: 'Net 30'
    },
    {
        name: 'Digital Innovations Inc',
        email: 'info@digitalinnovations.com',
        phone: '+91-8765432109',
        address: '456 Tech Hub, Bangalore, Karnataka 560001',
        gstin: '29FGHIJ5678K2A6',
        payment_terms: 'Net 15'
    }
];
const sampleTasks = [
    {
        project_id: '',
        title: 'Setup project structure',
        description: 'Initialize project repository and basic structure',
        status: types_1.TaskStatus.COMPLETED,
        priority: types_1.TaskPriority.HIGH,
        due_date: '2024-01-20',
        estimated_hours: 8,
        actual_hours: 6
    },
    {
        project_id: '',
        title: 'Design database schema',
        description: 'Create database design and relationships',
        status: types_1.TaskStatus.COMPLETED,
        priority: types_1.TaskPriority.HIGH,
        due_date: '2024-01-25',
        estimated_hours: 12,
        actual_hours: 10
    },
    {
        project_id: '',
        title: 'Implement user authentication',
        description: 'Build login and registration functionality',
        status: types_1.TaskStatus.IN_PROGRESS,
        priority: types_1.TaskPriority.MEDIUM,
        due_date: '2024-02-05',
        estimated_hours: 16,
        actual_hours: 8
    }
];
const sampleInvoices = [
    {
        invoice_number: 'INV-2024-001',
        client_id: 'client_1',
        project_id: '',
        amount: 25000,
        tax_amount: 4500,
        total_amount: 29500,
        status: types_1.InvoiceStatus.PAID,
        due_date: '2024-01-15'
    },
    {
        invoice_number: 'INV-2024-002',
        client_id: 'client_2',
        project_id: '',
        amount: 15000,
        tax_amount: 2700,
        total_amount: 17700,
        status: types_1.InvoiceStatus.SENT,
        due_date: '2024-02-15'
    }
];
const sampleTimeEntries = [
    {
        task_id: '',
        project_id: '',
        hours: 6,
        description: 'Initial project setup and configuration',
        date: '2024-01-16'
    },
    {
        task_id: '',
        project_id: '',
        hours: 4,
        description: 'Database schema design and documentation',
        date: '2024-01-17'
    }
];
const sampleExpenses = [
    {
        project_id: '',
        category: types_1.ExpenseCategory.SOFTWARE,
        amount: 2000,
        description: 'Development tools and licenses',
        date: '2024-01-15',
        receipt_url: 'https://example.com/receipt1.pdf'
    },
    {
        project_id: '',
        category: types_1.ExpenseCategory.EQUIPMENT,
        amount: 5000,
        description: 'Testing devices and equipment',
        date: '2024-01-20',
        receipt_url: 'https://example.com/receipt2.pdf'
    }
];
async function initializeSheets() {
    try {
        console.log('🚀 Starting Google Sheets initialization...');
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!spreadsheetId) {
            throw new Error('GOOGLE_SHEETS_ID environment variable is required');
        }
        if (!serviceAccountKey) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required');
        }
        let parsedKey;
        try {
            parsedKey = JSON.parse(serviceAccountKey);
        }
        catch (error) {
            throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.');
        }
        const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, parsedKey);
        console.log('📋 Creating sheets and headers...');
        await sheetsService.initializeSheets();
        console.log('✅ Sheets initialized successfully');
        if (process.argv.includes('--seed')) {
            console.log('🌱 Seeding sample data...');
            await seedSampleData(sheetsService);
            console.log('✅ Sample data seeded successfully');
        }
        console.log('🎉 Google Sheets initialization completed!');
        console.log(`📊 Spreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    }
    catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}
async function seedSampleData(sheetsService) {
    try {
        console.log('Creating sample clients...');
        const clientIds = await sheetsService.batchCreate('Clients', sampleClients);
        sampleProjects[0].client_id = clientIds[0];
        sampleProjects[1].client_id = clientIds[1];
        sampleProjects[2].client_id = clientIds[0];
        console.log('Creating sample projects...');
        const projectIds = await sheetsService.batchCreate('Projects', sampleProjects);
        sampleTasks[0].project_id = projectIds[0];
        sampleTasks[1].project_id = projectIds[0];
        sampleTasks[2].project_id = projectIds[1];
        sampleInvoices[0].project_id = projectIds[2];
        sampleInvoices[1].project_id = projectIds[1];
        sampleTimeEntries[0].project_id = projectIds[0];
        sampleTimeEntries[1].project_id = projectIds[0];
        sampleExpenses[0].project_id = projectIds[0];
        sampleExpenses[1].project_id = projectIds[1];
        console.log('Creating sample tasks...');
        const taskIds = await sheetsService.batchCreate('Tasks', sampleTasks);
        sampleTimeEntries[0].task_id = taskIds[0];
        sampleTimeEntries[1].task_id = taskIds[1];
        console.log('Creating sample invoices...');
        await sheetsService.batchCreate('Invoices', sampleInvoices);
        console.log('Creating sample time entries...');
        await sheetsService.batchCreate('Time_Entries', sampleTimeEntries);
        console.log('Creating sample expenses...');
        await sheetsService.batchCreate('Expenses', sampleExpenses);
        console.log('Sample data created successfully!');
    }
    catch (error) {
        console.error('Failed to seed sample data:', error);
        throw error;
    }
}
async function backupData() {
    try {
        console.log('📦 Starting data backup...');
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!spreadsheetId || !serviceAccountKey) {
            throw new Error('Missing required environment variables');
        }
        const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, JSON.parse(serviceAccountKey));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupData = {};
        const sheetNames = ['Projects', 'Tasks', 'Clients', 'Invoices', 'Time_Entries', 'Expenses'];
        for (const sheetName of sheetNames) {
            console.log(`Backing up ${sheetName}...`);
            backupData[sheetName] = await sheetsService.read(sheetName);
        }
        const fs = require('fs');
        const backupPath = `./backup-${timestamp}.json`;
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup completed: ${backupPath}`);
    }
    catch (error) {
        console.error('❌ Backup failed:', error);
        process.exit(1);
    }
}
async function restoreData(backupFilePath) {
    try {
        console.log('📥 Starting data restore...');
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!spreadsheetId || !serviceAccountKey) {
            throw new Error('Missing required environment variables');
        }
        const fs = require('fs');
        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`Backup file not found: ${backupFilePath}`);
        }
        const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
        const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, JSON.parse(serviceAccountKey));
        const sheetNames = ['Projects', 'Tasks', 'Clients', 'Invoices', 'Time_Entries', 'Expenses'];
        for (const sheetName of sheetNames) {
            if (backupData[sheetName] && backupData[sheetName].length > 0) {
                console.log(`Restoring ${sheetName}...`);
                await clearSheetData(sheetsService, sheetName);
                await sheetsService.batchCreate(sheetName, backupData[sheetName]);
                console.log(`✅ Restored ${backupData[sheetName].length} records to ${sheetName}`);
            }
        }
        console.log('✅ Data restore completed successfully');
    }
    catch (error) {
        console.error('❌ Restore failed:', error);
        process.exit(1);
    }
}
async function clearSheetData(sheetsService, sheetName) {
    try {
        const records = await sheetsService.read(sheetName);
        for (const record of records) {
            await sheetsService.delete(sheetName, record.id);
        }
    }
    catch (error) {
        console.warn(`Warning: Could not clear ${sheetName}:`, error);
    }
}
async function validateSheets() {
    try {
        console.log('🔍 Validating Google Sheets structure...');
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!spreadsheetId || !serviceAccountKey) {
            throw new Error('Missing required environment variables');
        }
        const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, JSON.parse(serviceAccountKey));
        const expectedSheets = ['Projects', 'Tasks', 'Clients', 'Invoices', 'Time_Entries', 'Expenses'];
        const expectedHeaders = {
            'Projects': ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at'],
            'Tasks': ['id', 'project_id', 'title', 'description', 'status', 'priority', 'due_date', 'estimated_hours', 'actual_hours', 'created_at'],
            'Clients': ['id', 'name', 'email', 'phone', 'address', 'gstin', 'payment_terms', 'created_at'],
            'Invoices': ['id', 'invoice_number', 'client_id', 'project_id', 'amount', 'tax_amount', 'total_amount', 'status', 'due_date', 'created_at'],
            'Time_Entries': ['id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at'],
            'Expenses': ['id', 'project_id', 'category', 'amount', 'description', 'date', 'receipt_url']
        };
        let validationErrors = [];
        const { sheets } = require('googleapis').google.sheets({ version: 'v4', auth: sheetsService['auth'] });
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });
        const existingSheets = spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title) || [];
        for (const sheetName of expectedSheets) {
            if (!existingSheets.includes(sheetName)) {
                validationErrors.push(`Missing sheet: ${sheetName}`);
                continue;
            }
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: `${sheetName}!1:1`
                });
                const actualHeaders = response.data.values?.[0] || [];
                const expectedHeadersForSheet = expectedHeaders[sheetName];
                for (const expectedHeader of expectedHeadersForSheet) {
                    if (!actualHeaders.includes(expectedHeader)) {
                        validationErrors.push(`Missing header '${expectedHeader}' in sheet '${sheetName}'`);
                    }
                }
                for (const actualHeader of actualHeaders) {
                    if (!expectedHeadersForSheet.includes(actualHeader)) {
                        console.warn(`⚠️  Unexpected header '${actualHeader}' in sheet '${sheetName}'`);
                    }
                }
            }
            catch (error) {
                validationErrors.push(`Could not validate headers for sheet '${sheetName}': ${error}`);
            }
        }
        if (validationErrors.length > 0) {
            console.error('❌ Validation failed:');
            validationErrors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }
        else {
            console.log('✅ All sheets are properly structured');
            for (const sheetName of expectedSheets) {
                try {
                    const records = await sheetsService.read(sheetName);
                    console.log(`📊 ${sheetName}: ${records.length} records`);
                }
                catch (error) {
                    console.warn(`⚠️  Could not count records in ${sheetName}`);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}
async function checkDataIntegrity() {
    try {
        console.log('🔍 Checking data integrity...');
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!spreadsheetId || !serviceAccountKey) {
            throw new Error('Missing required environment variables');
        }
        const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, JSON.parse(serviceAccountKey));
        let integrityIssues = [];
        const [projects, tasks, clients, invoices, timeEntries, expenses] = await Promise.all([
            sheetsService.read('Projects'),
            sheetsService.read('Tasks'),
            sheetsService.read('Clients'),
            sheetsService.read('Invoices'),
            sheetsService.read('Time_Entries'),
            sheetsService.read('Expenses')
        ]);
        console.log('Checking referential integrity...');
        const clientIds = new Set(clients.map(c => c.id));
        projects.forEach(project => {
            if (project.client_id && !clientIds.has(project.client_id)) {
                integrityIssues.push(`Project '${project.name}' references non-existent client ID: ${project.client_id}`);
            }
        });
        const projectIds = new Set(projects.map(p => p.id));
        tasks.forEach(task => {
            if (task.project_id && !projectIds.has(task.project_id)) {
                integrityIssues.push(`Task '${task.title}' references non-existent project ID: ${task.project_id}`);
            }
        });
        invoices.forEach(invoice => {
            if (invoice.client_id && !clientIds.has(invoice.client_id)) {
                integrityIssues.push(`Invoice '${invoice.invoice_number}' references non-existent client ID: ${invoice.client_id}`);
            }
            if (invoice.project_id && !projectIds.has(invoice.project_id)) {
                integrityIssues.push(`Invoice '${invoice.invoice_number}' references non-existent project ID: ${invoice.project_id}`);
            }
        });
        const taskIds = new Set(tasks.map(t => t.id));
        timeEntries.forEach(entry => {
            if (entry.task_id && !taskIds.has(entry.task_id)) {
                integrityIssues.push(`Time entry references non-existent task ID: ${entry.task_id}`);
            }
            if (entry.project_id && !projectIds.has(entry.project_id)) {
                integrityIssues.push(`Time entry references non-existent project ID: ${entry.project_id}`);
            }
        });
        expenses.forEach(expense => {
            if (expense.project_id && !projectIds.has(expense.project_id)) {
                integrityIssues.push(`Expense references non-existent project ID: ${expense.project_id}`);
            }
        });
        console.log('Checking data validity...');
        const checkDuplicateIds = (records, sheetName) => {
            const ids = records.map(r => r.id).filter(id => id);
            const uniqueIds = new Set(ids);
            if (ids.length !== uniqueIds.size) {
                integrityIssues.push(`Duplicate IDs found in ${sheetName}`);
            }
        };
        checkDuplicateIds(projects, 'Projects');
        checkDuplicateIds(tasks, 'Tasks');
        checkDuplicateIds(clients, 'Clients');
        checkDuplicateIds(invoices, 'Invoices');
        checkDuplicateIds(timeEntries, 'Time_Entries');
        checkDuplicateIds(expenses, 'Expenses');
        projects.forEach(project => {
            if (!project.name || !project.client_id) {
                integrityIssues.push(`Project missing required fields: ${project.id}`);
            }
        });
        clients.forEach(client => {
            if (!client.name || !client.email) {
                integrityIssues.push(`Client missing required fields: ${client.id}`);
            }
        });
        if (integrityIssues.length > 0) {
            console.error('❌ Data integrity issues found:');
            integrityIssues.forEach(issue => console.error(`  - ${issue}`));
            console.log('\n💡 Consider running backup before fixing these issues');
        }
        else {
            console.log('✅ Data integrity check passed');
        }
    }
    catch (error) {
        console.error('❌ Data integrity check failed:', error);
        process.exit(1);
    }
}
const command = process.argv[2];
const arg = process.argv[3];
switch (command) {
    case 'init':
        initializeSheets();
        break;
    case 'backup':
        backupData();
        break;
    case 'restore':
        if (!arg) {
            console.error('❌ Backup file path is required for restore command');
            console.log('Usage: npm run sheets restore <backup-file-path>');
            process.exit(1);
        }
        restoreData(arg);
        break;
    case 'validate':
        validateSheets();
        break;
    case 'check':
        checkDataIntegrity();
        break;
    default:
        console.log(`
Usage: npm run sheets <command> [options]

Commands:
  init [--seed]     Initialize Google Sheets with headers and optionally seed sample data
  backup            Create a backup of all data
  restore <file>    Restore data from a backup file
  validate          Validate sheet structure and headers
  check             Check data integrity and referential consistency

Examples:
  npm run sheets init
  npm run sheets init --seed
  npm run sheets backup
  npm run sheets restore ./backup-2024-01-15T10-30-00-000Z.json
  npm run sheets validate
  npm run sheets check
    `);
        break;
}
//# sourceMappingURL=init-sheets.js.map