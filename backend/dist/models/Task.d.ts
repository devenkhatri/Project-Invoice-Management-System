import { z } from 'zod';
import { BaseModel, TaskStatus, TaskPriority, ValidationResult } from './types';
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
export declare const TaskSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    project_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    status: z.ZodEnum<typeof TaskStatus>;
    priority: z.ZodEnum<typeof TaskPriority>;
    due_date: z.ZodDate;
    estimated_hours: z.ZodNumber;
    actual_hours: z.ZodDefault<z.ZodNumber>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class Task implements ITask {
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
    constructor(data: Partial<ITask>);
    private generateId;
    validate(): ValidationResult;
    isCompleted(): boolean;
    isOverdue(): boolean;
    getProgressPercentage(): number;
    getRemainingHours(): number;
    isOverBudget(): boolean;
    markCompleted(): void;
    startTask(): void;
    addTimeEntry(hours: number): void;
    updateEstimate(hours: number): void;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): Task;
}
//# sourceMappingURL=Task.d.ts.map