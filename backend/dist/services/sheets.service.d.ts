import { QueryOptions, BatchOperation } from '../types';
export declare class SheetsService {
    private static instance;
    private sheets;
    private spreadsheetId;
    private auth;
    private sheetConfigs;
    constructor(spreadsheetId: string, serviceAccountKey: any);
    static getInstance(): SheetsService;
    private initializeSheetConfigs;
    initializeSheets(): Promise<void>;
    private createSheetIfNotExists;
    create(sheetName: string, data: any): Promise<string>;
    read(sheetName: string, id?: string): Promise<any[]>;
    update(sheetName: string, id: string, data: any): Promise<boolean>;
    delete(sheetName: string, id: string): Promise<boolean>;
    batchCreate(sheetName: string, dataArray: any[]): Promise<string[]>;
    batchUpdate(operations: BatchOperation[]): Promise<boolean>;
    query(sheetName: string, options?: QueryOptions | Record<string, any>): Promise<any[]>;
    private applyFilter;
    aggregate(sheetName: string, operation: 'count' | 'sum' | 'avg' | 'min' | 'max', field?: string): Promise<number>;
    validateSheetStructure(sheetName: string): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    validateAllSheets(): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    exportSheetData(sheetName: string): Promise<any[]>;
    exportAllData(): Promise<Record<string, any[]>>;
    clearSheet(sheetName: string, preserveHeaders?: boolean): Promise<boolean>;
    validateRecordData(sheetName: string, data: any): {
        isValid: boolean;
        errors: string[];
    };
    private generateId;
    private getColumnLetter;
    private handleError;
    private isRetryableError;
    private retryOperation;
}
//# sourceMappingURL=sheets.service.d.ts.map