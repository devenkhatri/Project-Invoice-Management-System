#!/usr/bin/env node

import { createGoogleSheetsService } from '../services/googleSheets';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Sheet configurations with headers and sample data
 */
const SHEET_CONFIGURATIONS = [
  {
    name: 'Projects',
    headers: [
      'id', 'name', 'client_id', 'status', 'start_date', 'end_date', 
      'budget', 'description', 'created_at', 'updated_at'
    ],
    sampleData: [
      {
        name: 'Website Redesign',
        client_id: 'client-1',
        status: 'active',
        start_date: '2024-01-15',
        end_date: '2024-03-15',
        budget: 50000,
        description: 'Complete website redesign with modern UI/UX'
      },
      {
        name: 'Mobile App Development',
        client_id: 'client-2',
        status: 'active',
        start_date: '2024-02-01',
        end_date: '2024-06-01',
        budget: 150000,
        description: 'Native mobile app for iOS and Android'
      }
    ]
  },
  {
    name: 'Tasks',
    headers: [
      'id', 'project_id', 'title', 'description', 'status', 'priority', 
      'due_date', 'estimated_hours', 'actual_hours', 'created_at'
    ],
    sampleData: [
      {
        project_id: 'project-1',
        title: 'Design Homepage',
        description: 'Create wireframes and mockups for homepage',
        status: 'in-progress',
        priority: 'high',
        due_date: '2024-02-01',
        estimated_hours: 16,
        actual_hours: 12
      },
      {
        project_id: 'project-1',
        title: 'Implement Navigation',
        description: 'Code responsive navigation component',
        status: 'todo',
        priority: 'medium',
        due_date: '2024-02-05',
        estimated_hours: 8,
        actual_hours: 0
      }
    ]
  },
  {
    name: 'Clients',
    headers: [
      'id', 'name', 'email', 'phone', 'address', 'gstin', 'payment_terms', 'created_at'
    ],
    sampleData: [
      {
        name: 'Tech Solutions Pvt Ltd',
        email: 'contact@techsolutions.com',
        phone: '+91-9876543210',
        address: '123 Business Park, Mumbai, Maharashtra 400001',
        gstin: '27AABCT1234C1Z5',
        payment_terms: 'Net 30'
      },
      {
        name: 'Digital Marketing Co',
        email: 'info@digitalmarketing.com',
        phone: '+91-9876543211',
        address: '456 Corporate Tower, Bangalore, Karnataka 560001',
        gstin: '29AABCD5678E1Z2',
        payment_terms: 'Net 15'
      }
    ]
  },
  {
    name: 'Invoices',
    headers: [
      'id', 'invoice_number', 'client_id', 'project_id', 'amount', 'tax_amount', 
      'total_amount', 'status', 'due_date', 'currency', 'tax_rate', 'notes', 'terms',
      'is_recurring', 'recurring_frequency', 'recurring_next_date', 'recurring_end_date',
      'recurring_count', 'payment_link', 'created_at', 'updated_at'
    ],
    sampleData: [
      {
        invoice_number: 'INV-2024-001',
        client_id: 'client-1',
        project_id: 'project-1',
        amount: 25000,
        tax_amount: 4500,
        total_amount: 29500,
        status: 'sent',
        due_date: '2024-02-15',
        currency: 'INR',
        tax_rate: 18,
        notes: 'Thank you for your business',
        terms: 'Payment due within 30 days',
        is_recurring: false
      },
      {
        invoice_number: 'INV-2024-002',
        client_id: 'client-2',
        project_id: 'project-2',
        amount: 50000,
        tax_amount: 9000,
        total_amount: 59000,
        status: 'draft',
        due_date: '2024-03-01',
        currency: 'INR',
        tax_rate: 18,
        notes: 'Thank you for your business',
        terms: 'Payment due within 15 days',
        is_recurring: false
      }
    ]
  },
  {
    name: 'Invoice_Items',
    headers: [
      'id', 'invoice_id', 'description', 'quantity', 'rate', 'amount', 'type', 'hsn_sac'
    ],
    sampleData: [
      {
        invoice_id: 'invoice-1',
        description: 'Web Development Services',
        quantity: 40,
        rate: 1500,
        amount: 60000,
        type: 'service',
        hsn_sac: '998314'
      },
      {
        invoice_id: 'invoice-1',
        description: 'UI/UX Design',
        quantity: 20,
        rate: 2000,
        amount: 40000,
        type: 'service',
        hsn_sac: '998314'
      },
      {
        invoice_id: 'invoice-2',
        description: 'Mobile App Development',
        quantity: 80,
        rate: 1800,
        amount: 144000,
        type: 'service',
        hsn_sac: '998314'
      }
    ]
  },
  {
    name: 'Time_Entries',
    headers: [
      'id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at'
    ],
    sampleData: [
      {
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Created initial wireframes for homepage',
        date: '2024-01-20'
      },
      {
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 6,
        description: 'Refined homepage design based on feedback',
        date: '2024-01-21'
      }
    ]
  },
  {
    name: 'Expenses',
    headers: [
      'id', 'project_id', 'category', 'amount', 'description', 'date', 'receipt_url'
    ],
    sampleData: [
      {
        project_id: 'project-1',
        category: 'Software',
        amount: 2500,
        description: 'Adobe Creative Suite subscription',
        date: '2024-01-15',
        receipt_url: 'https://drive.google.com/file/d/receipt1'
      },
      {
        project_id: 'project-2',
        category: 'Hardware',
        amount: 15000,
        description: 'Development laptop',
        date: '2024-01-20',
        receipt_url: 'https://drive.google.com/file/d/receipt2'
      }
    ]
  },
  {
    name: 'Payments',
    headers: [
      'id', 'invoice_id', 'amount', 'currency', 'gateway', 'gateway_payment_id',
      'status', 'payment_date', 'payment_method', 'transaction_fee', 'metadata',
      'created_at', 'updated_at'
    ],
    sampleData: [
      {
        invoice_id: 'invoice-1',
        amount: 29500,
        currency: 'INR',
        gateway: 'razorpay',
        gateway_payment_id: 'pay_mock123456',
        status: 'completed',
        payment_date: '2024-02-10',
        payment_method: 'card',
        transaction_fee: 590,
        metadata: '{}'
      },
      {
        invoice_id: 'invoice-2',
        amount: 30000,
        currency: 'INR',
        gateway: 'bank_transfer',
        gateway_payment_id: 'manual_12345',
        status: 'completed',
        payment_date: '2024-02-15',
        payment_method: 'bank_transfer',
        transaction_fee: 0,
        metadata: '{}'
      }
    ]
  },
  {
    name: 'Communications',
    headers: [
      'id', 'client_id', 'project_id', 'type', 'direction', 'subject', 'content', 
      'contact_person', 'follow_up_required', 'follow_up_date', 'attachments', 'created_at', 'updated_at'
    ],
    sampleData: [
      {
        client_id: 'client-1',
        project_id: 'project-1',
        type: 'email',
        direction: 'outbound',
        subject: 'Project Kickoff Meeting',
        content: 'Hi, I would like to schedule a kickoff meeting for the website redesign project. Are you available next Tuesday?',
        contact_person: 'John Doe',
        follow_up_required: true,
        follow_up_date: '2024-01-25',
        attachments: ''
      },
      {
        client_id: 'client-1',
        project_id: 'project-1',
        type: 'meeting',
        direction: 'inbound',
        subject: 'Design Review Meeting',
        content: 'We had a productive meeting to review the initial designs. Client provided feedback on color scheme and layout preferences.',
        contact_person: 'Jane Smith',
        follow_up_required: false,
        follow_up_date: '',
        attachments: ''
      }
    ]
  }
];

