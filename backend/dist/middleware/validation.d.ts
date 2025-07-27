import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
export declare const handleValidationErrors: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRequest: (req: Request, res: Response, next: NextFunction) => void;
export declare const ValidationRules: {
    email: () => ValidationChain;
    password: () => ValidationChain;
    name: () => ValidationChain;
    projectName: () => ValidationChain;
    projectStatus: () => ValidationChain;
    projectBudget: () => ValidationChain;
    projectDates: () => ValidationChain[];
    clientName: () => ValidationChain;
    phone: () => ValidationChain;
    gstin: () => ValidationChain;
    pan: () => ValidationChain;
    taskTitle: () => ValidationChain;
    taskStatus: () => ValidationChain;
    taskPriority: () => ValidationChain;
    hours: () => ValidationChain;
    invoiceAmount: () => ValidationChain;
    invoiceStatus: () => ValidationChain;
    currency: () => ValidationChain;
    id: (paramName?: string) => ValidationChain;
    optionalId: (fieldName: string) => ValidationChain;
    dateRange: () => ValidationChain[];
    pagination: () => ValidationChain[];
    sanitizeBody: () => ValidationChain;
};
export declare const ValidationSets: {
    register: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    login: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    refreshToken: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    createProject: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    updateProject: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    createClient: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    updateClient: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    createTask: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    updateTask: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    createTimeEntry: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    createInvoice: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    getById: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
    queryWithPagination: (((req: Request, res: Response, next: NextFunction) => void) | ValidationChain)[];
};
export declare const validateFileUpload: (allowedTypes?: string[], maxSize?: number) => (req: Request & {
    file?: any;
}, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map