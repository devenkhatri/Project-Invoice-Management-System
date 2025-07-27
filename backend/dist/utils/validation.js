"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unique = exports.sortBy = exports.groupBy = exports.roundToTwoDecimals = exports.calculateGST = exports.calculatePercentage = exports.generateInvoiceNumber = exports.generateId = exports.formatPercentage = exports.formatDuration = exports.formatDateTime = exports.formatDate = exports.formatCurrency = exports.sanitizeData = exports.validateQueryFilters = exports.validateSheetData = exports.convertFromSheetRow = exports.convertToSheetRow = exports.isDateInPast = exports.isDateInFuture = exports.isValidTimeFormat = exports.isValidDate = exports.isValidUUID = exports.isValidCurrency = exports.isValidURL = exports.isValidPhone = exports.isValidPAN = exports.isValidGSTIN = exports.isValidEmail = void 0;
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const isValidGSTIN = (gstin) => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
};
exports.isValidGSTIN = isValidGSTIN;
const isValidPAN = (pan) => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
};
exports.isValidPAN = isValidPAN;
const isValidPhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone);
};
exports.isValidPhone = isValidPhone;
const isValidURL = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
exports.isValidURL = isValidURL;
const isValidCurrency = (currency) => {
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD'];
    return validCurrencies.includes(currency.toUpperCase());
};
exports.isValidCurrency = isValidCurrency;
const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};
exports.isValidUUID = isValidUUID;
const isValidDate = (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
};
exports.isValidDate = isValidDate;
const isValidTimeFormat = (time) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
};
exports.isValidTimeFormat = isValidTimeFormat;
const isDateInFuture = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    return date > now;
};
exports.isDateInFuture = isDateInFuture;
const isDateInPast = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
};
exports.isDateInPast = isDateInPast;
const convertToSheetRow = (data, headers) => {
    return headers.map(header => {
        const value = data[header];
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        return String(value);
    });
};
exports.convertToSheetRow = convertToSheetRow;
const convertFromSheetRow = (row, headers) => {
    const result = {};
    headers.forEach((header, index) => {
        const value = row[index];
        if (value === '' || value === null || value === undefined) {
            result[header] = null;
        }
        else if (header.includes('_at') || header.includes('date')) {
            if ((0, exports.isValidDate)(value)) {
                result[header] = new Date(value).toISOString();
            }
            else {
                result[header] = value;
            }
        }
        else if (header.includes('amount') || header.includes('budget') || header.includes('hours') || header.includes('rate')) {
            const numValue = parseFloat(value);
            result[header] = isNaN(numValue) ? 0 : numValue;
        }
        else if (header.includes('is_') || value === 'TRUE' || value === 'FALSE') {
            result[header] = value === 'TRUE' || value === true;
        }
        else if (header.includes('tags') || header.includes('dependencies')) {
            try {
                result[header] = typeof value === 'string' ? JSON.parse(value) : value;
            }
            catch {
                result[header] = typeof value === 'string' ? value.split(',').map(s => s.trim()) : [];
            }
        }
        else {
            result[header] = value;
        }
    });
    return result;
};
exports.convertFromSheetRow = convertFromSheetRow;
const validateSheetData = (sheetName, data) => {
    const errors = [];
    if (data.email && !(0, exports.isValidEmail)(data.email)) {
        errors.push('Invalid email format');
    }
    if (data.phone && !(0, exports.isValidPhone)(data.phone)) {
        errors.push('Invalid phone number format');
    }
    if (data.gstin && !(0, exports.isValidGSTIN)(data.gstin)) {
        errors.push('Invalid GSTIN format');
    }
    if (data.pan && !(0, exports.isValidPAN)(data.pan)) {
        errors.push('Invalid PAN format');
    }
    if (data.currency && !(0, exports.isValidCurrency)(data.currency)) {
        errors.push('Invalid currency code');
    }
    if (data.receipt_url && !(0, exports.isValidURL)(data.receipt_url)) {
        errors.push('Invalid receipt URL format');
    }
    const dateFields = ['start_date', 'end_date', 'due_date', 'date', 'created_at', 'updated_at'];
    dateFields.forEach(field => {
        if (data[field] && !(0, exports.isValidDate)(data[field])) {
            errors.push(`Invalid date format for ${field}`);
        }
    });
    const numericFields = ['budget', 'amount', 'tax_amount', 'total_amount', 'hours', 'estimated_hours', 'actual_hours'];
    numericFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== null) {
            const numValue = parseFloat(data[field]);
            if (isNaN(numValue)) {
                errors.push(`${field} must be a valid number`);
            }
            else if (numValue < 0) {
                errors.push(`${field} cannot be negative`);
            }
        }
    });
    switch (sheetName) {
        case 'Projects':
            if (!data.name || data.name.trim().length === 0) {
                errors.push('Project name is required');
            }
            if (!data.client_id || data.client_id.trim().length === 0) {
                errors.push('Client ID is required');
            }
            if (data.status && !['active', 'completed', 'on-hold'].includes(data.status)) {
                errors.push('Invalid project status');
            }
            if (data.start_date && data.end_date && new Date(data.start_date) > new Date(data.end_date)) {
                errors.push('Start date cannot be after end date');
            }
            break;
        case 'Tasks':
            if (!data.title || data.title.trim().length === 0) {
                errors.push('Task title is required');
            }
            if (!data.project_id || data.project_id.trim().length === 0) {
                errors.push('Project ID is required');
            }
            if (data.status && !['todo', 'in-progress', 'completed'].includes(data.status)) {
                errors.push('Invalid task status');
            }
            if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
                errors.push('Invalid task priority');
            }
            if (data.estimated_hours && data.actual_hours && data.actual_hours > data.estimated_hours * 2) {
                console.warn('Warning: Actual hours significantly exceed estimated hours');
            }
            break;
        case 'Clients':
            if (!data.name || data.name.trim().length === 0) {
                errors.push('Client name is required');
            }
            if (!data.email || data.email.trim().length === 0) {
                errors.push('Client email is required');
            }
            if (data.country && data.country.length !== 2) {
                errors.push('Country code must be 2 characters (ISO 3166-1 alpha-2)');
            }
            break;
        case 'Invoices':
            if (!data.invoice_number || data.invoice_number.trim().length === 0) {
                errors.push('Invoice number is required');
            }
            if (!data.client_id || data.client_id.trim().length === 0) {
                errors.push('Client ID is required');
            }
            if (data.status && !['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(data.status)) {
                errors.push('Invalid invoice status');
            }
            if (data.payment_status && !['pending', 'partial', 'paid', 'failed', 'refunded'].includes(data.payment_status)) {
                errors.push('Invalid payment status');
            }
            if (data.issue_date && data.due_date && new Date(data.issue_date) > new Date(data.due_date)) {
                errors.push('Issue date cannot be after due date');
            }
            if (data.subtotal && data.total_amount && data.total_amount < data.subtotal) {
                errors.push('Total amount cannot be less than subtotal');
            }
            break;
        case 'Time_Entries':
            if (!data.task_id || data.task_id.trim().length === 0) {
                errors.push('Task ID is required');
            }
            if (!data.project_id || data.project_id.trim().length === 0) {
                errors.push('Project ID is required');
            }
            if (!data.hours || data.hours <= 0) {
                errors.push('Hours must be greater than 0');
            }
            if (data.hours && data.hours > 24) {
                errors.push('Hours cannot exceed 24 in a single entry');
            }
            if (data.start_time && data.end_time) {
                const start = new Date(`1970-01-01T${data.start_time}`);
                const end = new Date(`1970-01-01T${data.end_time}`);
                if (start >= end) {
                    errors.push('Start time must be before end time');
                }
            }
            break;
        case 'Expenses':
            if (!data.project_id || data.project_id.trim().length === 0) {
                errors.push('Project ID is required');
            }
            if (!data.category || data.category.trim().length === 0) {
                errors.push('Expense category is required');
            }
            if (!data.amount || data.amount <= 0) {
                errors.push('Expense amount must be greater than 0');
            }
            if (data.approval_status && !['pending', 'approved', 'rejected'].includes(data.approval_status)) {
                errors.push('Invalid approval status');
            }
            if (data.tax_rate && (data.tax_rate < 0 || data.tax_rate > 100)) {
                errors.push('Tax rate must be between 0 and 100');
            }
            break;
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateSheetData = validateSheetData;
const validateQueryFilters = (filters) => {
    const errors = [];
    filters.forEach((filter, index) => {
        if (!filter.column || filter.column.trim().length === 0) {
            errors.push(`Filter ${index + 1}: Column is required`);
        }
        if (!['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'].includes(filter.operator)) {
            errors.push(`Filter ${index + 1}: Invalid operator`);
        }
        if (filter.value === null || filter.value === undefined) {
            errors.push(`Filter ${index + 1}: Value is required`);
        }
    });
    return errors;
};
exports.validateQueryFilters = validateQueryFilters;
const sanitizeData = (data) => {
    if (typeof data === 'string') {
        return data.trim().replace(/[<>]/g, '');
    }
    if (Array.isArray(data)) {
        return data.map(exports.sanitizeData);
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        Object.keys(data).forEach(key => {
            sanitized[key] = (0, exports.sanitizeData)(data[key]);
        });
        return sanitized;
    }
    return data;
};
exports.sanitizeData = sanitizeData;
const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount);
};
exports.formatCurrency = formatCurrency;
const formatDate = (dateString, locale = 'en-IN') => {
    return new Date(dateString).toLocaleDateString(locale);
};
exports.formatDate = formatDate;
const formatDateTime = (dateString, locale = 'en-IN') => {
    return new Date(dateString).toLocaleString(locale);
};
exports.formatDateTime = formatDateTime;
const formatDuration = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (wholeHours === 0) {
        return `${minutes}m`;
    }
    else if (minutes === 0) {
        return `${wholeHours}h`;
    }
    else {
        return `${wholeHours}h ${minutes}m`;
    }
};
exports.formatDuration = formatDuration;
const formatPercentage = (value, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
};
exports.formatPercentage = formatPercentage;
const generateId = (prefix) => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 11);
    return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
};
exports.generateId = generateId;
const generateInvoiceNumber = (prefix = 'INV', sequence) => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const seq = sequence ? String(sequence).padStart(4, '0') : String(Date.now()).slice(-4);
    return `${prefix}-${year}${month}-${seq}`;
};
exports.generateInvoiceNumber = generateInvoiceNumber;
const calculatePercentage = (part, total) => {
    if (total === 0)
        return 0;
    return Math.round((part / total) * 100 * 100) / 100;
};
exports.calculatePercentage = calculatePercentage;
const calculateGST = (amount, rate) => {
    const taxAmount = Math.round((amount * rate / 100) * 100) / 100;
    const totalAmount = Math.round((amount + taxAmount) * 100) / 100;
    return { taxAmount, totalAmount };
};
exports.calculateGST = calculateGST;
const roundToTwoDecimals = (value) => {
    return Math.round(value * 100) / 100;
};
exports.roundToTwoDecimals = roundToTwoDecimals;
const groupBy = (array, keyFn) => {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
};
exports.groupBy = groupBy;
const sortBy = (array, keyFn, order = 'asc') => {
    return [...array].sort((a, b) => {
        const aVal = keyFn(a);
        const bVal = keyFn(b);
        if (aVal < bVal)
            return order === 'asc' ? -1 : 1;
        if (aVal > bVal)
            return order === 'asc' ? 1 : -1;
        return 0;
    });
};
exports.sortBy = sortBy;
const unique = (array, keyFn) => {
    if (!keyFn) {
        return Array.from(new Set(array));
    }
    const seen = new Set();
    return array.filter(item => {
        const key = keyFn(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
exports.unique = unique;
//# sourceMappingURL=validation.js.map