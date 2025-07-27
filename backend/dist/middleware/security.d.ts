import { Request, Response, NextFunction } from 'express';
export declare const RateLimiters: {
    general: import("express-rate-limit").RateLimitRequestHandler;
    auth: import("express-rate-limit").RateLimitRequestHandler;
    passwordReset: import("express-rate-limit").RateLimitRequestHandler;
    fileUpload: import("express-rate-limit").RateLimitRequestHandler;
};
export declare const sanitizeRequest: (req: Request, res: Response, next: NextFunction) => void;
export declare const preventNoSQLInjection: import("express").Handler;
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const securityLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const ipWhitelist: (allowedIPs?: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimit: (maxSize?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map