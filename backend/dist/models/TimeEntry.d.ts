import { z } from 'zod';
import { BaseModel, ValidationResult } from './types';
export interface ITimeEntry extends BaseModel {
    task_id: string;
    project_id: string;
    hours: number;
    description: string;
    date: Date;
}
export declare const TimeEntrySchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    task_id: z.ZodString;
    project_id: z.ZodString;
    hours: z.ZodNumber;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    date: z.ZodDate;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class TimeEntry implements ITimeEntry {
    id: string;
    task_id: string;
    project_id: string;
    hours: number;
    description: string;
    date: Date;
    created_at: Date;
    updated_at: Date;
    constructor(data: Partial<ITimeEntry>);
    private generateId;
    validate(): ValidationResult;
    isToday(): boolean;
    isThisWeek(): boolean;
    isThisMonth(): boolean;
    getFormattedHours(): string;
    updateHours(hours: number): void;
    updateDescription(description: string): void;
    updateDate(date: Date): void;
    calculateBillableAmount(hourlyRate: number): number;
    isWithinDateRange(startDate: Date, endDate: Date): boolean;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): TimeEntry;
    static calculateTotalHours(entries: TimeEntry[]): number;
    static groupByDate(entries: TimeEntry[]): Map<string, TimeEntry[]>;
    static filterByDateRange(entries: TimeEntry[], startDate: Date, endDate: Date): TimeEntry[];
}
//# sourceMappingURL=TimeEntry.d.ts.map