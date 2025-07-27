import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * Security utilities for password hashing, token generation, and data sanitization
 */
export class SecurityUtils {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TOKEN_LENGTH = 32;

  /**
   * Hash a password using bcrypt
   */
  public static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against its hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error('Failed to verify password');
    }
  }

  /**
   * Generate a secure random token
   */
  public static generateSecureToken(length: number = this.TOKEN_LENGTH): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure random password
   */
  public static generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Sanitize input to prevent XSS attacks
   */
  public static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
      .trim();
  }

  /**
   * Validate email format
   */
  public static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  public static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a hash for data integrity verification
   */
  public static generateDataHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using hash
   */
  public static verifyDataHash(data: string, hash: string): boolean {
    const computedHash = this.generateDataHash(data);
    return computedHash === hash;
  }

  /**
   * Encrypt sensitive data
   */
  public static encryptData(data: string, key?: string): string {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key';
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  public static decryptData(encryptedData: string, key?: string): string {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || 'default-encryption-key';
    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Rate limiting helper - check if action is allowed
   */
  public static isActionAllowed(
    lastActionTime: Date,
    minIntervalMs: number
  ): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - lastActionTime.getTime();
    return timeDiff >= minIntervalMs;
  }

  /**
   * Generate CSRF token
   */
  public static generateCSRFToken(): string {
    return this.generateSecureToken(32);
  }

  /**
   * Validate CSRF token
   */
  public static validateCSRFToken(token: string, sessionToken: string): boolean {
    return token === sessionToken;
  }

  /**
   * Mask sensitive data for logging
   */
  public static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) {
      return '*'.repeat(data.length);
    }
    
    const masked = '*'.repeat(data.length - visibleChars);
    return masked + data.slice(-visibleChars);
  }

  /**
   * Validate Indian GST number format
   */
  public static validateGSTIN(gstin: string): boolean {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  }

  /**
   * Validate Indian PAN number format
   */
  public static validatePAN(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  /**
   * Generate secure session ID
   */
  public static generateSessionId(): string {
    return this.generateSecureToken(64);
  }

  /**
   * Check if IP address is in allowed range (basic implementation)
   */
  public static isIPAllowed(ip: string, allowedIPs: string[] = []): boolean {
    if (allowedIPs.length === 0) {
      return true; // Allow all if no restrictions
    }
    
    return allowedIPs.includes(ip);
  }
}