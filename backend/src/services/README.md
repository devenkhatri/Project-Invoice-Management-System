# Google Sheets Service

This service provides a comprehensive data access layer for Google Sheets, allowing the application to use Google Sheets as a backend database.

## Features

- **CRUD Operations**: Create, Read, Update, Delete operations for all data types
- **Batch Operations**: Efficient batch create and update operations
- **Query Functionality**: Advanced filtering, sorting, and pagination
- **Aggregation**: Count, sum, average, min, max operations
- **Error Handling**: Comprehensive error handling with retry logic for transient failures
- **Type Safety**: Full TypeScript support with proper type definitions
- **Data Validation**: Built-in validation for all data models

## Setup

### 1. Google Sheets Configuration

1. Create a Google Cloud Project
2. Enable the Google Sheets API
3. Create a Service Account and download the JSON key file
4. Share your Google Sheets document with the service account email
5. Copy the spreadsheet ID from the URL

### 2. Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 3. Initialize Sheets

Run the initialization script to create all required sheets with proper headers:

```bash
# Initialize sheets only
npm run sheets:init

# Initialize sheets with sample data
npm run sheets:seed

# Create a backup of existing data
npm run sheets:backup
```

## Usage

### Basic Usage

```typescript
import { SheetsService } from './services/sheets.service';

// Initialize the service
const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
const sheetsService = new SheetsService(process.env.GOOGLE_SHEETS_ID!, serviceAccountKey);

// Initialize sheets (creates sheets if they don't exist)
await sheetsService.initializeSheets();
```

### CRUD Operations

#### Create Records

```typescript
// Create a single project
const projectId = await sheetsService.create('Projects', {
  name: 'New Project',
  client_id: 'client_123',
  status: 'active',
  budget: 50000,
  description: 'Project description'
});

// Create multiple records at once
const taskIds = await sheetsService.batchCreate('Tasks', [
  { title: 'Task 1', project_id: projectId, status: 'todo' },
  { title: 'Task 2', project_id: projectId, status: 'in-progress' }
]);
```

#### Read Records

```typescript
// Get all projects
const allProjects = await sheetsService.read('Projects');

// Get a specific project by ID
const project = await sheetsService.read('Projects', projectId);

// Query with filters
const activeProjects = await sheetsService.query('Projects', {
  filters: [{ column: 'status', operator: 'eq', value: 'active' }],
  sortBy: 'name',
  sortOrder: 'asc',
  limit: 10
});
```

#### Update Records

```typescript
// Update a project
const success = await sheetsService.update('Projects', projectId, {
  status: 'completed',
  budget: 55000
});
```

#### Delete Records

```typescript
// Delete a project
const deleted = await sheetsService.delete('Projects', projectId);
```

### Query Operations

The service supports advanced querying with filters, sorting, and pagination:

```typescript
const results = await sheetsService.query('Projects', {
  filters: [
    { column: 'status', operator: 'eq', value: 'active' },
    { column: 'budget', operator: 'gte', value: 10000 }
  ],
  sortBy: 'created_at',
  sortOrder: 'desc',
  offset: 0,
  limit: 20
});
```

#### Supported Filter Operators

- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than
- `lt`: Less than
- `gte`: Greater than or equal to
- `lte`: Less than or equal to
- `contains`: Contains substring (case-insensitive)

### Aggregation Operations

```typescript
// Count total projects
const totalProjects = await sheetsService.aggregate('Projects', 'count');

// Sum all project budgets
const totalBudget = await sheetsService.aggregate('Projects', 'sum', 'budget');

// Get average budget
const avgBudget = await sheetsService.aggregate('Projects', 'avg', 'budget');

// Find min/max values
const minBudget = await sheetsService.aggregate('Projects', 'min', 'budget');
const maxBudget = await sheetsService.aggregate('Projects', 'max', 'budget');
```

## Data Models

The service supports the following data models:

### Projects
- `id`: Unique identifier
- `name`: Project name
- `client_id`: Reference to client
- `status`: active | completed | on-hold
- `start_date`: Project start date
- `end_date`: Project deadline
- `budget`: Project budget
- `description`: Project description
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Tasks
- `id`: Unique identifier
- `project_id`: Reference to project
- `title`: Task title
- `description`: Task description
- `status`: todo | in-progress | completed
- `priority`: low | medium | high
- `due_date`: Task deadline
- `estimated_hours`: Estimated time
- `actual_hours`: Actual time spent
- `created_at`: Creation timestamp

### Clients
- `id`: Unique identifier
- `name`: Client name
- `email`: Client email
- `phone`: Client phone
- `address`: Client address
- `gstin`: GST identification number
- `payment_terms`: Payment terms
- `created_at`: Creation timestamp

### Invoices
- `id`: Unique identifier
- `invoice_number`: Invoice number
- `client_id`: Reference to client
- `project_id`: Reference to project
- `amount`: Invoice amount
- `tax_amount`: Tax amount
- `total_amount`: Total amount
- `status`: draft | sent | paid | overdue
- `due_date`: Payment due date
- `created_at`: Creation timestamp

### Time Entries
- `id`: Unique identifier
- `task_id`: Reference to task
- `project_id`: Reference to project
- `hours`: Hours worked
- `description`: Work description
- `date`: Work date
- `created_at`: Creation timestamp

### Expenses
- `id`: Unique identifier
- `project_id`: Reference to project
- `category`: Expense category
- `amount`: Expense amount
- `description`: Expense description
- `date`: Expense date
- `receipt_url`: Receipt file URL

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const result = await sheetsService.create('Projects', projectData);
} catch (error) {
  if (error.retryable) {
    // Handle retryable errors (rate limits, network issues)
    console.log('Retryable error:', error.message);
  } else {
    // Handle non-retryable errors (authentication, validation)
    console.error('Fatal error:', error.message);
  }
}
```

### Error Types

- **Rate Limit Errors (429)**: Automatically retryable
- **Network Errors**: Automatically retryable
- **Authentication Errors (401)**: Not retryable
- **Validation Errors (400)**: Not retryable

## Performance Considerations

- **Batch Operations**: Use `batchCreate()` for multiple records
- **Pagination**: Use `limit` and `offset` for large datasets
- **Caching**: Consider implementing caching for frequently accessed data
- **Rate Limits**: Google Sheets API has rate limits - the service includes automatic retry logic

## Testing

Run the comprehensive test suite:

```bash
npm test -- --testPathPattern=sheets.service.test.ts
```

The tests cover:
- All CRUD operations
- Query functionality
- Aggregation operations
- Error handling scenarios
- Edge cases and validation

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify service account key is valid JSON
   - Ensure the spreadsheet is shared with the service account email

2. **Sheet Not Found Errors**
   - Run the initialization script: `npm run sheets:init`
   - Verify the spreadsheet ID is correct

3. **Rate Limit Errors**
   - The service automatically retries with exponential backoff
   - Consider implementing caching for frequently accessed data

4. **Data Validation Errors**
   - Check that required fields are provided
   - Verify data types match the expected format

### Debug Mode

Enable debug logging by setting the environment variable:

```env
NODE_ENV=development
```

This will log all API calls and errors for troubleshooting.