import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: 'admin' | 'client';
    };
}
export interface JWTPayload {
    id: string;
    email: string;
    role: 'admin' | 'client';
    iat?: number;
    exp?: number;
}
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const authorizeRoles: (...roles: ("admin" | "client")[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const authorizeOwnership: (resourceIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map