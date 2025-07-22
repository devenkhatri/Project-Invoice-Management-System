"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.TaskSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.TaskSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    project_id: zod_1.z.string().min(1, 'Project ID is required'),
    title: zod_1.z.string().min(1, 'Task title is required').max(255, 'Task title too long'),
    description: zod_1.z.string().max(1000, 'Description too long').optional().default(''),
    status: zod_1.z.nativeEnum(types_1.TaskStatus),
    priority: zod_1.z.nativeEnum(types_1.TaskPriority),
    due_date: zod_1.z.date(),
    estimated_hours: zod_1.z.number().min(0, 'Estimated hours must be non-negative'),
    actual_hours: zod_1.z.number().min(0, 'Actual hours must be non-negative').default(0),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
});
class Task {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.project_id = data.project_id || '';
        this.title = data.title || '';
        this.description = data.description || '';
        this.status = data.status || types_1.TaskStatus.TODO;
        this.priority = data.priority || types_1.TaskPriority.MEDIUM;
        this.due_date = data.due_date || new Date();
        this.estimated_hours = data.estimated_hours || 0;
        this.actual_hours = data.actual_hours || 0;
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validate() {
        try {
            exports.TaskSchema.parse(this);
            return { isValid: true, errors: [] };
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const errors = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code
                }));
                return { isValid: false, errors };
            }
            return {
                isValid: false,
                errors: [{ field: 'general', message: 'Validation failed', code: 'unknown' }]
            };
        }
    }
    isCompleted() {
        return this.status === types_1.TaskStatus.COMPLETED;
    }
    isOverdue() {
        return this.due_date < new Date() && this.status !== types_1.TaskStatus.COMPLETED;
    }
    getProgressPercentage() {
        if (this.estimated_hours === 0)
            return 0;
        return Math.min((this.actual_hours / this.estimated_hours) * 100, 100);
    }
    getRemainingHours() {
        return Math.max(this.estimated_hours - this.actual_hours, 0);
    }
    isOverBudget() {
        return this.actual_hours > this.estimated_hours;
    }
    markCompleted() {
        this.status = types_1.TaskStatus.COMPLETED;
        this.updated_at = new Date();
    }
    startTask() {
        if (this.status === types_1.TaskStatus.TODO) {
            this.status = types_1.TaskStatus.IN_PROGRESS;
            this.updated_at = new Date();
        }
    }
    addTimeEntry(hours) {
        if (hours < 0) {
            throw new Error('Hours cannot be negative');
        }
        this.actual_hours += hours;
        this.updated_at = new Date();
    }
    updateEstimate(hours) {
        if (hours < 0) {
            throw new Error('Estimated hours cannot be negative');
        }
        this.estimated_hours = hours;
        this.updated_at = new Date();
    }
    toSheetRow() {
        return {
            id: this.id,
            project_id: this.project_id,
            title: this.title,
            description: this.description,
            status: this.status,
            priority: this.priority,
            due_date: this.due_date.toISOString(),
            estimated_hours: this.estimated_hours,
            actual_hours: this.actual_hours,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }
    static fromSheetRow(row) {
        return new Task({
            id: row.id,
            project_id: row.project_id,
            title: row.title,
            description: row.description || '',
            status: row.status,
            priority: row.priority,
            due_date: new Date(row.due_date),
            estimated_hours: parseFloat(row.estimated_hours) || 0,
            actual_hours: parseFloat(row.actual_hours) || 0,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
}
exports.Task = Task;
//# sourceMappingURL=Task.js.map