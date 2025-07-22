"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = exports.ProjectSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.ProjectSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1, 'Project name is required').max(255, 'Project name too long'),
    client_id: zod_1.z.string().min(1, 'Client ID is required'),
    status: zod_1.z.nativeEnum(types_1.ProjectStatus),
    start_date: zod_1.z.date(),
    end_date: zod_1.z.date(),
    budget: zod_1.z.number().min(0, 'Budget must be non-negative'),
    description: zod_1.z.string().max(1000, 'Description too long').optional().default(''),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
}).refine(data => data.end_date >= data.start_date, {
    message: 'End date must be after start date',
    path: ['end_date']
});
class Project {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name || '';
        this.client_id = data.client_id || '';
        this.status = data.status || types_1.ProjectStatus.ACTIVE;
        this.start_date = data.start_date || new Date();
        this.end_date = data.end_date || new Date();
        this.budget = data.budget || 0;
        this.description = data.description || '';
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validate() {
        try {
            exports.ProjectSchema.parse(this);
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
    isActive() {
        return this.status === types_1.ProjectStatus.ACTIVE;
    }
    isOverdue() {
        return this.end_date < new Date() && this.status !== types_1.ProjectStatus.COMPLETED;
    }
    getDurationInDays() {
        const diffTime = Math.abs(this.end_date.getTime() - this.start_date.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    getRemainingDays() {
        const today = new Date();
        if (this.end_date < today)
            return 0;
        const diffTime = this.end_date.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    markCompleted() {
        this.status = types_1.ProjectStatus.COMPLETED;
        this.updated_at = new Date();
    }
    updateBudget(newBudget) {
        if (newBudget < 0) {
            throw new Error('Budget cannot be negative');
        }
        this.budget = newBudget;
        this.updated_at = new Date();
    }
    toSheetRow() {
        return {
            id: this.id,
            name: this.name,
            client_id: this.client_id,
            status: this.status,
            start_date: this.start_date.toISOString(),
            end_date: this.end_date.toISOString(),
            budget: this.budget,
            description: this.description,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }
    static fromSheetRow(row) {
        return new Project({
            id: row.id,
            name: row.name,
            client_id: row.client_id,
            status: row.status,
            start_date: new Date(row.start_date),
            end_date: new Date(row.end_date),
            budget: parseFloat(row.budget) || 0,
            description: row.description || '',
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map