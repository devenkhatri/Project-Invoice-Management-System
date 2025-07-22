import { Task } from '../Task';
import { TaskStatus, TaskPriority } from '../types';

describe('Task Model', () => {
  const validTaskData = {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Task',
    description: 'Test task description',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    due_date: new Date('2024-12-31'),
    estimated_hours: 8,
    actual_hours: 0
  };

  describe('Constructor', () => {
    it('should create a task with valid data', () => {
      const task = new Task(validTaskData);
      
      expect(task.title).toBe(validTaskData.title);
      expect(task.project_id).toBe(validTaskData.project_id);
      expect(task.status).toBe(validTaskData.status);
      expect(task.priority).toBe(validTaskData.priority);
      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task_/);
    });

    it('should set default values correctly', () => {
      const task = new Task({ project_id: validTaskData.project_id, title: 'Test' });
      
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.priority).toBe(TaskPriority.MEDIUM);
      expect(task.actual_hours).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate a valid task', () => {
      const task = new Task(validTaskData);
      const result = task.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty title', () => {
      const task = new Task({ ...validTaskData, title: '' });
      const result = task.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          message: 'Task title is required'
        })
      );
    });

    it('should fail validation for empty project_id', () => {
      const task = new Task({ ...validTaskData, project_id: '' });
      const result = task.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'project_id',
          message: 'Project ID is required'
        })
      );
    });

    it('should fail validation for negative hours', () => {
      const task = new Task({ ...validTaskData, estimated_hours: -1 });
      const result = task.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'estimated_hours',
          message: 'Estimated hours must be non-negative'
        })
      );
    });
  });

  describe('Business Logic Methods', () => {
    let task: Task;

    beforeEach(() => {
      task = new Task(validTaskData);
    });

    it('should correctly identify completed tasks', () => {
      task.status = TaskStatus.COMPLETED;
      expect(task.isCompleted()).toBe(true);

      task.status = TaskStatus.TODO;
      expect(task.isCompleted()).toBe(false);
    });

    it('should correctly identify overdue tasks', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      task.due_date = pastDate;
      task.status = TaskStatus.TODO;
      expect(task.isOverdue()).toBe(true);

      task.status = TaskStatus.COMPLETED;
      expect(task.isOverdue()).toBe(false);
    });

    it('should calculate progress percentage correctly', () => {
      task.estimated_hours = 10;
      task.actual_hours = 5;
      expect(task.getProgressPercentage()).toBe(50);

      task.actual_hours = 15;
      expect(task.getProgressPercentage()).toBe(100); // Capped at 100%
    });

    it('should calculate remaining hours correctly', () => {
      task.estimated_hours = 10;
      task.actual_hours = 3;
      expect(task.getRemainingHours()).toBe(7);

      task.actual_hours = 12;
      expect(task.getRemainingHours()).toBe(0); // Cannot be negative
    });

    it('should identify over-budget tasks', () => {
      task.estimated_hours = 10;
      task.actual_hours = 12;
      expect(task.isOverBudget()).toBe(true);

      task.actual_hours = 8;
      expect(task.isOverBudget()).toBe(false);
    });

    it('should mark task as completed', () => {
      task.markCompleted();
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should start task correctly', () => {
      task.status = TaskStatus.TODO;
      task.startTask();
      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should not change status if task is not TODO when starting', () => {
      task.status = TaskStatus.COMPLETED;
      task.startTask();
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should add time entry correctly', () => {
      const initialHours = task.actual_hours;
      task.addTimeEntry(2.5);
      expect(task.actual_hours).toBe(initialHours + 2.5);
    });

    it('should throw error for negative time entry', () => {
      expect(() => task.addTimeEntry(-1)).toThrow('Hours cannot be negative');
    });

    it('should update estimate correctly', () => {
      task.updateEstimate(15);
      expect(task.estimated_hours).toBe(15);
    });

    it('should throw error for negative estimate', () => {
      expect(() => task.updateEstimate(-1)).toThrow('Estimated hours cannot be negative');
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const task = new Task(validTaskData);
      const row = task.toSheetRow();
      
      expect(row.title).toBe(task.title);
      expect(row.project_id).toBe(task.project_id);
      expect(row.status).toBe(task.status);
      expect(row.priority).toBe(task.priority);
      expect(typeof row.due_date).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Sheet Task',
        description: 'From sheet',
        status: 'todo',
        priority: 'high',
        due_date: '2024-12-31T00:00:00.000Z',
        estimated_hours: '8',
        actual_hours: '2',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const task = Task.fromSheetRow(sheetRow);
      
      expect(task.id).toBe(sheetRow.id);
      expect(task.title).toBe(sheetRow.title);
      expect(task.estimated_hours).toBe(8);
      expect(task.actual_hours).toBe(2);
      expect(task.due_date).toBeInstanceOf(Date);
    });
  });
});