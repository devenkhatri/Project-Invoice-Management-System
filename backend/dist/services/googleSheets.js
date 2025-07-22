"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSheetsService = void 0;
exports.createGoogleSheetsService = createGoogleSheetsService;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const uuid_1 = require("uuid");
class GoogleSheetsService {
    constructor(config) {
        this.spreadsheetId = config.spreadsheetId;
        this.auth = new google_auth_library_1.JWT({
            email: config.serviceAccountEmail,
            key: config.privateKey.replace(/\\n/g, '\n'),
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
    }
    async testConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            console.log(`✅ Connected to Google Sheet: ${response.data.properties.title}`);
            return true;
        }
        catch (error) {
            console.error('❌ Failed to connect to Google Sheets:', error);
            return false;
        }
    }
    async getSpreadsheetInfo() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting spreadsheet info:', error);
            throw error;
        }
    }
    async createSheet(sheetName, headers) {
        try {
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
                range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [headers]
                }
            });
            console.log(`✅ Created sheet: ${sheetName} with headers`);
            return true;
        }
        catch (error) {
            console.error(`❌ Error creating sheet ${sheetName}:`, error);
            return false;
        }
    }
    async getHeaders(sheetName) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`
            });
            return response.data.values?.[0] || [];
        }
        catch (error) {
            console.error(`Error getting headers for ${sheetName}:`, error);
            throw error;
        }
    }
    rowToObject(headers, row) {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    }
    objectToRow(headers, obj) {
        return headers.map(header => obj[header] || '');
    }
    async findRowIndexById(sheetName, id) {
        const data = await this.read(sheetName);
        const index = data.findIndex(row => row.id === id);
        return index >= 0 ? index + 2 : -1;
    }
    async create(sheetName, data) {
        try {
            const headers = await this.getHeaders(sheetName);
            const id = data.id || (0, uuid_1.v4)();
            const timestamp = new Date().toISOString();
            const recordData = {
                ...data,
                id,
                created_at: timestamp,
                updated_at: timestamp
            };
            const row = this.objectToRow(headers, recordData);
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row]
                }
            });
            return id;
        }
        catch (error) {
            console.error(`Error creating record in ${sheetName}:`, error);
            throw error;
        }
    }
    async read(sheetName, id) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: sheetName
            });
            const rows = response.data.values || [];
            if (rows.length === 0) {
                return [];
            }
            const headers = rows[0];
            const data = rows.slice(1).map((row) => this.rowToObject(headers, row));
            if (id) {
                return data.filter((record) => record.id === id);
            }
            return data;
        }
        catch (error) {
            console.error(`Error reading from ${sheetName}:`, error);
            throw error;
        }
    }
    async update(sheetName, id, data) {
        try {
            const rowIndex = await this.findRowIndexById(sheetName, id);
            if (rowIndex === -1) {
                throw new Error(`Record with id ${id} not found in ${sheetName}`);
            }
            const headers = await this.getHeaders(sheetName);
            const existingData = await this.read(sheetName, id);
            if (existingData.length === 0) {
                throw new Error(`Record with id ${id} not found in ${sheetName}`);
            }
            const updatedData = {
                ...existingData[0],
                ...data,
                id,
                updated_at: new Date().toISOString()
            };
            const row = this.objectToRow(headers, updatedData);
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowIndex}:${String.fromCharCode(64 + headers.length)}${rowIndex}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row]
                }
            });
            return true;
        }
        catch (error) {
            console.error(`Error updating record in ${sheetName}:`, error);
            throw error;
        }
    }
    async delete(sheetName, id) {
        try {
            const rowIndex = await this.findRowIndexById(sheetName, id);
            if (rowIndex === -1) {
                throw new Error(`Record with id ${id} not found in ${sheetName}`);
            }
            const spreadsheetInfo = await this.getSpreadsheetInfo();
            const sheet = spreadsheetInfo.sheets?.find((s) => s.properties.title === sheetName);
            if (!sheet) {
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
                                    startIndex: rowIndex - 1,
                                    endIndex: rowIndex
                                }
                            }
                        }]
                }
            });
            return true;
        }
        catch (error) {
            console.error(`Error deleting record from ${sheetName}:`, error);
            throw error;
        }
    }
    async batchCreate(sheetName, dataArray) {
        try {
            const headers = await this.getHeaders(sheetName);
            const timestamp = new Date().toISOString();
            const ids = [];
            const rows = dataArray.map(data => {
                const id = data.id || (0, uuid_1.v4)();
                ids.push(id);
                const recordData = {
                    ...data,
                    id,
                    created_at: timestamp,
                    updated_at: timestamp
                };
                return this.objectToRow(headers, recordData);
            });
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: rows
                }
            });
            return ids;
        }
        catch (error) {
            console.error(`Error batch creating records in ${sheetName}:`, error);
            throw error;
        }
    }
    async batchUpdate(sheetName, updates) {
        try {
            const headers = await this.getHeaders(sheetName);
            const timestamp = new Date().toISOString();
            for (const update of updates) {
                if (!update.id) {
                    throw new Error('ID is required for batch update');
                }
                const existingData = await this.read(sheetName, update.id);
                if (existingData.length === 0) {
                    throw new Error(`Record with id ${update.id} not found in ${sheetName}`);
                }
                const updatedData = {
                    ...existingData[0],
                    ...update,
                    id: update.id,
                    updated_at: timestamp
                };
                await this.update(sheetName, update.id, updatedData);
            }
            return true;
        }
        catch (error) {
            console.error(`Error batch updating records in ${sheetName}:`, error);
            throw error;
        }
    }
    async query(sheetName, filters) {
        try {
            const allData = await this.read(sheetName);
            if (!Array.isArray(filters)) {
                return allData.filter(record => {
                    return Object.entries(filters).every(([field, value]) => {
                        return record[field] === value;
                    });
                });
            }
            return allData.filter(record => {
                return filters.every(filter => {
                    const fieldValue = record[filter.field];
                    switch (filter.operator) {
                        case 'eq':
                            return fieldValue === filter.value;
                        case 'ne':
                            return fieldValue !== filter.value;
                        case 'gt':
                            return Number(fieldValue) > Number(filter.value);
                        case 'gte':
                            return Number(fieldValue) >= Number(filter.value);
                        case 'lt':
                            return Number(fieldValue) < Number(filter.value);
                        case 'lte':
                            return Number(fieldValue) <= Number(filter.value);
                        case 'contains':
                            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
                        case 'in':
                            return Array.isArray(filter.value) && filter.value.includes(fieldValue);
                        default:
                            return false;
                    }
                });
            });
        }
        catch (error) {
            console.error(`Error querying ${sheetName}:`, error);
            throw error;
        }
    }
    async aggregate(sheetName, operation, field) {
        try {
            const data = await this.read(sheetName);
            const values = data.map(record => Number(record[field])).filter(val => !isNaN(val));
            switch (operation.toLowerCase()) {
                case 'sum':
                    return values.reduce((sum, val) => sum + val, 0);
                case 'avg':
                case 'average':
                    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
                case 'count':
                    return values.length;
                case 'min':
                    return values.length > 0 ? Math.min(...values) : 0;
                case 'max':
                    return values.length > 0 ? Math.max(...values) : 0;
                default:
                    throw new Error(`Unsupported aggregation operation: ${operation}`);
            }
        }
        catch (error) {
            console.error(`Error aggregating ${field} in ${sheetName}:`, error);
            throw error;
        }
    }
    async readSheet(sheetName, range) {
        try {
            const fullRange = range ? `${sheetName}!${range}` : sheetName;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: fullRange
            });
            const rows = response.data.values || [];
            if (rows.length === 0) {
                return [];
            }
            const headers = rows[0];
            const data = rows.slice(1).map((row) => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });
            return data;
        }
        catch (error) {
            console.error(`Error reading sheet ${sheetName}:`, error);
            throw error;
        }
    }
    async appendToSheet(sheetName, data) {
        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: data
                }
            });
            console.log(`✅ Appended ${data.length} rows to ${sheetName}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Error appending to sheet ${sheetName}:`, error);
            return false;
        }
    }
    async initializeProjectSheets() {
        const sheetsConfig = [
            {
                name: 'Users',
                headers: ['id', 'email', 'password', 'name', 'role', 'googleId', 'created_at', 'updated_at']
            },
            {
                name: 'Projects',
                headers: ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at']
            },
            {
                name: 'Tasks',
                headers: ['id', 'project_id', 'title', 'description', 'status', 'priority', 'due_date', 'estimated_hours', 'actual_hours', 'created_at']
            },
            {
                name: 'Clients',
                headers: ['id', 'name', 'email', 'phone', 'address', 'gstin', 'payment_terms', 'created_at']
            },
            {
                name: 'Invoices',
                headers: ['id', 'invoice_number', 'client_id', 'project_id', 'amount', 'tax_amount', 'total_amount', 'status', 'due_date', 'created_at']
            },
            {
                name: 'Time_Entries',
                headers: ['id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at']
            },
            {
                name: 'Expenses',
                headers: ['id', 'project_id', 'category', 'amount', 'description', 'date', 'receipt_url']
            },
            {
                name: 'TwoFactorSecrets',
                headers: ['userId', 'secret', 'verified', 'createdAt', 'updatedAt']
            },
            {
                name: 'RecoveryCodes',
                headers: ['userId', 'codes', 'createdAt', 'updatedAt']
            }
        ];
        try {
            for (const config of sheetsConfig) {
                await this.createSheet(config.name, config.headers);
            }
            console.log('✅ All project sheets initialized successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Error initializing project sheets:', error);
            return false;
        }
    }
}
exports.GoogleSheetsService = GoogleSheetsService;
function createGoogleSheetsService() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
        console.error('❌ Missing Google Sheets configuration. Please check environment variables.');
        return null;
    }
    return new GoogleSheetsService({
        spreadsheetId,
        serviceAccountEmail,
        privateKey
    });
}
//# sourceMappingURL=googleSheets.js.map