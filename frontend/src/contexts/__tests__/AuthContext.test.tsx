import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
  },
  tokenManager: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const { user, isAuthenticated, isLoading, error, login, logout, clearError } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{user ? user.name : 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={clearError}>Clear Error</button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide initial state', async () => {
    (authService.getProfile as jest.Mock).mockRejectedValue(new Error('No token'));
    
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('error')).toHaveTextContent('Session expired');
  });

  it('should handle successful login', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com', role: 'user' };
    (authService.login as jest.Mock).mockResolvedValue({ user: mockUser });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    const loginButton = screen.getByText('Login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('Test User');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('should handle login failure', async () => {
    const errorMessage = 'Invalid credentials';
    (authService.login as jest.Mock).mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    const loginButton = screen.getByText('Login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('error')).toHaveTextContent(errorMessage);
    });
  });

  it('should handle logout', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com', role: 'user' };
    (authService.login as jest.Mock).mockResolvedValue({ user: mockUser });
    (authService.logout as jest.Mock).mockResolvedValue({});

    renderWithProvider();

    // First login
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    const loginButton = screen.getByText('Login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    });

    // Then logout
    const logoutButton = screen.getByText('Logout');
    await act(async () => {
      await userEvent.click(logoutButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    expect(authService.logout).toHaveBeenCalled();
  });

  it('should clear error', async () => {
    (authService.login as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Test error' } }
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    // Trigger error
    const loginButton = screen.getByText('Login');
    await act(async () => {
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    });

    // Clear error
    const clearErrorButton = screen.getByText('Clear Error');
    await act(async () => {
      await userEvent.click(clearErrorButton);
    });

    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });
});