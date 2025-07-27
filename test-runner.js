#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 Starting Comprehensive Quality Assurance Testing...\n');

// Enhanced test results tracking
const testResults = {
  backend: { passed: 0, failed: 0, total: 0, duration: 0, coverage: 0 },
  frontend: { passed: 0, failed: 0, total: 0, duration: 0, coverage: 0 },
  e2e: { passed: 0, failed: 0, total: 0, duration: 0 },
  security: { passed: 0, failed: 0, total: 0, duration: 0 },
  performance: { passed: 0, failed: 0, total: 0, duration: 0 },
  accessibility: { passed: 0, failed: 0, total: 0, duration: 0 },
  overall: { passed: 0, failed: 0, total: 0, duration: 0 }
};

const startTime = Date.now();

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function runCommand(command, cwd = process.cwd(), timeout = 300000) {
  const commandStart = Date.now();
  try {
    console.log(`📋 Running: ${command}`);
    const result = execSync(command, { 
      cwd, 
      stdio: 'pipe',
      encoding: 'utf8',
      timeout
    });
    const duration = Date.now() - commandStart;
    console.log(`✅ Success (${formatDuration(duration)})\n`);
    return { success: true, output: result, duration };
  } catch (error) {
    const duration = Date.now() - commandStart;
    console.log(`❌ Failed (${formatDuration(duration)})\n`);
    console.error(error.stdout || error.message);
    return { success: false, output: error.stdout || error.message, duration };
  }
}

async function runCommandAsync(command, cwd = process.cwd(), timeout = 300000) {
  return new Promise((resolve) => {
    const commandStart = Date.now();
    console.log(`📋 Running: ${command}`);
    
    const child = spawn('sh', ['-c', command], {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - commandStart;
      const success = code === 0;
      
      if (success) {
        console.log(`✅ Success (${formatDuration(duration)})\n`);
      } else {
        console.log(`❌ Failed (${formatDuration(duration)})\n`);
        console.error(stderr || stdout);
      }
      
      resolve({
        success,
        output: stdout,
        error: stderr,
        duration
      });
    });
    
    child.on('error', (error) => {
      const duration = Date.now() - commandStart;
      console.log(`❌ Command failed (${formatDuration(duration)}): ${error.message}\n`);
      resolve({
        success: false,
        output: '',
        error: error.message,
        duration
      });
    });
  });
}

function updateTestResults(category, success, duration = 0, coverage = 0) {
  testResults[category].total++;
  testResults[category].duration += duration;
  if (coverage > 0) {
    testResults[category].coverage = coverage;
  }
  
  if (success) {
    testResults[category].passed++;
    testResults.overall.passed++;
  } else {
    testResults[category].failed++;
    testResults.overall.failed++;
  }
  testResults.overall.total++;
  testResults.overall.duration += duration;
}

function extractCoverage(output) {
  try {
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    return coverageMatch ? parseFloat(coverageMatch[1]) : 0;
  } catch (e) {
    return 0;
  }
}

