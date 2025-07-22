import { GoogleSheetsService } from './googleSheets';
export interface TwoFactorSecret {
    userId: string;
    secret: string;
    verified: boolean;
    createdAt: string;
    updatedAt: string;
}
export declare class TwoFactorService {
    private sheetsService;
    constructor(sheetsService: GoogleSheetsService);
    generateSecret(userId: string, email: string): Promise<{
        secret: string;
        uri: string;
        qrCode: string;
    }>;
    verifyToken(userId: string, token: string): Promise<boolean>;
    isTwoFactorEnabled(userId: string): Promise<boolean>;
    disableTwoFactor(userId: string): Promise<boolean>;
    generateRecoveryCode(userId: string): Promise<string>;
    verifyRecoveryCode(userId: string, code: string): Promise<boolean>;
    private generateSecretKey;
    private getUserSecret;
    private saveUserSecret;
    private markSecretAsVerified;
    private deleteUserSecret;
    private saveRecoveryCode;
    private getRecoveryCodes;
    private updateRecoveryCodes;
}
//# sourceMappingURL=twoFactor.d.ts.map