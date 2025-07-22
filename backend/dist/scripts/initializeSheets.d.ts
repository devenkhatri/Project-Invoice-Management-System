#!/usr/bin/env node
declare const SHEET_CONFIGURATIONS: ({
    name: string;
    headers: string[];
    sampleData: {
        name: string;
        client_id: string;
        status: string;
        start_date: string;
        end_date: string;
        budget: number;
        description: string;
    }[];
} | {
    name: string;
    headers: string[];
    sampleData: {
        project_id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        due_date: string;
        estimated_hours: number;
        actual_hours: number;
    }[];
} | {
    name: string;
    headers: string[];
    sampleData: {
        name: string;
        email: string;
        phone: string;
        address: string;
        gstin: string;
        payment_terms: string;
    }[];
} | {
    name: string;
    headers: string[];
    sampleData: {
        invoice_number: string;
        client_id: string;
        project_id: string;
        amount: number;
        tax_amount: number;
        total_amount: number;
        status: string;
        due_date: string;
    }[];
} | {
    name: string;
    headers: string[];
    sampleData: {
        task_id: string;
        project_id: string;
        hours: number;
        description: string;
        date: string;
    }[];
} | {
    name: string;
    headers: string[];
    sampleData: {
        project_id: string;
        category: string;
        amount: number;
        description: string;
        date: string;
        receipt_url: string;
    }[];
})[];
declare function initializeSheets(includeSampleData?: boolean): Promise<void>;
export { initializeSheets, SHEET_CONFIGURATIONS };
//# sourceMappingURL=initializeSheets.d.ts.map