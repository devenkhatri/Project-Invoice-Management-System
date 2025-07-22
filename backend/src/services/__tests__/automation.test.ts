import { AutomationService, WorkflowTriggerType, WorkflowActionType } from '../automation';
import { GoogleSheetsService } from '../googleSheets';
import { PaymentProcessingService } from '../paymentProcessing';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('../googleSheets');
jest.mock('../paymentProcessing');
jest.mock('nodemailer');

describe('AutomationService', () => {
  let automationService: AutomationService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockPaymentService: jest.Mocked<PaymentProcessingService>;
  let mockEmailTransporter: jest.Mocked<nodemailer.Transporter>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    mockSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    mockPaymentService = new PaymentProcessingService() as jest.Mocked<PaymentProcessingService>;
    mockEmailTransporter = {
      sendMail: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<nodemailer.Transporter>;
    
    // Mock nodemailer.createTransport to return our mock transporter
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockEmailTransporter);
    
    // Create instance of service with mocked dependencies
    automationService = new AutomationService();
    
    // Replace the service's dependencies with our mocks
    (automationService as any).sheetsService = mockSheetsService;
    (automationService as any).paymentService = mockPaymentService;
    (automationService as any).emailTransporter = mockEmailTransporter;
  });

  describe('initialize', () => {
    it('should load workflow rules and schedule recurring jobs', async () => {
      // Mock loadWorkflowRules
      const loadWorkflowRulesSpy = jest.spyOn(automationService as any, 'loadWorkflowRules')
        .mockResolvedValue(undefined);
      
      // Mock scheduleRecurringJobs
      const scheduleRecurringJobsSpy = jest.spyOn(automationService as any, 'scheduleRecurringJobs')
        .mockImplementation(() => {});
      
      await automationService.initialize();
      
      expect(loadWorkflowRulesSpy).toHaveBeenCalled();
      expect(scheduleRecurringJobsSpy).toHaveBeenCalled();
    });
    
    it('should handle errors during initialization', async () => {
      // Mock loadWorkflowRules to throw an error
      jest.spyOn(automationService as any, 'loadWorkflowRules')
        .mockRejectedValue(new Error('Test error'));
      
      await expect(automationService.initialize()).rejects.toThrow('Test error');
    });
  });

  describe('loadWorkflowRules', () => {
    it('should load workflow rules from Google Sheets', async () => {
      // Mock sheet data
      const mockRules = [
        {
          id: 'rule1',
          name: 'Test Rule',
          description: 'Test description',
          is_active: 'true',
          trigger: JSON.stringify({
            type: WorkflowTriggerType.DEADLINE_APPROACHING,
            conditions: { entity_type: 'task', days_before: 2 }
          }),
          actions: JSON.stringify([
            {
              type: WorkflowActionType.SEND_EMAIL,
              parameters: { template: 'deadline_reminder' }
            }
          ]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      mockSheetsService.read = jest.fn().mockResolvedValue(mockRules);
      
      await (automationService as any).loadWorkflowRules();
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('WorkflowRules');
      expect((automationService as any).workflowRules.size).toBe(1);
      expect((automationService as any).workflowRules.get('rule1')).toBeDefined();
    });
    
    it('should create workflow rules sheet if it does not exist', async () => {
      // Mock sheet not existing
      mockSheetsService.read = jest.fn().mockRejectedValue(new Error('Sheet not found'));
      
      // Mock sheet creation
      const createWorkflowRulesSheetSpy = jest.spyOn(automationService as any, 'createWorkflowRulesSheet')
        .mockResolvedValue(undefined);
      
      await (automationService as any).loadWorkflowRules();
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('WorkflowRules');
      expect(createWorkflowRulesSheetSpy).toHaveBeenCalled();
    });
  });

  describe('checkDeadlines', () => {
    it('should check for approaching task deadlines', async () => {
      // Mock current date
      const mockDate = new Date('2025-07-20');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);
      
      // Mock task data
      const mockTasks = [
        {
          id: 'task1',
          title: 'Test Task',
          status: 'in_progress',
          due_date: new Date('2025-07-22').toISOString(), // 2 days from now
          project_id: 'project1'
        },
        {
          id: 'task2',
          title: 'Completed Task',
          status: 'completed',
          due_date: new Date('2025-07-22').toISOString(),
          project_id: 'project1'
        },
        {
          id: 'task3',
          title: 'Far Future Task',
          status: 'in_progress',
          due_date: new Date('2025-08-01').toISOString(), // More than 2 days away
          project_id: 'project1'
        }
      ];
      
      // Mock project data
      const mockProjects = [
        {
          id: 'project1',
          name: 'Test Project',
          status: 'active',
          end_date: new Date('2025-07-23').toISOString(), // 3 days from now
          client_id: 'client1'
        }
      ];
      
      // Mock client data
      const mockClient = {
        id: 'client1',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Setup mocks
      mockSheetsService.read = jest.fn()
        .mockImplementation((sheetName) => {
          if (sheetName === 'Tasks') return mockTasks;
          if (sheetName === 'Projects') return mockProjects;
          if (sheetName === 'Clients') return [mockClient];
          return [];
        });
      
      // Mock processDeadlineReminder
      const processDeadlineReminderSpy = jest.spyOn(automationService as any, 'processDeadlineReminder')
        .mockResolvedValue(undefined);
      
      const result = await automationService.checkDeadlines();
      
      expect(result).toEqual({ tasks: 1, projects: 1 });
      expect(processDeadlineReminderSpy).toHaveBeenCalledTimes(2);
      expect(processDeadlineReminderSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'task1' }), 'task');
      expect(processDeadlineReminderSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'project1' }), 'project');
    });
  });

  describe('workflow rule management', () => {
    it('should create a new workflow rule', async () => {
      const newRule = {
        name: 'New Rule',
        description: 'Test description',
        is_active: true,
        trigger: {
          type: WorkflowTriggerType.DEADLINE_APPROACHING,
          conditions: { entity_type: 'task', days_before: 2 }
        },
        actions: [
          {
            type: WorkflowActionType.SEND_EMAIL,
            parameters: { template: 'deadline_reminder' }
          }
        ]
      };
      
      mockSheetsService.create = jest.fn().mockResolvedValue('rule_123');
      
      const result = await automationService.createWorkflowRule(newRule);
      
      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Rule');
      expect(mockSheetsService.create).toHaveBeenCalledWith('WorkflowRules', expect.any(Object));
      expect((automationService as any).workflowRules.get(result.id)).toBeDefined();
    });
    
    it('should update an existing workflow rule', async () => {
      // Add a rule to the map
      const existingRule = {
        id: 'rule1',
        name: 'Original Rule',
        description: 'Original description',
        is_active: true,
        trigger: {
          type: WorkflowTriggerType.DEADLINE_APPROACHING,
          conditions: { entity_type: 'task', days_before: 2 }
        },
        actions: [
          {
            type: WorkflowActionType.SEND_EMAIL,
            parameters: { template: 'deadline_reminder' }
          }
        ],
        created_at: new Date(),
        updated_at: new Date()
      };
      
      (automationService as any).workflowRules.set('rule1', existingRule);
      
      // Update the rule
      const updates = {
        name: 'Updated Rule',
        description: 'Updated description'
      };
      
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      const result = await automationService.updateWorkflowRule('rule1', updates);
      
      expect(result.name).toBe('Updated Rule');
      expect(result.description).toBe('Updated description');
      expect(mockSheetsService.update).toHaveBeenCalledWith('WorkflowRules', 'rule1', expect.any(Object));
    });
    
    it('should delete a workflow rule', async () => {
      // Add a rule to the map
      (automationService as any).workflowRules.set('rule1', { id: 'rule1', name: 'Test Rule' });
      
      mockSheetsService.delete = jest.fn().mockResolvedValue(true);
      
      const result = await automationService.deleteWorkflowRule('rule1');
      
      expect(result).toBe(true);
      expect(mockSheetsService.delete).toHaveBeenCalledWith('WorkflowRules', 'rule1');
      expect((automationService as any).workflowRules.has('rule1')).toBe(false);
    });
  });

  describe('notification management', () => {
    it('should get notifications for a user', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          user_id: 'user1',
          title: 'Test Notification',
          message: 'This is a test',
          type: 'info',
          is_read: 'false',
          created_at: new Date('2025-07-19').toISOString()
        },
        {
          id: 'notif2',
          user_id: 'user1',
          title: 'Another Notification',
          message: 'This is another test',
          type: 'warning',
          is_read: 'true',
          created_at: new Date('2025-07-18').toISOString()
        }
      ];
      
      mockSheetsService.query = jest.fn().mockResolvedValue(mockNotifications);
      
      const result = await automationService.getNotifications('user1');
      
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('notif1');
      expect(result[0].is_read).toBe(false);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Notifications', { user_id: 'user1' });
    });
    
    it('should mark a notification as read', async () => {
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      const result = await automationService.markNotificationAsRead('notif1');
      
      expect(result).toBe(true);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Notifications', 'notif1', { is_read: 'true' });
    });
  });

  describe('task status change processing', () => {
    it('should process task status change and trigger workflow rules', async () => {
      // Mock task data
      const mockTask = {
        id: 'task1',
        title: 'Test Task',
        status: 'completed',
        project_id: 'project1'
      };
      
      // Mock project data
      const mockProject = {
        id: 'project1',
        name: 'Test Project',
        client_id: 'client1'
      };
      
      // Mock client data
      const mockClient = {
        id: 'client1',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Add a workflow rule
      (automationService as any).workflowRules.set('rule1', {
        id: 'rule1',
        name: 'Task Completion Rule',
        is_active: true,
        trigger: {
          type: WorkflowTriggerType.TASK_STATUS_CHANGE,
          conditions: {
            old_status: 'in_progress',
            new_status: 'completed'
          }
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            parameters: {
              message: 'Task completed'
            }
          }
        ],
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // Setup mocks
      mockSheetsService.read = jest.fn()
        .mockImplementation((sheetName, id) => {
          if (sheetName === 'Tasks') return [mockTask];
          if (sheetName === 'Projects') return [mockProject];
          if (sheetName === 'Clients') return [mockClient];
          return [];
        });
      
      // Mock executeAction
      const executeActionSpy = jest.spyOn(automationService as any, 'executeAction')
        .mockResolvedValue(undefined);
      
      // Mock checkProjectCompletion
      const checkProjectCompletionSpy = jest.spyOn(automationService as any, 'checkProjectCompletion')
        .mockResolvedValue(undefined);
      
      await automationService.processTaskStatusChange('task1', 'in_progress', 'completed');
      
      expect(executeActionSpy).toHaveBeenCalled();
      expect(checkProjectCompletionSpy).toHaveBeenCalledWith('project1');
    });
  });

  describe('proposal to invoice conversion', () => {
    it('should process proposal acceptance and convert to invoice', async () => {
      // Mock proposal data
      const mockProposal = {
        id: 'proposal1',
        client_id: 'client1',
        project_name: 'New Project',
        amount: 1000
      };
      
      // Mock client data
      const mockClient = {
        id: 'client1',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Add a workflow rule
      (automationService as any).workflowRules.set('rule1', {
        id: 'rule1',
        name: 'Proposal Conversion Rule',
        is_active: true,
        trigger: {
          type: WorkflowTriggerType.PROPOSAL_ACCEPTED,
          conditions: {}
        },
        actions: [
          {
            type: WorkflowActionType.CONVERT_PROPOSAL_TO_INVOICE,
            parameters: {
              due_days: 30
            }
          }
        ],
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // Setup mocks
      mockSheetsService.read = jest.fn()
        .mockImplementation((sheetName, id) => {
          if (sheetName === 'Proposals') return [mockProposal];
          if (sheetName === 'Clients') return [mockClient];
          return [];
        });
      
      // Mock executeAction
      const executeActionSpy = jest.spyOn(automationService as any, 'executeAction')
        .mockResolvedValue(undefined);
      
      await automationService.processProposalAcceptance('proposal1');
      
      expect(executeActionSpy).toHaveBeenCalled();
      expect(executeActionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: WorkflowActionType.CONVERT_PROPOSAL_TO_INVOICE }),
        expect.objectContaining({ entity: mockProposal })
      );
    });
  });
});