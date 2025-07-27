import { Task as ITask, TaskStatus, TaskPriority } from '../types';
import { validateTask } from '../validation/schemas';

export class Task implements ITask {
  id!: string;
  project_id!: string;
  title!: string;
  description!: string;
  status!: TaskStatus;
  priority!: TaskPriority;
  due_date!: string;
  estimated_hours!: number;
  actual_hours!: number;
  is_billable!: boolean;
  hourly_rate?: number;
  assignee?: string;
  dependencies?: string[];
  tags?: string[];
  created_at!: string;
  updated_at?: string;

  constructor(data: Partial<ITask>) {
    const validation = validateTask(data);
    if (!validation.isValid) {
      throw new Error(`Invalid task data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as ITask;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Business logic methods
  calculateBillableAmount(defaultHourlyRate?: number): number {
    if (!this.is_billable) return 0;
    
    const rate = this.hourly_rate || defaultHourlyRate || 0;
    return this.actual_hours * rate;
  }

  calculateVariance(): {
    hours: number;
    percentage: number;
  } {
    const hoursVariance = this.actual_hours - this.estimated_hours;
    const percentageVariance = this.estimated_hours > 0 
      ? (hoursVariance / this.estimated_hours) * 100 
      : 0;

    return {
      hours: Math.round(hoursVariance * 100) / 100,
      percentage: Math.round(percentageVariance * 100) / 100
    };
  }

  isOverdue(): boolean {
    const now = new Date();
    const dueDate = new Date(this.due_date);
    return now > dueDate && this.status !== TaskStatus.COMPLETED;
  }

  getDaysRemaining(): number {
    const now = new Date();
    const dueDate = new Date(this.due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getCompletionPercentage(): number {
    if (this.status === TaskStatus.COMPLETED) return 100;
    if (this.status === TaskStatus.IN_PROGRESS) {
      return this.estimated_hours > 0 
        ? Math.min((this.actual_hours / this.estimated_hours) * 100, 99)
        : 50;
    }
    return 0;
  }

  canStart(completedTaskIds: string[]): boolean {
    if (!this.dependencies || this.dependencies.length === 0) return true;
    
    return this.dependencies.every(depId => completedTaskIds.includes(depId));
  }

  updateStatus(newStatus: TaskStatus): void {
    this.status = newStatus;
    this.updated_at = new Date().toISOString();
    
    if (newStatus === TaskStatus.COMPLETED && this.actual_hours === 0) {
      this.actual_hours = this.estimated_hours;
    }
  }

  addTimeEntry(hours: number): void {
    this.actual_hours += hours;
    this.updated_at = new Date().toISOString();
    
    // Auto-update status based on progress
    if (this.status === TaskStatus.TODO && hours > 0) {
      this.status = TaskStatus.IN_PROGRESS;
    }
  }

  markCompleted(): void {
    this.status = TaskStatus.COMPLETED;
    this.updated_at = new Date().toISOString();
    
    if (this.actual_hours === 0) {
      this.actual_hours = this.estimated_hours;
    }
  }

  // Priority-based sorting weight
  getPriorityWeight(): number {
    switch (this.priority) {
      case TaskPriority.HIGH: return 3;
      case TaskPriority.MEDIUM: return 2;
      case TaskPriority.LOW: return 1;
      default: return 1;
    }
  }

  // Validation methods
  static validate(data: Partial<ITask>) {
    return validateTask(data);
  }

  // Serialization methods
  toJSON(): ITask {
    return {
      id: this.id,
      project_id: this.project_id,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      due_date: this.due_date,
      estimated_hours: this.estimated_hours,
      actual_hours: this.actual_hours,
      is_billable: this.is_billable,
      hourly_rate: this.hourly_rate,
      assignee: this.assignee,
      dependencies: this.dependencies,
      tags: this.tags,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromJSON(data: any): Task {
    return new Task(data);
  }
}