# Google Sheets Management Scripts

This directory contains scripts for managing Google Sheets backend operations for the Project Invoice Management System.

## Prerequisites

Before using these scripts, ensure you have:

1. **Environment Variables Set:**
   - `GOOGLE_SHEETS_ID`: The ID of your Google Sheets document
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: JSON string of your Google Service Account credentials

2. **Google Service Account:**
   - Create a service account in Google Cloud Console
   - Enable Google Sheets API
   - Download the service account key JSON file
   - Share your Google Sheets document with the service account email

## Available Commands

### Initialize Sheets
```bash
npm run sheets:init
```
Creates all required sheets with proper headers if they don't exist.

### Initialize with Sample Data
```bash
npm run sheets:seed
```
Creates sheets and populates them with realistic sample data for development and testing.

### Backup Data
```bash
npm run sheets:backup
```
Creates a timestamped JSON backup of all data from Google Sheets.

### Restore Data
```bash
npm run sheets:restore <backup-file-path>
```
Restores data from a backup file. **Warning:** This will clear existing data.

Example:
```bash
npm run sheets:restore ./backup-2024-01-15T10-30-00-000Z.json
```

### Validate Sheet Structure
```bash
npm run sheets:validate
```
Validates that all required sheets exist with correct headers and shows data summary.

### Check Data Integrity
```bash
npm run sheets:check
```
Performs comprehensive data integrity checks including:
- Referential integrity (foreign key relationships)
- Duplicate ID detection
- Required field validation
- Data format validation

## Sheet Structure

The system creates 6 sheets with the following structure:

### Projects
- id, name, client_id, status, start_date, end_date, budget, description, created_at, updated_at

### Tasks
- id, project_id, title, description, status, priority, due_date, estimated_hours, actual_hours, created_at

### Clients
- id, name, email, phone, address, gstin, payment_terms, created_at

### Invoices
- id, invoice_number, client_id, project_id, amount, tax_amount, total_amount, status, due_date, created_at

### Time_Entries
- id, task_id, project_id, hours, description, date, created_at

### Expenses
- id, project_id, category, amount, description, date, receipt_url

## Data Validation

The scripts include comprehensive data validation:

- **Email format validation** for client emails
- **GSTIN format validation** for Indian tax numbers
- **Phone number validation** for contact numbers
- **Date format validation** for all date fields
- **Numeric validation** for amounts, hours, and budgets
- **Referential integrity** checks between related records
- **Required field validation** based on sheet type

## Error Handling

The scripts include robust error handling:

- **Retry logic** for Google Sheets API rate limits
- **Network error recovery** with exponential backoff
- **Validation error reporting** with detailed messages
- **Graceful degradation** when external services are unavailable

## Best Practices

1. **Always backup before major operations:**
   ```bash
   npm run sheets:backup
   ```

2. **Validate data integrity regularly:**
   ```bash
   npm run sheets:check
   ```

3. **Use sample data for development:**
   ```bash
   npm run sheets:seed
   ```

4. **Validate structure after manual changes:**
   ```bash
   npm run sheets:validate
   ```

## Troubleshooting

### Authentication Issues
- Verify `GOOGLE_SERVICE_ACCOUNT_KEY` is valid JSON
- Ensure service account has access to the Google Sheets document
- Check that Google Sheets API is enabled in Google Cloud Console

### Permission Issues
- Share the Google Sheets document with the service account email
- Ensure service account has "Editor" permissions

### Rate Limiting
- The scripts include automatic retry logic for rate limits
- If you encounter persistent rate limiting, wait a few minutes before retrying

### Data Integrity Issues
- Run `npm run sheets:check` to identify specific problems
- Create a backup before fixing any issues
- Use the restore functionality if data becomes corrupted

## Development

To modify or extend the scripts:

1. **Add new sheet types:** Update `initializeSheetConfigs()` in `SheetsService`
2. **Add new validations:** Extend `validateSheetData()` in `validation.ts`
3. **Add new CLI commands:** Extend the switch statement in `init-sheets.ts`

## Testing

Run the test suite to ensure functionality:

```bash
npm test -- --testPathPattern=sheets.service.test.ts
```

The tests cover all major functionality including CRUD operations, validation, error handling, and data integrity checks.