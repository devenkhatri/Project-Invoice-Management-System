import { Task } from '../Task';
import { TaskStatus, TaskPriority } from '../../types';

describe('Task Model', () => {
  const validTaskData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    project_id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Test Task',
    description: 'Test task description',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    due_date: '2024-12-31',
    estimated_hours: 10,
    actual_hours: 0,
    is_billable: true
  };

  describe('Constructor', () => {
    it('should create a task with valid data', () => {
      const task = new Task(validTaskData);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.priority).toBe(TaskPriority.MEDIUM);
      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        new Task({ ...validTaskData, title: '' });
      }).toThrow('Invalid task data');
    });
  });

  describe('Business Logic Methods', () => {
    let task: Task;

    beforeEach(() => {
      task = new Task(validTaskData);
    });

    describe('calculateBillableAmount', () => {
      it('should calculate billable amount with hourly rate', () => {
        task.actual_hours = 5;
        task.hourly_rate = 1000;
        
        expect(task.calculateBillableAmount()).toBe(5000);
      });

      it('should use default hourly rate when task rate not provided', () => {
        task.actual_hours = 5;
        
        expect(task.calculateBillableAmount(1500)).toBe(7500);
      });

      it('should return 0 for non-billable task', () => {
        task.is_billable = false;
        task.actual_hours = 5;
        task.hourly_rate = 1000;
        
        expect(task.calculateBillableAmount()).toBe(0);
      });
    });

    describe('calculateVariance', () => {
      it('should calculate positive variance when over estimated', () => {
        task.estimated_hours = 10;
        task.actual_hours = 12;
        
        const variance = task.calculateVariance();
        expect(variance.hours).toBe(2);
        expect(variance.percentage).toBe(20);
      });

      it('should calculate negative variance when under estimated', () => {
        task.estimated_hours = 10;
        task.actual_hours = 8;
        
        const variance = task.calculateVariance();
        expect(variance.hours).toBe(-2);
        expect(variance.percentage).toBe(-20);
      });

      it('should handle zero estimated hours', () => {
        task.estimated_hours = 0;
        task.actual_hours = 5;
        
        const variance = task.calculateVariance();
        expect(variance.hours).toBe(5);
        expect(variance.percentage).toBe(0);
      });
    });

    describe('isOverdue', () => {
      it('should return true for overdue incomplete task', () => {
        const overdueTask = new Task({
          ...validTaskData,
          due_date: '2020-01-01',
          status: TaskStatus.IN_PROGRESS
        });
        expect(overdueTask.isOverdue()).toBe(true);
      });

      it('should return false for completed task even if past due date', () => {
        const completedTask = new Task({
          ...validTaskData,
          due_date: '2020-01-01',
          status: TaskStatus.COMPLETED
        });
        expect(completedTask.isOverdue()).toBe(false);
      });
    });

    describe('getCompletionPercentage', () => {
      it('should return 100 for completed task', () => {
        task.status = TaskStatus.COMPLETED;
        expect(task.getCompletionPercentage()).toBe(100);
      });

      it('should calculate percentage for in-progress task', () => {
        task.status = TaskStatus.IN_PROGRESS;
        task.estimated_hours = 10;
        task.actual_hours = 5;
        expect(task.getCompletionPercentage()).toBe(50);
      });

      it('should return 50 for in-progress task with no estimated hours', () => {
        task.status = TaskStatus.IN_PROGRESS;
        task.estimated_hours = 0;
        expect(task.getCompletionPercentage()).toBe(50);
      });

      it('should return 0 for todo task', () => {
        task.status = TaskStatus.TODO;
        expect(task.getCompletionPercentage()).toBe(0);
      });
    });

    describe('canStart', () => {
      it('should return true when no dependencies', () => {
        expect(task.canStart([])).toBe(true);
      });

      it('should return true when all dependencies completed', () => {
        task.dependencies = ['task1', 'task2'];
        expect(task.canStart(['task1', 'task2', 'task3'])).toBe(true);
      });

      it('should return false when dependencies not completed', () => {
        task.dependencies = ['task1', 'task2'];
        expect(task.canStart(['task1'])).toBe(false);
      });
    });

    describe('updateStatus', () => {
      it('should update status and timestamp', async () => {
        const originalUpdatedAt = task.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        task.updateStatus(TaskStatus.IN_PROGRESS);
        
        expect(task.status).toBe(TaskStatus.IN_PROGRESS);
        expect(task.updated_at).not.toBe(originalUpdatedAt);
      });

      it('should set actual hours to estimated when completing task with zero actual hours', () => {
        task.actual_hours = 0;
        task.estimated_hours = 10;
        
        task.updateStatus(TaskStatus.COMPLETED);
        
        expect(task.actual_hours).toBe(10);
      });
    });

    describe('addTimeEntry', () => {
      it('should add hours and update timestamp', async () => {
        const originalUpdatedAt = task.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        task.addTimeEntry(3);
        
        expect(task.actual_hours).toBe(3);
        expect(task.updated_at).not.toBe(originalUpdatedAt);
      });

      it('should change status from TODO to IN_PROGRESS when adding time', () => {
        task.status = TaskStatus.TODO;
        
        task.addTimeEntry(2);
        
        expect(task.status).toBe(TaskStatus.IN_PROGRESS);
      });
    });

    describe('markCompleted', () => {
      it('should mark task as completed', () => {
        task.markCompleted();
        
        expect(task.status).toBe(TaskStatus.COMPLETED);
      });

      it('should set actual hours to estimated if zero', () => {
        task.actual_hours = 0;
        task.estimated_hours = 8;
        
        task.markCompleted();
        
        expect(task.actual_hours).toBe(8);
      });
    });

    describe('getPriorityWeight', () => {
      it('should return correct weight for each priority', () => {
        task.priority = TaskPriority.HIGH;
        expect(task.getPriorityWeight()).toBe(3);
        
        task.priority = TaskPriority.MEDIUM;
        expect(task.getPriorityWeight()).toBe(2);
        
        task.priority = TaskPriority.LOW;
        expect(task.getPriorityWeight()).toBe(1);
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const task = new Task(validTaskData);
      const json = task.toJSON();
      
      expect(json.title).toBe('Test Task');
      expect(json.status).toBe(TaskStatus.TODO);
      expect(json.priority).toBe(TaskPriority.MEDIUM);
    });

    it('should deserialize from JSON correctly', () => {
      const task = Task.fromJSON(validTaskData);
      
      expect(task).toBeInstanceOf(Task);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.TODO);
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = Task.validate(validTaskData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = Task.validate({ ...validTaskData, title: '' });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});