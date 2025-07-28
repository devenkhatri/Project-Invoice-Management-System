# Project Invoice Management System

A comprehensive project and invoice management system for solopreneurs, built with React, Node.js, and Google Sheets as the backend database.

## Features

- **Project Management**: Complete project lifecycle management with task tracking, time estimation, and progress monitoring
- **Task Management**: Hierarchical task organization with priority levels, status tracking, and time logging
- **Client Management**: Comprehensive client profiles with GST compliance and payment terms
- **Invoice Generation**: Professional invoice creation with GST calculations and multiple status tracking
- **Time Tracking**: Detailed time entry logging with task and project association
- **Expense Management**: Project-based expense tracking with receipt management
- **Financial Reporting**: Real-time analytics and reporting capabilities
- **Google Sheets Integration**: Robust data storage using Google Sheets API with full CRUD operations
- **GST Compliance**: Built-in support for Indian GST requirements and calculations
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI for components
- React Router for navigation
- Axios for API communication
- Chart.js for data visualization

### Backend
- Node.js with Express.js
- TypeScript for type safety
- Google Sheets API for data storage
- JWT for authentication
- Comprehensive security middleware (Multi-tier rate limiting, CSRF protection, request sanitization, security headers)
- Input validation with express-validator
- Comprehensive testing with Jest

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Google Cloud Platform account
- Google Sheets API access
- Payment gateway accounts (Stripe, PayPal, Razorpay)
- Email service (Gmail, SendGrid, or Mailgun)

### Quick Setup

We provide automated setup scripts to get you started quickly:

#### For macOS/Linux:
```bash
git clone <repository-url>
cd project-invoice-management
chmod +x setup.sh
./setup.sh
```

#### For Windows:
```bash
git clone <repository-url>
cd project-invoice-management
setup.bat
```

### Manual Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd project-invoice-management
```

2. **Install dependencies:**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Documentation (optional)
cd ../docs
npm install
```

3. **Set up environment variables:**
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env with your configuration
```

4. **Configure Google Sheets API:**
   - Create a Google Cloud Project
   - Enable Google Sheets API and Google Drive API
   - Create a service account and download JSON key
   - Create a Google Sheets spreadsheet
   - Share spreadsheet with service account email
   - Update environment variables with credentials

5. **Initialize Google Sheets structure:**
```bash
cd backend
npm run init-sheets
```

6. **Start the development servers:**
```bash
# Backend (terminal 1)
cd backend
npm run dev

# Frontend (terminal 2)
cd frontend
npm start

# Documentation (terminal 3, optional)
cd docs
npm start
```

### Environment Configuration

For detailed environment setup instructions, see:
- **[Environment Setup Guide](ENVIRONMENT_SETUP_GUIDE.md)** - Complete configuration guide
- **[Backend .env.example](backend/.env.example)** - Backend environment template
- **[Frontend .env.example](frontend/.env.example)** - Frontend environment template

### Required Services Setup

#### 1. Google Sheets API
- **Purpose**: Primary data storage backend
- **Setup**: [Google Cloud Console](https://console.cloud.google.com/)
- **Required**: Service account with Sheets and Drive API access

#### 2. Payment Gateways
- **Stripe**: [Dashboard](https://dashboard.stripe.com/) - International payments
- **PayPal**: [Developer Portal](https://developer.paypal.com/) - Global payments
- **Razorpay**: [Dashboard](https://dashboard.razorpay.com/) - Indian payments

#### 3. Email Service
- **Gmail**: App passwords for SMTP
- **SendGrid**: API key for transactional emails
- **Mailgun**: Domain and API key setup

#### 4. GST Compliance (India)
- **GST API**: Government or third-party GST service provider
- **E-Invoice**: GST Suvidha Provider (GSP) credentials

### Verification

After setup, verify your installation:

```bash
# Test backend API
curl http://localhost:5000/api/health

# Test frontend
open http://localhost:3000

# Run test suites
cd backend && npm test
cd frontend && npm test
```

### Development

The backend server will run on http://localhost:5000 by default.
The frontend will be available at http://localhost:3000.

### Building for Production

1. Build the backend:
   ```bash
   cd backend
   npm run build
   ```

2. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

### Testing

Run tests for both frontend and backend:

```bash
# Backend tests
cd backend
npm test

# Watch mode for backend tests
npm run test:watch

