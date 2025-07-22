import { AuthService, User } from '../auth';
import { GoogleSheetsService } from '../googleSheets';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock the GoogleSheetsService
jest.mock('../googleSheets');
const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;

// Mock jwt
jest.mock('jsonwebtoken');
const mockedJwt = {
  sign: jest.fn(),
  verify: jest.fn()
} as jest.Mocked<Pick<typeof jwt, 'sign' | 'verify'>>;

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = {
  hash: jest.fn(),
  compare: jest.fn()
} as jest.Mocked<Pick<typeof bcrypt, 'hash' | 'compare'>>;

// Mock config
jest.mock('../../config', () => ({
  default: {
    jwt: {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '1h',
      refreshExpiresIn: '7d'
    }
  }
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock sheets service
    mockSheetsService = new MockedGoogleSheetsService({} as any) as jest.Mocked<GoogleSheetsService>;
    
    // Initialize auth service
    authService = new AuthService(mockSheetsService);
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client' as const,
        name: 'Test User',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      mockedJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const tokens = authService.generateTokens(user);

      expect(tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600 // 1 hour in seconds
      });

      expect(mockedJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { id: user.id, email: user.email, role: user.role },
        'test-secret',
        { expiresIn: '1h' }
      );
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { id: user.id, email: user.email, role: user.role },
        'test-refresh-secret',
        { expiresIn: '7d' }
      );
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'testpassword';
      const hashedPassword = 'hashed-password';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await authService.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password against hash', async () => {
      const password = 'testpassword';
      const hash = 'hashed-password';

      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await authService.verifyPassword(password, hash);

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should return false for invalid password', async () => {
      const password = 'wrongpassword';
      const hash = 'hashed-password';

      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await authService.verifyPassword(password, hash);

      expect(result).toBe(false);
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
        role: 'client' as const
      };

      // Mock that user doesn't exist
      mockSheetsService.query.mockResolvedValue([]);
      
      // Mock password hashing
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      
      // Mock user creation
      mockSheetsService.create.mockResolvedValue('user123');
      
      // Mock token generation
      mockedJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(userData);

      expect(result.user.email).toBe(userData.email);
      expect(result.user.name).toBe(userData.name);
      expect(result.user.role).toBe(userData.role);
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');

      expect(mockSheetsService.query).toHaveBeenCalledWith('Users', { email: userData.email });
      expect(mockSheetsService.create).toHaveBeenCalledWith('Users', expect.objectContaining({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        password: 'hashed-password'
      }));
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      // Mock that user already exists
      mockSheetsService.query.mockResolvedValue([{
        id: 'existing-user',
        email: userData.email,
        name: 'Existing User'
      }]);

      await expect(authService.register(userData)).rejects.toThrow('User already exists with this email');
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const existingUser: User = {
        id: 'user123',
        email: credentials.email,
        password: 'hashed-password',
        name: 'Test User',
        role: 'client',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      // Mock finding user
      mockSheetsService.query.mockResolvedValue([existingUser]);
      
      // Mock password verification
      mockedBcrypt.compare.mockResolvedValue(true);
      
      // Mock user update
      mockSheetsService.update.mockResolvedValue(true);
      
      // Mock token generation
      mockedJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login(credentials);

      expect(result.user.email).toBe(credentials.email);
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');

      expect(mockSheetsService.query).toHaveBeenCalledWith('Users', { email: credentials.email });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(credentials.password, existingUser.password);
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Mock user not found
      mockSheetsService.query.mockResolvedValue([]);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const existingUser: User = {
        id: 'user123',
        email: credentials.email,
        password: 'hashed-password',
        name: 'Test User',
        role: 'client',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      // Mock finding user
      mockSheetsService.query.mockResolvedValue([existingUser]);
      
      // Mock password verification failure
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client'
      };

      const existingUser: User = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      // Mock token verification
      mockedJwt.verify.mockReturnValue(decodedPayload);
      
      // Mock finding user
      mockSheetsService.query.mockResolvedValue([existingUser]);
      
      // Mock new token generation
      mockedJwt.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');

      expect(mockedJwt.verify).toHaveBeenCalledWith(refreshToken, 'test-refresh-secret');
      expect(mockSheetsService.query).toHaveBeenCalledWith('Users', { id: decodedPayload.id });
    });

    it('should throw error for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      // Mock token verification failure
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error if user not found', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client'
      };

      // Mock token verification
      mockedJwt.verify.mockReturnValue(decodedPayload);
      
      // Mock user not found
      mockSheetsService.query.mockResolvedValue([]);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', () => {
      const token = 'valid-token';
      const payload = { id: 'user123', email: 'test@example.com', role: 'client' };

      mockedJwt.verify.mockReturnValue(payload);

      const result = authService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
      expect(result.error).toBeUndefined();
    });

    it('should handle expired token', () => {
      const token = 'expired-token';

      mockedJwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = authService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should handle invalid token', () => {
      const token = 'invalid-token';

      mockedJwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const result = authService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = 'user123';
      const existingUser: User = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'client',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      // Mock finding user
      mockSheetsService.query.mockResolvedValue([existingUser]);
      
      // Mock user update
      mockSheetsService.update.mockResolvedValue(true);

      await authService.logout(userId);

      expect(mockSheetsService.query).toHaveBeenCalledWith('Users', { id: userId });
      expect(mockSheetsService.update).toHaveBeenCalledWith('Users', userId, expect.objectContaining({
        updatedAt: expect.any(String)
      }));
    });

    it('should handle logout gracefully if user not found', async () => {
      const userId = 'nonexistent-user';

      // Mock user not found
      mockSheetsService.query.mockResolvedValue([]);

      // Should not throw error
      await expect(authService.logout(userId)).resolves.toBeUndefined();
    });
  });
});