/**
 * Initialize Google Sheets with all required sheets and headers
 */
async function initializeSheets(includeSampleData: boolean = false): Promise<void> {
  console.log('🚀 Starting Google Sheets initialization...');
  
  const sheetsService = createGoogleSheetsService();
  if (!sheetsService) {
    console.error('❌ Failed to create Google Sheets service. Check your environment variables.');
    process.exit(1);
  }

  try {
    // Test connection first
    const connected = await sheetsService.testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to Google Sheets');
      process.exit(1);
    }

    console.log('📋 Creating sheets and setting up headers...');
    
    // Get existing sheets to avoid duplicates
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
    const existingSheets = spreadsheetInfo.sheets?.map((sheet: any) => sheet.properties.title) || [];
    
    for (const sheetConfig of SHEET_CONFIGURATIONS) {
      console.log(`\n📄 Processing sheet: ${sheetConfig.name}`);
      
      // Create sheet if it doesn't exist
      if (!existingSheets.includes(sheetConfig.name)) {
        const created = await sheetsService.createSheet(sheetConfig.name, sheetConfig.headers);
        if (created) {
          console.log(`✅ Created sheet: ${sheetConfig.name}`);
        } else {
          console.error(`❌ Failed to create sheet: ${sheetConfig.name}`);
          continue;
        }
      } else {
        console.log(`ℹ️  Sheet ${sheetConfig.name} already exists, skipping creation`);
      }

      // Add sample data if requested
      if (includeSampleData && sheetConfig.sampleData.length > 0) {
        console.log(`📝 Adding sample data to ${sheetConfig.name}...`);
        try {
          const ids = await sheetsService.batchCreate(sheetConfig.name, sheetConfig.sampleData);
          console.log(`✅ Added ${ids.length} sample records to ${sheetConfig.name}`);
        } catch (error) {
          console.error(`❌ Failed to add sample data to ${sheetConfig.name}:`, error);
        }
      }
    }

    console.log('\n🎉 Google Sheets initialization completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Created/verified ${SHEET_CONFIGURATIONS.length} sheets`);
    if (includeSampleData) {
      const totalSampleRecords = SHEET_CONFIGURATIONS.reduce((sum, config) => sum + config.sampleData.length, 0);
      console.log(`- Added ${totalSampleRecords} sample records`);
    }
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const includeSampleData = args.includes('--with-sample-data') || args.includes('-s');
  
  console.log('🔧 Google Sheets Backend Initialization');
  console.log('=====================================');
  
  if (includeSampleData) {
    console.log('📝 Sample data will be included');
  } else {
    console.log('📝 Only creating sheets with headers (use --with-sample-data to include sample data)');
  }
  
  await initializeSheets(includeSampleData);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { initializeSheets, SHEET_CONFIGURATIONS };