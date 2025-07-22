import { AdvancedAutomationService, AdvancedWorkflowTriggerType, AdvancedWorkflowActionType } from '../advancedAutomation';
import { AutomationService } from '../automation';
import { GoogleSheetsService } from '../googleSheets';
import { GSTReportingService } from '../gstReporting';
import { EInvoicingService } from '../eInvoicing';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { Project, ProjectStatus } from '../../models/Project';
import { Client } from '../../models/Client';

// Mock dependencies
jest.mock('../googleSheets');
jest.mock('../automation');
jest.mock('../gstReporting');
jest.mock('../eInvoicing');
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn()
  })
}));

describe('AdvancedAutomationService', () => {
  let advancedAutomationService: AdvancedAutomationService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockAutomationService: jest.Mocked<AutomationService>;
  let mockGstReportingService: jest.Mocked<GSTReportingService>;
  let mockEInvoicingService: jest.Mocked<EInvoicingService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    mockAutomationService = new AutomationService() as jest.Mocked<AutomationService>;
    mockGstReportingService = {} as jest.Mocked<GSTReportingService>;
    mockEInvoicingService = {} as jest.Mocked<EInvoicingService>;
    
    // Mock methods
    mockGstReportingService.generateGSTR1Report = jest.fn().mockResolvedValue({});
    mockGstReportingService.generateGSTR3BReport = jest.fn().mockResolvedValue({});
    mockGstReportingService.exportGSTReport = jest.fn().mockResolvedValue(Buffer.from('mock_report_data'));
    
    mockEInvoicingService.generateEInvoice = jest.fn().mockResolvedValue({
      id: 'einv_123',
      invoice_id: 'inv_1',
      irn: '123456789012345678901234567890123456',
      status: 'generated'
    });
    
    // Create service instance with mocks
    advancedAutomationService = new AdvancedAutomationService(
      mockSheetsService,
      mockAutomationService,
      mockGstReportingService,
      mockEInvoicingService
    );
    
    // Mock initialize method
    jest.spyOn(advancedAutomationService, 'initialize').mockResolvedValue();
  });
  
  describe('initialize', () => {
    it('should schedule recurring jobs and register workflow rules', async () => {
      // Mock the scheduleRecurringJobs method
      const mockScheduleRecurringJobs = jest.spyOn(advancedAutomationService as any, 'scheduleRecurringJobs').mockImplementation();
      
      // Mock the registerAdvancedWorkflowRules method
      const mockRegisterAdvancedWorkflowRules = jest.spyOn(advancedAutomationService as any, 'registerAdvancedWorkflowRules').mockResolvedValue();
      
      // Call the method
      await advancedAutomationService.initialize();
      
      // Assertions
      expect(mockScheduleRecurringJobs).toHaveBeenCalled();
      expect(mockRegisterAdvancedWorkflowRules).toHaveBeenCalled();
    });
  });
  
  describe('generateMonthlyGSTReport', () => {
    it('should generate monthly GST report', async () => {
      // Mock the triggerWebhook method
      const mockTriggerWebhook = jest.spyOn(advancedAutomationService as any, 'triggerWebhook').mockResolvedValue();
      
      // Set up webhookEndpoints map
      (advancedAutomationService as any).webhookEndpoints = new Map([
        ['gst_report', 'https://example.com/webhook/gst_report']
      ]);
      
      // Call the method
      await advancedAutomationService.generateMonthlyGSTReport();
      
      // Assertions
      expect(mockGstReportingService.generateGSTR1Report).toHaveBeenCalled();
      expect(mockGstReportingService.exportGSTReport).toHaveBeenCalled();
      expect(mockTriggerWebhook).toHaveBeenCalledWith('gst_report', expect.objectContaining({
        report_type: 'GSTR1'
      }));
    });
  });
  
  describe('checkEInvoiceEligibility', () => {
    it('should generate e-invoices for eligible invoices', async () => {
      // Mock invoice data
      const mockInvoices = [
        {
          id: 'inv_1',
          invoice_number: 'INV-001',
          client_id: 'client_1',
          amount: 60000,
          tax_amount: 10800,
          total_amount: 70800, // Above 50,000 threshold
          status: InvoiceStatus.SENT,
          e_invoice_id: null
        },
        {
          id: 'inv_2',
          invoice_number: 'INV-002',
          client_id: 'client_2',
          amount: 40000,
          tax_amount: 7200,
          total_amount: 47200, // Below 50,000 threshold
          status: InvoiceStatus.SENT,
          e_invoice_id: null
        },
        {
          id: 'inv_3',
          invoice_number: 'INV-003',
          client_id: 'client_1',
          amount: 80000,
          tax_amount: 14400,
          total_amount: 94400, // Above 50,000 threshold but already has e-invoice
          status: InvoiceStatus.SENT,
          e_invoice_id: 'einv_456'
        }
      ];
      
      // Mock client data
      const mockClients = [
        {
          id: 'client_1',
          name: 'Test Client 1',
          email: 'client1@example.com',
          gstin: '27AAAAA0000A1Z5' // Has GSTIN
        },
        {
          id: 'client_2',
          name: 'Test Client 2',
          email: 'client2@example.com',
          gstin: '' // No GSTIN
        }
      ];
      
      // Setup mocks
      mockSheetsService.query.mockResolvedValue(mockInvoices.map(inv => ({
        ...inv,
        fromSheetRow: jest.fn().mockReturnValue(inv)
      })));
      
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClients[0],
            fromSheetRow: jest.fn().mockReturnValue(mockClients[0])
          }]);
        } else if (sheetName === 'Clients' && id === 'client_2') {
          return Promise.resolve([{
            ...mockClients[1],
            fromSheetRow: jest.fn().mockReturnValue(mockClients[1])
          }]);
        }
        return Promise.resolve([]);
      });
      
      // Call the method
      await advancedAutomationService.checkEInvoiceEligibility();
      
      // Assertions
      // Should only generate e-invoice for inv_1 (above threshold and has GSTIN)
      expect(mockEInvoicingService.generateEInvoice).toHaveBeenCalledTimes(1);
      expect(mockEInvoicingService.generateEInvoice).toHaveBeenCalledWith('inv_1');
    });
    
    it('should handle no eligible invoices', async () => {
      // Setup mocks
      mockSheetsService.query.mockResolvedValue([]);
      
      // Call the method
      await advancedAutomationService.checkEInvoiceEligibility();
      
      // Assertions
      expect(mockEInvoicingService.generateEInvoice).not.toHaveBeenCalled();
    });
  });
  
  describe('applyLatePaymentFee', () => {
    it('should apply late payment fee to eligible invoices', async () => {
      // Mock invoice data
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const mockInvoices = [
        {
          id: 'inv_1',
          invoice_number: 'INV-001',
          client_id: 'client_1',
          amount: 10000,
          tax_amount: 1800,
          total_amount: 11800,
          status: InvoiceStatus.OVERDUE,
          due_date: thirtyDaysAgo, // 30 days overdue
          late_fee_applied: false
        },
        {
          id: 'inv_2',
          invoice_number: 'INV-002',
          client_id: 'client_2',
          amount: 20000,
          tax_amount: 3600,
          total_amount: 23600,
          status: InvoiceStatus.OVERDUE,
          due_date: new Date(), // Not overdue
          late_fee_applied: false
        },
        {
          id: 'inv_3',
          invoice_number: 'INV-003',
          client_id: 'client_1',
          amount: 30000,
          tax_amount: 5400,
          total_amount: 35400,
          status: InvoiceStatus.OVERDUE,
          due_date: thirtyDaysAgo, // 30 days overdue
          late_fee_applied: true // Already applied
        }
      ];
      
      // Mock client data
      const mockClient = {
        id: 'client_1',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Setup mocks
      mockSheetsService.query.mockResolvedValue(mockInvoices.map(inv => ({
        ...inv,
        fromSheetRow: jest.fn().mockReturnValue(inv)
      })));
      
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClient,
            fromSheetRow: jest.fn().mockReturnValue(mockClient)
          }]);
        }
        return Promise.resolve([]);
      });
      
      mockSheetsService.update.mockResolvedValue(true);
      
      // Mock the recordCommunication method
      const mockRecordCommunication = jest.spyOn(advancedAutomationService as any, 'recordCommunication').mockResolvedValue();
      
      // Call the method
      await advancedAutomationService.applyLatePaymentFee(15, 1.5);
      
      // Assertions
      // Should only apply late fee to inv_1 (overdue by more than 15 days and not already applied)
      expect(mockSheetsService.update).toHaveBeenCalledTimes(1);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_1', expect.objectContaining({
        late_fee: 11800 * 0.015, // 1.5% of total amount
        late_fee_applied: true
      }));
      
      // Should record communication for the client
      expect(mockRecordCommunication).toHaveBeenCalledTimes(1);
      expect(mockRecordCommunication).toHaveBeenCalledWith(expect.objectContaining({
        client_id: 'client_1',
        subject: 'Late Payment Fee Applied'
      }));
    });
  });
  
  describe('checkProjectBudgetThresholds', () => {
    it('should create notifications for projects exceeding budget threshold', async () => {
      // Mock project data
      const mockProjects = [
        {
          id: 'project_1',
          name: 'Test Project 1',
          client_id: 'client_1',
          status: ProjectStatus.ACTIVE,
          budget: 100000,
          budget_alert_sent: false
        },
        {
          id: 'project_2',
          name: 'Test Project 2',
          client_id: 'client_2',
          status: ProjectStatus.ACTIVE,
          budget: 50000,
          budget_alert_sent: true // Alert already sent
        },
        {
          id: 'project_3',
          name: 'Test Project 3',
          client_id: 'client_1',
          status: ProjectStatus.ACTIVE,
          budget: 0 // No budget set
        }
      ];
      
      // Mock expense data
      const mockExpenses = [
        {
          id: 'exp_1',
          project_id: 'project_1',
          amount: 85000 // 85% of budget
        },
        {
          id: 'exp_2',
          project_id: 'project_2',
          amount: 45000 // 90% of budget
        }
      ];
      
      // Mock client data
      const mockClient = {
        id: 'client_1',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Setup mocks
      mockSheetsService.query.mockImplementation((sheetName, query) => {
        if (sheetName === 'Projects') {
          return Promise.resolve(mockProjects.map(project => ({
            ...project,
            fromSheetRow: jest.fn().mockReturnValue(project)
          })));
        } else if (sheetName === 'Expenses') {
          const projectId = query.project_id;
          return Promise.resolve(mockExpenses
            .filter(exp => exp.project_id === projectId)
            .map(exp => ({
              ...exp,
              fromSheetRow: jest.fn().mockReturnValue(exp)
            }))
          );
        }
        return Promise.resolve([]);
      });
      
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClient,
            fromSheetRow: jest.fn().mockReturnValue(mockClient)
          }]);
        }
        return Promise.resolve([]);
      });
      
      mockSheetsService.update.mockResolvedValue(true);
      
      // Mock the createNotification method
      const mockCreateNotification = jest.spyOn(advancedAutomationService as any, 'createNotification').mockResolvedValue();
      
      // Mock the triggerWebhook method
      const mockTriggerWebhook = jest.spyOn(advancedAutomationService as any, 'triggerWebhook').mockResolvedValue();
      
      // Set up webhookEndpoints map
      (advancedAutomationService as any).webhookEndpoints = new Map([
        ['budget_alert', 'https://example.com/webhook/budget_alert']
      ]);
      
      // Call the method
      await advancedAutomationService.checkProjectBudgetThresholds(80);
      
      // Assertions
      // Should only update project_1 (exceeds 80% threshold and alert not sent)
      expect(mockSheetsService.update).toHaveBeenCalledTimes(1);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Projects', 'project_1', expect.objectContaining({
        budget_alert_sent: true
      }));
      
      // Should create notification
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Project Budget Alert',
        related_entity_id: 'project_1'
      }));
      
      // Should trigger webhook
      expect(mockTriggerWebhook).toHaveBeenCalledTimes(1);
      expect(mockTriggerWebhook).toHaveBeenCalledWith('budget_alert', expect.objectContaining({
        project_id: 'project_1',
        percentage: 85
      }));
    });
  });
  
  describe('processAdvancedTrigger', () => {
    it('should process matching workflow rules', async () => {
      // Mock workflow rules
      const mockRules = [
        {
          id: 'rule_1',
          name: 'Test Rule 1',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.E_INVOICE_ELIGIBLE,
            conditions: {
              amount_threshold: 50000
            }
          },
          actions: [
            {
              type: AdvancedWorkflowActionType.GENERATE_E_INVOICE,
              parameters: {
                notify_client: true
              }
            }
          ]
        },
        {
          id: 'rule_2',
          name: 'Test Rule 2',
          is_active: false, // Inactive rule
          trigger: {
            type: AdvancedWorkflowTriggerType.E_INVOICE_ELIGIBLE,
            conditions: {
              amount_threshold: 10000
            }
          },
          actions: []
        },
        {
          id: 'rule_3',
          name: 'Test Rule 3',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.PROJECT_BUDGET_THRESHOLD, // Different trigger type
            conditions: {}
          },
          actions: []
        }
      ];
      
      // Setup mocks
      mockSheetsService.read.mockResolvedValue(mockRules);
      
      // Mock the checkTriggerConditions method
      const mockCheckTriggerConditions = jest.spyOn(advancedAutomationService as any, 'checkTriggerConditions').mockReturnValue(true);
      
      // Mock the executeAdvancedAction method
      const mockExecuteAdvancedAction = jest.spyOn(advancedAutomationService as any, 'executeAdvancedAction').mockResolvedValue();
      
      // Call the method
      const context = {
        invoice_id: 'inv_1',
        amount: 60000
      };
      
      await advancedAutomationService.processAdvancedTrigger(
        AdvancedWorkflowTriggerType.E_INVOICE_ELIGIBLE,
        context
      );
      
      // Assertions
      // Should check conditions for rule_1 only (active and matching trigger type)
      expect(mockCheckTriggerConditions).toHaveBeenCalledTimes(1);
      expect(mockCheckTriggerConditions).toHaveBeenCalledWith(
        mockRules[0].trigger.conditions,
        context
      );
      
      // Should execute action for rule_1
      expect(mockExecuteAdvancedAction).toHaveBeenCalledTimes(1);
      expect(mockExecuteAdvancedAction).toHaveBeenCalledWith(
        mockRules[0].actions[0],
        context
      );
    });
  });
});