# Project Invoice Management System User Guide

## Introduction

Welcome to the Project Invoice Management System, a comprehensive solution designed specifically for solopreneurs to manage projects, track time, generate invoices, and handle client relationships efficiently. This system uses Google Sheets as its backend database, providing you with direct access to your data while maintaining a professional web interface.

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Google account for Google Sheets integration

### Accessing the System

1. Navigate to the application URL provided by your administrator
2. Log in using your credentials
3. For first-time login, you'll be guided through a setup process

### Dashboard Overview

The dashboard provides a quick overview of your business:

- **Key Metrics**: Revenue, expenses, outstanding invoices, and profit
- **Recent Activity**: Latest projects, invoices, and client interactions
- **Quick Actions**: Common tasks like creating projects and invoices
- **Upcoming Deadlines**: Projects and tasks due soon

## Project Management

### Creating a New Project

1. Click "New Project" from the dashboard or Projects page
2. Fill in the required fields:
   - Project name
   - Client (select from dropdown or create new)
   - Start date and deadline
   - Budget
   - Description
3. Click "Create Project"

### Managing Tasks

1. Navigate to the project details page
2. Use the Tasks tab to:
   - Create new tasks with priorities and deadlines
   - Organize tasks using the Kanban board
   - View task timeline in the Gantt chart
   - Track time spent on tasks

### Time Tracking

1. From a task, click "Start Timer" to begin tracking time
2. Click "Stop Timer" when finished
3. Add a description of the work performed
4. Alternatively, manually add time entries with the "Add Time" button

## Client Management

### Adding a New Client

1. Navigate to the Clients page
2. Click "New Client"
3. Fill in client details:
   - Name and contact information
   - Billing address
   - GST information (for Indian clients)
   - Payment terms
4. Click "Save Client"

### Client Portal

1. From a client's profile, click "Client Portal Settings"
2. Enable the portal and set access permissions
3. Click "Generate Access Link" to create a unique URL for the client
4. Share the link with your client via email

## Invoice Management

### Creating an Invoice

1. Navigate to the Invoices page
2. Click "New Invoice"
3. Select a client and optionally a project
4. If a project is selected, time entries and expenses can be automatically added
5. Adjust quantities, rates, and descriptions as needed
6. Add any additional items or discounts
7. Click "Save Invoice"

### GST Compliance

For Indian clients, the system automatically:

1. Calculates CGST and SGST (or IGST for inter-state transactions)
2. Adds the appropriate tax rates based on the services provided
3. Generates GST-compliant invoice formats
4. Prepares data for GSTR1 and GSTR3B reports

### Sending Invoices

1. From the invoice details page, click "Send Invoice"
2. Customize the email message
3. Choose to attach the invoice as PDF
4. Click "Send" to deliver the invoice to the client

### Tracking Payments

1. When a payment is received, navigate to the invoice
2. Click "Record Payment"
3. Enter payment details:
   - Amount (full or partial)
   - Payment date
   - Payment method
   - Transaction reference
4. Click "Save Payment"

## Financial Reporting

### Generating Reports

1. Navigate to the Reports page
2. Select a report type:
   - Project Profitability
   - Revenue and Expenses
   - Tax Summary
   - Outstanding Invoices
3. Set the date range
4. Click "Generate Report"

### Exporting Data

1. From any report view, click "Export"
2. Select the format (PDF, Excel, CSV)
3. Click "Download"

## Document Management

### Uploading Files

1. Navigate to a project or client
2. Click the Files tab
3. Click "Upload File"
4. Select the file from your computer
5. Add a description
6. Set visibility (internal or client-visible)
7. Click "Upload"

### Sharing Documents

1. From the Files section, find the file to share
2. Click "Share"
3. Choose sharing options:
   - Share with client
   - Generate public link (password optional)
   - Set expiration date
4. Click "Create Share Link"

## System Settings

### Profile Settings

1. Click your profile icon in the top-right corner
2. Select "Profile Settings"
3. Update your information:
   - Name and contact details
   - Password
   - Notification preferences
   - Two-factor authentication

### Business Settings

1. Navigate to Settings > Business
2. Configure your business details:
   - Company name and logo
   - Address and contact information
   - GST registration details
   - Default payment terms

### Invoice Templates

1. Navigate to Settings > Invoice Templates
2. Select a template to customize
3. Modify colors, fonts, and layout
4. Add your logo and business details
5. Preview the template
6. Click "Save Template"

## Mobile Access

The system is fully responsive and works on mobile devices:

1. Access the same URL from your mobile browser
2. Use the mobile-optimized interface
3. Install as a Progressive Web App (PWA) for app-like experience:
   - On iOS: Share > Add to Home Screen
   - On Android: Menu > Add to Home Screen

## Troubleshooting

### Common Issues

- **Login Problems**: Ensure you're using the correct email and password. Use the "Forgot Password" link if needed.
- **Data Not Showing**: Refresh the page or check your internet connection.
- **Invoice Calculations**: Verify tax rates and item prices are entered correctly.

### Getting Help

- Click the Help icon (?) in the top-right corner
- Check the Knowledge Base for articles and guides
- Contact support through the Help > Contact Support menu

## Data Security

- All data is stored in your Google Sheets account
- Communications are encrypted using HTTPS
- Client portal access is protected by secure authentication
- Two-factor authentication is available for additional security

## Backup and Recovery

- Google Sheets provides version history for all data
- Use Settings > Backup to create manual backups
- Restore from backup using Settings > Restore