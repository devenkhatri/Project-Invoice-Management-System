export declare enum ProjectStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    ON_HOLD = "on-hold"
}
export declare enum TaskStatus {
    TODO = "todo",
    IN_PROGRESS = "in-progress",
    COMPLETED = "completed"
}
export declare enum TaskPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export declare enum InvoiceStatus {
    DRAFT = "draft",
    SENT = "sent",
    PAID = "paid",
    OVERDUE = "overdue"
}
export declare enum ExpenseCategory {
    TRAVEL = "travel",
    EQUIPMENT = "equipment",
    SOFTWARE = "software",
    MARKETING = "marketing",
    OFFICE = "office",
    OTHER = "other"
}
export interface BaseModel {
    id: string;
    created_at: Date;
    updated_at: Date;
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
//# sourceMappingURL=types.d.ts.map