import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: 'admin' | 'client';
                name: string;
            };
        }
    }
}
export interface TokenPayload {
    id: string;
    email: string;
    role: 'admin' | 'client';
    name: string;
    type: 'access' | 'refresh';
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export declare class AuthService {
    private static instance;
    private sheetsService;
    private readonly JWT_ACCESS_SECRET;
    private readonly JWT_REFRESH_SECRET;
    private readonly ACCESS_TOKEN_EXPIRY;
    private readonly REFRESH_TOKEN_EXPIRY;
    private constructor();
    static getInstance(): AuthService;
    generateTokens(user: Omit<TokenPayload, 'type'>): AuthTokens;
    verifyAccessToken(token: string): TokenPayload;
    verifyRefreshToken(token: string): TokenPayload;
    refreshAccessToken(refreshToken: string): Promise<AuthTokens>;
    revokeRefreshToken(refreshToken: string): Promise<void>;
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authorizeRoles: (...roles: ("admin" | "client")[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (roles: ("admin" | "client")[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const authorizeResourceAccess: (resourceType: "project" | "client" | "invoice") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map