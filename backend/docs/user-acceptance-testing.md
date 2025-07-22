# User Acceptance Testing Guide

## Introduction

This document provides a structured approach for conducting User Acceptance Testing (UAT) for the Project Invoice Management System. UAT is the final phase of testing where actual users test the system to ensure it meets their requirements and works as expected in real-world scenarios.

## Prerequisites

Before beginning UAT, ensure:

1. The system is deployed to a test environment
2. Test users have been created with appropriate permissions
3. Test data has been loaded (clients, projects, etc.)
4. All testers have access credentials
5. Testers are familiar with the basic functionality of the system

## Test Environment

- **URL**: [Test Environment URL]
- **Admin Credentials**: Provided separately
- **Test User Credentials**: Provided separately
- **Test Client Portal**: [Client Portal URL]

## UAT Process

### 1. Test Preparation

- Schedule UAT sessions with users
- Provide this document to all testers
- Ensure testers have the necessary devices (desktop, mobile)
- Set up a method for recording issues (e.g., shared spreadsheet)

### 2. Test Execution

Testers should:
- Follow the test scenarios in this document
- Record any issues encountered
- Note any usability concerns or suggestions
- Complete all mandatory test scenarios

### 3. Issue Reporting

For each issue, record:
- Test scenario number
- Description of the issue
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots (if applicable)
- Device/browser information

## Test Scenarios

### A. Authentication and Security

#### A1. User Login
1. Navigate to the login page
2. Enter valid credentials
3. Verify successful login and redirect to dashboard
4. **Expected**: User is logged in and dashboard is displayed

#### A2. Password Reset
1. Click "Forgot Password" on login page
2. Enter registered email
3. Check email for reset link
4. Click link and set new password
5. Login with new password
6. **Expected**: Password reset works and login with new password is successful

#### A3. Two-Factor Authentication
1. Enable 2FA in profile settings
2. Scan QR code with authenticator app
3. Enter verification code
4. Logout and login again
5. Verify 2FA prompt appears
6. **Expected**: 2FA is enabled and required for login

### B. Project Management

#### B1. Create New Project
1. Navigate to Projects page
2. Click "New Project"
3. Fill in all required fields
4. Click "Create Project"
5. **Expected**: Project is created and appears in project list

#### B2. Add Tasks to Project
1. Open a project
2. Navigate to Tasks tab
3. Create multiple tasks with different priorities
4. **Expected**: Tasks are created with correct priorities

#### B3. Track Time on Tasks
1. Select a task
2. Click "Start Timer"
3. Wait a few minutes
4. Click "Stop Timer"
5. Add description and save
6. **Expected**: Time entry is recorded with correct duration

#### B4. View Project in Different Views
1. Navigate to project list
2. Try different view options (list, board, calendar)
3. **Expected**: Project information is displayed correctly in all views

### C. Client Management

#### C1. Create New Client
1. Navigate to Clients page
2. Click "New Client"
3. Fill in all fields including GST information
4. Click "Save Client"
5. **Expected**: Client is created with all information saved correctly

#### C2. Client Portal Access
1. From client details, enable client portal
2. Generate access link
3. Open link in incognito/private browser
4. Login as client
5. **Expected**: Client can access their portal with projects and invoices

#### C3. Client Communication
1. Open a client
2. Add a new communication record
3. Verify it appears in communication history
4. **Expected**: Communication is recorded with timestamp

### D. Invoice Management

#### D1. Generate Invoice from Project
1. Open a project with time entries
2. Click "Generate Invoice"
3. Review and adjust if needed
4. Save invoice
5. **Expected**: Invoice is created with correct amounts from time entries

#### D2. GST Calculation
1. Create invoice for Indian client
2. Add line items
3. Verify GST calculations
4. **Expected**: CGST and SGST (or IGST) are calculated correctly

#### D3. Send Invoice
1. Open an invoice
2. Click "Send Invoice"
3. Customize email message
4. Send invoice
5. **Expected**: Invoice is sent and status changes to "Sent"

#### D4. Record Payment
1. Open a sent invoice
2. Click "Record Payment"
3. Enter partial payment details
4. Save payment
5. **Expected**: Invoice status changes to "Partially Paid" with correct remaining amount

### E. Financial Reporting

#### E1. Generate Project Profitability Report
1. Navigate to Reports
2. Select Project Profitability
3. Choose a project
4. Generate report
5. **Expected**: Report shows revenue, expenses, and profit for the project

#### E2. Export Financial Data
1. Generate a financial report
2. Click "Export"
3. Select different formats (PDF, Excel, CSV)
4. **Expected**: Report is exported in selected format with correct data

#### E3. GST Reports
1. Navigate to GST Reports
2. Select a reporting period
3. Generate GSTR1 report
4. **Expected**: Report includes all B2B and B2C invoices with correct GST amounts

### F. Document Management

#### F1. Upload and Share Files
1. Navigate to a project
2. Upload a document
3. Share with client
4. **Expected**: File is uploaded and available to client in portal

#### F2. File Organization
1. Create folders in file manager
2. Move files between folders
3. **Expected**: Files are organized in correct folders

### G. Mobile Responsiveness

#### G1. Mobile Access
1. Access system from mobile device
2. Navigate through key features
3. **Expected**: Interface is usable on mobile with all features accessible

#### G2. PWA Installation
1. On mobile device, add to home screen
2. Launch from home screen icon
3. **Expected**: App launches in full-screen mode without browser UI

### H. System Integration

#### H1. Google Sheets Integration
1. Make changes in the system
2. Check corresponding Google Sheet
3. **Expected**: Data is correctly synchronized with Google Sheets

#### H2. Email Notifications
1. Trigger actions that send emails (invoice, reminder)
2. Check email inbox
3. **Expected**: Emails are received with correct content and formatting

#### H3. Comprehensive System Integration
1. Follow the complete business workflow from client creation to payment
2. Verify all components work together seamlessly
3. Test concurrent operations (multiple users working simultaneously)
4. **Expected**: All system components integrate properly with no data inconsistencies

## UAT Sign-off

After completing all test scenarios, testers should provide:

1. List of any outstanding issues
2. Overall assessment of system usability
3. Recommendations for improvements
4. Formal sign-off if the system meets requirements

## UAT Results Template

```
Tester Name: ____________________
Date: __________________________

Test Scenario | Pass/Fail | Issues/Comments
------------- | --------- | ---------------
A1            |           |
A2            |           |
...           |           |

Overall Assessment:
_______________________________
_______________________________

Recommendations:
_______________________________
_______________________________

Sign-off:
□ I approve the system for production use
□ I approve with reservations (see comments)
□ I do not approve (see issues)

Signature: ____________________
```