export interface SheetsConfig {
    spreadsheetId: string;
    serviceAccountEmail: string;
    privateKey: string;
}
export interface QueryFilter {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
    value: any;
}
export interface BatchOperation {
    operation: 'create' | 'update' | 'delete';
    sheetName: string;
    id?: string;
    data?: any;
}
export interface SheetsServiceInterface {
    create(sheetName: string, data: any): Promise<string>;
    read(sheetName: string, id?: string): Promise<any[]>;
    update(sheetName: string, id: string, data: any): Promise<boolean>;
    delete(sheetName: string, id: string): Promise<boolean>;
    batchCreate(sheetName: string, data: any[]): Promise<string[]>;
    batchUpdate(sheetName: string, updates: any[]): Promise<boolean>;
    query(sheetName: string, filters: QueryFilter[]): Promise<any[]>;
    aggregate(sheetName: string, operation: string, field: string): Promise<number>;
}
export declare class GoogleSheetsService implements SheetsServiceInterface {
    private sheets;
    private spreadsheetId;
    private auth;
    constructor(config: SheetsConfig);
    testConnection(): Promise<boolean>;
    getSpreadsheetInfo(): Promise<any>;
    createSheet(sheetName: string, headers: string[]): Promise<boolean>;
    private getHeaders;
    private rowToObject;
    private objectToRow;
    private findRowIndexById;
    create(sheetName: string, data: any): Promise<string>;
    read(sheetName: string, id?: string): Promise<any[]>;
    update(sheetName: string, id: string, data: any): Promise<boolean>;
    delete(sheetName: string, id: string): Promise<boolean>;
    batchCreate(sheetName: string, dataArray: any[]): Promise<string[]>;
    batchUpdate(sheetName: string, updates: any[]): Promise<boolean>;
    query(sheetName: string, filters: QueryFilter[] | Record<string, any>): Promise<any[]>;
    aggregate(sheetName: string, operation: string, field: string): Promise<number>;
    readSheet(sheetName: string, range?: string): Promise<any[]>;
    appendToSheet(sheetName: string, data: any[]): Promise<boolean>;
    initializeProjectSheets(): Promise<boolean>;
}
export declare function createGoogleSheetsService(): GoogleSheetsService | null;
//# sourceMappingURL=googleSheets.d.ts.map