# Backend API - Project Invoice Management System

This is the backend API server for the Project Invoice Management System, built with Node.js, Express.js, and TypeScript.

## Architecture

The backend follows a modular architecture with:
- **Express.js**: Web framework with comprehensive security middleware
- **TypeScript**: Full type safety with comprehensive data model definitions
- **Google Sheets API**: Robust data persistence with advanced querying capabilities
- **JWT Authentication**: Token-based authentication system (ready for implementation)
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Specialized error handling with retry logic for API operations

## Security Features

### Implemented Security Measures
- **JWT Authentication**: Dual-token system with access and refresh tokens
- **Role-Based Authorization**: Admin and client roles with middleware support
- **Resource-Level Access Control**: Fine-grained permissions for data access
- **Comprehensive Security Middleware**: Full security middleware stack including:
  - **Multi-Tier Rate Limiting**: Different limits for various endpoint types
    - General API: 100 requests per 15 minutes per IP
    - Authentication: 5 attempts per 15 minutes per IP
    - Password Reset: 3 attempts per hour per IP
    - File Upload: 10 uploads per minute per IP
  - **Request Sanitization**: Recursive XSS and injection attack prevention
  - **NoSQL Injection Prevention**: MongoDB injection protection with monitoring
  - **Security Headers**: CSP, XSS protection, frame options, and content type validation
  - **CSRF Protection**: Cross-Site Request Forgery protection with token validation
  - **Security Logging**: Suspicious request pattern detection and monitoring
  - **IP Whitelisting**: Optional IP-based access control
  - **Request Size Limits**: Configurable payload size limits (default: 10MB)
  - **API Key Validation**: External integration security

### Environment Configuration
The server uses environment variables for configuration. Copy `.env.example` to `.env` and configure:

