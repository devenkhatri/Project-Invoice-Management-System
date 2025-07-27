"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeEntry = void 0;
const schemas_1 = require("../validation/schemas");
class TimeEntry {
    constructor(data) {
        const validation = (0, schemas_1.validateTimeEntry)(data);
        if (!validation.isValid) {
            throw new Error(`Invalid time entry data: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const validatedData = validation.data;
        Object.assign(this, validatedData);
        if (!this.created_at) {
            this.created_at = new Date().toISOString();
        }
        this.updated_at = new Date().toISOString();
        if (this.is_billable && this.hourly_rate) {
            this.total_amount = this.calculateTotalAmount();
        }
    }
    calculateTotalAmount(defaultHourlyRate) {
        if (!this.is_billable)
            return 0;
        const rate = this.hourly_rate || defaultHourlyRate || 0;
        return Math.round(this.hours * rate * 100) / 100;
    }
    updateTotalAmount(defaultHourlyRate) {
        this.total_amount = this.calculateTotalAmount(defaultHourlyRate);
        this.updated_at = new Date().toISOString();
    }
    calculateHoursFromTimeRange() {
        if (!this.start_time || !this.end_time)
            return this.hours;
        const [startHour, startMin] = this.start_time.split(':').map(Number);
        const [endHour, endMin] = this.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const diffMinutes = endMinutes - startMinutes;
        return Math.round((diffMinutes / 60) * 100) / 100;
    }
    updateHoursFromTimeRange() {
        if (this.start_time && this.end_time) {
            this.hours = this.calculateHoursFromTimeRange();
            this.updateTotalAmount();
        }
    }
    setTimeRange(startTime, endTime) {
        this.start_time = startTime;
        this.end_time = endTime;
        this.updateHoursFromTimeRange();
    }
    isValidTimeRange() {
        if (!this.start_time || !this.end_time)
            return true;
        const [startHour, startMin] = this.start_time.split(':').map(Number);
        const [endHour, endMin] = this.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return endMinutes > startMinutes;
    }
    isToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.date === today;
    }
    isThisWeek() {
        const entryDate = new Date(this.date);
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        return entryDate >= startOfWeek && entryDate <= endOfWeek;
    }
    isThisMonth() {
        const entryDate = new Date(this.date);
        const today = new Date();
        return entryDate.getMonth() === today.getMonth() &&
            entryDate.getFullYear() === today.getFullYear();
    }
    markAsBilled(invoiceId) {
        this.invoice_id = invoiceId;
        this.updated_at = new Date().toISOString();
    }
    isBilled() {
        return !!this.invoice_id;
    }
    toggleBillable() {
        this.is_billable = !this.is_billable;
        this.updateTotalAmount();
    }
    updateHourlyRate(rate) {
        this.hourly_rate = rate;
        this.updateTotalAmount();
    }
    getFormattedDuration() {
        const hours = Math.floor(this.hours);
        const minutes = Math.round((this.hours - hours) * 60);
        if (hours === 0) {
            return `${minutes}m`;
        }
        else if (minutes === 0) {
            return `${hours}h`;
        }
        else {
            return `${hours}h ${minutes}m`;
        }
    }
    getFormattedTimeRange() {
        if (!this.start_time || !this.end_time)
            return '';
        return `${this.start_time} - ${this.end_time}`;
    }
    getFormattedDate() {
        return new Date(this.date).toLocaleDateString();
    }
    static calculateTotalHours(entries) {
        return entries.reduce((total, entry) => total + entry.hours, 0);
    }
    static calculateTotalBillableHours(entries) {
        return entries
            .filter(entry => entry.is_billable)
            .reduce((total, entry) => total + entry.hours, 0);
    }
    static calculateTotalAmount(entries) {
        return entries
            .filter(entry => entry.is_billable && entry.total_amount)
            .reduce((total, entry) => total + (entry.total_amount || 0), 0);
    }
    static groupByDate(entries) {
        return entries.reduce((groups, entry) => {
            const date = entry.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(entry);
            return groups;
        }, {});
    }
    static groupByProject(entries) {
        return entries.reduce((groups, entry) => {
            const projectId = entry.project_id;
            if (!groups[projectId]) {
                groups[projectId] = [];
            }
            groups[projectId].push(entry);
            return groups;
        }, {});
    }
    static validate(data) {
        return (0, schemas_1.validateTimeEntry)(data);
    }
    toJSON() {
        return {
            id: this.id,
            task_id: this.task_id,
            project_id: this.project_id,
            hours: this.hours,
            description: this.description,
            date: this.date,
            start_time: this.start_time,
            end_time: this.end_time,
            is_billable: this.is_billable,
            hourly_rate: this.hourly_rate,
            total_amount: this.total_amount,
            user_id: this.user_id,
            invoice_id: this.invoice_id,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    static fromJSON(data) {
        return new TimeEntry(data);
    }
}
exports.TimeEntry = TimeEntry;
//# sourceMappingURL=TimeEntry.js.map