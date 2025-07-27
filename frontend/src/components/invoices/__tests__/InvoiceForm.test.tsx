import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import InvoiceForm from '../InvoiceForm';
import { Invoice, InvoiceStatus, PaymentStatus } from '../../../types/invoice';
import { invoiceService, clientService } from '../../../services/api';

// Mock the API services
jest.mock('../../../services/api', () => ({
  invoiceService: {
    post: jest.fn(),
    put: jest.fn(),
  },
  clientService: {
    get: jest.fn(),
    getProjects: jest.fn(),
  },
}));

const mockClients = [
  {
    id: 'client1',
    name: 'Test Client',
    email: 'client@test.com',
    address: '123 Test St',
    payment_terms: 'Net 30',
    default_currency: 'INR',
  },
  {
    id: 'client2',
    name: 'Another Client',
    email: 'another@test.com',
    address: '456 Test Ave',
    payment_terms: 'Net 15',
    default_currency: 'USD',
  },
];

const mockProjects = [
  {
    id: 'project1',
    name: 'Test Project',
    client_id: 'client1',
  },
];

const mockInvoice: Invoice = {
  id: '1',
  invoice_number: 'INV-2024-001',
  client_id: 'client1',
  project_id: 'project1',
  line_items: [
    {
      id: 'li1',
      description: 'Web Development',
      quantity: 40,
      unit_price: 50,
      tax_rate: 18,
      total_price: 2000,
      tax_amount: 360,
    },
  ],
  subtotal: 2000,
  tax_breakdown: {
    cgst_rate: 9,
    cgst_amount: 180,
    sgst_rate: 9,
    sgst_amount: 180,
    igst_rate: 0,
    igst_amount: 0,
    total_tax_amount: 360,
  },
  total_amount: 2360,
  currency: 'INR',
  status: InvoiceStatus.DRAFT,
  issue_date: '2024-01-15',
  due_date: '2024-02-15',
  payment_terms: 'Net 30',
  notes: 'Test notes',
  terms_conditions: 'Test terms',
  is_recurring: false,
  payment_status: PaymentStatus.PENDING,
  paid_amount: 0,
  created_at: '2024-01-15T10:00:00Z',
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {component}
    </LocalizationProvider>
  );
};

