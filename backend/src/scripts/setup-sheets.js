#!/usr/bin/env node

/**
 * Google Sheets Setup Script (JavaScript version)
 * 
 * This script creates and initializes all required Google Sheets for the
 * Project Invoice Management System with proper headers and structure.
 */

const dotenv = require('dotenv');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

// Load environment variables
dotenv.config();

// Complete sheet configurations for the Project Invoice Management System
const SHEET_CONFIGURATIONS = [
  // Core Business Entities
  {
    name: 'Projects',
    headers: [
      'id', 'name', 'client_id', 'status', 'start_date', 'end_date', 
      'budget', 'description', 'created_at', 'updated_at'
    ],
    description: 'Main projects data with client relationships and timeline'
  },
  {
    name: 'Tasks',
    headers: [
      'id', 'project_id', 'title', 'description', 'status', 'priority', 
      'due_date', 'estimated_hours', 'actual_hours', 'created_at'
    ],
    description: 'Project tasks with time tracking and priority management'
  },
  {
    name: 'Clients',
    headers: [
      'id', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 
      'postal_code', 'gstin', 'pan', 'payment_terms', 'default_currency', 
      'billing_address', 'shipping_address', 'contact_person', 'website', 
      'notes', 'is_active', 'portal_access_enabled', 'portal_password_hash', 
      'last_portal_login', 'company_name', 'created_at', 'updated_at'
    ],
    description: 'Client information with GST details and portal access'
  },
  {
    name: 'Invoices',
    headers: [
      'id', 'invoice_number', 'client_id', 'project_id', 'line_items', 
      'subtotal', 'tax_breakdown', 'total_amount', 'currency', 'status', 
      'issue_date', 'due_date', 'payment_terms', 'notes', 'terms_conditions', 
      'is_recurring', 'recurring_frequency', 'next_invoice_date', 
      'payment_status', 'paid_amount', 'payment_date', 'payment_method', 
      'late_fee_applied', 'discount_percentage', 'discount_amount', 
      'created_at', 'updated_at'
    ],
    description: 'Invoice management with GST compliance and payment tracking'
  },
  {
    name: 'Time_Entries',
    headers: [
      'id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at'
    ],
    description: 'Time tracking entries linked to tasks and projects'
  },
  {
    name: 'Expenses',
    headers: [
      'id', 'project_id', 'category', 'amount', 'currency', 'description', 
      'date', 'receipt_url', 'vendor', 'is_billable', 'tax_amount', 'tax_rate', 
      'reimbursable', 'approval_status', 'approved_by', 'approved_at', 
      'invoice_id', 'created_at', 'updated_at'
    ],
    description: 'Project expenses with approval workflow and tax details'
  },

  // User Management
  {
    name: 'Users',
    headers: [
      'id', 'name', 'email', 'password_hash', 'role', 'is_active', 
      'email_verified', 'last_login', 'failed_login_attempts', 'locked_until', 
      'created_at', 'updated_at'
    ],
    description: 'System users with authentication and role management'
  },

  // Client Portal and Communication
  {
    name: 'Client_Communications',
    headers: [
      'id', 'client_id', 'project_id', 'subject', 'message', 'sender', 
      'sender_name', 'sender_email', 'status', 'thread_id', 'created_at'
    ],
    description: 'Client communication history and messaging'
  },
  {
    name: 'Client_Activities',
    headers: [
      'id', 'client_id', 'activity', 'metadata', 'timestamp'
    ],
    description: 'Client portal activity tracking and audit log'
  },

  // Payment Management
  {
    name: 'Payment_Links',
    headers: [
      'id', 'gateway', 'url', 'amount', 'currency', 'description', 'invoice_id', 
      'client_email', 'client_name', 'status', 'expires_at', 'allow_partial_payments', 
      'paid_amount', 'paid_at', 'metadata', 'created_at', 'updated_at'
    ],
    description: 'Payment gateway links and transaction tracking'
  },
  {
    name: 'Payment_Reminders',
    headers: [
      'id', 'invoice_id', 'type', 'days_offset', 'template', 'method', 
      'status', 'scheduled_at', 'sent_at', 'created_at', 'updated_at'
    ],
    description: 'Automated payment reminder scheduling and tracking'
  },
  {
    name: 'Late_Fee_Rules',
    headers: [
      'id', 'name', 'type', 'amount', 'grace_period_days', 'max_amount', 
      'compounding_frequency', 'is_active', 'created_at', 'updated_at'
    ],
    description: 'Late fee calculation rules and policies'
  },
  {
    name: 'Late_Fees',
    headers: [
      'id', 'invoice_id', 'rule_id', 'amount', 'days_past_due', 'applied_at', 'created_at'
    ],
    description: 'Applied late fees with calculation details'
  },

  // Automation and Workflow
  {
    name: 'Automation_Rules',
    headers: [
      'id', 'name', 'description', 'trigger', 'conditions', 'actions', 
      'is_active', 'created_at', 'updated_at'
    ],
    description: 'Business process automation rules and triggers'
  },
  {
    name: 'Reminder_Schedules',
    headers: [
      'id', 'type', 'entity_id', 'scheduled_at', 'reminder_config', 'status', 
      'attempts', 'last_attempt_at', 'created_at'
    ],
    description: 'Scheduled reminders for deadlines and payments'
  },
  {
    name: 'Notification_Templates',
    headers: [
      'id', 'name', 'type', 'subject', 'body', 'variables', 'is_active', 
      'created_at', 'updated_at'
    ],
    description: 'Email and notification templates with variable substitution'
  },
  {
    name: 'Workflow_Executions',
    headers: [
      'id', 'rule_id', 'trigger_data', 'status', 'started_at', 'completed_at', 
      'error_message', 'actions_executed'
    ],
    description: 'Workflow execution history and status tracking'
  },
  {
    name: 'Automation_Logs',
    headers: [
      'id', 'type', 'entity_id', 'action', 'status', 'details', 'timestamp'
    ],
    description: 'Detailed automation activity logs for debugging'
  },

  // File Management
  {
    name: 'Files',
    headers: [
      'id', 'name', 'original_name', 'mime_type', 'size', 'path', 'drive_file_id', 
      'project_id', 'client_id', 'invoice_id', 'uploaded_by', 'is_public', 
      'download_count', 'created_at', 'updated_at'
    ],
    description: 'File metadata and Google Drive integration'
  },
  {
    name: 'File_Shares',
    headers: [
      'id', 'file_id', 'shared_with', 'permission', 'expires_at', 'created_by', 'created_at'
    ],
    description: 'File sharing permissions and access control'
  },
  {
    name: 'File_Comments',
    headers: [
      'id', 'file_id', 'user_id', 'comment', 'created_at'
    ],
    description: 'File comments and collaboration features'
  },
  {
    name: 'File_Versions',
    headers: [
      'id', 'file_id', 'version_number', 'drive_file_id', 'size', 
      'change_description', 'created_by', 'created_at'
    ],
    description: 'File version history and change tracking'
  }
];

