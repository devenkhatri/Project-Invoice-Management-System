import { z } from 'zod';
import { BaseModel, ProjectStatus, ValidationResult } from './types';
export interface IProject extends BaseModel {
    name: string;
    client_id: string;
    status: ProjectStatus;
    start_date: Date;
    end_date: Date;
    budget: number;
    description: string;
}
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    client_id: z.ZodString;
    status: z.ZodEnum<typeof ProjectStatus>;
    start_date: z.ZodDate;
    end_date: z.ZodDate;
    budget: z.ZodNumber;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class Project implements IProject {
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
    constructor(data: Partial<IProject>);
    private generateId;
    validate(): ValidationResult;
    isActive(): boolean;
    isOverdue(): boolean;
    getDurationInDays(): number;
    getRemainingDays(): number;
    markCompleted(): void;
    updateBudget(newBudget: number): void;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): Project;
}
//# sourceMappingURL=Project.d.ts.map