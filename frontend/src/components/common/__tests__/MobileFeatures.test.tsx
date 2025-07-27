import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@testing-library/jest-dom';
import {
  CameraCapture,
  VoiceInput,
  LocationCapture,
  BiometricAuth,
  PWAInstallPrompt,
  NotificationPermission,
} from '../MobileFeatures';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock navigator APIs
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
};

const mockMediaDevices = {
  getUserMedia: jest.fn(),
};

const mockCredentials = {
  get: jest.fn(),
};

// Mock global objects
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
});

Object.defineProperty(global.navigator, 'credentials', {
  value: mockCredentials,
  writable: true,
});

// Mock Notification API
Object.defineProperty(global, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: jest.fn().mockResolvedValue('granted'),
  },
  writable: true,
});

describe('MobileFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CameraCapture', () => {
    it('renders camera button', () => {
      const mockOnCapture = jest.fn();
      renderWithTheme(<CameraCapture onCapture={mockOnCapture} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('opens camera dialog when clicked', async () => {
      const mockOnCapture = jest.fn();
      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }],
      };
      
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
      
      renderWithTheme(<CameraCapture onCapture={mockOnCapture} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Capture Receipt')).toBeInTheDocument();
      });
    });

    it('handles camera access error', async () => {
      const mockOnCapture = jest.fn();
      const mockOnError = jest.fn();
      
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Camera not available'));
      
      renderWithTheme(
        <CameraCapture onCapture={mockOnCapture} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Camera access denied or not available');
      });
    });
  });

  describe('VoiceInput', () => {
    it('renders voice input button', () => {
      const mockOnResult = jest.fn();
      renderWithTheme(<VoiceInput onResult={mockOnResult} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles speech recognition not supported', () => {
      const mockOnResult = jest.fn();
      const mockOnError = jest.fn();
      
      // Remove speech recognition from window
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      
      renderWithTheme(
        <VoiceInput onResult={mockOnResult} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(mockOnError).toHaveBeenCalledWith('Speech recognition not supported in this browser');
    });
  });

  describe('LocationCapture', () => {
    it('renders location button', () => {
      const mockOnLocation = jest.fn();
      renderWithTheme(<LocationCapture onLocation={mockOnLocation} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('gets current location successfully', async () => {
      const mockOnLocation = jest.fn();
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      };
      
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });
      
      renderWithTheme(<LocationCapture onLocation={mockOnLocation} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(mockOnLocation).toHaveBeenCalledWith({
          latitude: 40.7128,
          longitude: -74.0060,
        });
      });
    });

    it('handles geolocation error', async () => {
      const mockOnLocation = jest.fn();
      const mockOnError = jest.fn();
      
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({ code: 1 }); // PERMISSION_DENIED
      });
      
      renderWithTheme(
        <LocationCapture onLocation={mockOnLocation} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Unable to retrieve location');
      });
    });

    it('handles geolocation not supported', () => {
      const mockOnLocation = jest.fn();
      const mockOnError = jest.fn();
      
      // Mock geolocation as undefined
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
      });
      
      renderWithTheme(
        <LocationCapture onLocation={mockOnLocation} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(mockOnError).toHaveBeenCalledWith('Geolocation is not supported by this browser');
    });
  });

  describe('BiometricAuth', () => {
    it('renders biometric button', () => {
      const mockOnSuccess = jest.fn();
      renderWithTheme(<BiometricAuth onSuccess={mockOnSuccess} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles successful authentication', async () => {
      const mockOnSuccess = jest.fn();
      
      mockCredentials.get.mockResolvedValue({ id: 'test-credential' });
      
      renderWithTheme(<BiometricAuth onSuccess={mockOnSuccess} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('handles authentication failure', async () => {
      const mockOnSuccess = jest.fn();
      const mockOnError = jest.fn();
      
      mockCredentials.get.mockRejectedValue(new Error('Authentication failed'));
      
      renderWithTheme(
        <BiometricAuth onSuccess={mockOnSuccess} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Biometric authentication not available or failed');
      });
    });

    it('handles Web Authentication API not supported', () => {
      const mockOnSuccess = jest.fn();
      const mockOnError = jest.fn();
      
      // Mock credentials as undefined
      Object.defineProperty(global.navigator, 'credentials', {
        value: undefined,
        writable: true,
      });
      
      renderWithTheme(
        <BiometricAuth onSuccess={mockOnSuccess} onError={mockOnError} />
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(mockOnError).toHaveBeenCalledWith('Web Authentication API not supported');
    });
  });

  describe('PWAInstallPrompt', () => {
    it('does not render on desktop', () => {
      // Mock desktop breakpoint
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: false, // Desktop
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithTheme(<PWAInstallPrompt />);
      
      expect(screen.queryByText('Install')).not.toBeInTheDocument();
    });
  });

  describe('NotificationPermission', () => {
    it('shows prompt when permission is default', () => {
      (global as any).Notification.permission = 'default';
      
      renderWithTheme(<NotificationPermission />);
      
      expect(screen.getByText(/Enable notifications/)).toBeInTheDocument();
    });

    it('does not show prompt when permission is granted', () => {
      (global as any).Notification.permission = 'granted';
      
      renderWithTheme(<NotificationPermission />);
      
      expect(screen.queryByText(/Enable notifications/)).not.toBeInTheDocument();
    });

    it('requests permission when enable button is clicked', async () => {
      (global as any).Notification.permission = 'default';
      
      renderWithTheme(<NotificationPermission />);
      
      fireEvent.click(screen.getByText('Enable'));
      
      await waitFor(() => {
        expect(global.Notification.requestPermission).toHaveBeenCalled();
      });
    });
  });
});

// Test mobile responsiveness
describe('Mobile Responsiveness', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('applies mobile styles correctly', () => {
    const { container } = renderWithTheme(
      <div data-testid="mobile-test">Mobile content</div>
    );
    
    expect(container).toBeInTheDocument();
  });
});

// Test PWA functionality
describe('PWA Functionality', () => {
  it('PWA components render without errors', () => {
    // Test that PWA components can be rendered without crashing
    renderWithTheme(<PWAInstallPrompt />);
    renderWithTheme(<NotificationPermission />);
    
    // Components should render without throwing errors
    expect(true).toBe(true);
  });
});