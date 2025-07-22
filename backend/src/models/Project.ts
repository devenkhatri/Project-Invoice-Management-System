import { z } from 'zod';
import { BaseModel, ProjectStatus, ValidationResult, ValidationError } from './types';

// TypeScript interface for Project
export interface IProject extends BaseModel {
  name: string;
  client_id: string;
  status: ProjectStatus;
  start_date: Date;
  end_date: Date;
  budget: number;
  description: string;
}

// Zod schema for validation
export const ProjectSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Project name is required').max(255, 'Project name too long'),
  client_id: z.string().min(1, 'Client ID is required'),
  status: z.nativeEnum(ProjectStatus),
  start_date: z.date(),
  end_date: z.date(),
  budget: z.number().min(0, 'Budget must be non-negative'),
  description: z.string().max(1000, 'Description too long').optional().default(''),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
}).refine(data => data.end_date >= data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date']
});

// Project model class with business logic
export class Project implements IProject {
  id: string;
  name: string;
  client_id: string;
  status: ProjectStatus;
  start_date: Date;
  end_date: Date;
  budget: number;
  description: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IProject>) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.client_id = data.client_id || '';
    this.status = data.status || ProjectStatus.ACTIVE;
    this.start_date = data.start_date || new Date();
    this.end_date = data.end_date || new Date();
    this.budget = data.budget || 0;
    this.description = data.description || '';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      ProjectSchema.parse(this);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        return { isValid: false, errors };
      }
      return { 
        isValid: false, 
        errors: [{ field: 'general', message: 'Validation failed', code: 'unknown' }] 
      };
    }
  }

  // Business logic methods
  isActive(): boolean {
    return this.status === ProjectStatus.ACTIVE;
  }

  isOverdue(): boolean {
    return this.end_date < new Date() && this.status !== ProjectStatus.COMPLETED;
  }

  getDurationInDays(): number {
    const diffTime = Math.abs(this.end_date.getTime() - this.start_date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
  }

  getRemainingDays(): number {
    const today = new Date();
    if (this.end_date < today) return 0;
    const diffTime = this.end_date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  markCompleted(): void {
    this.status = ProjectStatus.COMPLETED;
    this.updated_at = new Date();
  }

  updateBudget(newBudget: number): void {
    if (newBudget < 0) {
      throw new Error('Budget cannot be negative');
    }
    this.budget = newBudget;
    this.updated_at = new Date();
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      client_id: this.client_id,
      status: this.status,
      start_date: this.start_date.toISOString(),
      end_date: this.end_date.toISOString(),
      budget: this.budget,
      description: this.description,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Project {
    return new Project({
      id: row.id,
      name: row.name,
      client_id: row.client_id,
      status: row.status as ProjectStatus,
      start_date: new Date(row.start_date),
      end_date: new Date(row.end_date),
      budget: parseFloat(row.budget) || 0,
      description: row.description || '',
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }
}