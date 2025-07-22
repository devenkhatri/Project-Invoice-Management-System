import crypto from 'crypto';
import { totp } from 'otplib';
import QRCode from 'qrcode';
import { GoogleSheetsService } from './googleSheets';

export interface TwoFactorSecret {
  userId: string;
  secret: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export class TwoFactorService {
  private sheetsService: GoogleSheetsService;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
    // Configure TOTP settings
    totp.options = { 
      digits: 6,
      step: 30,
      window: 1 // Allow 1 step before/after for clock drift
    };
  }

  /**
   * Generate a new TOTP secret for a user
   */
  async generateSecret(userId: string, email: string): Promise<{ secret: string; uri: string; qrCode: string }> {
    // Check if user already has a secret
    const existingSecret = await this.getUserSecret(userId);
    if (existingSecret && existingSecret.verified) {
      throw new Error('Two-factor authentication is already enabled for this user');
    }

    // Generate a new secret
    const secret = this.generateSecretKey();
    const uri = totp.keyuri(email, 'Invoice Management System', secret);
    
    // Save the secret
    await this.saveUserSecret(userId, secret);
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(uri);
    
    return { secret, uri, qrCode };
  }

  /**
   * Verify a TOTP token against a user's secret
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const userSecret = await this.getUserSecret(userId);
    if (!userSecret || !userSecret.secret) {
      throw new Error('Two-factor authentication is not set up for this user');
    }

    const isValid = totp.verify({
      token,
      secret: userSecret.secret
    });

    if (isValid && !userSecret.verified) {
      // Mark the secret as verified on first successful verification
      await this.markSecretAsVerified(userId);
    }

    return isValid;
  }

  /**
   * Check if a user has 2FA enabled
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const userSecret = await this.getUserSecret(userId);
    return !!(userSecret && userSecret.verified);
  }

  /**
   * Disable 2FA for a user
   */
  async disableTwoFactor(userId: string): Promise<boolean> {
    try {
      const userSecret = await this.getUserSecret(userId);
      if (!userSecret) {
        return true; // Already disabled
      }

      // Delete the secret from the database
      await this.deleteUserSecret(userId);
      return true;
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      return false;
    }
  }

  /**
   * Generate a recovery code for a user
   */
  async generateRecoveryCode(userId: string): Promise<string> {
    const recoveryCode = crypto.randomBytes(10).toString('hex');
    
    // Store the recovery code (hashed)
    const hashedCode = crypto.createHash('sha256').update(recoveryCode).digest('hex');
    await this.saveRecoveryCode(userId, hashedCode);
    
    return recoveryCode;
  }

  /**
   * Verify a recovery code
   */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const storedCodes = await this.getRecoveryCodes(userId);
    if (!storedCodes || storedCodes.length === 0) {
      return false;
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const matchIndex = storedCodes.findIndex(c => c === hashedCode);
    
    if (matchIndex >= 0) {
      // Remove the used code
      storedCodes.splice(matchIndex, 1);
      await this.updateRecoveryCodes(userId, storedCodes);
      return true;
    }
    
    return false;
  }

  /**
   * Generate a secure random secret key
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  /**
   * Get a user's 2FA secret from the database
   */
  private async getUserSecret(userId: string): Promise<TwoFactorSecret | null> {
    try {
      const results = await this.sheetsService.query('TwoFactorSecrets', { userId });
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Error getting user 2FA secret:', error);
      return null;
    }
  }

  /**
   * Save a user's 2FA secret to the database
   */
  private async saveUserSecret(userId: string, secret: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const existingSecret = await this.getUserSecret(userId);
    
    if (existingSecret) {
      // Update existing secret
      await this.sheetsService.update('TwoFactorSecrets', existingSecret.userId, {
        ...existingSecret,
        secret,
        verified: false,
        updatedAt: timestamp
      });
    } else {
      // Create new secret
      await this.sheetsService.create('TwoFactorSecrets', {
        userId,
        secret,
        verified: false,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  }

  /**
   * Mark a user's 2FA secret as verified
   */
  private async markSecretAsVerified(userId: string): Promise<void> {
    const userSecret = await this.getUserSecret(userId);
    if (userSecret) {
      await this.sheetsService.update('TwoFactorSecrets', userId, {
        ...userSecret,
        verified: true,
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a user's 2FA secret
   */
  private async deleteUserSecret(userId: string): Promise<void> {
    try {
      const userSecret = await this.getUserSecret(userId);
      if (userSecret) {
        await this.sheetsService.delete('TwoFactorSecrets', userId);
      }
    } catch (error) {
      console.error('Error deleting 2FA secret:', error);
      throw error;
    }
  }

  /**
   * Save a recovery code for a user
   */
  private async saveRecoveryCode(userId: string, hashedCode: string): Promise<void> {
    const codes = await this.getRecoveryCodes(userId);
    codes.push(hashedCode);
    await this.updateRecoveryCodes(userId, codes);
  }

  /**
   * Get recovery codes for a user
   */
  private async getRecoveryCodes(userId: string): Promise<string[]> {
    try {
      const results = await this.sheetsService.query('RecoveryCodes', { userId });
      if (results.length > 0) {
        return JSON.parse(results[0].codes || '[]');
      }
      return [];
    } catch (error) {
      console.error('Error getting recovery codes:', error);
      return [];
    }
  }

  /**
   * Update recovery codes for a user
   */
  private async updateRecoveryCodes(userId: string, codes: string[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const results = await this.sheetsService.query('RecoveryCodes', { userId });
    
    if (results.length > 0) {
      await this.sheetsService.update('RecoveryCodes', userId, {
        userId,
        codes: JSON.stringify(codes),
        updatedAt: timestamp
      });
    } else {
      await this.sheetsService.create('RecoveryCodes', {
        userId,
        codes: JSON.stringify(codes),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  }
}