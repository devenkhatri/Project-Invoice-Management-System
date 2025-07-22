import request from 'supertest';
import express from 'express';
import { automationService, WorkflowTriggerType, WorkflowActionType } from '../../services/automation';
import automationRoutes from '../../routes/automation';
import { authenticateToken } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/automation');
jest.mock('../../middleware/auth');

describe('Automation Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock authenticateToken middleware
    (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'user1', role: 'admin' };
      next();
    });
    
    // Create express app
    app = express();
    app.use(express.json());
    app.use('/api/automation', automationRoutes);
  });

  describe('GET /api/automation/workflow-rules', () => {
    it('should return all workflow rules', async () => {
      // Mock workflow rules
      const mockRules = [
        {
          id: 'rule1',
          name: 'Test Rule',
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
          ],
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      // Mock getWorkflowRules
      (automationService.getWorkflowRules as jest.Mock).mockResolvedValue(mockRules);
      
      const response = await request(app).get('/api/automation/workflow-rules');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('rule1');
      expect(automationService.getWorkflowRules).toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      // Mock getWorkflowRules to throw an error
      (automationService.getWorkflowRules as jest.Mock).mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/automation/workflow-rules');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('POST /api/automation/workflow-rules', () => {
    it('should create a new workflow rule', async () => {
      // Mock workflow rule data
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
      
      // Mock createWorkflowRule
      (automationService.createWorkflowRule as jest.Mock).mockResolvedValue({
        ...newRule,
        id: 'rule_123',
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const response = await request(app)
        .post('/api/automation/workflow-rules')
        .send(newRule);
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBe('rule_123');
      expect(response.body.name).toBe('New Rule');
      expect(automationService.createWorkflowRule).toHaveBeenCalledWith(newRule);
    });
    
    it('should validate input', async () => {
      // Invalid rule data (missing required fields)
      const invalidRule = {
        name: 'Invalid Rule',
        // Missing is_active, trigger, actions
      };
      
      const response = await request(app)
        .post('/api/automation/workflow-rules')
        .send(invalidRule);
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(automationService.createWorkflowRule).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/automation/workflow-rules/:id', () => {
    it('should update an existing workflow rule', async () => {
      // Mock update data
      const updates = {
        name: 'Updated Rule',
        description: 'Updated description'
      };
      
      // Mock updateWorkflowRule
      (automationService.updateWorkflowRule as jest.Mock).mockResolvedValue({
        id: 'rule1',
        ...updates,
        is_active: true,
        trigger: { type: WorkflowTriggerType.DEADLINE_APPROACHING, conditions: {} },
        actions: [],
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const response = await request(app)
        .put('/api/automation/workflow-rules/rule1')
        .send(updates);
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Rule');
      expect(automationService.updateWorkflowRule).toHaveBeenCalledWith('rule1', updates);
    });
    
    it('should handle not found errors', async () => {
      // Mock updateWorkflowRule to throw not found error
      (automationService.updateWorkflowRule as jest.Mock).mockRejectedValue(
        new Error('Workflow rule rule999 not found')
      );
      
      const response = await request(app)
        .put('/api/automation/workflow-rules/rule999')
        .send({ name: 'Updated Rule' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Workflow rule not found');
    });
  });

  describe('DELETE /api/automation/workflow-rules/:id', () => {
    it('should delete a workflow rule', async () => {
      // Mock deleteWorkflowRule
      (automationService.deleteWorkflowRule as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app).delete('/api/automation/workflow-rules/rule1');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Workflow rule deleted successfully');
      expect(automationService.deleteWorkflowRule).toHaveBeenCalledWith('rule1');
    });
    
    it('should handle not found errors', async () => {
      // Mock deleteWorkflowRule to return false (not found)
      (automationService.deleteWorkflowRule as jest.Mock).mockResolvedValue(false);
      
      const response = await request(app).delete('/api/automation/workflow-rules/rule999');
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Workflow rule not found');
    });
  });

  describe('POST /api/automation/check-deadlines', () => {
    it('should trigger deadline check', async () => {
      // Mock checkDeadlines
      (automationService.checkDeadlines as jest.Mock).mockResolvedValue({
        tasks: 2,
        projects: 1
      });
      
      const response = await request(app).post('/api/automation/check-deadlines');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Deadline check completed');
      expect(response.body.results).toEqual({ tasks: 2, projects: 1 });
      expect(automationService.checkDeadlines).toHaveBeenCalled();
    });
  });

  describe('POST /api/automation/task-status-change', () => {
    it('should process task status change', async () => {
      // Mock processTaskStatusChange
      (automationService.processTaskStatusChange as jest.Mock).mockResolvedValue(undefined);
      
      const response = await request(app)
        .post('/api/automation/task-status-change')
        .send({
          taskId: 'task1',
          oldStatus: 'in_progress',
          newStatus: 'completed'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task status change processed successfully');
      expect(automationService.processTaskStatusChange).toHaveBeenCalledWith(
        'task1', 'in_progress', 'completed'
      );
    });
    
    it('should validate input', async () => {
      // Invalid data (missing fields)
      const response = await request(app)
        .post('/api/automation/task-status-change')
        .send({
          taskId: 'task1'
          // Missing oldStatus and newStatus
        });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(automationService.processTaskStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/automation/notifications', () => {
    it('should get notifications for the current user', async () => {
      // Mock notifications
      const mockNotifications = [
        {
          id: 'notif1',
          user_id: 'user1',
          title: 'Test Notification',
          message: 'This is a test',
          type: 'info',
          is_read: false,
          created_at: new Date()
        }
      ];
      
      // Mock getNotifications
      (automationService.getNotifications as jest.Mock).mockResolvedValue(mockNotifications);
      
      const response = await request(app).get('/api/automation/notifications');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('notif1');
      expect(automationService.getNotifications).toHaveBeenCalledWith('user1', expect.any(Object));
    });
    
    it('should apply query parameters', async () => {
      // Mock getNotifications
      (automationService.getNotifications as jest.Mock).mockResolvedValue([]);
      
      const response = await request(app).get('/api/automation/notifications?limit=5&unreadOnly=true');
      
      expect(response.status).toBe(200);
      expect(automationService.getNotifications).toHaveBeenCalledWith('user1', {
        limit: 5,
        unreadOnly: true
      });
    });
  });

  describe('PUT /api/automation/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      // Mock markNotificationAsRead
      (automationService.markNotificationAsRead as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app).put('/api/automation/notifications/notif1/read');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification marked as read');
      expect(automationService.markNotificationAsRead).toHaveBeenCalledWith('notif1');
    });
    
    it('should handle not found errors', async () => {
      // Mock markNotificationAsRead to return false (not found)
      (automationService.markNotificationAsRead as jest.Mock).mockResolvedValue(false);
      
      const response = await request(app).put('/api/automation/notifications/notif999/read');
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Notification not found');
    });
  });

  describe('PUT /api/automation/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      // Mock markAllNotificationsAsRead
      (automationService.markAllNotificationsAsRead as jest.Mock).mockResolvedValue(3);
      
      const response = await request(app).put('/api/automation/notifications/read-all');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('3 notifications marked as read');
      expect(automationService.markAllNotificationsAsRead).toHaveBeenCalledWith('user1');
    });
  });
});