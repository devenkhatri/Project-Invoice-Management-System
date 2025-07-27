import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ClientForm from '../ClientForm';
import { clientService } from '../../../services/api';
import { Client } from '../../../types/client';

// Mock the API service
jest.mock('../../../services/api');
const mockClientService = clientService as jest.Mocked<typeof clientService>;

// Mock the useApi hook
jest.mock('../../../hooks/useApi', () => ({
  useApi: (fn: any) => ({
    execute: fn,
    loading: false,
    error: null
  })
}));

const theme = createTheme();

const mockClient: Client = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  country: 'USA',
  postal_code: '10001',
  gstin: '22AAAAA0000A1Z5',
  pan: 'ABCDE1234F',
  payment_terms: 'Net 30',
  default_currency: 'USD',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  company_name: 'Doe Industries',
  contact_person: 'John Doe',
  website: 'https://doe.com',
  notes: 'Important client'
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ClientForm', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form correctly', () => {
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Create New Client')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it('renders edit form with existing client data', () => {
    renderWithTheme(
      <ClientForm 
        client={mockClient}
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Edit Client')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
  });

  it('validates required fields in basic information step', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Try to proceed without filling required fields
    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Phone is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill in invalid email
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });
  });

  it('validates phone format', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill in invalid phone
    const phoneInput = screen.getByLabelText(/phone/i);
    await user.type(phoneInput, '123');

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid phone format')).toBeInTheDocument();
    });
  });

  it('navigates through form steps', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill basic information
    await user.type(screen.getByLabelText(/client name/i), 'Test Client');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');

    // Go to next step
    await user.click(screen.getByText('Next'));

    // Should be on address details step
    await waitFor(() => {
      expect(screen.getByText('Address Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    });

    // Fill address and continue
    await user.type(screen.getByLabelText(/address/i), '123 Test St');
    await user.click(screen.getByText('Next'));

    // Should be on business information step
    await waitFor(() => {
      expect(screen.getByText('Business Information')).toBeInTheDocument();
    });

    // Continue to final step
    await user.click(screen.getByText('Next'));

    // Should be on additional settings step
    await waitFor(() => {
      expect(screen.getByText('Additional Settings')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
  });

  it('validates GSTIN format', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Navigate to business information step
    await fillBasicInfo(user);
    await user.click(screen.getByText('Next'));
    
    await fillAddressInfo(user);
    await user.click(screen.getByText('Next'));

    // Fill invalid GSTIN
    const gstinInput = screen.getByLabelText(/gstin/i);
    await user.type(gstinInput, 'INVALID');

    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Invalid GSTIN format')).toBeInTheDocument();
    });
  });

  it('validates PAN format', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Navigate to business information step
    await fillBasicInfo(user);
    await user.click(screen.getByText('Next'));
    
    await fillAddressInfo(user);
    await user.click(screen.getByText('Next'));

    // Fill invalid PAN
    const panInput = screen.getByLabelText(/pan/i);
    await user.type(panInput, 'INVALID');

    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Invalid PAN format')).toBeInTheDocument();
    });
  });

  it('shows real-time GSTIN validation', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Navigate to business information step
    await fillBasicInfo(user);
    await user.click(screen.getByText('Next'));
    
    await fillAddressInfo(user);
    await user.click(screen.getByText('Next'));

    const gstinInput = screen.getByLabelText(/gstin/i);
    
    // Type valid GSTIN
    await user.type(gstinInput, '22AAAAA0000A1Z5');
    
    // Should show success icon (you might need to adjust based on your implementation)
    await waitFor(() => {
      const successIcon = screen.getByTestId('CheckCircleIcon');
      expect(successIcon).toBeInTheDocument();
    });
  });

  it('creates new client successfully', async () => {
    const user = userEvent.setup();
    const mockResponse = { client: { ...mockClient, id: 'new-id' } };
    mockClientService.post.mockResolvedValue(mockResponse);

    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill complete form
    await fillCompleteForm(user);

    // Submit form
    const createButton = screen.getByText('Create Client');
    await user.click(createButton);

    await waitFor(() => {
      expect(mockClientService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+1234567890'
        })
      );
      expect(mockOnSave).toHaveBeenCalledWith(mockResponse.client);
    });
  });

  it('updates existing client successfully', async () => {
    const user = userEvent.setup();
    const mockResponse = { client: mockClient };
    mockClientService.put.mockResolvedValue(mockResponse);

    renderWithTheme(
      <ClientForm 
        client={mockClient}
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
      />
    );

    // Navigate to final step
    await navigateToFinalStep(user);

    // Submit form
    const updateButton = screen.getByText('Update Client');
    await user.click(updateButton);

    await waitFor(() => {
      expect(mockClientService.put).toHaveBeenCalledWith(
        mockClient.id,
        expect.objectContaining({
          name: mockClient.name,
          email: mockClient.email
        })
      );
      expect(mockOnSave).toHaveBeenCalledWith(mockResponse.client);
    });
  });

  it('handles API errors during submission', async () => {
    const user = userEvent.setup();
    mockClientService.post.mockRejectedValue(new Error('API Error'));

    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    await fillCompleteForm(user);

    const createButton = screen.getByText('Create Client');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('allows navigation back through steps', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Navigate forward
    await fillBasicInfo(user);
    await user.click(screen.getByText('Next'));
    
    await fillAddressInfo(user);
    await user.click(screen.getByText('Next'));

    // Now navigate back
    await user.click(screen.getByText('Back'));

    await waitFor(() => {
      expect(screen.getByText('Address Details')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back'));

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
  });

  it('shows summary in final step', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    await fillCompleteForm(user);

    // Should show summary with filled data
    expect(screen.getByText('Test Client')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('123 Test St')).toBeInTheDocument();
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ClientForm onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  // Helper functions
  const fillBasicInfo = async (user: any) => {
    await user.type(screen.getByLabelText(/client name/i), 'Test Client');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
  };

  const fillAddressInfo = async (user: any) => {
    await user.type(screen.getByLabelText(/address/i), '123 Test St');
  };

  const fillCompleteForm = async (user: any) => {
    // Basic info
    await fillBasicInfo(user);
    await user.click(screen.getByText('Next'));

    // Address info
    await fillAddressInfo(user);
    await user.click(screen.getByText('Next'));

    // Business info (skip for now)
    await user.click(screen.getByText('Next'));

    // Final step
    await waitFor(() => {
      expect(screen.getByText('Additional Settings')).toBeInTheDocument();
    });
  };

  const navigateToFinalStep = async (user: any) => {
    // Navigate through all steps for existing client
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByText('Next'));
  };
});