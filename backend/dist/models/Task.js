"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const types_1 = require("../types");
const schemas_1 = require("../validation/schemas");
class Task {
    constructor(data) {
        const validation = (0, schemas_1.validateTask)(data);
        if (!validation.isValid) {
            throw new Error(`Invalid task data: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const validatedData = validation.data;
        Object.assign(this, validatedData);
        if (!this.created_at) {
            this.created_at = new Date().toISOString();
        }
        this.updated_at = new Date().toISOString();
    }
    calculateBillableAmount(defaultHourlyRate) {
        if (!this.is_billable)
            return 0;
        const rate = this.hourly_rate || defaultHourlyRate || 0;
        return this.actual_hours * rate;
    }
    calculateVariance() {
        const hoursVariance = this.actual_hours - this.estimated_hours;
        const percentageVariance = this.estimated_hours > 0
            ? (hoursVariance / this.estimated_hours) * 100
            : 0;
        return {
            hours: Math.round(hoursVariance * 100) / 100,
            percentage: Math.round(percentageVariance * 100) / 100
        };
    }
    isOverdue() {
        const now = new Date();
        const dueDate = new Date(this.due_date);
        return now > dueDate && this.status !== types_1.TaskStatus.COMPLETED;
    }
    getDaysRemaining() {
        const now = new Date();
        const dueDate = new Date(this.due_date);
        const diffTime = dueDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    getCompletionPercentage() {
        if (this.status === types_1.TaskStatus.COMPLETED)
            return 100;
        if (this.status === types_1.TaskStatus.IN_PROGRESS) {
            return this.estimated_hours > 0
                ? Math.min((this.actual_hours / this.estimated_hours) * 100, 99)
                : 50;
        }
        return 0;
    }
    canStart(completedTaskIds) {
        if (!this.dependencies || this.dependencies.length === 0)
            return true;
        return this.dependencies.every(depId => completedTaskIds.includes(depId));
    }
    updateStatus(newStatus) {
        this.status = newStatus;
        this.updated_at = new Date().toISOString();
        if (newStatus === types_1.TaskStatus.COMPLETED && this.actual_hours === 0) {
            this.actual_hours = this.estimated_hours;
        }
    }
    addTimeEntry(hours) {
        this.actual_hours += hours;
        this.updated_at = new Date().toISOString();
        if (this.status === types_1.TaskStatus.TODO && hours > 0) {
            this.status = types_1.TaskStatus.IN_PROGRESS;
        }
    }
    markCompleted() {
        this.status = types_1.TaskStatus.COMPLETED;
        this.updated_at = new Date().toISOString();
        if (this.actual_hours === 0) {
            this.actual_hours = this.estimated_hours;
        }
    }
    getPriorityWeight() {
        switch (this.priority) {
            case types_1.TaskPriority.HIGH: return 3;
            case types_1.TaskPriority.MEDIUM: return 2;
            case types_1.TaskPriority.LOW: return 1;
            default: return 1;
        }
    }
    static validate(data) {
        return (0, schemas_1.validateTask)(data);
    }
    toJSON() {
        return {
            id: this.id,
            project_id: this.project_id,
            title: this.title,
            description: this.description,
            status: this.status,
            priority: this.priority,
            due_date: this.due_date,
            estimated_hours: this.estimated_hours,
            actual_hours: this.actual_hours,
            is_billable: this.is_billable,
            hourly_rate: this.hourly_rate,
            assignee: this.assignee,
            dependencies: this.dependencies,
            tags: this.tags,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    static fromJSON(data) {
        return new Task(data);
    }
}
exports.Task = Task;
//# sourceMappingURL=Task.js.map