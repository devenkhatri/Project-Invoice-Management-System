import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { AuthService } from '../middleware/auth';
import { SecurityUtils } from '../utils/security';
import { SheetsService } from '../services/sheets.service';
import { ValidationSets, ValidationRules, handleValidationErrors } from '../middleware/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const authService = AuthService.getInstance();
const sheetsService = SheetsService.getInstance();

/**
 * User registration endpoint
 * POST /api/auth/register
 */
router.post('/register', ValidationSets.register, async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = 'client' } = req.body;

    // Check if user already exists
    const existingUsers = await sheetsService.query('Users', {
      filters: [{ column: 'email', operator: 'eq', value: email }]
    });

    if (existingUsers.length > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
      return;
    }

    // Hash password
    const hashedPassword = await SecurityUtils.hashPassword(password);

    // Create user record
    const userId = uuidv4();
    const userData = {
      id: userId,
      name: SecurityUtils.sanitizeInput(name),
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      role,
      is_active: true,
      email_verified: false,
      last_login: null,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await sheetsService.create('Users', userData);

    // Generate tokens
    const tokens = authService.generateTokens({
      id: userId,
      email,
      role,
      name
    });

    // Log successful registration
    console.log(`✅ User registered successfully: ${email} (${role})`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        name,
        email,
        role,
        is_active: true
      },
      tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user'
    });
  }
});

/**
 * User login endpoint
 * POST /api/auth/login
 */
router.post('/login', ValidationSets.login, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const users = await sheetsService.query('Users', {
      filters: [{ column: 'email', operator: 'eq', value: email.toLowerCase() }]
    });

    if (users.length === 0) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
      return;
    }

    const user = users[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(423).json({
        error: 'Account Locked',
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
      return;
    }

    // Check if account is active
    if (!user.is_active) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is deactivated'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await SecurityUtils.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const updateData: any = {
        failed_login_attempts: failedAttempts,
        updated_at: new Date().toISOString()
      };

      // Lock account after 5 failed attempts for 30 minutes
      if (failedAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        updateData.locked_until = lockUntil.toISOString();
      }

      await sheetsService.update('Users', user.id, updateData);

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
      return;
    }

    // Reset failed login attempts and update last login
    await sheetsService.update('Users', user.id, {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Generate tokens
    const tokens = authService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    // Log successful login
    console.log(`✅ User logged in successfully: ${user.email} (${user.role})`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      },
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate user'
    });
  }
});

/**
 * Refresh token endpoint
 * POST /api/auth/refresh
 */
router.post('/refresh', ValidationSets.refreshToken, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid refresh token'
    });
  }
});

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Don't fail logout even if token revocation fails
    res.json({
      message: 'Logged out successfully'
    });
  }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Get fresh user data
    const users = await sheetsService.query('Users', {
      filters: [{ column: 'id', operator: 'eq', value: req.user.id }]
    });

    if (users.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }

    const user = users[0];

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        email_verified: user.email_verified,
        last_login: user.last_login,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user profile'
    });
  }
});

/**
 * Change password endpoint
 * POST /api/auth/change-password
 */
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  ValidationRules.password(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Get user data
    const users = await sheetsService.query('Users', {
      filters: [{ column: 'id', operator: 'eq', value: req.user.id }]
    });

    if (users.length === 0) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
      return;
    }

    const user = users[0];

    // Verify current password
    const isCurrentPasswordValid = await SecurityUtils.verifyPassword(
      currentPassword,
      user.password_hash
    );

    if (!isCurrentPasswordValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const hashedNewPassword = await SecurityUtils.hashPassword(newPassword);

    // Update password
    await sheetsService.update('Users', user.id, {
      password_hash: hashedNewPassword,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ Password changed successfully for user: ${user.email}`);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password'
    });
  }
});

export default router;