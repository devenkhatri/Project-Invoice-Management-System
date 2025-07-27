import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SheetsService } from '../services/sheets.service';

// Extend Request interface to include user
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

export class AuthService {
  private static instance: AuthService;
  private sheetsService: SheetsService;
  private readonly JWT_ACCESS_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  private constructor() {
    this.sheetsService = SheetsService.getInstance();
    this.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.warn('⚠️  JWT secrets not set in environment variables. Using default values for development.');
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Generate access and refresh tokens for a user
   */
  public generateTokens(user: Omit<TokenPayload, 'type'>): AuthTokens {
    const accessTokenPayload: TokenPayload = { ...user, type: 'access' };
    const refreshTokenPayload: TokenPayload = { ...user, type: 'refresh' };

    const accessToken = jwt.sign(accessTokenPayload, this.JWT_ACCESS_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'project-invoice-api',
      audience: 'project-invoice-client'
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'project-invoice-api',
      audience: 'project-invoice-client'
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  public verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_ACCESS_SECRET, {
        issuer: 'project-invoice-api',
        audience: 'project-invoice-client'
      }) as TokenPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  public verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET, {
        issuer: 'project-invoice-api',
        audience: 'project-invoice-client'
      }) as TokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    const decoded = this.verifyRefreshToken(refreshToken);
    
    // Verify user still exists and is active
    const users = await this.sheetsService.query('Users', {
      filters: [
        { column: 'id', operator: 'eq', value: decoded.id },
        { column: 'is_active', operator: 'eq', value: true }
      ]
    });

    if (users.length === 0) {
      throw new Error('User not found or inactive');
    }

    const user = users[0];
    return this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });
  }

  /**
   * Revoke refresh token (logout)
   */
  public async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // In a real implementation, you might want to store revoked tokens
      // For now, we'll just verify the token is valid
      console.log(`Refresh token revoked for user: ${decoded.email}`);
    } catch (error) {
      // Token is already invalid, which is fine for logout
      console.log('Attempted to revoke invalid refresh token');
    }
  }
}

/**
 * Middleware to authenticate requests using JWT access tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required'
      });
      return;
    }

    const authService = AuthService.getInstance();
    const decoded = authService.verifyAccessToken(token);

    // Verify user still exists and is active
    const sheetsService = SheetsService.getInstance();
    const users = await sheetsService.query('Users', {
      filters: [
        { column: 'id', operator: 'eq', value: decoded.id },
        { column: 'is_active', operator: 'eq', value: true }
      ]
    });

    if (users.length === 0) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token'
    });
  }
};

/**
 * Middleware to authorize requests based on user roles
 */
export const authorizeRoles = (...roles: ('admin' | 'client')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
      return;
    }

    next();
  };
};

/**
 * Alias for authorizeRoles for backward compatibility
 */
export const requireRole = (roles: ('admin' | 'client')[]) => {
  return authorizeRoles(...roles);
};

/**
 * Middleware to check if user can access specific resource
 */
export const authorizeResourceAccess = (resourceType: 'project' | 'client' | 'invoice') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
        return;
      }

      // Admin can access all resources
      if (req.user.role === 'admin') {
        next();
        return;
      }

      // Client can only access their own resources
      const resourceId = req.params.id;
      if (!resourceId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Resource ID is required'
        });
        return;
      }

      const sheetsService = SheetsService.getInstance();
      let hasAccess = false;

      switch (resourceType) {
        case 'client':
          // Client can access their own client record
          const clients = await sheetsService.query('Clients', {
            filters: [
              { column: 'id', operator: 'eq', value: resourceId },
              { column: 'email', operator: 'eq', value: req.user.email }
            ]
          });
          hasAccess = clients.length > 0;
          break;

        case 'project':
          // Client can access projects associated with their client record
          const projects = await sheetsService.query('Projects', {
            filters: [
              { column: 'id', operator: 'eq', value: resourceId }
            ]
          });
          if (projects.length > 0) {
            const clientProjects = await sheetsService.query('Clients', {
              filters: [
                { column: 'id', operator: 'eq', value: projects[0].client_id },
                { column: 'email', operator: 'eq', value: req.user.email }
              ]
            });
            hasAccess = clientProjects.length > 0;
          }
          break;

        case 'invoice':
          // Client can access invoices for their projects
          const invoices = await sheetsService.query('Invoices', {
            filters: [
              { column: 'id', operator: 'eq', value: resourceId }
            ]
          });
          if (invoices.length > 0) {
            const clientInvoices = await sheetsService.query('Clients', {
              filters: [
                { column: 'id', operator: 'eq', value: invoices[0].client_id },
                { column: 'email', operator: 'eq', value: req.user.email }
              ]
            });
            hasAccess = clientInvoices.length > 0;
          }
          break;
      }

      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this resource'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error checking resource access'
      });
    }
  };
};