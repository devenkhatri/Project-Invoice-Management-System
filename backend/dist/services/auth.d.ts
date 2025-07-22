import { GoogleSheetsService } from './googleSheets';
export interface User {
    id: string;
    email: string;
    password?: string;
    role: 'admin' | 'client';
    name: string;
    googleId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface RegisterData {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'client';
}
export interface GoogleAuthData {
    code: string;
    redirectUri: string;
}
export declare class AuthService {
    private sheetsService;
    private oauth2Client;
    constructor(sheetsService: GoogleSheetsService);
    private initializeGoogleOAuth;
    generateTokens(user: Omit<User, 'password'>): AuthTokens;
    private getTokenExpirationTime;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    register(userData: RegisterData): Promise<{
        user: Omit<User, 'password'>;
        tokens: AuthTokens;
    }>;
    login(credentials: LoginCredentials): Promise<{
        user: Omit<User, 'password'>;
        tokens: AuthTokens;
    }>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    googleLogin(authData: GoogleAuthData): Promise<{
        user: Omit<User, 'password'>;
        tokens: AuthTokens;
    }>;
    getGoogleAuthUrl(redirectUri: string): string;
    private findUserByEmail;
    private findUserById;
    private saveUser;
    private updateUser;
    private generateUserId;
    validateToken(token: string): {
        valid: boolean;
        payload?: any;
        error?: string;
    };
    logout(userId: string): Promise<void>;
}
//# sourceMappingURL=auth.d.ts.map