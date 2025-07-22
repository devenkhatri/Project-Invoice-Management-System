# Google Sheets Backend Scripts

This directory contains scripts for managing the Google Sheets backend infrastructure for the Project Invoice Management System.

## Overview

The system uses Google Sheets as its primary database, with the following sheets:

- **Projects**: Project information and metadata
- **Tasks**: Individual tasks within projects
- **Clients**: Client contact and billing information
- **Invoices**: Invoice records and payment tracking
- **Time_Entries**: Time tracking for tasks and projects
- **Expenses**: Business expense tracking
- **Payments**: Payment transaction records
- **Communications**: Client communication history

## Prerequisites

1. **Google API Setup**:
   - Create a Google Cloud Project
   - Enable Google Sheets API and Google Drive API
   - Create a Service Account and download the JSON key
   - Share your Google Sheets document with the service account email
   - Grant the service account appropriate Drive permissions

2. **Environment Variables**:
   ```bash
   GOOGLE_SHEETS_ID=your_spreadsheet_id
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_DRIVE_ROOT_FOLDER=optional_root_folder_id
   ```

## Scripts

### 1. Sheet Initialization (`initializeSheets.ts`)

Sets up all required sheets with proper headers and optionally adds sample data.

**Usage:**
```bash
# Initialize sheets with headers only
npm run sheets:init

# Initialize sheets with sample data
npm run sheets:init:sample
```

**Features:**
- Creates all 6 required sheets
- Sets up proper column headers
- Adds sample data for development/testing
- Skips existing sheets to avoid duplicates
- Comprehensive error handling and logging

### 2. Backup & Restore (`backupRestore.ts`)

Provides data backup and restore functionality for disaster recovery and data migration.

**Usage:**
```bash
# Create a backup
npm run sheets:backup

# Restore from backup
npm run sheets:restore path/to/backup.json

# List available backups
npm run sheets:list-backups

# Advanced restore options
ts-node src/scripts/backupRestore.ts restore backup.json --clear --sheets=Projects,Tasks
```

**Features:**
- Full data backup to JSON format
- Selective sheet restoration
- Option to clear existing data before restore
- Automatic backup file naming with timestamps
- Batch processing for large datasets

### 3. Configuration & Validation (`sheetConfig.ts`)

Validates sheet structure and provides maintenance utilities.

**Usage:**
```bash
# Validate all sheets
npm run sheets:config validate

# Get statistics
npm run sheets:config stats

# Clear specific sheets
npm run sheets:config clear Projects Tasks

# Clear all sheets (with confirmation)
npm run sheets:config clear --all
```

**Features:**
- Validates sheet existence and header structure
- Provides detailed statistics and insights
- Selective or bulk data clearing
- Connection testing and diagnostics

## Sheet Structure

### Projects Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique project identifier |
| name | String | Project name |
| client_id | String | Reference to client |
| status | String | active/completed/on-hold |
| start_date | Date | Project start date |
| end_date | Date | Project deadline |
| budget | Number | Project budget |
| description | Text | Project description |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |

### Tasks Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique task identifier |
| project_id | String | Reference to project |
| title | String | Task title |
| description | Text | Task description |
| status | String | todo/in-progress/completed |
| priority | String | low/medium/high |
| due_date | Date | Task deadline |
| estimated_hours | Number | Estimated time |
| actual_hours | Number | Actual time spent |
| created_at | DateTime | Creation timestamp |

### Clients Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique client identifier |
| name | String | Client name |
| email | String | Client email |
| phone | String | Client phone |
| address | Text | Client address |
| gstin | String | GST identification number |
| payment_terms | String | Payment terms |
| created_at | DateTime | Creation timestamp |

### Invoices Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique invoice identifier |
| invoice_number | String | Invoice number |
| client_id | String | Reference to client |
| project_id | String | Reference to project |
| amount | Number | Invoice amount |
| tax_amount | Number | Tax amount |
| total_amount | Number | Total amount |
| status | String | draft/sent/paid/overdue |
| due_date | Date | Payment due date |
| created_at | DateTime | Creation timestamp |

