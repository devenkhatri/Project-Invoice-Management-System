import { Project as IProject, ProjectStatus, Task, TimeEntry, Expense } from '../types';
import { validateProject } from '../validation/schemas';

export class Project implements IProject {
  id!: string;
  name!: string;
  client_id!: string;
  status!: ProjectStatus;
  start_date!: string;
  end_date!: string;
  budget!: number;
  actual_cost?: number;
  description!: string;
  progress_percentage?: number;
  is_billable!: boolean;
  hourly_rate?: number;
  currency!: string;
  tags?: string[];
  created_at!: string;
  updated_at!: string;

  constructor(data: Partial<IProject>) {
    const validation = validateProject(data);
    if (!validation.isValid) {
      throw new Error(`Invalid project data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as IProject;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Business logic methods
  calculateProgress(tasks: Task[]): number {
    if (!tasks || tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  }

  calculateActualCost(timeEntries: TimeEntry[], expenses: Expense[]): number {
    let totalCost = 0;

    // Calculate cost from time entries
    if (timeEntries) {
      totalCost += timeEntries.reduce((sum, entry) => {
        if (entry.is_billable && entry.hourly_rate) {
          return sum + (entry.hours * entry.hourly_rate);
        }
        return sum + (entry.hours * (this.hourly_rate || 0));
      }, 0);
    }

    // Add expenses
    if (expenses) {
      totalCost += expenses.reduce((sum, expense) => sum + expense.amount, 0);
    }

    return totalCost;
  }

  calculateProfitability(timeEntries: TimeEntry[], expenses: Expense[]): {
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  } {
    const costs = this.calculateActualCost(timeEntries, expenses);
    const revenue = this.budget;
    const profit = revenue - costs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      revenue,
      costs,
      profit,
      margin: Math.round(margin * 100) / 100
    };
  }

  isOverBudget(timeEntries: TimeEntry[], expenses: Expense[]): boolean {
    const actualCost = this.calculateActualCost(timeEntries, expenses);
    return actualCost > this.budget;
  }

  isOverdue(): boolean {
    const now = new Date();
    const endDate = new Date(this.end_date);
    return now > endDate && this.status !== ProjectStatus.COMPLETED;
  }

  getDaysRemaining(): number {
    const now = new Date();
    const endDate = new Date(this.end_date);
    const diffTime = endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  updateProgress(tasks: Task[]): void {
    this.progress_percentage = this.calculateProgress(tasks);
    this.updated_at = new Date().toISOString();
  }

  updateActualCost(timeEntries: TimeEntry[], expenses: Expense[]): void {
    this.actual_cost = this.calculateActualCost(timeEntries, expenses);
    this.updated_at = new Date().toISOString();
  }

  markCompleted(): void {
    this.status = ProjectStatus.COMPLETED;
    this.progress_percentage = 100;
    this.updated_at = new Date().toISOString();
  }

  // Validation methods
  static validate(data: Partial<IProject>) {
    return validateProject(data);
  }

  // Serialization methods
  toJSON(): IProject {
    return {
      id: this.id,
      name: this.name,
      client_id: this.client_id,
      status: this.status,
      start_date: this.start_date,
      end_date: this.end_date,
      budget: this.budget,
      actual_cost: this.actual_cost,
      description: this.description,
      progress_percentage: this.progress_percentage,
      is_billable: this.is_billable,
      hourly_rate: this.hourly_rate,
      currency: this.currency,
      tags: this.tags,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromJSON(data: any): Project {
    return new Project(data);
  }
}