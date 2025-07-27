export declare class SecurityUtils {
    private static readonly SALT_ROUNDS;
    private static readonly TOKEN_LENGTH;
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hash: string): Promise<boolean>;
    static generateSecureToken(length?: number): string;
    static generateSecurePassword(length?: number): string;
    static sanitizeInput(input: string): string;
    static isValidEmail(email: string): boolean;
    static validatePasswordStrength(password: string): {
        isValid: boolean;
        errors: string[];
    };
    static generateDataHash(data: string): string;
    static verifyDataHash(data: string, hash: string): boolean;
    static encryptData(data: string, key?: string): string;
    static decryptData(encryptedData: string, key?: string): string;
    static isActionAllowed(lastActionTime: Date, minIntervalMs: number): boolean;
    static generateCSRFToken(): string;
    static validateCSRFToken(token: string, sessionToken: string): boolean;
    static maskSensitiveData(data: string, visibleChars?: number): string;
    static validateGSTIN(gstin: string): boolean;
    static validatePAN(pan: string): boolean;
    static generateSessionId(): string;
    static isIPAllowed(ip: string, allowedIPs?: string[]): boolean;
}
//# sourceMappingURL=security.d.ts.map