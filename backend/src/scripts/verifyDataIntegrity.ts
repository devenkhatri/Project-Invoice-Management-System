/**
 * Data Integrity Verification Script
 * 
 * This script verifies the integrity of data stored in Google Sheets by:
 * 1. Checking for data consistency across related sheets
 * 2. Validating referential integrity
 * 3. Ensuring data format compliance
 * 4. Detecting and reporting anomalies
 */

import { SheetsService } from '../services/googleSheets';
import fs from 'fs';
import path from 'path';

// Define verification result interface
interface VerificationResult {
  sheet: string;
  passed: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  referentialIntegrityIssues: number;
  formatIssues: number;
  missingRequiredFields: number;
  details: Array<{
    rowIndex: number;
    id: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Define overall verification report
interface VerificationReport {
  timestamp: string;
  overallStatus: 'passed' | 'warning' | 'failed';
  sheets: {
    [key: string]: VerificationResult;
  };
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    referentialIntegrityIssues: number;
    formatIssues: number;
    missingRequiredFields: number;
  };
}

// Main verification function
async function verifyDataIntegrity(): Promise<VerificationReport> {
  const sheetsService = new SheetsService();
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    overallStatus: 'passed',
    sheets: {},
    summary: {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      referentialIntegrityIssues: 0,
      formatIssues: 0,
      missingRequiredFields: 0
    }
  };
  
  // Define sheets to verify
  const sheets = [
    'Projects',
    'Tasks',
    'Clients',
    'Invoices',
    'Time_Entries',
    'Expenses'
  ];
  
  // Verify each sheet
  for (const sheet of sheets) {
    console.log(`Verifying ${sheet} sheet...`);
    const result = await verifySheet(sheet, sheetsService);
    report.sheets[sheet] = result;
    
    // Update summary
    report.summary.totalRecords += result.totalRecords;
    report.summary.validRecords += result.validRecords;
    report.summary.invalidRecords += result.invalidRecords;
    report.summary.referentialIntegrityIssues += result.referentialIntegrityIssues;
    report.summary.formatIssues += result.formatIssues;
    report.summary.missingRequiredFields += result.missingRequiredFields;
    
    // Update overall status
    if (result.invalidRecords > 0) {
      const invalidRatio = result.invalidRecords / result.totalRecords;
      if (invalidRatio > 0.05) {
        report.overallStatus = 'failed';
      } else if (report.overallStatus !== 'failed' && invalidRatio > 0) {
        report.overallStatus = 'warning';
      }
    }
  }
  
  // Verify cross-sheet relationships
  console.log('Verifying cross-sheet relationships...');
  const relationshipResults = await verifyRelationships(sheetsService);
  report.sheets['Relationships'] = relationshipResults;
  
  // Update summary with relationship results
  report.summary.referentialIntegrityIssues += relationshipResults.referentialIntegrityIssues;
  if (relationshipResults.referentialIntegrityIssues > 0) {
    report.overallStatus = 'failed';
  }
  
  return report;
}

// Verify a single sheet
async function verifySheet(sheetName: string, sheetsService: SheetsService): Promise<VerificationResult> {
  const result: VerificationResult = {
    sheet: sheetName,
    passed: true,
    totalRecords: 0,
    validRecords: 0,
    invalidRecords: 0,
    referentialIntegrityIssues: 0,
    formatIssues: 0,
    missingRequiredFields: 0,
    details: []
  };
  
  try {
    // Get all records from the sheet
    const records = await sheetsService.read(sheetName);
    result.totalRecords = records.length;
    
    // Define required fields for each sheet
    const requiredFields: { [key: string]: string[] } = {
      Projects: ['id', 'name', 'client_id', 'status'],
      Tasks: ['id', 'project_id', 'title', 'status'],
      Clients: ['id', 'name', 'email'],
      Invoices: ['id', 'invoice_number', 'client_id', 'amount', 'status'],
      Time_Entries: ['id', 'task_id', 'project_id', 'hours', 'date'],
      Expenses: ['id', 'project_id', 'amount', 'category', 'date']
    };
    
    // Define format validations for each sheet
    const formatValidations: { [key: string]: { [field: string]: RegExp } } = {
      Projects: {
        id: /^PRJ-\d+$/,
        status: /^(active|completed|on-hold)$/
      },
      Tasks: {
        id: /^TSK-\d+$/,
        status: /^(todo|in-progress|completed)$/,
        priority: /^(low|medium|high)$/
      },
      Clients: {
        id: /^CLT-\d+$/,
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      },
      Invoices: {
        id: /^INV-\d+$/,
        invoice_number: /^\d{4}-\d{4}$/,
        status: /^(draft|sent|partially_paid|paid|overdue)$/
      },
      Time_Entries: {
        id: /^TM-\d+$/,
        hours: /^\d+(\.\d{1,2})?$/
      },
      Expenses: {
        id: /^EXP-\d+$/
      }
    };
    
    // Check each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      let recordValid = true;
      
      // Check required fields
      if (requiredFields[sheetName]) {
        for (const field of requiredFields[sheetName]) {
          if (!record[field]) {
            result.missingRequiredFields++;
            recordValid = false;
            result.details.push({
              rowIndex: i + 2, // +2 because of header row and 0-indexing
              id: record.id || `Row ${i + 2}`,
              issue: `Missing required field: ${field}`,
              severity: 'high'
            });
          }
        }
      }
      
      // Check format validations
      if (formatValidations[sheetName]) {
        for (const [field, regex] of Object.entries(formatValidations[sheetName])) {
          if (record[field] && !regex.test(record[field])) {
            result.formatIssues++;
            recordValid = false;
            result.details.push({
              rowIndex: i + 2,
              id: record.id || `Row ${i + 2}`,
              issue: `Invalid format for ${field}: ${record[field]}`,
              severity: 'medium'
            });
          }
        }
      }
      
      // Update counters
      if (recordValid) {
        result.validRecords++;
      } else {
        result.invalidRecords++;
        result.passed = false;
      }
    }
  } catch (error) {
    console.error(`Error verifying ${sheetName} sheet:`, error);
    result.passed = false;
    result.details.push({
      rowIndex: 0,
      id: 'SHEET_ERROR',
      issue: `Error accessing sheet: ${(error as Error).message}`,
      severity: 'high'
    });
  }
  
  return result;
}