describe('InvoiceForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientService.get as jest.Mock).mockResolvedValue({ data: mockClients });
    (clientService.getProjects as jest.Mock).mockResolvedValue({ data: mockProjects });
    (invoiceService.post as jest.Mock).mockResolvedValue({ data: mockInvoice });
    (invoiceService.put as jest.Mock).mockResolvedValue({ data: mockInvoice });
  });

  it('renders create invoice form', async () => {
    renderWithProviders(<InvoiceForm />);

    expect(screen.getByText('Create Invoice')).toBeInTheDocument();
    expect(screen.getByText('Invoice Details')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Client/)).toBeInTheDocument();
    });
  });

  it('renders edit invoice form with existing data', async () => {
    renderWithProviders(<InvoiceForm invoice={mockInvoice} />);

    expect(screen.getByText('Edit Invoice')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test terms')).toBeInTheDocument();
    });
  });

  it('navigates through form steps', async () => {
    renderWithProviders(<InvoiceForm />);

    await waitFor(() => {
      expect(screen.getByText('Invoice Details')).toBeInTheDocument();
    });

    // Select a client first
    const clientInput = screen.getByLabelText(/Client/);
    fireEvent.click(clientInput);
    
    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    // Navigate to next step
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Line Items')).toBeInTheDocument();
    });
  });

  it('adds and removes line items', async () => {
    renderWithProviders(<InvoiceForm />);

    // Navigate to line items step
    const clientInput = screen.getByLabelText(/Client/);
    fireEvent.click(clientInput);
    
    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    // Add a line item
    const addButton = screen.getByText('Add Item');
    fireEvent.click(addButton);

    // Should have 2 line items now (1 default + 1 added)
    const descriptionInputs = screen.getAllByLabelText(/Description/);
    expect(descriptionInputs).toHaveLength(2);
  });

  it('calculates totals correctly', async () => {
    renderWithProviders(<InvoiceForm />);

    // Navigate to line items step
    const clientInput = screen.getByLabelText(/Client/);
    fireEvent.click(clientInput);
    
    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Fill in line item details
      const descriptionInput = screen.getAllByLabelText(/Description/)[0];
      const quantityInput = screen.getAllByDisplayValue('1')[0];
      const priceInput = screen.getAllByDisplayValue('0')[0];

      fireEvent.change(descriptionInput, { target: { value: 'Test Service' } });
      fireEvent.change(quantityInput, { target: { value: '10' } });
      fireEvent.change(priceInput, { target: { value: '100' } });
    });

    // Check if totals are calculated
    await waitFor(() => {
      expect(screen.getByText(/Invoice Summary/)).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    const mockOnSave = jest.fn();
    renderWithProviders(<InvoiceForm onSave={mockOnSave} />);

    // Try to navigate without selecting client
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a client')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('handles form submission for new invoice', async () => {
    const mockOnSave = jest.fn();
    renderWithProviders(<InvoiceForm onSave={mockOnSave} />);

    // Fill out the form
    await waitFor(() => {
      const clientInput = screen.getByLabelText(/Client/);
      fireEvent.click(clientInput);
    });

    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    // Navigate through steps
    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Fill line item
      const descriptionInput = screen.getAllByLabelText(/Description/)[0];
      fireEvent.change(descriptionInput, { target: { value: 'Test Service' } });
    });

    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const saveDraftButton = screen.getByText('Save Draft');
      fireEvent.click(saveDraftButton);
    });

    await waitFor(() => {
      expect(invoiceService.post).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('handles form submission for existing invoice', async () => {
    const mockOnSave = jest.fn();
    renderWithProviders(<InvoiceForm invoice={mockInvoice} onSave={mockOnSave} />);

    // Navigate to final step
    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const saveDraftButton = screen.getByText('Save Draft');
      fireEvent.click(saveDraftButton);
    });

    await waitFor(() => {
      expect(invoiceService.put).toHaveBeenCalledWith(mockInvoice.id, expect.any(Object));
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('handles recurring invoice settings', async () => {
    renderWithProviders(<InvoiceForm />);

    await waitFor(() => {
      const recurringCheckbox = screen.getByLabelText('Recurring Invoice');
      fireEvent.click(recurringCheckbox);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
    });
  });

  it('applies discount correctly', async () => {
    renderWithProviders(<InvoiceForm />);

    // Navigate to line items step
    const clientInput = screen.getByLabelText(/Client/);
    fireEvent.click(clientInput);
    
    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Add discount
      const discountPercentageInput = screen.getByLabelText('Discount Percentage');
      fireEvent.change(discountPercentageInput, { target: { value: '10' } });
    });

    // Check if discount is applied in summary
    await waitFor(() => {
      expect(screen.getByText(/Discount/)).toBeInTheDocument();
    });
  });

  it('handles cancel action', () => {
    const mockOnCancel = jest.fn();
    renderWithProviders(<InvoiceForm onCancel={mockOnCancel} />);

    const backButton = screen.getByLabelText('Back');
    fireEvent.click(backButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('loads projects when client is selected', async () => {
    renderWithProviders(<InvoiceForm />);

    await waitFor(() => {
      const clientInput = screen.getByLabelText(/Client/);
      fireEvent.click(clientInput);
    });

    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    await waitFor(() => {
      expect(clientService.getProjects).toHaveBeenCalledWith('client1');
    });
  });

  it('handles API errors gracefully', async () => {
    (invoiceService.post as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    const mockOnSave = jest.fn();
    renderWithProviders(<InvoiceForm onSave={mockOnSave} />);

    // Fill out form and submit
    await waitFor(() => {
      const clientInput = screen.getByLabelText(/Client/);
      fireEvent.click(clientInput);
    });

    await waitFor(() => {
      const clientOption = screen.getByText('Test Client');
      fireEvent.click(clientOption);
    });

    // Navigate through steps and submit
    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const descriptionInput = screen.getAllByLabelText(/Description/)[0];
      fireEvent.change(descriptionInput, { target: { value: 'Test Service' } });
    });

    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const saveDraftButton = screen.getByText('Save Draft');
      fireEvent.click(saveDraftButton);
    });

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to save invoice/)).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });
});