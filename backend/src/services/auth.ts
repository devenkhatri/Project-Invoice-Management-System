import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import config from '../config';
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

export class AuthService {
  private sheetsService: GoogleSheetsService;
  private oauth2Client: any;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
    this.initializeGoogleOAuth();
  }

  private initializeGoogleOAuth() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );
  }

  /**
   * Generate JWT access and refresh tokens
   */
  generateTokens(user: Omit<User, 'password'>): AuthTokens {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(
      payload, 
      config.jwt.secret as jwt.Secret, 
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      payload, 
      config.jwt.refreshSecret as jwt.Secret, 
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    // Calculate expiration time in seconds
    const expiresIn = this.getTokenExpirationTime(config.jwt.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Convert time string to seconds
   */
  private getTokenExpirationTime(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600; // 1 hour default
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<{ user: Omit<User, 'password'>; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await this.findUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user object
    const user: User = {
      id: this.generateUserId(),
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      name: userData.name,
      role: userData.role || 'client',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save user to Google Sheets
    await this.saveUser(user);

    // Generate tokens
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;
    const tokens = this.generateTokens(userWithoutPassword);

    return { user: userWithoutPassword, tokens };
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: Omit<User, 'password'>; tokens: AuthTokens }> {
    // Find user by email
    const user = await this.findUserByEmail(credentials.email);
    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(credentials.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.updatedAt = new Date().toISOString();
    await this.updateUser(user);

    // Generate tokens
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;
    const tokens = this.generateTokens(userWithoutPassword);

    return { user: userWithoutPassword, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      
      // Find user to ensure they still exist
      const user = await this.findUserById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const userWithoutPassword = { ...user };
      delete userWithoutPassword.password;
      return this.generateTokens(userWithoutPassword);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Google OAuth login
   */
  async googleLogin(authData: GoogleAuthData): Promise<{ user: Omit<User, 'password'>; tokens: AuthTokens }> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(authData.code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      if (!data.email) {
        throw new Error('Unable to get user email from Google');
      }

      // Check if user exists
      let user = await this.findUserByEmail(data.email);
      
      if (!user) {
        // Create new user
        user = {
          id: this.generateUserId(),
          email: data.email.toLowerCase(),
          name: data.name || data.email,
          role: 'client',
          googleId: data.id || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveUser(user);
      } else {
        // Update existing user with Google ID if not set
        if (!user.googleId && data.id) {
          user.googleId = data.id;
          user.updatedAt = new Date().toISOString();
          await this.updateUser(user);
        }
      }

      // Generate tokens
      const userWithoutPassword: Omit<User, 'password'> = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        googleId: user.googleId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      const authTokens = this.generateTokens(userWithoutPassword);

      return { user: userWithoutPassword, tokens: authTokens };
    } catch (error) {
      throw new Error(`Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl(redirectUri: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/spreadsheets'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      redirect_uri: redirectUri
    });
  }

  /**
   * Find user by email
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.sheetsService.query('Users', { email: email.toLowerCase() });
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Find user by ID
   */
  private async findUserById(id: string): Promise<User | null> {
    try {
      const users = await this.sheetsService.query('Users', { id });
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * Save user to Google Sheets
   */
  private async saveUser(user: User): Promise<void> {
    await this.sheetsService.create('Users', user);
  }

  /**
   * Update user in Google Sheets
   */
  private async updateUser(user: User): Promise<void> {
    await this.sheetsService.update('Users', user.id, user);
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      return { valid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      } else {
        return { valid: false, error: 'Token verification failed' };
      }
    }
  }

  /**
   * Logout user (in a stateless JWT system, this is mainly for cleanup)
   */
  async logout(userId: string): Promise<void> {
    // In a stateless JWT system, we can't invalidate tokens
    // This method is here for future enhancements like token blacklisting
    // For now, we just update the user's last activity
    try {
      const user = await this.findUserById(userId);
      if (user) {
        user.updatedAt = new Date().toISOString();
        await this.updateUser(user);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
}