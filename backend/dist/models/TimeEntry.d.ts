import { TimeEntry as ITimeEntry } from '../types';
export declare class TimeEntry implements ITimeEntry {
    id: string;
    task_id: string;
    project_id: string;
    hours: number;
    description: string;
    date: string;
    start_time?: string;
    end_time?: string;
    is_billable: boolean;
    hourly_rate?: number;
    total_amount?: number;
    user_id?: string;
    invoice_id?: string;
    created_at: string;
    updated_at?: string;
    constructor(data: Partial<ITimeEntry>);
    calculateTotalAmount(defaultHourlyRate?: number): number;
    updateTotalAmount(defaultHourlyRate?: number): void;
    calculateHoursFromTimeRange(): number;
    updateHoursFromTimeRange(): void;
    setTimeRange(startTime: string, endTime: string): void;
    isValidTimeRange(): boolean;
    isToday(): boolean;
    isThisWeek(): boolean;
    isThisMonth(): boolean;
    markAsBilled(invoiceId: string): void;
    isBilled(): boolean;
    toggleBillable(): void;
    updateHourlyRate(rate: number): void;
    getFormattedDuration(): string;
    getFormattedTimeRange(): string;
    getFormattedDate(): string;
    static calculateTotalHours(entries: TimeEntry[]): number;
    static calculateTotalBillableHours(entries: TimeEntry[]): number;
    static calculateTotalAmount(entries: TimeEntry[]): number;
    static groupByDate(entries: TimeEntry[]): Record<string, TimeEntry[]>;
    static groupByProject(entries: TimeEntry[]): Record<string, TimeEntry[]>;
    static validate(data: Partial<ITimeEntry>): {
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
    toJSON(): ITimeEntry;
    static fromJSON(data: any): TimeEntry;
}
//# sourceMappingURL=TimeEntry.d.ts.map