async function runComprehensiveTests() {
  // 1. Backend Unit Tests with Coverage
  console.log('🔧 Running Backend Unit Tests with Coverage...');
  const backendCoverageResult = runCommand('npm run test:coverage', 'backend', 180000);
  const backendCoverage = extractCoverage(backendCoverageResult.output);
  updateTestResults('backend', backendCoverageResult.success, backendCoverageResult.duration, backendCoverage);

  // 2. Frontend Unit Tests with Coverage
  console.log('🎨 Running Frontend Unit Tests with Coverage...');
  const frontendCoverageResult = runCommand('npm run test:coverage', 'frontend', 180000);
  const frontendCoverage = extractCoverage(frontendCoverageResult.output);
  updateTestResults('frontend', frontendCoverageResult.success, frontendCoverageResult.duration, frontendCoverage);

  // 3. Security Tests
  console.log('🔒 Running Security Tests...');
  const securityTests = [
    'npm audit --audit-level=moderate',
    'npm test -- --testPathPattern="security" --passWithNoTests'
  ];
  
  for (const test of securityTests) {
    const result = runCommand(test, 'backend', 120000);
    updateTestResults('security', result.success, result.duration);
  }

  // 4. Performance Tests
  console.log('⚡ Running Performance Tests...');
  const performanceResult = runCommand('npm test -- --testPathPattern="performance" --passWithNoTests', 'backend', 300000);
  updateTestResults('performance', performanceResult.success, performanceResult.duration);

  // 5. Accessibility Tests
  console.log('♿ Running Accessibility Tests...');
  if (fs.existsSync('frontend/src/__tests__/accessibility')) {
    const a11yResult = runCommand('npm run test:a11y', 'frontend', 120000);
    updateTestResults('accessibility', a11yResult.success, a11yResult.duration);
  } else {
    console.log('⚠️ Accessibility tests not found, skipping...');
  }

  // 6. GST Compliance Tests
  console.log('🏛️ Running GST Compliance Tests...');
  const gstResult = runCommand('npm test -- --testPathPattern="gst-compliance" --passWithNoTests', 'backend', 120000);
  updateTestResults('backend', gstResult.success, gstResult.duration);

  // 7. Build Tests
  console.log('🏗️ Running Build Tests...');
  const backendBuild = runCommand('npm run build', 'backend', 120000);
  updateTestResults('backend', backendBuild.success, backendBuild.duration);

  const frontendBuild = runCommand('npm run build', 'frontend', 180000);
  updateTestResults('frontend', frontendBuild.success, frontendBuild.duration);

  // 8. Linting and Code Quality
  console.log('🧹 Running Code Quality Checks...');
  const backendLint = runCommand('npm run lint', 'backend', 60000);
  updateTestResults('backend', backendLint.success, backendLint.duration);

  const frontendLint = runCommand('npm run lint', 'frontend', 60000);
  updateTestResults('frontend', frontendLint.success, frontendLint.duration);

  // 9. Type Checking
  console.log('🔍 Running Type Checking...');
  const backendTypeCheck = runCommand('npx tsc --noEmit', 'backend', 60000);
  updateTestResults('backend', backendTypeCheck.success, backendTypeCheck.duration);

  const frontendTypeCheck = runCommand('npx tsc --noEmit', 'frontend', 60000);
  updateTestResults('frontend', frontendTypeCheck.success, frontendTypeCheck.duration);

  // 10. E2E Tests
  console.log('🌐 Running End-to-End Tests...');
  if (fs.existsSync('cypress/e2e')) {
    const e2eTests = [
      'npx cypress run --spec "cypress/e2e/complete-workflow.cy.ts" --headless',
      'npx cypress run --spec "cypress/e2e/gst-compliance-workflow.cy.ts" --headless',
      'npx cypress run --spec "cypress/e2e/requirements-validation.cy.ts" --headless'
    ];
    
    for (const test of e2eTests) {
      const result = await runCommandAsync(test, '.', 600000);
      updateTestResults('e2e', result.success, result.duration);
    }
  } else {
    console.log('⚠️ Cypress E2E tests not found, skipping...');
  }

  // 11. Cross-browser Tests (if Playwright is available)
  console.log('🌍 Running Cross-browser Tests...');
  if (fs.existsSync('frontend/playwright.config.ts')) {
    const playwrightResult = await runCommandAsync('npx playwright test', 'frontend', 600000);
    updateTestResults('e2e', playwrightResult.success, playwrightResult.duration);
  } else {
    console.log('⚠️ Playwright not configured, skipping cross-browser tests');
  }

  // 12. Documentation Build
  console.log('📚 Building Documentation...');
  if (fs.existsSync('docs/package.json')) {
    const docsBuild = runCommand('npm run build', 'docs', 120000);
    updateTestResults('frontend', docsBuild.success, docsBuild.duration);
  } else {
    console.log('⚠️ Documentation not found, skipping...');
  }

  // 13. Performance Benchmarking
  console.log('📊 Running Performance Benchmarks...');
  if (fs.existsSync('tests/performance/load-test.yml')) {
    const loadTestResult = await runCommandAsync('npm run test:performance', 'backend', 300000);
    updateTestResults('performance', loadTestResult.success, loadTestResult.duration);
  } else {
    console.log('⚠️ Performance tests not configured, skipping...');
  }
}

// Run all tests
runComprehensiveTests().then(() => {
  generateFinalReport();
}).catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

