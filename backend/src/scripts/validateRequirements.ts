/**
 * Requirements Validation Script
 * 
 * This script validates that all requirements from the specification have been
 * implemented correctly in the system. It performs automated checks where possible
 * and generates a comprehensive validation report.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { SheetsService } from '../services/googleSheets';
import { monitoringService } from '../services/monitoring';
import config from '../config';

// Define requirement structure
interface Requirement {
  id: string;
  title: string;
  userStory: string;
  criteria: string[];
  validationMethods: ValidationMethod[];
  validationResults: ValidationResult[];
}

interface ValidationMethod {
  type: 'api' | 'sheets' | 'file' | 'manual';
  description: string;
  endpoint?: string;
  method?: string;
  params?: any;
  fileCheck?: string;
  sheetCheck?: {
    sheetName: string;
    operation: string;
    params?: any;
  };
}

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

// Load requirements from file
async function loadRequirements(): Promise<Requirement[]> {
  try {
    // In a real implementation, this would parse the requirements.md file
    // For this example, we'll define the requirements directly
    
    const requirements: Requirement[] = [
      {
        id: '1',
        title: 'Project Management',
        userStory: 'As a solopreneur, I want to create and manage projects with associated tasks, so that I can organize my work efficiently and track progress.',
        criteria: [
          'WHEN I create a new project THEN the system SHALL allow me to specify project name, client, deadline, and status',
          'WHEN I view my projects THEN the system SHALL display them in categorized lists with filtering options by status (active, completed, on-hold)',
          'WHEN I add tasks to a project THEN the system SHALL allow me to set priorities, deadlines, and create sub-tasks',
          'WHEN I view tasks THEN the system SHALL provide Kanban board, Gantt chart, and list views',
          'WHEN I work on tasks THEN the system SHALL provide time tracking with timer functionality and manual entries',
          'WHEN project progress changes THEN the system SHALL update visual progress bars and send notifications for approaching deadlines'
        ],
        validationMethods: [
          {
            type: 'api',
            description: 'Verify project creation API',
            endpoint: '/api/projects',
            method: 'POST',
            params: {
              name: 'Validation Test Project',
              client_id: '{{TEST_CLIENT_ID}}',
              status: 'active',
              start_date: '{{CURRENT_DATE}}',
              end_date: '{{FUTURE_DATE}}',
              budget: 5000,
              description: 'Project for validation testing'
            }
          },
          {
            type: 'api',
            description: 'Verify project filtering',
            endpoint: '/api/projects?status=active',
            method: 'GET'
          },
          {
            type: 'api',
            description: 'Verify task creation with priorities',
            endpoint: '/api/projects/{{PROJECT_ID}}/tasks',
            method: 'POST',
            params: {
              title: 'Validation Test Task',
              priority: 'high',
              due_date: '{{FUTURE_DATE}}',
              estimated_hours: 10
            }
          },
          {
            type: 'file',
            description: 'Verify Kanban board component exists',
            fileCheck: 'frontend/src/components/projects/TaskBoard.tsx'
          },
          {
            type: 'file',
            description: 'Verify Gantt chart component exists',
            fileCheck: 'frontend/src/components/projects/ProjectGantt.tsx'
          },
          {
            type: 'api',
            description: 'Verify time tracking functionality',
            endpoint: '/api/time-entries',
            method: 'POST',
            params: {
              task_id: '{{TASK_ID}}',
              project_id: '{{PROJECT_ID}}',
              hours: 2,
              description: 'Validation testing',
              date: '{{CURRENT_DATE}}'
            }
          }
        ],
        validationResults: []
      },
      // Additional requirements would be defined here
      {
        id: '2',
        title: 'Document and File Management',
        userStory: 'As a solopreneur, I want to store and share project-related documents with clients, so that all project materials are centralized and accessible.',
        criteria: [
          'WHEN I upload files to a project THEN the system SHALL store them securely and associate them with the project',
          'WHEN I need to share documents THEN the system SHALL provide a secure client portal for file sharing',
          'WHEN clients access the portal THEN the system SHALL allow them to view proposals, updates, and deliverables',
          'WHEN project discussions occur THEN the system SHALL provide commenting and chat functionality'
        ],
        validationMethods: [
          {
            type: 'api',
            description: 'Verify file upload functionality',
            endpoint: '/api/files',
            method: 'POST',
            params: {
              project_id: '{{PROJECT_ID}}',
              name: 'test-document.pdf',
              type: 'application/pdf',
              size: 1024,
              description: 'Test document for validation'
            }
          },
          {
            type: 'file',
            description: 'Verify client portal component exists',
            fileCheck: 'frontend/src/components/clients/ClientPortal.tsx'
          },
          {
            type: 'api',
            description: 'Verify file sharing functionality',
            endpoint: '/api/files/share',
            method: 'POST',
            params: {
              file_id: '{{FILE_ID}}',
              client_id: '{{CLIENT_ID}}',
              access_level: 'view'
            }
          }
        ],
        validationResults: []
      },
      // Additional requirements would continue...
    ];
    
    return requirements;
  } catch (error) {
    console.error('Error loading requirements:', error);
    return [];
  }
}

// Validate requirements
async function validateRequirements(requirements: Requirement[]): Promise<Requirement[]> {
  const baseUrl = `http://localhost:${config.port}/api`;
  const authToken = await getAuthToken();
  
  // Create a test client for validation
  const testClientId = await createTestClient(baseUrl, authToken);
  
  // Replace placeholders in validation methods
  const currentDate = new Date().toISOString();
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  let projectId = '';
  let taskId = '';
  let fileId = '';
  
  // Process each requirement
  for (const requirement of requirements) {
    for (const method of requirement.validationMethods) {
      try {
        let result: ValidationResult;
        
        // Replace dynamic placeholders
        if (method.endpoint) {
          method.endpoint = method.endpoint
            .replace('{{PROJECT_ID}}', projectId)
            .replace('{{TASK_ID}}', taskId)
            .replace('{{FILE_ID}}', fileId)
            .replace('{{CLIENT_ID}}', testClientId);
        }
        
        if (method.params) {
          method.params = JSON.parse(
            JSON.stringify(method.params)
              .replace('"{{TEST_CLIENT_ID}}"', `"${testClientId}"`)
              .replace('"{{PROJECT_ID}}"', `"${projectId}"`)
              .replace('"{{TASK_ID}}"', `"${taskId}"`)
              .replace('"{{CURRENT_DATE}}"', `"${currentDate}"`)
              .replace('"{{FUTURE_DATE}}"', `"${futureDate}"`)
          );
        }
        
        // Execute validation based on type
        switch (method.type) {
          case 'api':
            result = await validateApiEndpoint(baseUrl, authToken, method);
            
            // Store IDs for subsequent tests
            if (result.passed && result.details?.id) {
              if (method.endpoint?.includes('/projects') && method.method === 'POST') {
                projectId = result.details.id;
              } else if (method.endpoint?.includes('/tasks') && method.method === 'POST') {
                taskId = result.details.id;
              } else if (method.endpoint?.includes('/files') && method.method === 'POST') {
                fileId = result.details.id;
              }
            }
            break;
            
          case 'file':
            result = validateFileExists(method.fileCheck || '');
            break;
            
          case 'sheets':
            result = await validateSheetsOperation(method.sheetCheck);
            break;
            
          case 'manual':
            result = {
              passed: false,
              message: 'Manual validation required: ' + method.description,
              details: { requiresManualCheck: true }
            };
            break;
            
          default:
            result = {
              passed: false,
              message: 'Unknown validation method type',
              details: { method }
            };
        }
        
        requirement.validationResults.push(result);
      } catch (error) {
        requirement.validationResults.push({
          passed: false,
          message: `Error during validation: ${(error as Error).message}`,
          details: { error }
        });
      }
    }
  }
  
  return requirements;
}

// Helper function to get auth token
async function getAuthToken(): Promise<string> {
  try {
    const baseUrl = `http://localhost:${config.port}/api`;
    const response = await axios.post(`${baseUrl}/auth/login`, {
      email: 'admin@example.com',
      password: 'securePassword123'
    });
    
    return response.data.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw new Error('Failed to authenticate for validation');
  }
}

// Helper function to create a test client
async function createTestClient(baseUrl: string, authToken: string): Promise<string> {
  try {
    const response = await axios.post(
      `${baseUrl}/clients`,
      {
        name: 'Validation Test Client',
        email: 'validation@example.com',
        phone: '9876543210',
        address: '123 Validation St, Test City',
        gstin: '27AAPFU0939F1ZV',
        payment_terms: 'Net 30'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    return response.data.id;
  } catch (error) {
    console.error('Error creating test client:', error);
    throw new Error('Failed to create test client for validation');
  }
}

// Validate API endpoint
async function validateApiEndpoint(
  baseUrl: string,
  authToken: string,
  method: ValidationMethod
): Promise<ValidationResult> {
  try {
    const url = `${baseUrl}${method.endpoint}`;
    let response;
    
    switch (method.method?.toUpperCase()) {
      case 'GET':
        response = await axios.get(url, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        break;
        
      case 'POST':
        response = await axios.post(url, method.params, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        break;
        
      case 'PUT':
        response = await axios.put(url, method.params, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        break;
        
      case 'DELETE':
        response = await axios.delete(url, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        break;
        
      default:
        return {
          passed: false,
          message: `Unsupported HTTP method: ${method.method}`,
          details: { method }
        };
    }
    
    return {
      passed: response.status >= 200 && response.status < 300,
      message: `API endpoint ${method.endpoint} validation ${response.status >= 200 && response.status < 300 ? 'passed' : 'failed'} with status ${response.status}`,
      details: response.data
    };
  } catch (error) {
    const axiosError = error as any;
    return {
      passed: false,
      message: `API endpoint ${method.endpoint} validation failed: ${axiosError.message}`,
      details: {
        status: axiosError.response?.status,
        data: axiosError.response?.data
      }
    };
  }
}

// Validate file exists
function validateFileExists(filePath: string): ValidationResult {
  try {
    const fullPath = path.join(process.cwd(), '..', filePath);
    const exists = fs.existsSync(fullPath);
    
    return {
      passed: exists,
      message: exists ? `File ${filePath} exists` : `File ${filePath} does not exist`,
      details: { filePath, fullPath }
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking file ${filePath}: ${(error as Error).message}`,
      details: { error }
    };
  }
}

// Validate Google Sheets operation
async function validateSheetsOperation(sheetCheck?: { sheetName: string; operation: string; params?: any }): Promise<ValidationResult> {
  if (!sheetCheck) {
    return {
      passed: false,
      message: 'No sheet check specified',
      details: { sheetCheck }
    };
  }
  
  try {
    const sheetsService = new SheetsService();
    
    switch (sheetCheck.operation) {
      case 'read':
        const data = await sheetsService.read(sheetCheck.sheetName);
        return {
          passed: Array.isArray(data) && data.length > 0,
          message: `Sheet ${sheetCheck.sheetName} read operation ${Array.isArray(data) && data.length > 0 ? 'successful' : 'failed'}`,
          details: { rowCount: data.length }
        };
        
      case 'query':
        const queryResults = await sheetsService.query(sheetCheck.sheetName, sheetCheck.params || {});
        return {
          passed: Array.isArray(queryResults),
          message: `Sheet ${sheetCheck.sheetName} query operation ${Array.isArray(queryResults) ? 'successful' : 'failed'}`,
          details: { rowCount: queryResults.length }
        };
        
      default:
        return {
          passed: false,
          message: `Unsupported sheet operation: ${sheetCheck.operation}`,
          details: { sheetCheck }
        };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Error during sheet operation: ${(error as Error).message}`,
      details: { error }
    };
  }
}

// Generate validation report
function generateReport(requirements: Requirement[]): void {
  const reportDir = path.join(process.cwd(), 'reports');
  const reportPath = path.join(reportDir, `requirements-validation-${new Date().toISOString().split('T')[0]}.json`);
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Calculate statistics
  const totalRequirements = requirements.length;
  const totalValidations = requirements.reduce((sum, req) => sum + req.validationMethods.length, 0);
  const passedValidations = requirements.reduce((sum, req) => {
    return sum + req.validationResults.filter(result => result.passed).length;
  }, 0);
  
  const requirementsPassed = requirements.filter(req => {
    return req.validationResults.every(result => result.passed);
  }).length;
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRequirements,
      requirementsPassed,
      requirementsPassedPercentage: (requirementsPassed / totalRequirements) * 100,
      totalValidations,
      passedValidations,
      validationsPassedPercentage: (passedValidations / totalValidations) * 100
    },
    requirements: requirements.map(req => ({
      id: req.id,
      title: req.title,
      passed: req.validationResults.every(result => result.passed),
      validationResults: req.validationResults.map(result => ({
        passed: result.passed,
        message: result.message
      }))
    }))
  };
  
  // Write report to file
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\nRequirements Validation Report`);
  console.log(`==============================`);
  console.log(`Total Requirements: ${totalRequirements}`);
  console.log(`Requirements Passed: ${requirementsPassed} (${(requirementsPassed / totalRequirements * 100).toFixed(2)}%)`);
  console.log(`Total Validations: ${totalValidations}`);
  console.log(`Validations Passed: ${passedValidations} (${(passedValidations / totalValidations * 100).toFixed(2)}%)`);
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  // Print failed validations for quick review
  console.log(`\nFailed Validations:`);
  requirements.forEach(req => {
    const failedResults = req.validationResults.filter(result => !result.passed);
    if (failedResults.length > 0) {
      console.log(`\nRequirement ${req.id}: ${req.title}`);
      failedResults.forEach(result => {
        console.log(`  - ${result.message}`);
      });
    }
  });
}

// Main function
async function main() {
  try {
    console.log('Starting requirements validation...');
    
    const requirements = await loadRequirements();
    console.log(`Loaded ${requirements.length} requirements for validation`);
    
    const validatedRequirements = await validateRequirements(requirements);
    generateReport(validatedRequirements);
    
    console.log('Requirements validation completed');
  } catch (error) {
    console.error('Error during requirements validation:', error);
    process.exit(1);
  }
}

// Run the validation if executed directly
if (require.main === module) {
  main();
}

export { loadRequirements, validateRequirements, generateReport };