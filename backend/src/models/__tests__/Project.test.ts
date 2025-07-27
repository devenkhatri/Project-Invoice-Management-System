import { Project } from '../Project';
import { ProjectStatus, TaskStatus, Task, TimeEntry, Expense } from '../../types';

describe('Project Model', () => {
  const validProjectData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Project',
    client_id: '550e8400-e29b-41d4-a716-446655440001',
    status: ProjectStatus.ACTIVE,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    budget: 100000,
    description: 'Test project description',
    is_billable: true,
    currency: 'INR'
  };

  describe('Constructor', () => {
    it('should create a project with valid data', () => {
      const project = new Project(validProjectData);
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe(ProjectStatus.ACTIVE);
      expect(project.budget).toBe(100000);
      expect(project.created_at).toBeDefined();
      expect(project.updated_at).toBeDefined();
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        new Project({ ...validProjectData, name: '' });
      }).toThrow('Invalid project data');
    });

    it('should throw error when end date is before start date', () => {
      expect(() => {
        new Project({
          ...validProjectData,
          start_date: '2024-12-31',
          end_date: '2024-01-01'
        });
      }).toThrow('Invalid project data');
    });
  });

  describe('Business Logic Methods', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project(validProjectData);
    });

    describe('calculateProgress', () => {
      it('should return 0 for empty tasks array', () => {
        expect(project.calculateProgress([])).toBe(0);
      });

      it('should calculate correct progress percentage', () => {
        const tasks: Task[] = [
          { status: TaskStatus.COMPLETED } as Task,
          { status: TaskStatus.COMPLETED } as Task,
          { status: TaskStatus.IN_PROGRESS } as Task,
          { status: TaskStatus.TODO } as Task
        ];
        expect(project.calculateProgress(tasks)).toBe(50);
      });

      it('should return 100 for all completed tasks', () => {
        const tasks: Task[] = [
          { status: TaskStatus.COMPLETED } as Task,
          { status: TaskStatus.COMPLETED } as Task
        ];
        expect(project.calculateProgress(tasks)).toBe(100);
      });
    });

    describe('calculateActualCost', () => {
      it('should calculate cost from time entries and expenses', () => {
        const timeEntries: TimeEntry[] = [
          { hours: 10, is_billable: true, hourly_rate: 1000 } as TimeEntry,
          { hours: 5, is_billable: true, hourly_rate: 1500 } as TimeEntry,
          { hours: 3, is_billable: false, hourly_rate: 1000 } as TimeEntry
        ];
        const expenses: Expense[] = [
          { amount: 5000 } as Expense,
          { amount: 3000 } as Expense
        ];

        const actualCost = project.calculateActualCost(timeEntries, expenses);
        expect(actualCost).toBe(25500); // (10*1000) + (5*1500) + 5000 + 3000
      });

      it('should use project hourly rate when entry rate is not provided', () => {
        project.hourly_rate = 2000;
        const timeEntries: TimeEntry[] = [
          { hours: 10, is_billable: true } as TimeEntry
        ];
        const expenses: Expense[] = [];

        const actualCost = project.calculateActualCost(timeEntries, expenses);
        expect(actualCost).toBe(20000);
      });
    });

    describe('calculateProfitability', () => {
      it('should calculate profitability metrics', () => {
        const timeEntries: TimeEntry[] = [
          { hours: 10, is_billable: true, hourly_rate: 1000 } as TimeEntry
        ];
        const expenses: Expense[] = [
          { amount: 5000 } as Expense
        ];

        const profitability = project.calculateProfitability(timeEntries, expenses);
        expect(profitability.revenue).toBe(100000);
        expect(profitability.costs).toBe(15000);
        expect(profitability.profit).toBe(85000);
        expect(profitability.margin).toBe(85);
      });
    });

    describe('isOverBudget', () => {
      it('should return true when actual cost exceeds budget', () => {
        const timeEntries: TimeEntry[] = [
          { hours: 150, is_billable: true, hourly_rate: 1000 } as TimeEntry
        ];
        const expenses: Expense[] = [];

        expect(project.isOverBudget(timeEntries, expenses)).toBe(true);
      });

      it('should return false when actual cost is within budget', () => {
        const timeEntries: TimeEntry[] = [
          { hours: 50, is_billable: true, hourly_rate: 1000 } as TimeEntry
        ];
        const expenses: Expense[] = [];

        expect(project.isOverBudget(timeEntries, expenses)).toBe(false);
      });
    });

    describe('isOverdue', () => {
      it('should return true for overdue active project', () => {
        const overdueProject = new Project({
          ...validProjectData,
          start_date: '2020-01-01',
          end_date: '2020-12-31',
          status: ProjectStatus.ACTIVE
        });
        expect(overdueProject.isOverdue()).toBe(true);
      });

      it('should return false for completed project even if past end date', () => {
        const completedProject = new Project({
          ...validProjectData,
          start_date: '2020-01-01',
          end_date: '2020-12-31',
          status: ProjectStatus.COMPLETED
        });
        expect(completedProject.isOverdue()).toBe(false);
      });
    });

    describe('updateProgress', () => {
      it('should update progress percentage and updated_at', async () => {
        const tasks: Task[] = [
          { status: TaskStatus.COMPLETED } as Task,
          { status: TaskStatus.TODO } as Task
        ];
        const originalUpdatedAt = project.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        project.updateProgress(tasks);
        
        expect(project.progress_percentage).toBe(50);
        expect(project.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('markCompleted', () => {
      it('should mark project as completed with 100% progress', () => {
        project.markCompleted();
        
        expect(project.status).toBe(ProjectStatus.COMPLETED);
        expect(project.progress_percentage).toBe(100);
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const project = new Project(validProjectData);
      const json = project.toJSON();
      
      expect(json.name).toBe('Test Project');
      expect(json.status).toBe(ProjectStatus.ACTIVE);
      expect(json.budget).toBe(100000);
    });

    it('should deserialize from JSON correctly', () => {
      const project = Project.fromJSON(validProjectData);
      
      expect(project).toBeInstanceOf(Project);
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe(ProjectStatus.ACTIVE);
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = Project.validate(validProjectData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = Project.validate({ ...validProjectData, name: '' });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});