import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, authorizeRoles, authorizeOwnership, optionalAuth, AuthenticatedRequest, JWTPayload } from '../auth';

// Mock jwt
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

// Mock config
jest.mock('../../config', () => ({
  default: {
    jwt: {
      secret: 'test-secret'
    }
  }
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined,
      params: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const payload: JWTPayload = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockedJwt.verify.mockImplementation(() => payload);

      authenticateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: payload.id,
        email: payload.email,
        role: payload.role
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no token provided', () => {
      mockRequest.headers = {};

      authenticateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for expired token', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token'
      };

      const expiredError = new jwt.TokenExpiredError('Token expired', new Date());
      mockedJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      authenticateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      const invalidError = new jwt.JsonWebTokenError('Invalid token');
      mockedJwt.verify.mockImplementation(() => {
        throw invalidError;
      });

      authenticateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 for other token verification errors', () => {
      mockRequest.headers = {
        authorization: 'Bearer problematic-token'
      };

      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Some other error');
      });

      authenticateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizeRoles', () => {
    it('should allow access for authorized role', () => {
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin'
      };

      const middleware = authorizeRoles('admin', 'client');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client'
      };

      const middleware = authorizeRoles('admin');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: ['admin'],
        current: 'client'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = authorizeRoles('admin');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizeOwnership', () => {
    beforeEach(() => {
      mockRequest.params = { id: 'resource123' };
    });

    it('should allow admin to access any resource', () => {
      mockRequest.user = {
        id: 'admin123',
        email: 'admin@example.com',
        role: 'admin'
      };

      const middleware = authorizeOwnership();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow client to access their own resource', () => {
      mockRequest.user = {
        id: 'user123',
        email: 'user@example.com',
        role: 'client'
      };
      mockRequest.params = { id: 'user123' };

      const middleware = authorizeOwnership();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny client access to other resources', () => {
      mockRequest.user = {
        id: 'user123',
        email: 'user@example.com',
        role: 'client'
      };
      mockRequest.params = { id: 'other-user' };

      const middleware = authorizeOwnership();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access denied - can only access own resources',
        code: 'OWNERSHIP_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom resource ID parameter', () => {
      mockRequest.user = {
        id: 'user123',
        email: 'user@example.com',
        role: 'client'
      };
      mockRequest.params = { userId: 'user123' };

      const middleware = authorizeOwnership('userId');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = authorizeOwnership();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', () => {
      const payload: JWTPayload = {
        id: 'user123',
        email: 'test@example.com',
        role: 'client'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockedJwt.verify.mockImplementation(() => payload);

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: payload.id,
        email: payload.email,
        role: payload.role
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user if no token provided', () => {
      mockRequest.headers = {};

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user if invalid token provided', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuth(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});