class GoogleSheetsSetup {
  constructor() {
    this.validateEnvironment();
    this.initializeAuth();
  }

  validateEnvironment() {
    const requiredVars = [
      'GOOGLE_SHEETS_ID',
      'GOOGLE_SERVICE_ACCOUNT_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(varName => console.error(`  - ${varName}`));
      console.error('\nPlease check your .env file and ensure all variables are set.');
      process.exit(1);
    }

    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  }

  initializeAuth() {
    try {
      const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      this.auth = new JWT({
        email: serviceAccountKey.client_email,
        key: serviceAccountKey.private_key,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('❌ Failed to initialize Google authentication:', error);
      console.error('Please check your GOOGLE_SERVICE_ACCOUNT_KEY format.');
      process.exit(1);
    }
  }

  async createSpreadsheet() {
    try {
      console.log('🆕 Creating new Google Spreadsheet...');
      
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'Project Invoice Management System - Database',
            locale: 'en_US',
            timeZone: 'UTC'
          }
        }
      });

      const spreadsheetId = response.data.spreadsheetId;
      console.log(`✅ Created spreadsheet: ${spreadsheetId}`);
      console.log(`📊 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
      
      return spreadsheetId;
    } catch (error) {
      console.error('❌ Failed to create spreadsheet:', error);
      throw error;
    }
  }

  async setupSheets() {
    try {
      console.log('🚀 Starting Google Sheets setup...');
      console.log(`📊 Spreadsheet ID: ${this.spreadsheetId}`);

      // Get existing spreadsheet info
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      console.log(`📋 Spreadsheet: ${spreadsheet.data.properties?.title}`);

      // Get existing sheets
      const existingSheets = spreadsheet.data.sheets?.map(sheet => ({
        id: sheet.properties?.sheetId,
        title: sheet.properties?.title
      })) || [];

      console.log(`📄 Found ${existingSheets.length} existing sheets`);

      // Create missing sheets
      const sheetsToCreate = SHEET_CONFIGURATIONS.filter(
        config => !existingSheets.some(existing => existing.title === config.name)
      );

      if (sheetsToCreate.length > 0) {
        console.log(`📝 Creating ${sheetsToCreate.length} new sheets...`);
        await this.createSheets(sheetsToCreate);
      } else {
        console.log('✅ All required sheets already exist');
      }

      // Setup headers for all sheets
      console.log('📋 Setting up headers...');
      await this.setupHeaders();

      // Apply formatting
      console.log('🎨 Applying formatting...');
      await this.applyFormatting();

      console.log('🎉 Google Sheets setup completed successfully!');
      console.log(`📊 Access your spreadsheet: https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`);

    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  }

  async createSheets(sheetsToCreate) {
    const requests = sheetsToCreate.map(config => ({
      addSheet: {
        properties: {
          title: config.name,
          gridProperties: {
            rowCount: 1000,
            columnCount: config.headers.length + 5 // Extra columns for future expansion
          }
        }
      }
    }));

    // Remove the default "Sheet1" if it exists and we're creating new sheets
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const defaultSheet = spreadsheet.data.sheets?.find(
      sheet => sheet.properties?.title === 'Sheet1'
    );

    if (defaultSheet && sheetsToCreate.length > 0) {
      requests.push({
        deleteSheet: {
          sheetId: defaultSheet.properties?.sheetId
        }
      });
    }

    if (requests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: { requests }
      });

      console.log(`✅ Created ${sheetsToCreate.length} sheets`);
    }
  }

  async setupHeaders() {
    const requests = [];

    for (const config of SHEET_CONFIGURATIONS) {
      // Add headers
      requests.push({
        updateCells: {
          range: {
            sheetId: await this.getSheetId(config.name),
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: config.headers.length
          },
          rows: [{
            values: config.headers.map(header => ({
              userEnteredValue: { stringValue: header },
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: { bold: true },
                horizontalAlignment: 'CENTER'
              }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat'
        }
      });

      // Freeze header row
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: await this.getSheetId(config.name),
            gridProperties: {
              frozenRowCount: 1
            }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      });
    }

    if (requests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: { requests }
      });
    }
  }

  async applyFormatting() {
    const requests = [];

    for (const config of SHEET_CONFIGURATIONS) {
      const sheetId = await this.getSheetId(config.name);

      // Auto-resize columns
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: config.headers.length
          }
        }
      });

      // Add alternating row colors
      requests.push({
        addBanding: {
          bandedRange: {
            range: {
              sheetId: sheetId,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: config.headers.length
            },
            rowProperties: {
              headerColor: { red: 0.9, green: 0.9, blue: 0.9 },
              firstBandColor: { red: 1, green: 1, blue: 1 },
              secondBandColor: { red: 0.95, green: 0.95, blue: 0.95 }
            }
          }
        }
      });
    }

    if (requests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: { requests }
      });
    }
  }

  async getSheetId(sheetName) {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === sheetName
    );

    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    return sheet.properties?.sheetId;
  }

  async validateSetup() {
    try {
      console.log('🔍 Validating setup...');

      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheets = spreadsheet.data.sheets?.map(
        sheet => sheet.properties?.title
      ) || [];

      const missingSheets = SHEET_CONFIGURATIONS.filter(
        config => !existingSheets.includes(config.name)
      );

      if (missingSheets.length > 0) {
        console.error('❌ Missing sheets:');
        missingSheets.forEach(sheet => console.error(`  - ${sheet.name}`));
        return;
      }

      // Validate headers for each sheet
      for (const config of SHEET_CONFIGURATIONS) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${config.name}!1:1`
        });

        const actualHeaders = response.data.values?.[0] || [];
        const missingHeaders = config.headers.filter(
          header => !actualHeaders.includes(header)
        );

        if (missingHeaders.length > 0) {
          console.error(`❌ Missing headers in ${config.name}:`, missingHeaders);
        }
      }

      console.log('✅ Setup validation completed');
      console.log(`📊 Total sheets: ${existingSheets.length}`);
      console.log(`📋 All required sheets present: ${missingSheets.length === 0 ? 'Yes' : 'No'}`);

    } catch (error) {
      console.error('❌ Validation failed:', error);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  const setup = new GoogleSheetsSetup();

  try {
    switch (command) {
      case 'create':
        const spreadsheetId = await setup.createSpreadsheet();
        console.log(`\n📝 Update your .env file with:`);
        console.log(`GOOGLE_SHEETS_ID=${spreadsheetId}`);
        break;

      case 'setup':
        await setup.setupSheets();
        break;

      case 'validate':
        await setup.validateSetup();
        break;

      case 'full':
        await setup.setupSheets();
        await setup.validateSetup();
        console.log('\n🎉 Full setup completed successfully!');
        break;

      default:
        console.log(`
🚀 Google Sheets Setup Tool

Usage: node setup-sheets.js <command>

Commands:
  create    Create a new Google Spreadsheet
  setup     Setup all required sheets and headers
  validate  Validate existing sheet structure
  full      Complete setup with validation

Examples:
  node setup-sheets.js create
  node setup-sheets.js setup
  node setup-sheets.js full

Environment Variables Required:
  GOOGLE_SHEETS_ID              - Your Google Sheets spreadsheet ID
  GOOGLE_SERVICE_ACCOUNT_KEY    - Your service account JSON key

For detailed setup instructions, see: ENVIRONMENT_SETUP_GUIDE.md
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { GoogleSheetsSetup, SHEET_CONFIGURATIONS };