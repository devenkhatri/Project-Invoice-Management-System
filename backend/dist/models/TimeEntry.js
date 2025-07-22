"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeEntry = exports.TimeEntrySchema = void 0;
const zod_1 = require("zod");
exports.TimeEntrySchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    task_id: zod_1.z.string().min(1, 'Task ID is required'),
    project_id: zod_1.z.string().min(1, 'Project ID is required'),
    hours: zod_1.z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Hours cannot exceed 24 per day'),
    description: zod_1.z.string().max(500, 'Description too long').optional().default(''),
    date: zod_1.z.date(),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
});
class TimeEntry {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.task_id = data.task_id || '';
        this.project_id = data.project_id || '';
        this.hours = data.hours || 0;
        this.description = data.description || '';
        this.date = data.date || new Date();
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'time_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validate() {
        try {
            exports.TimeEntrySchema.parse(this);
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
    isToday() {
        const today = new Date();
        return this.date.toDateString() === today.toDateString();
    }
    isThisWeek() {
        const today = new Date();
        const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
        const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        return this.date >= weekStart && this.date <= weekEnd;
    }
    isThisMonth() {
        const today = new Date();
        return this.date.getMonth() === today.getMonth() &&
            this.date.getFullYear() === today.getFullYear();
    }
    getFormattedHours() {
        const hours = Math.floor(this.hours);
        const minutes = Math.round((this.hours - hours) * 60);
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    updateHours(hours) {
        if (hours < 0.1) {
            throw new Error('Hours must be at least 0.1');
        }
        if (hours > 24) {
            throw new Error('Hours cannot exceed 24 per day');
        }
        this.hours = hours;
        this.updated_at = new Date();
    }
    updateDescription(description) {
        this.description = description;
        this.updated_at = new Date();
    }
    updateDate(date) {
        this.date = date;
        this.updated_at = new Date();
    }
    calculateBillableAmount(hourlyRate) {
        return this.hours * hourlyRate;
    }
    isWithinDateRange(startDate, endDate) {
        return this.date >= startDate && this.date <= endDate;
    }
    toSheetRow() {
        return {
            id: this.id,
            task_id: this.task_id,
            project_id: this.project_id,
            hours: this.hours,
            description: this.description,
            date: this.date.toISOString(),
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }
    static fromSheetRow(row) {
        return new TimeEntry({
            id: row.id,
            task_id: row.task_id,
            project_id: row.project_id,
            hours: parseFloat(row.hours) || 0,
            description: row.description || '',
            date: new Date(row.date),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
    static calculateTotalHours(entries) {
        return entries.reduce((total, entry) => total + entry.hours, 0);
    }
    static groupByDate(entries) {
        const grouped = new Map();
        entries.forEach(entry => {
            const dateKey = entry.date.toDateString();
            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, []);
            }
            grouped.get(dateKey).push(entry);
        });
        return grouped;
    }
    static filterByDateRange(entries, startDate, endDate) {
        return entries.filter(entry => entry.isWithinDateRange(startDate, endDate));
    }
}
exports.TimeEntry = TimeEntry;
//# sourceMappingURL=TimeEntry.js.map