"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const types_1 = require("../types");
const schemas_1 = require("../validation/schemas");
class Project {
    constructor(data) {
        const validation = (0, schemas_1.validateProject)(data);
        if (!validation.isValid) {
            throw new Error(`Invalid project data: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const validatedData = validation.data;
        Object.assign(this, validatedData);
        if (!this.created_at) {
            this.created_at = new Date().toISOString();
        }
        this.updated_at = new Date().toISOString();
    }
    calculateProgress(tasks) {
        if (!tasks || tasks.length === 0)
            return 0;
        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        return Math.round((completedTasks / tasks.length) * 100);
    }
    calculateActualCost(timeEntries, expenses) {
        let totalCost = 0;
        if (timeEntries) {
            totalCost += timeEntries.reduce((sum, entry) => {
                if (entry.is_billable && entry.hourly_rate) {
                    return sum + (entry.hours * entry.hourly_rate);
                }
                return sum + (entry.hours * (this.hourly_rate || 0));
            }, 0);
        }
        if (expenses) {
            totalCost += expenses.reduce((sum, expense) => sum + expense.amount, 0);
        }
        return totalCost;
    }
    calculateProfitability(timeEntries, expenses) {
        const costs = this.calculateActualCost(timeEntries, expenses);
        const revenue = this.budget;
        const profit = revenue - costs;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
            revenue,
            costs,
            profit,
            margin: Math.round(margin * 100) / 100
        };
    }
    isOverBudget(timeEntries, expenses) {
        const actualCost = this.calculateActualCost(timeEntries, expenses);
        return actualCost > this.budget;
    }
    isOverdue() {
        const now = new Date();
        const endDate = new Date(this.end_date);
        return now > endDate && this.status !== types_1.ProjectStatus.COMPLETED;
    }
    getDaysRemaining() {
        const now = new Date();
        const endDate = new Date(this.end_date);
        const diffTime = endDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    updateProgress(tasks) {
        this.progress_percentage = this.calculateProgress(tasks);
        this.updated_at = new Date().toISOString();
    }
    updateActualCost(timeEntries, expenses) {
        this.actual_cost = this.calculateActualCost(timeEntries, expenses);
        this.updated_at = new Date().toISOString();
    }
    markCompleted() {
        this.status = types_1.ProjectStatus.COMPLETED;
        this.progress_percentage = 100;
        this.updated_at = new Date().toISOString();
    }
    static validate(data) {
        return (0, schemas_1.validateProject)(data);
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            client_id: this.client_id,
            status: this.status,
            start_date: this.start_date,
            end_date: this.end_date,
            budget: this.budget,
            actual_cost: this.actual_cost,
            description: this.description,
            progress_percentage: this.progress_percentage,
            is_billable: this.is_billable,
            hourly_rate: this.hourly_rate,
            currency: this.currency,
            tags: this.tags,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    static fromJSON(data) {
        return new Project(data);
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map