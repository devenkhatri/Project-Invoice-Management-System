import { TimeEntry as ITimeEntry } from '../types';
import { validateTimeEntry } from '../validation/schemas';

export class TimeEntry implements ITimeEntry {
  id!: string;
  task_id!: string;
  project_id!: string;
  hours!: number;
  description!: string;
  date!: string;
  start_time?: string;
  end_time?: string;
  is_billable!: boolean;
  hourly_rate?: number;
  total_amount?: number;
  user_id?: string;
  invoice_id?: string;
  created_at!: string;
  updated_at?: string;

  constructor(data: Partial<ITimeEntry>) {
    const validation = validateTimeEntry(data);
    if (!validation.isValid) {
      throw new Error(`Invalid time entry data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as ITimeEntry;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
    
    // Calculate total amount if hourly rate is provided
    if (this.is_billable && this.hourly_rate) {
      this.total_amount = this.calculateTotalAmount();
    }
  }

  // Business logic methods
  calculateTotalAmount(defaultHourlyRate?: number): number {
    if (!this.is_billable) return 0;
    
    const rate = this.hourly_rate || defaultHourlyRate || 0;
    return Math.round(this.hours * rate * 100) / 100;
  }

  updateTotalAmount(defaultHourlyRate?: number): void {
    this.total_amount = this.calculateTotalAmount(defaultHourlyRate);
    this.updated_at = new Date().toISOString();
  }

  // Time calculation methods
  calculateHoursFromTimeRange(): number {
    if (!this.start_time || !this.end_time) return this.hours;
    
    const [startHour, startMin] = this.start_time.split(':').map(Number);
    const [endHour, endMin] = this.end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    const diffMinutes = endMinutes - startMinutes;
    return Math.round((diffMinutes / 60) * 100) / 100;
  }

  updateHoursFromTimeRange(): void {
    if (this.start_time && this.end_time) {
      this.hours = this.calculateHoursFromTimeRange();
      this.updateTotalAmount();
    }
  }

  setTimeRange(startTime: string, endTime: string): void {
    this.start_time = startTime;
    this.end_time = endTime;
    this.updateHoursFromTimeRange();
  }

  // Validation methods
  isValidTimeRange(): boolean {
    if (!this.start_time || !this.end_time) return true;
    
    const [startHour, startMin] = this.start_time.split(':').map(Number);
    const [endHour, endMin] = this.end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return endMinutes > startMinutes;
  }

  isToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.date === today;
  }

  isThisWeek(): boolean {
    const entryDate = new Date(this.date);
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    return entryDate >= startOfWeek && entryDate <= endOfWeek;
  }

  isThisMonth(): boolean {
    const entryDate = new Date(this.date);
    const today = new Date();
    
    return entryDate.getMonth() === today.getMonth() && 
           entryDate.getFullYear() === today.getFullYear();
  }

  // Billing methods
  markAsBilled(invoiceId: string): void {
    this.invoice_id = invoiceId;
    this.updated_at = new Date().toISOString();
  }

  isBilled(): boolean {
    return !!this.invoice_id;
  }

  toggleBillable(): void {
    this.is_billable = !this.is_billable;
    this.updateTotalAmount();
  }

  updateHourlyRate(rate: number): void {
    this.hourly_rate = rate;
    this.updateTotalAmount();
  }

  // Formatting methods
  getFormattedDuration(): string {
    const hours = Math.floor(this.hours);
    const minutes = Math.round((this.hours - hours) * 60);
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }

  getFormattedTimeRange(): string {
    if (!this.start_time || !this.end_time) return '';
    return `${this.start_time} - ${this.end_time}`;
  }

  getFormattedDate(): string {
    return new Date(this.date).toLocaleDateString();
  }

  // Summary methods
  static calculateTotalHours(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => total + entry.hours, 0);
  }

  static calculateTotalBillableHours(entries: TimeEntry[]): number {
    return entries
      .filter(entry => entry.is_billable)
      .reduce((total, entry) => total + entry.hours, 0);
  }

  static calculateTotalAmount(entries: TimeEntry[]): number {
    return entries
      .filter(entry => entry.is_billable && entry.total_amount)
      .reduce((total, entry) => total + (entry.total_amount || 0), 0);
  }

  static groupByDate(entries: TimeEntry[]): Record<string, TimeEntry[]> {
    return entries.reduce((groups, entry) => {
      const date = entry.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
      return groups;
    }, {} as Record<string, TimeEntry[]>);
  }

  static groupByProject(entries: TimeEntry[]): Record<string, TimeEntry[]> {
    return entries.reduce((groups, entry) => {
      const projectId = entry.project_id;
      if (!groups[projectId]) {
        groups[projectId] = [];
      }
      groups[projectId].push(entry);
      return groups;
    }, {} as Record<string, TimeEntry[]>);
  }

  // Validation methods
  static validate(data: Partial<ITimeEntry>) {
    return validateTimeEntry(data);
  }

  // Serialization methods
  toJSON(): ITimeEntry {
    return {
      id: this.id,
      task_id: this.task_id,
      project_id: this.project_id,
      hours: this.hours,
      description: this.description,
      date: this.date,
      start_time: this.start_time,
      end_time: this.end_time,
      is_billable: this.is_billable,
      hourly_rate: this.hourly_rate,
      total_amount: this.total_amount,
      user_id: this.user_id,
      invoice_id: this.invoice_id,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromJSON(data: any): TimeEntry {
    return new TimeEntry(data);
  }
}