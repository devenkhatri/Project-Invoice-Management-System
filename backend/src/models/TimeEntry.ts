import { z } from 'zod';
import { BaseModel, ValidationResult, ValidationError } from './types';

// TypeScript interface for TimeEntry
export interface ITimeEntry extends BaseModel {
  task_id: string;
  project_id: string;
  hours: number;
  description: string;
  date: Date;
}

// Zod schema for validation
export const TimeEntrySchema = z.object({
  id: z.string().min(1).optional(),
  task_id: z.string().min(1, 'Task ID is required'),
  project_id: z.string().min(1, 'Project ID is required'),
  hours: z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Hours cannot exceed 24 per day'),
  description: z.string().max(500, 'Description too long').optional().default(''),
  date: z.date(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// TimeEntry model class with business logic
export class TimeEntry implements ITimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  hours: number;
  description: string;
  date: Date;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<ITimeEntry>) {
    this.id = data.id || this.generateId();
    this.task_id = data.task_id || '';
    this.project_id = data.project_id || '';
    this.hours = data.hours || 0;
    this.description = data.description || '';
    this.date = data.date || new Date();
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'time_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      TimeEntrySchema.parse(this);
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
  isToday(): boolean {
    const today = new Date();
    return this.date.toDateString() === today.toDateString();
  }

  isThisWeek(): boolean {
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    return this.date >= weekStart && this.date <= weekEnd;
  }

  isThisMonth(): boolean {
    const today = new Date();
    return this.date.getMonth() === today.getMonth() && 
           this.date.getFullYear() === today.getFullYear();
  }

  getFormattedHours(): string {
    const hours = Math.floor(this.hours);
    const minutes = Math.round((this.hours - hours) * 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  updateHours(hours: number): void {
    if (hours < 0.1) {
      throw new Error('Hours must be at least 0.1');
    }
    if (hours > 24) {
      throw new Error('Hours cannot exceed 24 per day');
    }
    this.hours = hours;
    this.updated_at = new Date();
  }

  updateDescription(description: string): void {
    this.description = description;
    this.updated_at = new Date();
  }

  updateDate(date: Date): void {
    this.date = date;
    this.updated_at = new Date();
  }

  // Calculate billable amount based on hourly rate
  calculateBillableAmount(hourlyRate: number): number {
    return this.hours * hourlyRate;
  }

  // Check if entry is within a date range
  isWithinDateRange(startDate: Date, endDate: Date): boolean {
    return this.date >= startDate && this.date <= endDate;
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      task_id: this.task_id,
      project_id: this.project_id,
      hours: this.hours,
      description: this.description,
      date: this.date.toISOString(),
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): TimeEntry {
    return new TimeEntry({
      id: row.id,
      task_id: row.task_id,
      project_id: row.project_id,
      hours: parseFloat(row.hours) || 0,
      description: row.description || '',
      date: new Date(row.date),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }

  // Static method to calculate total hours for multiple entries
  static calculateTotalHours(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => total + entry.hours, 0);
  }

  // Static method to group entries by date
  static groupByDate(entries: TimeEntry[]): Map<string, TimeEntry[]> {
    const grouped = new Map<string, TimeEntry[]>();
    entries.forEach(entry => {
      const dateKey = entry.date.toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    });
    return grouped;
  }

  // Static method to filter entries by date range
  static filterByDateRange(entries: TimeEntry[], startDate: Date, endDate: Date): TimeEntry[] {
    return entries.filter(entry => entry.isWithinDateRange(startDate, endDate));
  }
}