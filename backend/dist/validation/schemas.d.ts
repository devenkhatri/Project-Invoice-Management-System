import Joi from 'joi';
export declare const projectSchema: Joi.ObjectSchema<any>;
export declare const taskSchema: Joi.ObjectSchema<any>;
export declare const clientSchema: Joi.ObjectSchema<any>;
export declare const invoiceLineItemSchema: Joi.ObjectSchema<any>;
export declare const taxBreakdownSchema: Joi.ObjectSchema<any>;
export declare const invoiceSchema: Joi.ObjectSchema<any>;
export declare const timeEntrySchema: Joi.ObjectSchema<any>;
export declare const expenseSchema: Joi.ObjectSchema<any>;
export declare const createValidator: (schema: Joi.ObjectSchema) => (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateProject: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateTask: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateClient: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateInvoice: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateTimeEntry: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
export declare const validateExpense: (data: any) => {
    isValid: boolean;
    errors: {
        field: string;
        message: string;
        value: any;
    }[];
    data: null;
} | {
    isValid: boolean;
    errors: never[];
    data: any;
};
//# sourceMappingURL=schemas.d.ts.map