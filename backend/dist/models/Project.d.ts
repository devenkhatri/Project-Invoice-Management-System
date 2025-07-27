import { Project as IProject, ProjectStatus, Task, TimeEntry, Expense } from '../types';
export declare class Project implements IProject {
    id: string;
    name: string;
    client_id: string;
    status: ProjectStatus;
    start_date: string;
    end_date: string;
    budget: number;
    actual_cost?: number;
    description: string;
    progress_percentage?: number;
    is_billable: boolean;
    hourly_rate?: number;
    currency: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
    constructor(data: Partial<IProject>);
    calculateProgress(tasks: Task[]): number;
    calculateActualCost(timeEntries: TimeEntry[], expenses: Expense[]): number;
    calculateProfitability(timeEntries: TimeEntry[], expenses: Expense[]): {
        revenue: number;
        costs: number;
        profit: number;
        margin: number;
    };
    isOverBudget(timeEntries: TimeEntry[], expenses: Expense[]): boolean;
    isOverdue(): boolean;
    getDaysRemaining(): number;
    updateProgress(tasks: Task[]): void;
    updateActualCost(timeEntries: TimeEntry[], expenses: Expense[]): void;
    markCompleted(): void;
    static validate(data: Partial<IProject>): {
        isValid: boolean;
        errors: {
            field: string;
            message: string;
            value: any;
        }[];
        data: null;
    } | {
        isValid: boolean;
        errors: never[];
        data: any;
    };
    toJSON(): IProject;
    static fromJSON(data: any): Project;
}
//# sourceMappingURL=Project.d.ts.map