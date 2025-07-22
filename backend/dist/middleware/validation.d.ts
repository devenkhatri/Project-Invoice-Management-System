import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
import { z } from 'zod';
export declare const handleValidationErrors: (req: Request, res: Response, next: NextFunction) => void;
export declare const sanitizeHtml: (value: string) => string;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const schemas: {
    register: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        name: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<{
            admin: "admin";
            client: "client";
        }>>;
    }, z.core.$strip>;
    login: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        name: z.ZodString;
        clientId: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        budget: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            completed: "completed";
            "on-hold": "on-hold";
        }>>;
    }, z.core.$strip>;
    task: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        projectId: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            completed: "completed";
            todo: "todo";
            "in-progress": "in-progress";
        }>>;
        dueDate: z.ZodOptional<z.ZodString>;
        estimatedHours: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    client: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        gstin: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    invoice: z.ZodObject<{
        clientId: z.ZodString;
        projectId: z.ZodOptional<z.ZodString>;
        amount: z.ZodNumber;
        taxAmount: z.ZodOptional<z.ZodNumber>;
        dueDate: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            description: z.ZodString;
            quantity: z.ZodNumber;
            rate: z.ZodNumber;
            amount: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    timeEntry: z.ZodObject<{
        taskId: z.ZodString;
        projectId: z.ZodString;
        hours: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodString;
    }, z.core.$strip>;
    expense: z.ZodObject<{
        projectId: z.ZodOptional<z.ZodString>;
        category: z.ZodString;
        amount: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodString;
    }, z.core.$strip>;
};
export declare const validateSchema: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validationChains: {
    register: ValidationChain[];
    login: ValidationChain[];
    createProject: ValidationChain[];
    createClient: ValidationChain[];
    createInvoice: ValidationChain[];
    mongoId: ValidationChain[];
    pagination: ValidationChain[];
};
declare global {
    var rateLimitStore: Map<string, number[]> | undefined;
}
export declare const validateRateLimit: (windowMs: number, max: number, message?: string) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map