// Verify relationships between sheets
async function verifyRelationships(sheetsService: SheetsService): Promise<VerificationResult> {
  const result: VerificationResult = {
    sheet: 'Relationships',
    passed: true,
    totalRecords: 0,
    validRecords: 0,
    invalidRecords: 0,
    referentialIntegrityIssues: 0,
    formatIssues: 0,
    missingRequiredFields: 0,
    details: []
  };
  
  try {
    // Define relationships to check
    const relationships = [
      { sheet: 'Projects', field: 'client_id', referencedSheet: 'Clients', referencedField: 'id' },
      { sheet: 'Tasks', field: 'project_id', referencedSheet: 'Projects', referencedField: 'id' },
      { sheet: 'Invoices', field: 'client_id', referencedSheet: 'Clients', referencedField: 'id' },
      { sheet: 'Invoices', field: 'project_id', referencedSheet: 'Projects', referencedField: 'id' },
      { sheet: 'Time_Entries', field: 'project_id', referencedSheet: 'Projects', referencedField: 'id' },
      { sheet: 'Time_Entries', field: 'task_id', referencedSheet: 'Tasks', referencedField: 'id' },
      { sheet: 'Expenses', field: 'project_id', referencedSheet: 'Projects', referencedField: 'id' }
    ];
    
    // Check each relationship
    for (const rel of relationships) {
      console.log(`Checking relationship: ${rel.sheet}.${rel.field} -> ${rel.referencedSheet}.${rel.referencedField}`);
      
      // Get records from both sheets
      const records = await sheetsService.read(rel.sheet);
      const referencedRecords = await sheetsService.read(rel.referencedSheet);
      
      // Create a set of valid referenced IDs
      const validIds = new Set(referencedRecords.map(r => r[rel.referencedField]));
      
      // Check each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        result.totalRecords++;
        
        // Skip if the field is empty (might be optional)
        if (!record[rel.field]) {
          result.validRecords++;
          continue;
        }
        
        // Check if the referenced ID exists
        if (!validIds.has(record[rel.field])) {
          result.referentialIntegrityIssues++;
          result.invalidRecords++;
          result.passed = false;
          result.details.push({
            rowIndex: i + 2,
            id: record.id || `Row ${i + 2}`,
            issue: `Invalid reference: ${rel.sheet}.${rel.field}=${record[rel.field]} does not exist in ${rel.referencedSheet}.${rel.referencedField}`,
            severity: 'high'
          });
        } else {
          result.validRecords++;
        }
      }
    }
  } catch (error) {
    console.error('Error verifying relationships:', error);
    result.passed = false;
    result.details.push({
      rowIndex: 0,
      id: 'RELATIONSHIP_ERROR',
      issue: `Error checking relationships: ${(error as Error).message}`,
      severity: 'high'
    });
  }
  
  return result;
}

// Generate and save report
function saveReport(report: VerificationReport): void {
  const reportDir = path.join(process.cwd(), 'reports');
  const reportPath = path.join(reportDir, `data-integrity-${new Date().toISOString().split('T')[0]}.json`);
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Write report to file
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary to console
  console.log('\nData Integrity Verification Report');
  console.log('==================================');
  console.log(`Status: ${report.overallStatus.toUpperCase()}`);
  console.log(`Total Records: ${report.summary.totalRecords}`);
  console.log(`Valid Records: ${report.summary.validRecords} (${(report.summary.validRecords / report.summary.totalRecords * 100).toFixed(2)}%)`);
  console.log(`Invalid Records: ${report.summary.invalidRecords}`);
  console.log(`Referential Integrity Issues: ${report.summary.referentialIntegrityIssues}`);
  console.log(`Format Issues: ${report.summary.formatIssues}`);
  console.log(`Missing Required Fields: ${report.summary.missingRequiredFields}`);
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  // Print issues by sheet
  console.log('\nIssues by Sheet:');
  for (const [sheetName, result] of Object.entries(report.sheets)) {
    if (result.invalidRecords > 0) {
      console.log(`\n${sheetName}: ${result.invalidRecords} issues`);
      
      // Group issues by type
      const issuesByType: { [key: string]: number } = {};
      result.details.forEach(detail => {
        const issueType = detail.issue.split(':')[0];
        issuesByType[issueType] = (issuesByType[issueType] || 0) + 1;
      });
      
      // Print issue types
      Object.entries(issuesByType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
    }
  }
}

// Main function
async function main() {
  try {
    console.log('Starting data integrity verification...');
    const report = await verifyDataIntegrity();
    saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.overallStatus === 'passed' ? 0 : 1);
  } catch (error) {
    console.error('Error during data integrity verification:', error);
    process.exit(1);
  }
}

// Run the verification if executed directly
if (require.main === module) {
  main();
}

export { verifyDataIntegrity, saveReport };