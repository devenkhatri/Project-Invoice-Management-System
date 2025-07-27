import { QueryFilter } from '../types';
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidGSTIN: (gstin: string) => boolean;
export declare const isValidPAN: (pan: string) => boolean;
export declare const isValidPhone: (phone: string) => boolean;
export declare const isValidURL: (url: string) => boolean;
export declare const isValidCurrency: (currency: string) => boolean;
export declare const isValidUUID: (uuid: string) => boolean;
export declare const isValidDate: (dateString: string) => boolean;
export declare const isValidTimeFormat: (time: string) => boolean;
export declare const isDateInFuture: (dateString: string) => boolean;
export declare const isDateInPast: (dateString: string) => boolean;
export declare const convertToSheetRow: (data: any, headers: string[]) => any[];
export declare const convertFromSheetRow: (row: any[], headers: string[]) => any;
export declare const validateSheetData: (sheetName: string, data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateQueryFilters: (filters: QueryFilter[]) => string[];
export declare const sanitizeData: (data: any) => any;
export declare const formatCurrency: (amount: number, currency?: string) => string;
export declare const formatDate: (dateString: string, locale?: string) => string;
export declare const formatDateTime: (dateString: string, locale?: string) => string;
export declare const formatDuration: (hours: number) => string;
export declare const formatPercentage: (value: number, decimals?: number) => string;
export declare const generateId: (prefix?: string) => string;
export declare const generateInvoiceNumber: (prefix?: string, sequence?: number) => string;
export declare const calculatePercentage: (part: number, total: number) => number;
export declare const calculateGST: (amount: number, rate: number) => {
    taxAmount: number;
    totalAmount: number;
};
export declare const roundToTwoDecimals: (value: number) => number;
export declare const groupBy: <T>(array: T[], keyFn: (item: T) => string) => Record<string, T[]>;
export declare const sortBy: <T>(array: T[], keyFn: (item: T) => any, order?: "asc" | "desc") => T[];
export declare const unique: <T>(array: T[], keyFn?: (item: T) => any) => T[];
//# sourceMappingURL=validation.d.ts.map