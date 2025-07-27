# API Reference

## Overview

The Project & Invoice Management System provides a comprehensive REST API that allows developers to integrate with the system programmatically. This API enables you to manage projects, clients, invoices, and all other system functionality.

## Base URL

```
https://api.projectinvoice.com/v1
```

## Authentication

All API requests require authentication using JWT tokens.

### Getting an API Token

1. Log in to your account
2. Go to **Settings** → **API Access**
3. Click **Generate API Token**
4. Copy and securely store your token

### Using the Token

Include the token in the Authorization header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Token Refresh

Tokens expire after 24 hours. Use the refresh endpoint to get a new token:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

## Rate Limiting

API requests are limited to:
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated requests

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Pagination

List endpoints support pagination using cursor-based pagination:

### Request Parameters
- `limit`: Number of items per page (default: 20, max: 100)
- `cursor`: Pagination cursor from previous response

### Response Format
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "hasNext": true,
      "nextCursor": "eyJpZCI6MTIzfQ==",
      "limit": 20,
      "total": 150
    }
  }
}
```

## Filtering and Sorting

### Filtering
Use query parameters to filter results:
```http
GET /projects?status=active&client_id=123
```

### Sorting
Use the `sort` parameter:
```http
GET /projects?sort=created_at:desc,name:asc
```

## Webhooks

Configure webhooks to receive real-time notifications about events in your system.

### Supported Events
- `project.created`
- `project.updated`
- `project.completed`
- `invoice.created`
- `invoice.sent`
- `invoice.paid`
- `payment.received`
- `client.created`

### Webhook Configuration

```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks",
  "events": ["invoice.paid", "payment.received"],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload
```json
{
  "event": "invoice.paid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "invoice_id": "inv_123",
    "amount": 5000,
    "currency": "INR"
  },
  "signature": "sha256=..."
}
```

## API Endpoints

### Authentication

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer YOUR_JWT_TOKEN
```

### Projects

#### List Projects
```http
GET /projects
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `status`: Filter by status (active, completed, on-hold)
- `client_id`: Filter by client
- `limit`: Number of results (default: 20)
- `cursor`: Pagination cursor

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "proj_123",
        "name": "Website Redesign",
        "description": "Complete website overhaul",
        "status": "active",
        "client_id": "client_456",
        "budget": 50000,
        "currency": "INR",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "hasNext": true,
      "nextCursor": "eyJpZCI6MTIzfQ==",
      "limit": 20,
      "total": 45
    }
  }
}
```

#### Create Project
```http
POST /projects
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "New Project",
  "description": "Project description",
  "client_id": "client_456",
  "budget": 25000,
  "currency": "INR",
  "start_date": "2024-02-01",
  "end_date": "2024-04-30",
  "status": "active"
}
```

#### Get Project
```http
GET /projects/{project_id}
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Update Project
```http
PUT /projects/{project_id}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Updated Project Name",
  "status": "completed"
}
```

#### Delete Project
```http
DELETE /projects/{project_id}
Authorization: Bearer YOUR_JWT_TOKEN
```

### Tasks

#### List Project Tasks
```http
GET /projects/{project_id}/tasks
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create Task
```http
POST /projects/{project_id}/tasks
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Design Homepage",
  "description": "Create homepage mockups",
  "priority": "high",
  "status": "todo",
  "due_date": "2024-02-15",
  "estimated_hours": 8
}
```

#### Update Task
```http
PUT /tasks/{task_id}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "status": "completed",
  "actual_hours": 6
}
```

### Time Entries

#### List Time Entries
```http
GET /time-entries
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `project_id`: Filter by project
- `task_id`: Filter by task
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)

#### Create Time Entry
```http
POST /time-entries
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "project_id": "proj_123",
  "task_id": "task_456",
  "hours": 4.5,
  "description": "Worked on homepage design",
  "date": "2024-01-15",
  "billable": true
}
```

### Clients

#### List Clients
```http
GET /clients
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create Client
```http
POST /clients
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+91-9876543210",
  "address": {
    "street": "123 Business Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "India"
  },
  "gstin": "27ABCDE1234F1Z5",
  "payment_terms": "net_30"
}
```

#### Get Client
```http
GET /clients/{client_id}
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Update Client
```http
PUT /clients/{client_id}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "newemail@acme.com",
  "phone": "+91-9876543211"
}
```

### Invoices

#### List Invoices
```http
GET /invoices
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `status`: Filter by status (draft, sent, paid, overdue)
- `client_id`: Filter by client
- `start_date`: Filter from date
- `end_date`: Filter to date

#### Create Invoice
```http
POST /invoices
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "client_id": "client_456",
  "project_id": "proj_123",
  "invoice_number": "INV-2024-001",
  "issue_date": "2024-01-15",
  "due_date": "2024-02-14",
  "currency": "INR",
  "line_items": [
    {
      "description": "Web Development Services",
      "quantity": 40,
      "rate": 1500,
      "amount": 60000,
      "hsn_code": "998314",
      "tax_rate": 18
    }
  ],
  "tax_details": {
    "cgst": 5400,
    "sgst": 5400,
    "total_tax": 10800
  },
  "subtotal": 60000,
  "total_amount": 70800,
  "notes": "Payment due within 30 days"
}
```

#### Generate Invoice from Project
```http
POST /invoices/generate-from-project
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "project_id": "proj_123",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "include_time_entries": true,
  "include_expenses": true,
  "template_id": "template_professional"
}
```

#### Send Invoice
```http
POST /invoices/{invoice_id}/send
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "client@example.com",
  "subject": "Invoice INV-2024-001",
  "message": "Please find attached your invoice.",
  "send_copy_to_self": true
}
```

#### Record Payment
```http
POST /invoices/{invoice_id}/payments
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "amount": 70800,
  "payment_date": "2024-01-20",
  "payment_method": "bank_transfer",
  "reference_number": "TXN123456",
  "notes": "Payment received via NEFT"
}
```

### Expenses

#### List Expenses
```http
GET /expenses
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create Expense
```http
POST /expenses
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "project_id": "proj_123",
  "category": "software",
  "amount": 2500,
  "currency": "INR",
  "description": "Adobe Creative Suite subscription",
  "date": "2024-01-15",
  "receipt_url": "https://example.com/receipt.pdf",
  "billable": true
}
```

