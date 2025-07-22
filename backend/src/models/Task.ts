import { z } from 'zod';
import { BaseModel, TaskStatus, TaskPriority, ValidationResult, ValidationError } from './types';

// TypeScript interface for Task
export interface ITask extends BaseModel {
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: Date;
  estimated_hours: number;
  actual_hours: number;
}

// Zod schema for validation
export const TaskSchema = z.object({
  id: z.string().min(1).optional(),
  project_id: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Task title is required').max(255, 'Task title too long'),
  description: z.string().max(1000, 'Description too long').optional().default(''),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  due_date: z.date(),
  estimated_hours: z.number().min(0, 'Estimated hours must be non-negative'),
  actual_hours: z.number().min(0, 'Actual hours must be non-negative').default(0),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// Task model class with business logic
export class Task implements ITask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: Date;
  estimated_hours: number;
  actual_hours: number;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<ITask>) {
    this.id = data.id || this.generateId();
    this.project_id = data.project_id || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.status = data.status || TaskStatus.TODO;
    this.priority = data.priority || TaskPriority.MEDIUM;
    this.due_date = data.due_date || new Date();
    this.estimated_hours = data.estimated_hours || 0;
    this.actual_hours = data.actual_hours || 0;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      TaskSchema.parse(this);
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
  isCompleted(): boolean {
    return this.status === TaskStatus.COMPLETED;
  }

  isOverdue(): boolean {
    return this.due_date < new Date() && this.status !== TaskStatus.COMPLETED;
  }

  getProgressPercentage(): number {
    if (this.estimated_hours === 0) return 0;
    return Math.min((this.actual_hours / this.estimated_hours) * 100, 100);
  }

  getRemainingHours(): number {
    return Math.max(this.estimated_hours - this.actual_hours, 0);
  }

  isOverBudget(): boolean {
    return this.actual_hours > this.estimated_hours;
  }

  markCompleted(): void {
    this.status = TaskStatus.COMPLETED;
    this.updated_at = new Date();
  }

  startTask(): void {
    if (this.status === TaskStatus.TODO) {
      this.status = TaskStatus.IN_PROGRESS;
      this.updated_at = new Date();
    }
  }

  addTimeEntry(hours: number): void {
    if (hours < 0) {
      throw new Error('Hours cannot be negative');
    }
    this.actual_hours += hours;
    this.updated_at = new Date();
  }

  updateEstimate(hours: number): void {
    if (hours < 0) {
      throw new Error('Estimated hours cannot be negative');
    }
    this.estimated_hours = hours;
    this.updated_at = new Date();
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      project_id: this.project_id,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      due_date: this.due_date.toISOString(),
      estimated_hours: this.estimated_hours,
      actual_hours: this.actual_hours,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Task {
    return new Task({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description: row.description || '',
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      due_date: new Date(row.due_date),
      estimated_hours: parseFloat(row.estimated_hours) || 0,
      actual_hours: parseFloat(row.actual_hours) || 0,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }
}