### Time_Entries Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique entry identifier |
| task_id | String | Reference to task |
| project_id | String | Reference to project |
| hours | Number | Hours worked |
| description | Text | Work description |
| date | Date | Work date |
| created_at | DateTime | Creation timestamp |

### Expenses Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique expense identifier |
| project_id | String | Reference to project |
| category | String | Expense category |
| amount | Number | Expense amount |
| description | Text | Expense description |
| date | Date | Expense date |
| receipt_url | String | Receipt file URL |

### Payments Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique payment identifier |
| invoice_id | String | Reference to invoice |
| amount | Number | Payment amount |
| currency | String | Payment currency |
| gateway | String | Payment gateway used |
| gateway_payment_id | String | Gateway transaction ID |
| status | String | Payment status |
| payment_date | DateTime | Payment timestamp |
| payment_method | String | Payment method |
| transaction_fee | Number | Gateway transaction fee |

### Communications Sheet
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique communication identifier |
| client_id | String | Reference to client |
| project_id | String | Reference to project (optional) |
| type | String | Communication type (email/phone/meeting) |
| direction | String | inbound/outbound |
| subject | String | Communication subject |
| content | Text | Communication content |
| contact_person | String | Contact person name |
| follow_up_date | Date | Follow-up date (optional) |
| follow_up_completed | Boolean | Follow-up completion status |

## Sample Data

The initialization script includes realistic sample data for development and testing:

- 2 sample projects (Website Redesign, Mobile App Development)
- 2 sample tasks per project with time tracking
- 2 sample clients with GST information
- 2 sample invoices with tax calculations
- Time entries for task tracking
- Business expense records across multiple categories
- Payment transaction records
- Client communication history

This sample data enables immediate testing of:
- Dashboard financial metrics and charts
- Project profitability analysis
- Invoice payment tracking
- Client portal functionality
- Reporting and export features

## File Management

The system includes a comprehensive file management service built on Google Drive API:

### File Storage Structure

- **Project Files**: Organized by project with standardized subfolders
- **Client Files**: Organized by client with standardized subfolders
- **File Metadata**: Stored in Google Sheets with references to Google Drive files

### File Search Capabilities

The file search functionality has been enhanced with:

- **Full-text search**: Search within file content, not just filenames
- **Custom fields**: Specify which fields to include in search results
- **Advanced filtering**: Filter by MIME type, parent folders, and other criteria
- **Sorting options**: Sort by various metadata fields

### File Management Features

- File uploads with automatic folder organization
- File sharing with clients via secure links
- File metadata management and tagging
- Thumbnail generation for supported file types
- Batch operations for file management

## Best Practices

1. **Regular Backups**: Schedule regular backups of your data
2. **Validation**: Run validation checks after major changes
3. **Environment Separation**: Use different spreadsheets for development and production
4. **Access Control**: Limit service account permissions to necessary scopes
5. **Error Handling**: Monitor logs for API rate limits and errors

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify service account email and private key
   - Ensure spreadsheet is shared with service account
   - Check Google Cloud API permissions

2. **Rate Limiting**:
   - Google Sheets API has rate limits
   - Scripts include retry logic for transient failures
   - Consider batching operations for large datasets

3. **Sheet Not Found**:
   - Run initialization script to create missing sheets
   - Verify spreadsheet ID in environment variables

4. **Header Mismatch**:
   - Run validation to check header structure
   - Re-run initialization if headers are incorrect

### Getting Help

1. Check the console output for detailed error messages
2. Verify environment variables are correctly set
3. Test connection using the validation script
4. Review Google Sheets API quotas and limits

## Development Workflow

1. **Initial Setup**:
   ```bash
   npm run sheets:init:sample
   npm run sheets:config validate
   ```

2. **Regular Development**:
   ```bash
   npm run sheets:config stats
   npm run sheets:backup
   ```

3. **Testing**:
   ```bash
   npm run sheets:config clear --all
   npm run sheets:init:sample
   ```

4. **Production Deployment**:
   ```bash
   npm run sheets:backup
   npm run sheets:init
   npm run sheets:config validate
   ```

This comprehensive setup ensures reliable data management and provides tools for maintenance, backup, and recovery of your Google Sheets backend.