# Frontend tests
cd frontend
npm test
```

The backend includes comprehensive test coverage with:
- Model validation and business logic tests
- Service integration tests with Google Sheets API
- Utility function tests
- Error handling and edge case testing

### Code Quality

The backend includes ESLint for code quality:

```bash
cd backend
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix linting issues
```

## Dependencies

### Backend Dependencies
- **express**: Web framework for Node.js
- **googleapis**: Google APIs client library for Sheets integration
- **jsonwebtoken**: JWT token generation and verification
- **cors**: Cross-Origin Resource Sharing middleware
- **dotenv**: Environment variable management
- **helmet**: Security middleware for Express
- **express-rate-limit**: Rate limiting middleware
- **express-mongo-sanitize**: NoSQL injection prevention
- **express-validator**: Input validation and sanitization

### Development Dependencies
- **typescript**: TypeScript compiler and language support
- **nodemon**: Development server with auto-restart
- **jest**: Testing framework with TypeScript support
- **eslint**: Code linting and quality checks

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── server.ts              # Express server setup with security middleware
│   │   ├── test-setup.ts          # Jest test configuration and global setup
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript type definitions for all data models
│   │   ├── models/
│   │   │   ├── *.ts               # Data model classes with definite assignment assertions
│   │   │   └── __tests__/         # Model validation and business logic tests
│   │   ├── middleware/
│   │   │   └── auth.ts            # JWT authentication and authorization middleware
│   │   ├── services/
│   │   │   ├── sheets.service.ts  # Google Sheets API integration service
│   │   │   ├── __tests__/         # Service integration tests
│   │   │   └── README.md          # Service documentation
│   │   ├── utils/
│   │   │   └── validation.ts      # Data validation and sanitization utilities
│   │   ├── validation/
│   │   │   └── schemas.ts         # Joi validation schemas for all models
│   │   └── scripts/
│   │       └── init-sheets.ts     # Google Sheets initialization script
│   ├── package.json               # Backend dependencies and scripts
│   ├── tsconfig.json              # TypeScript configuration
│   ├── jest.config.js             # Jest testing configuration
│   ├── .eslintrc.js              # ESLint configuration
│   └── .env.example              # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Main React component with routing
│   │   ├── index.tsx              # React entry point
│   │   └── services/
│   │       └── api.ts             # API client configuration with interceptors
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── .kiro/
│   └── specs/                     # Project specifications and implementation plan
└── README.md
```

## Data Models

The system uses comprehensive TypeScript interfaces and classes for type safety and data validation:

### Core Data Models
All data models are implemented as TypeScript classes with definite assignment assertions for strict null checking and comprehensive validation:

- **User**: User authentication and authorization with role-based access control
- **Project**: Complete project information with client association, status tracking, budget management, and timeline
- **Task**: Hierarchical task management with priority levels, status tracking, time estimation, and project association
- **Client**: Comprehensive client profiles with contact information, GST compliance, and payment terms
- **Invoice**: Professional invoice management with line items, tax calculations, status tracking, and payment integration
- **TimeEntry**: Detailed time tracking with task and project association for accurate billing
- **Expense**: Project-based expense tracking with categorization and receipt management

### Data Model Features
- **Type Safety**: All models use TypeScript definite assignment assertions (`!`) for required properties
- **Validation**: Built-in validation using Joi schemas with comprehensive error handling
- **Business Logic**: Each model includes business logic methods for calculations and status management
- **Serialization**: JSON serialization and deserialization support for API communication
- **GST Compliance**: Built-in support for Indian GST calculations and validation

### Authentication Types
- **TokenPayload**: JWT token structure with user information and token type
- **AuthTokens**: Access and refresh token pair for authentication

### Google Sheets Integration Types
- **SheetConfig**: Sheet structure and header definitions
- **QueryFilter**: Advanced filtering with operators (eq, ne, gt, lt, gte, lte, contains)
- **QueryOptions**: Comprehensive query options with filtering, sorting, and pagination
- **BatchOperation**: Efficient batch operations for bulk data management
- **SheetsError**: Specialized error handling with retry logic

## API Endpoints

### Core Endpoints
- `GET /health` - Health check endpoint with system status
- `GET /api` - API information and available endpoints

### Authentication Endpoints
- `POST /api/auth/login` - User login with email and password
- `POST /api/auth/refresh` - Refresh access token using refresh token
- `POST /api/auth/logout` - Logout and revoke refresh token
- `GET /api/auth/me` - Get current user information

### Client Management Endpoints
- `GET /api/clients` - Get all clients with search, filtering, and pagination
  - Query parameters: `page`, `limit`, `search`, `country`, `is_active`, `gstin`, `sort_by`, `sort_order`
  - Returns enhanced client data with project counts, financial metrics, and GST compliance status
- `POST /api/clients` - Create a new client with GST validation (Admin only)
  - Validates GSTIN and PAN formats for Indian clients
  - Checks for duplicate email addresses