#### Server Configuration
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)
- `FRONTEND_URL`: Allowed CORS origin (default: http://localhost:3000)

#### Google Sheets Configuration
- `GOOGLE_SHEETS_ID`: Your Google Sheets spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_KEY`: Complete service account JSON key for Sheets API authentication

#### JWT Authentication
- `JWT_ACCESS_SECRET`: Secret key for access token signing
- `JWT_REFRESH_SECRET`: Secret key for refresh token signing

#### Payment Gateways (Future Implementation)
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`
- **Razorpay**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

#### Email Configuration
- `EMAIL_SERVICE`: Email service provider (gmail)
- `EMAIL_USER`: Email address for sending notifications
- `EMAIL_PASS`: App password for email authentication

#### GST Compliance (Indian Market)
- `GST_API_BASE_URL`: GST API endpoint
- `GST_API_KEY`: API key for GST services

## Available Scripts

```bash
# Development
npm run dev          # Start development server with auto-restart

# Production
npm run build        # Compile TypeScript to JavaScript
npm start           # Start production server

# Testing
npm test            # Run Jest tests
npm run test:watch  # Run tests in watch mode

# Code Quality
npm run lint        # Check code with ESLint
npm run lint:fix    # Auto-fix ESLint issues

# Google Sheets Management
npm run sheets       # Show available sheet commands
npm run sheets:init  # Initialize Google Sheets with headers
npm run sheets:seed  # Initialize sheets with sample data
npm run sheets:backup # Create backup of existing data
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status, version, and timestamp.

**Response:**
```json
{
  "status": "OK",
  "message": "Project Invoice Management API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### API Information
```
GET /api
```
Returns API information and available endpoints.

**Response:**
```json
{
  "message": "Project Invoice Management API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "auth": "/api/auth",
    "projects": "/api/projects",
    "tasks": "/api/tasks",
    "timeEntries": "/api/time-entries",
    "analytics": "/api/analytics",
    "clients": "/api/clients",
    "clientPortal": "/api/client-portal"
  }
}
```

### Client Management API
The client management system provides comprehensive CRUD operations with enhanced features and improved code organization:

#### Code Organization Improvements
- **Helper Functions**: Utility functions like `calculateAveragePaymentTime` and `logClientActivity` are now standalone functions for better maintainability and testability
- **Modular Structure**: Clear separation of concerns with dedicated helper functions for common operations
- **Type Safety**: Full TypeScript implementation with proper type definitions

#### GET /api/clients
Get all clients with advanced search, filtering, and pagination capabilities.

**Query Parameters:**
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 10)
- `search` (string): Search term for name, email, phone, or contact person
- `country` (string): Filter by country
- `is_active` (boolean): Filter by active status
- `gstin` (string): Filter by GSTIN (partial match)
- `sort_by` (string): Sort field (default: 'created_at')
- `sort_order` (string): Sort order 'asc' or 'desc' (default: 'desc')

**Response includes:**
- Enhanced client data with project counts and financial metrics
- GST compliance status and payment terms
- Outstanding amounts and overdue invoice counts

#### POST /api/clients
Create a new client with comprehensive validation.

**Features:**
- GSTIN and PAN format validation for Indian clients
- Duplicate email detection
- Automatic GST compliance checking
- Activity logging for audit trail

#### GET /api/clients/:id
Get detailed client information with related data.

**Response includes:**
- Complete client profile with validation status
- All associated projects grouped by status
- All invoices with financial summary
- Communication history
- Comprehensive financial metrics including payment success rate

#### Additional Endpoints
- `PUT /api/clients/:id` - Update client with validation and activity logging
- `POST /api/clients/onboard` - Complete onboarding workflow with document management
- `GET /api/clients/:id/activities` - Paginated activity audit trail
- `PUT /api/clients/:id/portal-access` - Portal access management
- `DELETE /api/clients/:id` - Soft delete with dependency validation

#### Helper Functions
The client management system includes utility functions for common operations:
- `calculateAveragePaymentTime(invoices)`: Calculates average payment time from invoice data
- `logClientActivity(clientId, activity, metadata)`: Logs client activities for audit trail

## Error Handling

The server includes comprehensive error handling:
- 404 errors for unknown routes
- 500 errors for server exceptions
- Development vs production error messages
- Rate limiting error responses

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

The server will start on http://localhost:3001 with auto-restart on file changes.

## Testing

The backend uses Jest for testing with comprehensive TypeScript support and proper test configuration. Test files should follow the pattern `*.test.ts` or `*.spec.ts`.

### Test Configuration
- **Jest**: Configured with `ts-jest` preset for TypeScript support
- **Test Environment**: Node.js environment for backend testing
- **Coverage**: Comprehensive coverage reporting with HTML, LCOV, and text formats
- **Setup**: Automated test setup with global configuration

### Running Tests
```bash
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
```

### Test Structure
Tests are organized in `__tests__` directories alongside the source code:
- Model tests: `src/models/__tests__/`
- Service tests: `src/services/__tests__/`
- Utility tests: `src/utils/__tests__/`

## Code Quality

ESLint is configured for TypeScript with recommended rules:
- TypeScript-specific linting rules
- Code style consistency
- Best practices enforcement

```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix linting issues
```

## Authentication & Authorization

The backend implements a comprehensive JWT-based authentication system with role-based access control.

### AuthService Class

The `AuthService` is a singleton class that handles all authentication operations:

#### Token Management
- **Access Tokens**: Short-lived (15 minutes) JWT tokens for API requests
- **Refresh Tokens**: Long-lived (7 days) JWT tokens for token renewal
- **Token Verification**: Validates tokens with issuer and audience claims
- **Token Refresh**: Seamless token renewal using refresh tokens

#### Key Methods
- `generateTokens(user)`: Creates access and refresh token pair
- `verifyAccessToken(token)`: Validates and decodes access tokens
- `verifyRefreshToken(token)`: Validates and decodes refresh tokens
- `refreshAccessToken(refreshToken)`: Issues new tokens using refresh token
- `revokeRefreshToken(refreshToken)`: Revokes refresh token (logout)

### Authentication Middleware

#### `authenticateToken`
Middleware that validates JWT access tokens and attaches user information to the request:
```typescript
// Usage in routes
app.get('/api/protected', authenticateToken, (req, res) => {
  // req.user contains authenticated user info
});
```

#### `authorizeRoles(...roles)`
Middleware that restricts access based on user roles:
```typescript
// Admin only access
app.get('/api/admin', authenticateToken, authorizeRoles('admin'), handler);

// Admin or client access
app.get('/api/data', authenticateToken, authorizeRoles('admin', 'client'), handler);
```

#### `authorizeResourceAccess(resourceType)`
Middleware that enforces resource-level access control:
```typescript
// Clients can only access their own projects
app.get('/api/projects/:id', 
  authenticateToken, 
  authorizeResourceAccess('project'), 
  handler
);
```

### User Roles & Permissions

#### Admin Role
- Full access to all resources and operations
- Can manage all clients, projects, invoices, and system data
- Can perform administrative functions

#### Client Role
- Access limited to their own resources
- Can view and manage their own projects and invoices
- Cannot access other clients' data

### Security Features

- **Token Type Validation**: Ensures access tokens are used for API requests
- **User Status Verification**: Checks if user is still active before granting access
- **Resource Ownership**: Validates client access to specific resources
- **Secure Token Storage**: Uses separate secrets for access and refresh tokens
- **Token Expiration**: Automatic token expiration with refresh capability

## Type System

The backend includes comprehensive TypeScript type definitions in `src/types/index.ts`:

### Core Data Models
All data models are implemented as TypeScript classes with definite assignment assertions for strict null checking and comprehensive validation:

- **User**: `id`, `name`, `email`, `password_hash`, `role`, `is_active`, `email_verified`, authentication fields, timestamps
- **Project**: `id`, `name`, `client_id`, `status`, `start_date`, `end_date`, `budget`, `description`, timestamps
- **Task**: `id`, `project_id`, `title`, `description`, `status`, `priority`, `due_date`, `estimated_hours`, `actual_hours`, timestamps
- **Client**: `id`, `name`, `email`, `phone`, `address`, `gstin`, `payment_terms`, timestamps
- **Invoice**: `id`, `invoice_number`, `client_id`, `project_id`, amounts, tax calculations, `status`, `due_date`, timestamps
- **TimeEntry**: `id`, `task_id`, `project_id`, `hours`, `description`, `date`, timestamps
- **Expense**: `id`, `project_id`, `category`, `amount`, `description`, `date`, `receipt_url`

### Data Model Features
- **Type Safety**: All models use TypeScript definite assignment assertions (`!`) for required properties
- **Validation**: Built-in validation using Joi schemas with comprehensive error handling
- **Business Logic**: Each model includes business logic methods for calculations and status management
- **Serialization**: JSON serialization and deserialization support for API communication
- **GST Compliance**: Built-in support for Indian GST calculations and validation
- **GST Compliance**: Built-in support for Indian GST calculations and validation

### Google Sheets Integration Types
- **SheetConfig**: Sheet structure and header definitions
- **QueryFilter**: Advanced filtering with operators (eq, ne, gt, lt, gte, lte, contains)
- **QueryOptions**: Comprehensive query options with filtering, sorting, and pagination
- **BatchOperation**: Efficient batch operations for bulk data management
- **SheetsError**: Specialized error handling with retry logic

### Data Validation
The `src/utils/validation.ts` module provides:
- Input validation for all data models
- Data sanitization and security measures
- Type conversion utilities for Google Sheets integration
- Query filter validation
- GST number validation for Indian compliance

### Data Model Implementation
All data models use TypeScript definite assignment assertions (`!`) which:
- Ensure strict null checking compliance
- Indicate properties are definitely assigned in the constructor
- Provide better type safety and IDE support
- Enable comprehensive validation through Joi schemas

### TypeScript Improvements
Recent improvements to TypeScript implementation include:
- **Session Type Handling**: Fixed type assertions for session-based CSRF token validation
- **Strict Type Checking**: Enhanced type safety with proper type assertions where needed
- **Middleware Type Safety**: Improved type handling in security middleware for session management

## Google Sheets Service

The `SheetsService` class provides a complete data access layer:
- Full CRUD operations with type safety
- Advanced querying with filters, sorting, and pagination
- Batch operations for efficient data management
- Aggregation functions (count, sum, avg, min, max)
- Comprehensive error handling with retry logic
- Automatic sheet initialization and management

See `src/services/README.md` for detailed service documentation.

## Recent Code Organization Improvements

### Client Management System Enhancements
Recent improvements to the client management system include:
- **Standalone Helper Functions**: Converted private methods to standalone functions for better testability
  - `calculateAveragePaymentTime`: Now a standalone function for calculating payment metrics
  - `logClientActivity`: Standalone function for activity logging with improved error handling
- **Modular Architecture**: Clear separation of concerns with dedicated utility functions
- **Enhanced Maintainability**: Functions can now be easily tested in isolation and reused across modules
- **Type Safety**: Full TypeScript implementation with proper type definitions

These changes improve code maintainability, testability, and follow modern JavaScript/TypeScript best practices for function organization.

## Future Implementation

According to the project specification, the following features will be implemented:
- Authentication and authorization endpoints
- Project management API endpoints
- Client management system
- Invoice generation and management
- Payment processing integration
- Financial reporting and analytics
- Automated workflows and notifications

See `.kiro/specs/project-invoice-management/tasks.md` for the complete implementation roadmap.