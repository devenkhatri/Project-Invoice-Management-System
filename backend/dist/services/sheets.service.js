"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsService = void 0;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const validation_1 = require("../utils/validation");
class SheetsService {
    constructor(spreadsheetId, serviceAccountKey) {
        this.sheetConfigs = new Map();
        this.spreadsheetId = spreadsheetId;
        this.auth = new google_auth_library_1.JWT({
            email: serviceAccountKey.client_email,
            key: serviceAccountKey.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
        this.initializeSheetConfigs();
    }
    static getInstance() {
        if (!SheetsService.instance) {
            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
            if (!spreadsheetId || !serviceAccountKey) {
                throw new Error('Google Sheets configuration not found in environment variables');
            }
            SheetsService.instance = new SheetsService(spreadsheetId, JSON.parse(serviceAccountKey));
        }
        return SheetsService.instance;
    }
    initializeSheetConfigs() {
        this.sheetConfigs.set('Projects', {
            name: 'Projects',
            headers: ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Tasks', {
            name: 'Tasks',
            headers: ['id', 'project_id', 'title', 'description', 'status', 'priority', 'due_date', 'estimated_hours', 'actual_hours', 'created_at']
        });
        this.sheetConfigs.set('Clients', {
            name: 'Clients',
            headers: ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'gstin', 'pan', 'payment_terms', 'default_currency', 'billing_address', 'shipping_address', 'contact_person', 'website', 'notes', 'is_active', 'portal_access_enabled', 'portal_password_hash', 'last_portal_login', 'company_name', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Invoices', {
            name: 'Invoices',
            headers: ['id', 'invoice_number', 'client_id', 'project_id', 'line_items', 'subtotal', 'tax_breakdown', 'total_amount', 'currency', 'status', 'issue_date', 'due_date', 'payment_terms', 'notes', 'terms_conditions', 'is_recurring', 'recurring_frequency', 'next_invoice_date', 'payment_status', 'paid_amount', 'payment_date', 'payment_method', 'late_fee_applied', 'discount_percentage', 'discount_amount', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Time_Entries', {
            name: 'Time_Entries',
            headers: ['id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at']
        });
        this.sheetConfigs.set('Expenses', {
            name: 'Expenses',
            headers: ['id', 'project_id', 'category', 'amount', 'currency', 'description', 'date', 'receipt_url', 'vendor', 'is_billable', 'tax_amount', 'tax_rate', 'reimbursable', 'approval_status', 'approved_by', 'approved_at', 'invoice_id', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Users', {
            name: 'Users',
            headers: ['id', 'name', 'email', 'password_hash', 'role', 'is_active', 'email_verified', 'last_login', 'failed_login_attempts', 'locked_until', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Client_Communications', {
            name: 'Client_Communications',
            headers: ['id', 'client_id', 'project_id', 'subject', 'message', 'sender', 'sender_name', 'sender_email', 'status', 'thread_id', 'created_at']
        });
        this.sheetConfigs.set('Client_Activities', {
            name: 'Client_Activities',
            headers: ['id', 'client_id', 'activity', 'metadata', 'timestamp']
        });
        this.sheetConfigs.set('Payment_Links', {
            name: 'Payment_Links',
            headers: ['id', 'gateway', 'url', 'amount', 'currency', 'description', 'invoice_id', 'client_email', 'client_name', 'status', 'expires_at', 'allow_partial_payments', 'paid_amount', 'paid_at', 'metadata', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Payment_Reminders', {
            name: 'Payment_Reminders',
            headers: ['id', 'invoice_id', 'type', 'days_offset', 'template', 'method', 'status', 'scheduled_at', 'sent_at', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Late_Fee_Rules', {
            name: 'Late_Fee_Rules',
            headers: ['id', 'name', 'type', 'amount', 'grace_period_days', 'max_amount', 'compounding_frequency', 'is_active', 'created_at', 'updated_at']
        });
        this.sheetConfigs.set('Late_Fees', {
            name: 'Late_Fees',
            headers: ['id', 'invoice_id', 'rule_id', 'amount', 'days_past_due', 'applied_at', 'created_at']
        });
    }
    async initializeSheets() {
        try {
            const sheetNames = Array.from(this.sheetConfigs.keys());
            for (const sheetName of sheetNames) {
                const config = this.sheetConfigs.get(sheetName);
                await this.createSheetIfNotExists(sheetName, config.headers);
            }
        }
        catch (error) {
            throw this.handleError(error, 'Failed to initialize sheets');
        }
    }
    async createSheetIfNotExists(sheetName, headers) {
        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheetExists = spreadsheet.data.sheets?.some(sheet => sheet.properties?.title === sheetName);
            if (!sheetExists) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        requests: [{
                                addSheet: {
                                    properties: {
                                        title: sheetName
                                    }
                                }
                            }]
                    }
                });
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:${this.getColumnLetter(headers.length)}1`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [headers]
                    }
                });
            }
        }
        catch (error) {
            throw this.handleError(error, `Failed to create sheet: ${sheetName}`);
        }
    }
    async create(sheetName, data) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const validation = (0, validation_1.validateSheetData)(sheetName, data);
            if (!validation.isValid) {
                throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
            }
            const id = this.generateId();
            const now = new Date().toISOString();
            const recordData = {
                ...(0, validation_1.sanitizeData)(data),
                id,
                created_at: now,
                ...(config.headers.includes('updated_at') && { updated_at: now })
            };
            const row = (0, validation_1.convertToSheetRow)(recordData, config.headers);
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:${this.getColumnLetter(config.headers.length)}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row]
                }
            });
            return id;
        }
        catch (error) {
            throw this.handleError(error, `Failed to create record in ${sheetName}`);
        }
    }
    async read(sheetName, id) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:${this.getColumnLetter(config.headers.length)}`
            });
            const rows = response.data.values || [];
            if (rows.length <= 1) {
                return [];
            }
            const records = rows.slice(1).map(row => (0, validation_1.convertFromSheetRow)(row, config.headers));
            if (id) {
                return records.filter(record => record.id === id);
            }
            return records;
        }
        catch (error) {
            throw this.handleError(error, `Failed to read from ${sheetName}`);
        }
    }
    async update(sheetName, id, data) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const records = await this.read(sheetName);
            const recordIndex = records.findIndex(record => record.id === id);
            if (recordIndex === -1) {
                return false;
            }
            const mergedData = {
                ...records[recordIndex],
                ...(0, validation_1.sanitizeData)(data),
                ...(config.headers.includes('updated_at') && { updated_at: new Date().toISOString() })
            };
            const validation = (0, validation_1.validateSheetData)(sheetName, mergedData);
            if (!validation.isValid) {
                throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
            }
            const row = (0, validation_1.convertToSheetRow)(mergedData, config.headers);
            const rowNumber = recordIndex + 2;
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowNumber}:${this.getColumnLetter(config.headers.length)}${rowNumber}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row]
                }
            });
            return true;
        }
        catch (error) {
            throw this.handleError(error, `Failed to update record in ${sheetName}`);
        }
    }
    async delete(sheetName, id) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const records = await this.read(sheetName);
            const recordIndex = records.findIndex(record => record.id === id);
            if (recordIndex === -1) {
                return false;
            }
            const rowNumber = recordIndex + 2;
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
            if (!sheet?.properties?.sheetId) {
                throw new Error(`Sheet ${sheetName} not found`);
            }
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: sheet.properties.sheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowNumber - 1,
                                    endIndex: rowNumber
                                }
                            }
                        }]
                }
            });
            return true;
        }
        catch (error) {
            throw this.handleError(error, `Failed to delete record from ${sheetName}`);
        }
    }
    async batchCreate(sheetName, dataArray) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const ids = [];
            const rows = [];
            const now = new Date().toISOString();
            dataArray.forEach(data => {
                const id = this.generateId();
                ids.push(id);
                const recordData = {
                    ...(0, validation_1.sanitizeData)(data),
                    id,
                    created_at: now,
                    ...(config.headers.includes('updated_at') && { updated_at: now })
                };
                rows.push((0, validation_1.convertToSheetRow)(recordData, config.headers));
            });
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:${this.getColumnLetter(config.headers.length)}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: rows
                }
            });
            return ids;
        }
        catch (error) {
            throw this.handleError(error, `Failed to batch create in ${sheetName}`);
        }
    }
    async batchUpdate(operations) {
        try {
            const requests = [];
            for (const operation of operations) {
                if (operation.operation === 'update' && operation.id) {
                    const config = this.sheetConfigs.get(operation.sheetName);
                    if (!config)
                        continue;
                    const records = await this.read(operation.sheetName);
                    const recordIndex = records.findIndex(record => record.id === operation.id);
                    if (recordIndex !== -1) {
                        const updatedData = {
                            ...records[recordIndex],
                            ...(0, validation_1.sanitizeData)(operation.data),
                            ...(config.headers.includes('updated_at') && { updated_at: new Date().toISOString() })
                        };
                        const row = (0, validation_1.convertToSheetRow)(updatedData, config.headers);
                        const rowNumber = recordIndex + 2;
                        await this.sheets.spreadsheets.values.update({
                            spreadsheetId: this.spreadsheetId,
                            range: `${operation.sheetName}!A${rowNumber}:${this.getColumnLetter(config.headers.length)}${rowNumber}`,
                            valueInputOption: 'RAW',
                            requestBody: {
                                values: [row]
                            }
                        });
                    }
                }
            }
            return true;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to execute batch operations');
        }
    }
    async query(sheetName, options = {}) {
        try {
            const records = await this.read(sheetName);
            let filteredRecords = records;
            if (!('filters' in options) && Object.keys(options).length > 0) {
                filteredRecords = records.filter(record => {
                    return Object.entries(options).every(([key, value]) => {
                        if (Array.isArray(value)) {
                            return value.includes(record[key]);
                        }
                        else if (typeof value === 'object' && value !== null) {
                            return Object.entries(value).every(([operator, operandValue]) => {
                                const recordValue = record[key];
                                switch (operator) {
                                    case '>=':
                                        return recordValue >= operandValue;
                                    case '<=':
                                        return recordValue <= operandValue;
                                    case '>':
                                        return recordValue > operandValue;
                                    case '<':
                                        return recordValue < operandValue;
                                    case '!=':
                                        return recordValue !== operandValue;
                                    default:
                                        return recordValue === operandValue;
                                }
                            });
                        }
                        else {
                            return record[key] === value;
                        }
                    });
                });
            }
            else if ('filters' in options && options.filters && options.filters.length > 0) {
                const filterErrors = (0, validation_1.validateQueryFilters)(options.filters);
                if (filterErrors.length > 0) {
                    throw new Error(`Filter validation errors: ${filterErrors.join(', ')}`);
                }
                filteredRecords = records.filter(record => {
                    return options.filters.every((filter) => {
                        const value = record[filter.column];
                        return this.applyFilter(value, filter);
                    });
                });
            }
            if ('sortBy' in options && options.sortBy) {
                filteredRecords.sort((a, b) => {
                    const aVal = a[options.sortBy];
                    const bVal = b[options.sortBy];
                    let comparison = 0;
                    if (aVal < bVal)
                        comparison = -1;
                    if (aVal > bVal)
                        comparison = 1;
                    return options.sortOrder === 'desc' ? -comparison : comparison;
                });
            }
            if ('offset' in options || 'limit' in options) {
                const start = options.offset || 0;
                const end = options.limit ? start + options.limit : undefined;
                filteredRecords = filteredRecords.slice(start, end);
            }
            return filteredRecords;
        }
        catch (error) {
            throw this.handleError(error, `Failed to query ${sheetName}`);
        }
    }
    applyFilter(value, filter) {
        switch (filter.operator) {
            case 'eq':
                return value === filter.value;
            case 'ne':
                return value !== filter.value;
            case 'gt':
                return value > filter.value;
            case 'lt':
                return value < filter.value;
            case 'gte':
                return value >= filter.value;
            case 'lte':
                return value <= filter.value;
            case 'contains':
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
            case 'in':
                return Array.isArray(filter.value) ? filter.value.includes(value) : value === filter.value;
            default:
                return true;
        }
    }
    async aggregate(sheetName, operation, field) {
        try {
            const records = await this.read(sheetName);
            switch (operation) {
                case 'count':
                    return records.length;
                case 'sum':
                    if (!field)
                        throw new Error('Field is required for sum operation');
                    return records.reduce((sum, record) => sum + (parseFloat(record[field]) || 0), 0);
                case 'avg':
                    if (!field)
                        throw new Error('Field is required for avg operation');
                    const sum = records.reduce((sum, record) => sum + (parseFloat(record[field]) || 0), 0);
                    return records.length > 0 ? sum / records.length : 0;
                case 'min':
                    if (!field)
                        throw new Error('Field is required for min operation');
                    return Math.min(...records.map(record => parseFloat(record[field]) || 0));
                case 'max':
                    if (!field)
                        throw new Error('Field is required for max operation');
                    return Math.max(...records.map(record => parseFloat(record[field]) || 0));
                default:
                    throw new Error(`Unknown aggregation operation: ${operation}`);
            }
        }
        catch (error) {
            throw this.handleError(error, `Failed to aggregate ${sheetName}`);
        }
    }
    async validateSheetStructure(sheetName) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                return { isValid: false, errors: [`Unknown sheet: ${sheetName}`] };
            }
            const errors = [];
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheetExists = spreadsheet.data.sheets?.some(sheet => sheet.properties?.title === sheetName);
            if (!sheetExists) {
                errors.push(`Sheet '${sheetName}' does not exist`);
                return { isValid: false, errors };
            }
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });
            const actualHeaders = response.data.values?.[0] || [];
            for (const expectedHeader of config.headers) {
                if (!actualHeaders.includes(expectedHeader)) {
                    errors.push(`Missing header '${expectedHeader}' in sheet '${sheetName}'`);
                }
            }
            for (const actualHeader of actualHeaders) {
                if (!config.headers.includes(actualHeader)) {
                    console.warn(`Warning: Unexpected header '${actualHeader}' in sheet '${sheetName}'`);
                }
            }
            return { isValid: errors.length === 0, errors };
        }
        catch (error) {
            return {
                isValid: false,
                errors: [`Failed to validate sheet structure: ${error}`]
            };
        }
    }
    async validateAllSheets() {
        const allErrors = [];
        const sheetNames = Array.from(this.sheetConfigs.keys());
        for (const sheetName of sheetNames) {
            const validation = await this.validateSheetStructure(sheetName);
            if (!validation.isValid) {
                allErrors.push(...validation.errors);
            }
        }
        return { isValid: allErrors.length === 0, errors: allErrors };
    }
    async exportSheetData(sheetName) {
        try {
            return await this.read(sheetName);
        }
        catch (error) {
            throw this.handleError(error, `Failed to export data from ${sheetName}`);
        }
    }
    async exportAllData() {
        try {
            const allData = {};
            const sheetNames = Array.from(this.sheetConfigs.keys());
            for (const sheetName of sheetNames) {
                allData[sheetName] = await this.exportSheetData(sheetName);
            }
            return allData;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to export all data');
        }
    }
    async clearSheet(sheetName, preserveHeaders = true) {
        try {
            const config = this.sheetConfigs.get(sheetName);
            if (!config) {
                throw new Error(`Unknown sheet: ${sheetName}`);
            }
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
            if (!sheet?.properties?.sheetId) {
                throw new Error(`Sheet ${sheetName} not found`);
            }
            const startRow = preserveHeaders ? 1 : 0;
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: sheet.properties.sheetId,
                                    dimension: 'ROWS',
                                    startIndex: startRow,
                                    endIndex: 1000
                                }
                            }
                        }]
                }
            });
            return true;
        }
        catch (error) {
            throw this.handleError(error, `Failed to clear sheet ${sheetName}`);
        }
    }
    validateRecordData(sheetName, data) {
        const config = this.sheetConfigs.get(sheetName);
        if (!config) {
            return { isValid: false, errors: [`Unknown sheet: ${sheetName}`] };
        }
        const errors = [];
        switch (sheetName) {
            case 'Projects':
                if (!data.name || typeof data.name !== 'string') {
                    errors.push('Project name is required and must be a string');
                }
                if (!data.client_id || typeof data.client_id !== 'string') {
                    errors.push('Client ID is required and must be a string');
                }
                if (data.budget && (typeof data.budget !== 'number' || data.budget < 0)) {
                    errors.push('Budget must be a positive number');
                }
                break;
            case 'Tasks':
                if (!data.title || typeof data.title !== 'string') {
                    errors.push('Task title is required and must be a string');
                }
                if (!data.project_id || typeof data.project_id !== 'string') {
                    errors.push('Project ID is required and must be a string');
                }
                if (data.estimated_hours && (typeof data.estimated_hours !== 'number' || data.estimated_hours < 0)) {
                    errors.push('Estimated hours must be a positive number');
                }
                break;
            case 'Clients':
                if (!data.name || typeof data.name !== 'string') {
                    errors.push('Client name is required and must be a string');
                }
                if (!data.email || typeof data.email !== 'string') {
                    errors.push('Client email is required and must be a string');
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (data.email && !emailRegex.test(data.email)) {
                    errors.push('Client email must be a valid email address');
                }
                break;
            case 'Invoices':
                if (!data.invoice_number || typeof data.invoice_number !== 'string') {
                    errors.push('Invoice number is required and must be a string');
                }
                if (!data.client_id || typeof data.client_id !== 'string') {
                    errors.push('Client ID is required and must be a string');
                }
                if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                    errors.push('Invoice amount is required and must be a positive number');
                }
                break;
            case 'Time_Entries':
                if (!data.task_id || typeof data.task_id !== 'string') {
                    errors.push('Task ID is required and must be a string');
                }
                if (!data.project_id || typeof data.project_id !== 'string') {
                    errors.push('Project ID is required and must be a string');
                }
                if (!data.hours || typeof data.hours !== 'number' || data.hours <= 0) {
                    errors.push('Hours is required and must be a positive number');
                }
                break;
            case 'Expenses':
                if (!data.project_id || typeof data.project_id !== 'string') {
                    errors.push('Project ID is required and must be a string');
                }
                if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                    errors.push('Expense amount is required and must be a positive number');
                }
                if (!data.category || typeof data.category !== 'string') {
                    errors.push('Expense category is required and must be a string');
                }
                break;
        }
        return { isValid: errors.length === 0, errors };
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    getColumnLetter(columnNumber) {
        let result = '';
        while (columnNumber > 0) {
            columnNumber--;
            result = String.fromCharCode(65 + (columnNumber % 26)) + result;
            columnNumber = Math.floor(columnNumber / 26);
        }
        return result;
    }
    handleError(error, message) {
        const sheetsError = new Error(message);
        sheetsError.code = error.code || 'UNKNOWN_ERROR';
        sheetsError.statusCode = error.status || 500;
        sheetsError.retryable = this.isRetryableError(error);
        console.error('SheetsService Error:', error);
        return sheetsError;
    }
    isRetryableError(error) {
        if (error.status === 429)
            return true;
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')
            return true;
        if (error.status >= 500)
            return true;
        return false;
    }
    async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === maxRetries || !this.isRetryableError(error)) {
                    throw error;
                }
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
}
exports.SheetsService = SheetsService;
//# sourceMappingURL=sheets.service.js.map