- `GET /api/clients/:id` - Get a single client with comprehensive project and invoice data
  - Includes financial summary, payment metrics, and communication history
  - Calculates average payment time and outstanding amounts
- `PUT /api/clients/:id` - Update client information (Admin only)
  - Validates GST and PAN changes
  - Logs activity for audit trail
- `POST /api/clients/onboard` - Complete client onboarding workflow (Admin only)
  - Creates client with document collection
  - Optional portal access setup
  - Returns next steps for client management
- `GET /api/clients/:id/activities` - Get paginated client activity audit trail
  - Tracks all client-related activities and changes
- `PUT /api/clients/:id/portal-access` - Enable/disable client portal access (Admin only)
  - Manages portal credentials and access permissions
- `DELETE /api/clients/:id` - Soft delete a client with dependency validation (Admin only)
  - Prevents deletion if active projects or unpaid invoices exist
  - Performs soft delete by deactivating the client

**Note**: Non-GET requests require CSRF protection. Include the `x-csrf-token` header for POST, PUT, DELETE requests (except authentication endpoints).

### Security Features
- **JWT Authentication**: Dual-token system with access tokens (15 minutes) and refresh tokens (7 days)
- **Role-Based Authorization**: Admin and client roles with resource-level access control
- **Multi-Tier Rate Limiting**: Comprehensive rate limiting with different limits for various endpoints
  - General API: 100 requests per 15 minutes
  - Authentication: 5 attempts per 15 minutes
  - Password Reset: 3 attempts per hour
  - File Upload: 10 uploads per minute
- **Request Sanitization**: XSS and injection attack prevention with recursive object sanitization
- **NoSQL Injection Prevention**: MongoDB injection protection with monitoring and logging
- **Security Headers**: Comprehensive HTTP security headers including CSP, XSS protection, and frame options
- **CSRF Protection**: Cross-Site Request Forgery protection with token validation
- **Security Monitoring**: Suspicious request pattern detection and comprehensive logging
- **IP Whitelisting**: Optional IP-based access control for enhanced security
- **Request Size Limits**: Configurable payload size limits (default: 10MB)
- **API Key Validation**: External integration security with API key validation

### Authentication System
The system implements a comprehensive JWT-based authentication with:
- **Access Tokens**: Short-lived (15 minutes) for API requests
- **Refresh Tokens**: Long-lived (7 days) for token renewal
- **Role-Based Access**: Admin users have full access, clients can only access their own resources
- **Resource Authorization**: Fine-grained access control for projects, invoices, and client data

More endpoints will be added as development progresses according to the implementation plan.

## Documentation

- **Backend API**: See `backend/README.md` for detailed backend documentation
- **Specifications**: See `.kiro/specs/` directory for requirements, design, and implementation tasks

## Recent Updates

### Client Management System Implementation
The backend now includes a comprehensive client management system with:
- **Complete CRUD Operations**: Full client lifecycle management with validation
- **GST Compliance**: Built-in GSTIN and PAN validation for Indian clients
- **Financial Metrics**: Automatic calculation of payment metrics and outstanding amounts
- **Activity Audit Trail**: Complete tracking of all client-related activities
- **Portal Access Management**: Client portal access control with credential management
- **Dependency Validation**: Smart deletion prevention for clients with active projects
- **Enhanced Search & Filtering**: Advanced search capabilities with pagination
- **Code Organization**: Improved helper function structure for better maintainability

### Code Organization Improvements
Recent improvements to the client management system include:
- **Standalone Helper Functions**: Converted private methods to standalone functions for better testability
  - `calculateAveragePaymentTime`: Now a standalone function for calculating payment metrics
  - `logClientActivity`: Standalone function for activity logging with improved error handling
- **Modular Architecture**: Clear separation of concerns with dedicated utility functions
- **Enhanced Maintainability**: Functions can now be easily tested in isolation and reused across modules
- **Type Safety**: Full TypeScript implementation with proper type definitions

These changes improve code maintainability, testability, and follow modern JavaScript/TypeScript best practices for function organization.

### Authentication System Implementation
The backend now includes a comprehensive JWT-based authentication system with:
- **AuthService**: Singleton service for token management and user verification
- **Authentication Middleware**: `authenticateToken` for validating JWT access tokens
- **Authorization Middleware**: `authorizeRoles` for role-based access control
- **Resource Access Control**: `authorizeResourceAccess` for fine-grained permissions
- **Token Management**: Dual-token system with automatic refresh capability
- **User Model**: Complete user management with role-based permissions

The frontend API service has been updated to handle automatic token refresh and authentication headers.

## Contributing

This project follows the spec-driven development methodology. See the `.kiro/specs/` directory for detailed requirements, design, and implementation tasks.

## License

MIT License