function generateFinalReport() {
  const totalDuration = Date.now() - startTime;
  const successRate = testResults.overall.total > 0 ? 
    (testResults.overall.passed / testResults.overall.total * 100).toFixed(1) : 0;

  // Generate comprehensive test report
  console.log('\n📊 Comprehensive Test Results Summary');
  console.log('=====================================');
  console.log(`Total Duration: ${formatDuration(totalDuration)}`);
  console.log(`Environment: Node ${process.version} on ${os.platform()}`);
  console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total`);
  console.log('');

  // Category breakdown
  Object.entries(testResults).forEach(([category, results]) => {
    if (category === 'overall') return;
    
    const categoryRate = results.total > 0 ? 
      (results.passed / results.total * 100).toFixed(1) : 0;
    const coverage = results.coverage > 0 ? ` (${results.coverage}% coverage)` : '';
    
    console.log(`${category.charAt(0).toUpperCase() + category.slice(1)}: ${results.passed}/${results.total} passed (${categoryRate}%)${coverage} - ${formatDuration(results.duration)}`);
  });

  console.log('');
  console.log(`Overall: ${testResults.overall.passed}/${testResults.overall.total} passed`);
  console.log(`Success Rate: ${successRate}%`);

  // Quality gates
  const qualityGates = {
    overallSuccess: testResults.overall.failed === 0,
    coverageThreshold: (testResults.backend.coverage >= 80 && testResults.frontend.coverage >= 80),
    performanceAcceptable: testResults.performance.failed === 0,
    securityClean: testResults.security.failed === 0,
    accessibilityCompliant: testResults.accessibility.failed === 0
  };

  console.log('\n🚪 Quality Gates:');
  console.log(`Overall Tests: ${qualityGates.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Code Coverage: ${qualityGates.coverageThreshold ? '✅ PASS' : '❌ FAIL'} (Backend: ${testResults.backend.coverage}%, Frontend: ${testResults.frontend.coverage}%)`);
  console.log(`Performance: ${qualityGates.performanceAcceptable ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Security: ${qualityGates.securityClean ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Accessibility: ${qualityGates.accessibilityCompliant ? '✅ PASS' : '❌ FAIL'}`);

  const allQualityGatesPassed = Object.values(qualityGates).every(gate => gate);

  // Generate detailed report
  const report = {
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    environment: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      memory: os.totalmem(),
      cpus: os.cpus().length
    },
    results: testResults,
    successRate: parseFloat(successRate),
    qualityGates,
    status: allQualityGatesPassed ? 'PASSED' : 'FAILED'
  };

  // Create reports directory if it doesn't exist
  const reportsDir = './test-reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write JSON report
  fs.writeFileSync(path.join(reportsDir, 'comprehensive-test-report.json'), JSON.stringify(report, null, 2));
  
  // Write HTML report
  const htmlReport = generateHtmlReport(report);
  fs.writeFileSync(path.join(reportsDir, 'comprehensive-test-report.html'), htmlReport);

  console.log(`\n📄 Detailed reports saved to ${reportsDir}/`);

  // Final status
  if (allQualityGatesPassed) {
    console.log('\n🎉 All quality gates passed! System is ready for deployment.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some quality gates failed. Please address the issues before deployment.');
    process.exit(1);
  }
}

function generateHtmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Test Results Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .meta { opacity: 0.9; margin-top: 10px; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.danger { border-left-color: #dc3545; }
        .metric h3 { margin: 0 0 10px 0; color: #666; font-size: 0.9em; text-transform: uppercase; }
        .metric .value { font-size: 2.5em; font-weight: bold; color: #333; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .test-category { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
        .test-category h3 { margin: 0 0 10px 0; color: #495057; }
        .test-stats { display: flex; gap: 20px; align-items: center; }
        .stat { display: flex; align-items: center; gap: 5px; }
        .quality-gates { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .gate { padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
        .gate.pass { background: #d4edda; color: #155724; }
        .gate.fail { background: #f8d7da; color: #721c24; }
        .status-badge { padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: uppercase; }
        .status-badge.passed { background: #28a745; color: white; }
        .status-badge.failed { background: #dc3545; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Comprehensive Test Results</h1>
            <div class="meta">
                <div>Generated: ${data.timestamp}</div>
                <div>Duration: ${formatDuration(data.duration)}</div>
                <div>Environment: Node ${data.environment.node} on ${data.environment.platform}</div>
                <div>Status: <span class="status-badge ${data.status.toLowerCase()}">${data.status}</span></div>
            </div>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric ${data.results.overall.failed === 0 ? 'success' : 'danger'}">
                    <h3>Total Tests</h3>
                    <div class="value">${data.results.overall.total}</div>
                </div>
                <div class="metric success">
                    <h3>Passed</h3>
                    <div class="value">${data.results.overall.passed}</div>
                </div>
                <div class="metric ${data.results.overall.failed === 0 ? 'success' : 'danger'}">
                    <h3>Failed</h3>
                    <div class="value">${data.results.overall.failed}</div>
                </div>
                <div class="metric ${data.successRate >= 95 ? 'success' : data.successRate >= 80 ? 'warning' : 'danger'}">
                    <h3>Success Rate</h3>
                    <div class="value">${data.successRate}%</div>
                </div>
            </div>
            
            <div class="section">
                <h2>Test Categories</h2>
                ${Object.entries(data.results).filter(([key]) => key !== 'overall').map(([category, results]) => `
                    <div class="test-category">
                        <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                        <div class="test-stats">
                            <div class="stat">✅ Passed: ${results.passed}</div>
                            <div class="stat">❌ Failed: ${results.failed}</div>
                            <div class="stat">⏱️ Duration: ${formatDuration(results.duration)}</div>
                            ${results.coverage > 0 ? `<div class="stat">📊 Coverage: ${results.coverage}%</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="section">
                <h2>Quality Gates</h2>
                <div class="quality-gates">
                    ${Object.entries(data.qualityGates).map(([gate, passed]) => `
                        <div class="gate ${passed ? 'pass' : 'fail'}">
                            <span>${passed ? '✅' : '❌'}</span>
                            <span>${gate.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}