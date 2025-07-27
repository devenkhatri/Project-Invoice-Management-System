import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';
import { AuthProvider } from '../../../contexts/AuthContext';
import { authService } from '../../../services/api';

// Mock the API service
jest.mock('../../../services/api', () => ({
  authService: {
    login: jest.fn(),
    getProfile: jest.fn(),
  },
  tokenManager: {
    getToken: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const renderLoginForm = (props = {}) => {
  return render(
    <AuthProvider>
      <LoginForm {...props} />
    </AuthProvider>
  );
};

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getProfile as jest.Mock).mockRejectedValue(new Error('No token'));
  });

  it('should render login form', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('should validate password length', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, '123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
  });

  it('should handle successful login', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com', role: 'user' };
    (authService.login as jest.Mock).mockResolvedValue({ user: mockUser });
    
    const onSuccess = jest.fn();
    renderLoginForm({ onSuccess });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle login error', async () => {
    const errorMessage = 'Invalid credentials';
    (authService.login as jest.Mock).mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should toggle password visibility', async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByTestId('VisibilityIcon').closest('button')!;

    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password again
    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should disable form during submission', async () => {
    (authService.login as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderLoginForm();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    // Form should be disabled during submission
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});