### Reports

#### Financial Summary
```http
GET /reports/financial-summary
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `start_date`: Report start date (YYYY-MM-DD)
- `end_date`: Report end date (YYYY-MM-DD)
- `project_id`: Filter by project
- `client_id`: Filter by client

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "revenue": {
      "total": 150000,
      "invoiced": 120000,
      "received": 100000,
      "outstanding": 20000
    },
    "expenses": {
      "total": 25000,
      "billable": 15000,
      "non_billable": 10000
    },
    "profit": {
      "gross": 125000,
      "net": 75000,
      "margin": 60.0
    },
    "by_project": [
      {
        "project_id": "proj_123",
        "project_name": "Website Redesign",
        "revenue": 70800,
        "expenses": 5000,
        "profit": 65800,
        "margin": 92.9
      }
    ]
  }
}
```

#### GST Reports

##### GSTR-1 Report
```http
GET /reports/gst/gstr1
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `month`: Report month (1-12)
- `year`: Report year (YYYY)
- `format`: Response format (json, excel)

##### GSTR-3B Report
```http
GET /reports/gst/gstr3b
Authorization: Bearer YOUR_JWT_TOKEN
```

### Files

#### Upload File
```http
POST /files
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

file: [binary data]
project_id: proj_123
description: Project proposal document
```

#### List Files
```http
GET /files
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `project_id`: Filter by project
- `file_type`: Filter by type (document, image, spreadsheet)

#### Download File
```http
GET /files/{file_id}/download
Authorization: Bearer YOUR_JWT_TOKEN
```

### Settings

#### Get Business Settings
```http
GET /settings/business
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Update Business Settings
```http
PUT /settings/business
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "company_name": "My Business",
  "email": "business@example.com",
  "phone": "+91-9876543210",
  "address": {
    "street": "123 Business Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "India"
  },
  "gstin": "27ABCDE1234F1Z5",
  "currency": "INR",
  "timezone": "Asia/Kolkata"
}
```

## SDKs and Libraries

### JavaScript/Node.js
```bash
npm install @projectinvoice/api-client
```

```javascript
const ProjectInvoiceAPI = require('@projectinvoice/api-client');

const client = new ProjectInvoiceAPI({
  apiKey: 'your_api_key',
  baseURL: 'https://api.projectinvoice.com/v1'
});

// List projects
const projects = await client.projects.list();

// Create invoice
const invoice = await client.invoices.create({
  client_id: 'client_123',
  line_items: [...]
});
```

### Python
```bash
pip install projectinvoice-api
```

```python
from projectinvoice import ProjectInvoiceAPI

client = ProjectInvoiceAPI(api_key='your_api_key')

# List projects
projects = client.projects.list()

# Create invoice
invoice = client.invoices.create(
    client_id='client_123',
    line_items=[...]
)
```

### PHP
```bash
composer require projectinvoice/api-client
```

```php
use ProjectInvoice\ApiClient;

$client = new ApiClient('your_api_key');

// List projects
$projects = $client->projects()->list();

// Create invoice
$invoice = $client->invoices()->create([
    'client_id' => 'client_123',
    'line_items' => [...]
]);
```

## Testing

### Sandbox Environment

Use the sandbox environment for testing:
```
https://sandbox-api.projectinvoice.com/v1
```

### Test Data

The sandbox includes sample data:
- Test clients
- Sample projects
- Mock invoices
- Dummy payment transactions

### API Testing Tools

#### Postman Collection
Import our Postman collection for easy API testing:
[Download Collection](https://api.projectinvoice.com/postman-collection.json)

#### OpenAPI Specification
Access our OpenAPI spec for automated testing:
[OpenAPI Spec](https://api.projectinvoice.com/openapi.json)

## Best Practices

### Error Handling
Always handle API errors gracefully:

```javascript
try {
  const project = await client.projects.create(projectData);
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
    console.log('Validation failed:', error.details);
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limiting
    setTimeout(() => retryRequest(), error.retryAfter * 1000);
  } else {
    // Handle other errors
    console.error('API Error:', error.message);
  }
}
```

### Pagination
Handle pagination properly for large datasets:

```javascript
let allProjects = [];
let cursor = null;

do {
  const response = await client.projects.list({ cursor, limit: 100 });
  allProjects = allProjects.concat(response.data.items);
  cursor = response.data.pagination.nextCursor;
} while (response.data.pagination.hasNext);
```

### Webhooks Security
Verify webhook signatures:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}
```

### Rate Limiting
Implement exponential backoff for rate limits:

```javascript
async function makeRequestWithRetry(requestFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

## Support

### Documentation
- [API Reference](https://docs.projectinvoice.com/api)
- [Tutorials](https://docs.projectinvoice.com/tutorials)
- [FAQ](https://docs.projectinvoice.com/faq)

### Community
- [Developer Forum](https://community.projectinvoice.com)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/projectinvoice-api)
- [GitHub Issues](https://github.com/projectinvoice/api-issues)

### Direct Support
- Email: api-support@projectinvoice.com
- Response time: 24-48 hours
- Priority support available for enterprise customers

---

*API Version: 1.0 | Last Updated: January 2024*