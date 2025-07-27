# Getting Started

Welcome to the Project & Invoice Management System! This comprehensive guide will help you set up and start using the system to manage your projects, track time, generate invoices, and handle client relationships.

## Overview

The Project & Invoice Management System is designed specifically for solopreneurs who need a streamlined solution to:

- Manage projects and tasks
- Track time and expenses
- Generate GST-compliant invoices
- Process payments
- Maintain client relationships
- Generate financial reports

## System Requirements

### Minimum Requirements
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Internet connection for Google Sheets integration
- Google account for data storage

### Recommended Setup
- Desktop or laptop computer for optimal experience
- Mobile device for on-the-go access
- Stable internet connection (minimum 1 Mbps)

## Quick Setup Guide

### Step 1: Google Sheets Setup

1. **Create a Google Account** (if you don't have one)
   - Go to [accounts.google.com](https://accounts.google.com)
   - Follow the registration process

2. **Enable Google Sheets API**
   - Visit [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable Google Sheets API and Google Drive API
   - Create service account credentials

3. **Download Credentials**
   - Download the service account JSON file
   - Keep this file secure - it provides access to your data

### Step 2: System Installation

#### Option A: Cloud Deployment (Recommended)
```bash
# Clone the repository
git clone https://github.com/your-org/project-invoice-management.git
cd project-invoice-management

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Google Sheets credentials

# Deploy to cloud platform
npm run deploy
```

#### Option B: Local Development
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Start development servers
npm run dev
```

### Step 3: Initial Configuration

1. **Access the Application**
   - Open your web browser
   - Navigate to your deployed URL or `http://localhost:3000`

2. **Complete Setup Wizard**
   - Upload your Google Sheets credentials
   - Configure business information
   - Set up GST details (for Indian users)
   - Create your first project

3. **Verify Installation**
   - Check that Google Sheets integration is working
   - Create a test project and task
   - Generate a sample invoice

## First Steps

### 1. Set Up Your Business Profile

Navigate to **Settings > Business Profile** and configure:

- **Business Name**: Your company or personal brand name
- **Address**: Complete business address
- **Contact Information**: Phone, email, website
- **GST Details**: GSTIN, state, business type (for Indian users)
- **Bank Details**: For invoice payment instructions

### 2. Create Your First Client

Go to **Clients > Add New Client**:

```markdown
**Required Information:**
- Client Name
- Email Address
- Phone Number
- Business Address

**Optional Information:**
- GSTIN (for Indian clients)
- Payment Terms
- Notes and Tags
```

### 3. Create Your First Project

Navigate to **Projects > Create New Project**:

1. **Basic Information**
   - Project Name
   - Client Selection
   - Project Description
   - Estimated Budget

2. **Timeline**
   - Start Date
   - Deadline
   - Milestones (optional)

3. **Settings**
   - Billing Rate
   - Currency
   - Project Status

### 4. Add Tasks and Track Time

Within your project:

1. **Create Tasks**
   - Click "Add Task"
   - Set priority and due date
   - Assign estimated hours

2. **Track Time**
   - Use the built-in timer
   - Or add manual time entries
   - Categorize as billable/non-billable

### 5. Generate Your First Invoice

When ready to bill:

1. **Go to Invoices > Create New**
2. **Select Project or Manual Entry**
3. **Review Line Items**
4. **Configure Tax Settings**
5. **Preview and Send**

## Key Features Overview

### Project Management
- **Kanban Board**: Visual task management
- **Gantt Chart**: Timeline and dependency tracking
- **Time Tracking**: Built-in timer and manual entries
- **File Management**: Document storage and sharing

### Invoice Management
- **GST Compliance**: Automatic tax calculations
- **Multiple Templates**: Professional invoice designs
- **Recurring Invoices**: Automated billing cycles
- **Payment Integration**: Stripe, PayPal, Razorpay

### Client Portal
- **Secure Access**: Token-based authentication
- **Project Visibility**: Real-time progress updates
- **Document Sharing**: Secure file access
- **Communication**: Built-in messaging

### Financial Reporting
- **Profit/Loss Analysis**: Per project and overall
- **Expense Tracking**: Categorized business expenses
- **Tax Reports**: GST-compliant reporting
- **Export Options**: PDF, Excel, CSV

## Mobile Access

The system is fully responsive and includes:

- **Progressive Web App (PWA)**: Install on mobile devices
- **Offline Capability**: Work without internet connection
- **Touch Optimized**: Mobile-friendly interface
- **Push Notifications**: Important updates and reminders

## Getting Help

### Documentation
- **User Guide**: Detailed feature explanations
- **API Reference**: For developers and integrations
- **Video Tutorials**: Step-by-step walkthroughs
- **FAQ**: Common questions and solutions

### Support Channels
- **Email Support**: support@yourcompany.com
- **Community Forum**: Connect with other users
- **Live Chat**: Available during business hours
- **Knowledge Base**: Searchable help articles

## Next Steps

Now that you have the basics set up:

1. **Explore the User Guide** for detailed feature explanations
2. **Watch Video Tutorials** for visual learning
3. **Join the Community** to connect with other users
4. **Set Up Integrations** with your existing tools

Ready to dive deeper? Check out our [User Guide](./user-guide/overview.md) for comprehensive feature documentation.