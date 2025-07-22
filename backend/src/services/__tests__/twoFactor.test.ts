import { TwoFactorService } from '../twoFactor';
import { GoogleSheetsService } from '../googleSheets';
import { totp } from 'otplib';

// Mock the GoogleSheetsService
jest.mock('../googleSheets');
const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;

// Mock otplib
jest.mock('otplib', () => ({
  totp: {
    options: {},
    keyuri: jest.fn(),
    verify: jest.fn()
  }
}));

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('mocked-qr-code-data-url')
}));

describe('TwoFactorService', () => {
  let twoFactorService: TwoFactorService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock sheets service
    mockSheetsService = new MockedGoogleSheetsService({} as any) as jest.Mocked<GoogleSheetsService>;
    
    // Initialize two-factor service
    twoFactorService = new TwoFactorService(mockSheetsService);
  });

  describe('generateSecret', () => {
    it('should generate a new secret for a user', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      
      // Mock that user doesn't have a secret yet
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.create.mockResolvedValue('secret123');
      
      // Mock totp.keyuri
      (totp.keyuri as jest.Mock).mockReturnValue('otpauth://totp/Invoice%20Management%20System:test@example.com?secret=ABCDEFGHIJKLMNOP&issuer=Invoice%20Management%20System');
      
      const result = await twoFactorService.generateSecret(userId, email);
      
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('uri');
      expect(result).toHaveProperty('qrCode', 'mocked-qr-code-data-url');
      
      expect(mockSheetsService.query).toHaveBeenCalledWith('TwoFactorSecrets', { userId });
      expect(mockSheetsService.create).toHaveBeenCalledWith('TwoFactorSecrets', expect.objectContaining({
        userId,
        secret: expect.any(String),
        verified: false
      }));
    });

    it('should throw error if user already has verified 2FA', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      
      // Mock that user already has a verified secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret: 'existing-secret',
        verified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      await expect(twoFactorService.generateSecret(userId, email))
        .rejects.toThrow('Two-factor authentication is already enabled for this user');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const userId = 'user123';
      const token = '123456';
      const secret = 'test-secret';
      
      // Mock that user has a secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret,
        verified: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      // Mock totp.verify to return true
      (totp.verify as jest.Mock).mockReturnValue(true);
      
      // Mock update for marking as verified
      mockSheetsService.update.mockResolvedValue(true);
      
      const result = await twoFactorService.verifyToken(userId, token);
      
      expect(result).toBe(true);
      expect(totp.verify).toHaveBeenCalledWith({
        token,
        secret
      });
      
      // Should mark as verified on first successful verification
      expect(mockSheetsService.update).toHaveBeenCalledWith('TwoFactorSecrets', userId, expect.objectContaining({
        verified: true
      }));
    });

    it('should return false for invalid token', async () => {
      const userId = 'user123';
      const token = '123456';
      const secret = 'test-secret';
      
      // Mock that user has a secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret,
        verified: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      // Mock totp.verify to return false
      (totp.verify as jest.Mock).mockReturnValue(false);
      
      const result = await twoFactorService.verifyToken(userId, token);
      
      expect(result).toBe(false);
      expect(mockSheetsService.update).not.toHaveBeenCalled();
    });

    it('should throw error if user has no 2FA setup', async () => {
      const userId = 'user123';
      const token = '123456';
      
      // Mock that user has no secret
      mockSheetsService.query.mockResolvedValue([]);
      
      await expect(twoFactorService.verifyToken(userId, token))
        .rejects.toThrow('Two-factor authentication is not set up for this user');
    });
  });

  describe('isTwoFactorEnabled', () => {
    it('should return true if user has verified 2FA', async () => {
      const userId = 'user123';
      
      // Mock that user has a verified secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret: 'test-secret',
        verified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      const result = await twoFactorService.isTwoFactorEnabled(userId);
      
      expect(result).toBe(true);
    });

    it('should return false if user has no 2FA setup', async () => {
      const userId = 'user123';
      
      // Mock that user has no secret
      mockSheetsService.query.mockResolvedValue([]);
      
      const result = await twoFactorService.isTwoFactorEnabled(userId);
      
      expect(result).toBe(false);
    });

    it('should return false if user has unverified 2FA', async () => {
      const userId = 'user123';
      
      // Mock that user has an unverified secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret: 'test-secret',
        verified: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      const result = await twoFactorService.isTwoFactorEnabled(userId);
      
      expect(result).toBe(false);
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable 2FA for a user', async () => {
      const userId = 'user123';
      
      // Mock that user has a secret
      mockSheetsService.query.mockResolvedValue([{
        userId,
        secret: 'test-secret',
        verified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]);
      
      // Mock delete operation
      mockSheetsService.delete.mockResolvedValue(true);
      
      const result = await twoFactorService.disableTwoFactor(userId);
      
      expect(result).toBe(true);
      expect(mockSheetsService.delete).toHaveBeenCalledWith('TwoFactorSecrets', userId);
    });

    it('should return true if user has no 2FA to disable', async () => {
      const userId = 'user123';
      
      // Mock that user has no secret
      mockSheetsService.query.mockResolvedValue([]);
      
      const result = await twoFactorService.disableTwoFactor(userId);
      
      expect(result).toBe(true);
      expect(mockSheetsService.delete).not.toHaveBeenCalled();
    });
  });

  describe('recovery codes', () => {
    it('should generate and verify recovery codes', async () => {
      const userId = 'user123';
      
      // Mock empty recovery codes initially
      mockSheetsService.query.mockResolvedValueOnce([]);
      
      // Mock create operation for saving recovery code
      mockSheetsService.create.mockResolvedValue('code123');
      
      // Generate a recovery code
      const recoveryCode = await twoFactorService.generateRecoveryCode(userId);
      expect(recoveryCode).toBeTruthy();
      expect(typeof recoveryCode).toBe('string');
      
      // Mock query to return the saved code
      mockSheetsService.query.mockResolvedValueOnce([{
        userId,
        codes: JSON.stringify([expect.any(String)]) // Hashed code
      }]);
      
      // Mock update operation for removing used code
      mockSheetsService.update.mockResolvedValue(true);
      
      // Verify the recovery code
      const isValid = await twoFactorService.verifyRecoveryCode(userId, recoveryCode);
      expect(isValid).toBe(true);
      
      // Should update recovery codes (removing the used one)
      expect(mockSheetsService.update).toHaveBeenCalledWith('RecoveryCodes', userId, expect.objectContaining({
        codes: '[]' // Empty array after using the code
      }));
    });

    it('should return false for invalid recovery code', async () => {
      const userId = 'user123';
      const invalidCode = 'invalid-code';
      
      // Mock query to return saved codes
      mockSheetsService.query.mockResolvedValue([{
        userId,
        codes: JSON.stringify(['some-hashed-code'])
      }]);
      
      const isValid = await twoFactorService.verifyRecoveryCode(userId, invalidCode);
      expect(isValid).toBe(false);
      expect(mockSheetsService.update).not.toHaveBeenCalled();
    });
  });
});