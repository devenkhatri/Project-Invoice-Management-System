import { Project, ProjectSchema } from '../Project';
import { ProjectStatus } from '../types';

describe('Project Model', () => {
  const validProjectData = {
    name: 'Test Project',
    client_id: '123e4567-e89b-12d3-a456-426614174000',
    status: ProjectStatus.ACTIVE,
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    budget: 10000,
    description: 'Test project description'
  };

  describe('Constructor', () => {
    it('should create a project with valid data', () => {
      const project = new Project(validProjectData);
      
      expect(project.name).toBe(validProjectData.name);
      expect(project.client_id).toBe(validProjectData.client_id);
      expect(project.status).toBe(validProjectData.status);
      expect(project.budget).toBe(validProjectData.budget);
      expect(project.id).toBeDefined();
      expect(project.created_at).toBeInstanceOf(Date);
      expect(project.updated_at).toBeInstanceOf(Date);
    });

    it('should generate ID if not provided', () => {
      const project = new Project(validProjectData);
      expect(project.id).toMatch(/^proj_/);
    });

    it('should use provided ID if given', () => {
      const customId = '123e4567-e89b-12d3-a456-426614174000';
      const project = new Project({ ...validProjectData, id: customId });
      expect(project.id).toBe(customId);
    });
  });

  describe('Validation', () => {
    it('should validate a valid project', () => {
      const project = new Project(validProjectData);
      const result = project.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty name', () => {
      const project = new Project({ ...validProjectData, name: '' });
      const result = project.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: 'Project name is required'
        })
      );
    });

    it('should fail validation for empty client_id', () => {
      const project = new Project({ ...validProjectData, client_id: '' });
      const result = project.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'client_id',
          message: 'Client ID is required'
        })
      );
    });

    it('should fail validation for negative budget', () => {
      const project = new Project({ ...validProjectData, budget: -1000 });
      const result = project.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'budget',
          message: 'Budget must be non-negative'
        })
      );
    });

    it('should fail validation when end_date is before start_date', () => {
      const project = new Project({
        ...validProjectData,
        start_date: new Date('2024-12-31'),
        end_date: new Date('2024-01-01')
      });
      const result = project.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'end_date',
          message: 'End date must be after start date'
        })
      );
    });
  });

  describe('Business Logic Methods', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project(validProjectData);
    });

    it('should correctly identify active projects', () => {
      project.status = ProjectStatus.ACTIVE;
      expect(project.isActive()).toBe(true);

      project.status = ProjectStatus.COMPLETED;
      expect(project.isActive()).toBe(false);
    });

    it('should correctly identify overdue projects', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      project.end_date = pastDate;
      project.status = ProjectStatus.ACTIVE;
      expect(project.isOverdue()).toBe(true);

      project.status = ProjectStatus.COMPLETED;
      expect(project.isOverdue()).toBe(false);
    });

    it('should calculate duration in days correctly', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      project.start_date = start;
      project.end_date = end;
      
      expect(project.getDurationInDays()).toBe(31);
    });

    it('should calculate remaining days correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      project.end_date = futureDate;
      expect(project.getRemainingDays()).toBe(10);
    });

    it('should mark project as completed', () => {
      project.markCompleted();
      expect(project.status).toBe(ProjectStatus.COMPLETED);
      expect(project.updated_at).toBeInstanceOf(Date);
    });

    it('should update budget correctly', () => {
      const newBudget = 15000;
      project.updateBudget(newBudget);
      
      expect(project.budget).toBe(newBudget);
      expect(project.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for negative budget', () => {
      expect(() => project.updateBudget(-1000)).toThrow('Budget cannot be negative');
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const project = new Project(validProjectData);
      const row = project.toSheetRow();
      
      expect(row.name).toBe(project.name);
      expect(row.client_id).toBe(project.client_id);
      expect(row.status).toBe(project.status);
      expect(row.budget).toBe(project.budget);
      expect(typeof row.created_at).toBe('string');
      expect(typeof row.updated_at).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sheet Project',
        client_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'active',
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z',
        budget: '10000',
        description: 'From sheet',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const project = Project.fromSheetRow(sheetRow);
      
      expect(project.id).toBe(sheetRow.id);
      expect(project.name).toBe(sheetRow.name);
      expect(project.budget).toBe(10000);
      expect(project.start_date).toBeInstanceOf(Date);
    });
  });
});