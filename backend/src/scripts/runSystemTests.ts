/**
 * System Integration Test Runner
 * 
 * This script runs all system integration tests and generates a comprehensive report.
 * It executes:
 * 1. End-to-end tests
 * 2. Requirements validation
 * 3. Data integrity verification
 * 4. GST compliance tests
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { validateRequirements, loadRequirements, generateReport } from './validateRequirements';
import { verifyDataIntegrity, saveReport } from './verifyDataIntegrity';

// Define test result interface
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: any;
}

// Define test report interface
interface TestReport {
  timestamp: string;
  overallStatus: 'passed' | 'failed';
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

// Run Jest tests
async function runJestTests(testPattern: string): Promise<TestResult> {
  return new Promise((resolve) => {
    console.log(`Running tests matching pattern: ${testPattern}`);
    const startTime = Date.now();
    
    const jest = spawn('npx', ['jest', testPattern, '--json', '--testTimeout=30000'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let stdout = '';
    let stderr = '';
    
    jest.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    jest.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    jest.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      try {
        // Parse Jest JSON output
        const jestResult = JSON.parse(stdout);
        const passed = jestResult.success;
        
        resolve({
          name: `Jest Tests: ${testPattern}`,
          passed,
          duration,
          details: {
            numPassedTests: jestResult.numPassedTests,
            numFailedTests: jestResult.numFailedTests,
            numTotalTests: jestResult.numTotalTests,
            testResults: jestResult.testResults.map((result: any) => ({
              name: result.name,
              status: result.status,
              message: result.message
            }))
          }
        });
      } catch (error) {
        console.error('Error parsing Jest output:', error);
        console.error('Jest stdout:', stdout);
        console.error('Jest stderr:', stderr);
        
        resolve({
          name: `Jest Tests: ${testPattern}`,
          passed: false,
          duration,
          details: {
            error: 'Failed to parse Jest output',
            stdout,
            stderr
          }
        });
      }
    });
  });
}

// Run requirements validation
async function runRequirementsValidation(): Promise<TestResult> {
  console.log('Running requirements validation...');
  const startTime = Date.now();
  
  try {
    const requirements = await loadRequirements();
    const validatedRequirements = await validateRequirements(requirements);
    
    // Calculate pass rate
    const totalValidations = validatedRequirements.reduce(
      (sum, req) => sum + req.validationMethods.length, 0
    );
    
    const passedValidations = validatedRequirements.reduce(
      (sum, req) => sum + req.validationResults.filter(result => result.passed).length, 0
    );
    
    const passed = passedValidations === totalValidations;
    
    return {
      name: 'Requirements Validation',
      passed,
      duration: Date.now() - startTime,
      details: {
        totalRequirements: requirements.length,
        totalValidations,
        passedValidations,
        passRate: totalValidations > 0 ? (passedValidations / totalValidations) * 100 : 0
      }
    };
  } catch (error) {
    console.error('Error during requirements validation:', error);
    
    return {
      name: 'Requirements Validation',
      passed: false,
      duration: Date.now() - startTime,
      details: {
        error: (error as Error).message
      }
    };
  }
}

// Run data integrity verification
async function runDataIntegrityVerification(): Promise<TestResult> {
  console.log('Running data integrity verification...');
  const startTime = Date.now();
  
  try {
    const report = await verifyDataIntegrity();
    const passed = report.overallStatus === 'passed';
    
    return {
      name: 'Data Integrity Verification',
      passed,
      duration: Date.now() - startTime,
      details: {
        totalRecords: report.summary.totalRecords,
        validRecords: report.summary.validRecords,
        invalidRecords: report.summary.invalidRecords,
        referentialIntegrityIssues: report.summary.referentialIntegrityIssues,
        formatIssues: report.summary.formatIssues,
        missingRequiredFields: report.summary.missingRequiredFields
      }
    };
  } catch (error) {
    console.error('Error during data integrity verification:', error);
    
    return {
      name: 'Data Integrity Verification',
      passed: false,
      duration: Date.now() - startTime,
      details: {
        error: (error as Error).message
      }
    };
  }
}

// Run GST compliance tests
async function runGstComplianceTests(): Promise<TestResult> {
  console.log('Running GST compliance tests...');
  const startTime = Date.now();
  
  try {
    // Run specific GST compliance tests
    const gstTestResult = await runJestTests('services/__tests__/gstReporting.test.ts');
    const eInvoiceTestResult = await runJestTests('services/__tests__/eInvoicing.test.ts');
    
    const passed = gstTestResult.passed && eInvoiceTestResult.passed;
    
    return {
      name: 'GST Compliance Tests',
      passed,
      duration: Date.now() - startTime,
      details: {
        gstReporting: gstTestResult.details,
        eInvoicing: eInvoiceTestResult.details
      }
    };
  } catch (error) {
    console.error('Error during GST compliance tests:', error);
    
    return {
      name: 'GST Compliance Tests',
      passed: false,
      duration: Date.now() - startTime,
      details: {
        error: (error as Error).message
      }
    };
  }
}

// Generate and save test report
function saveTestReport(report: TestReport): void {
  const reportDir = path.join(process.cwd(), 'reports');
  const reportPath = path.join(reportDir, `system-test-report-${new Date().toISOString().split('T')[0]}.json`);
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Write report to file
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary to console
  console.log('\nSystem Integration Test Report');
  console.log('=============================');
  console.log(`Status: ${report.overallStatus.toUpperCase()}`);
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)} seconds`);
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  // Print test results
  console.log('\nTest Results:');
  report.tests.forEach(test => {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name} (${(test.duration / 1000).toFixed(2)}s)`);
  });
}

// Main function
async function main() {
  const startTime = Date.now();
  console.log('Starting system integration tests...');
  
  const results: TestResult[] = [];
  
  // Run end-to-end tests
  results.push(await runJestTests('__tests__/e2e'));
  
  // Run system integration tests
  results.push(await runJestTests('__tests__/e2e/system-integration.test.ts'));
  
  // Run requirements validation
  results.push(await runRequirementsValidation());
  
  // Run data integrity verification
  results.push(await runDataIntegrityVerification());
  
  // Run GST compliance tests
  results.push(await runGstComplianceTests());
  
  // Generate report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    overallStatus: results.every(r => r.passed) ? 'passed' : 'failed',
    tests: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      duration: Date.now() - startTime
    }
  };
  
  saveTestReport(report);
  
  // Exit with appropriate code
  process.exit(report.overallStatus === 'passed' ? 0 : 1);
}

// Run the tests if executed directly
if (require.main === module) {
  main();
}

export { runJestTests, runRequirementsValidation, runDataIntegrityVerification, runGstComplianceTests };