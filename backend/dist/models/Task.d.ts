import { Task as ITask, TaskStatus, TaskPriority } from '../types';
export declare class Task implements ITask {
    id: string;
    project_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    estimated_hours: number;
    actual_hours: number;
    is_billable: boolean;
    hourly_rate?: number;
    assignee?: string;
    dependencies?: string[];
    tags?: string[];
    created_at: string;
    updated_at?: string;
    constructor(data: Partial<ITask>);
    calculateBillableAmount(defaultHourlyRate?: number): number;
    calculateVariance(): {
        hours: number;
        percentage: number;
    };
    isOverdue(): boolean;
    getDaysRemaining(): number;
    getCompletionPercentage(): number;
    canStart(completedTaskIds: string[]): boolean;
    updateStatus(newStatus: TaskStatus): void;
    addTimeEntry(hours: number): void;
    markCompleted(): void;
    getPriorityWeight(): number;
    static validate(data: Partial<ITask>): {
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
    toJSON(): ITask;
    static fromJSON(data: any): Task;
}
//# sourceMappingURL=Task.d.ts.map