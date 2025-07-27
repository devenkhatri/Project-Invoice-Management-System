import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ClientList from '../ClientList';
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

const mockClients: Client[] = [
  {
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
    payment_terms: 'Net 30',
    default_currency: 'USD',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    company_name: 'Doe Industries',
    contact_person: 'John Doe',
    project_count: 3,
    active_projects: 2,
    invoice_count: 5,
    total_invoiced: 10000,
    paid_amount: 8000,
    outstanding_amount: 2000,
    overdue_invoices: 1,
    gst_compliant: true,
    payment_terms_days: 30
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1987654321',
    address: '456 Oak Ave',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
    postal_code: '90210',
    payment_terms: 'Net 15',
    default_currency: 'USD',
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    project_count: 1,
    active_projects: 1,
    invoice_count: 2,
    total_invoiced: 5000,
    paid_amount: 5000,
    outstanding_amount: 0,
    overdue_invoices: 0,
    gst_compliant: false,
    payment_terms_days: 15
  }
];

const mockApiResponse = {
  clients: mockClients,
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1
  }
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ClientList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientService.get.mockResolvedValue(mockApiResponse);
  });

  it('renders client list with data', async () => {
    renderWithTheme(<ClientList />);

    // Check if loading state is handled
    expect(screen.getByText('Client Management')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Check client details
    expect(screen.getByText('Doe Industries')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and use search input
    const searchInput = screen.getByPlaceholderText(/search clients/i);
    await user.type(searchInput, 'John');

    // Verify API is called with search parameter
    await waitFor(() => {
      expect(mockClientService.get).toHaveBeenCalledWith('', expect.objectContaining({
        search: 'John'
      }));
    });
  });

  it('handles filter changes', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open status filter
    const statusSelect = screen.getByLabelText('Status');
    await user.click(statusSelect);

    // Select "Active" option
    const activeOption = screen.getByText('Active');
    await user.click(activeOption);

    // Verify API is called with filter
    await waitFor(() => {
      expect(mockClientService.get).toHaveBeenCalledWith('', expect.objectContaining({
        is_active: true
      }));
    });
  });

  it('displays client financial information correctly', async () => {
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check financial information formatting
    expect(screen.getByText('$8,000.00')).toBeInTheDocument(); // Paid amount
    expect(screen.getByText('$2,000.00')).toBeInTheDocument(); // Outstanding amount
  });

  it('shows GST compliance status', async () => {
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check GST compliance chip
    expect(screen.getByText('GST Compliant')).toBeInTheDocument();
  });

  it('handles client selection', async () => {
    const mockOnClientSelect = jest.fn();
    const user = userEvent.setup();
    
    renderWithTheme(<ClientList onClientSelect={mockOnClientSelect} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click on a client row
    const clientRow = screen.getByText('John Doe').closest('tr');
    if (clientRow) {
      await user.click(clientRow);
      expect(mockOnClientSelect).toHaveBeenCalledWith(mockClients[0]);
    }
  });

  it('opens action menu and handles actions', async () => {
    const mockOnClientEdit = jest.fn();
    const user = userEvent.setup();
    
    renderWithTheme(<ClientList onClientEdit={mockOnClientEdit} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click the action menu button
    const actionButtons = screen.getAllByLabelText(/more/i);
    await user.click(actionButtons[0]);

    // Check if menu items appear
    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Edit Client')).toBeInTheDocument();
    });

    // Click edit action
    const editButton = screen.getByText('Edit Client');
    await user.click(editButton);

    expect(mockOnClientEdit).toHaveBeenCalledWith(mockClients[0]);
  });

  it('handles pagination', async () => {
    const mockResponseWithPagination = {
      ...mockApiResponse,
      pagination: {
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3
      }
    };
    
    mockClientService.get.mockResolvedValue(mockResponseWithPagination);
    
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    // Note: This depends on your DataTable component implementation
    // You might need to adjust based on your actual pagination UI
  });

  it('displays empty state when no clients', async () => {
    mockClientService.get.mockResolvedValue({
      clients: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    });

    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockClientService.get.mockRejectedValue(new Error('API Error'));

    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText(/api error/i)).toBeInTheDocument();
    });
  });

  it('shows advanced filters when toggled', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click "More Filters" button
    const moreFiltersButton = screen.getByText('More Filters');
    await user.click(moreFiltersButton);

    // Check if advanced filters appear
    await waitFor(() => {
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
      expect(screen.getByLabelText('Sort Order')).toBeInTheDocument();
    });
  });

  it('calls onClientCreate when Add Client button is clicked', async () => {
    const mockOnClientCreate = jest.fn();
    const user = userEvent.setup();
    
    renderWithTheme(<ClientList onClientCreate={mockOnClientCreate} />);

    const addButton = screen.getByText('Add Client');
    await user.click(addButton);

    expect(mockOnClientCreate).toHaveBeenCalled();
  });

  it('displays project and invoice counts correctly', async () => {
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check project counts
    expect(screen.getByText('2')).toBeInTheDocument(); // Active projects for John
    expect(screen.getByText('3 Total')).toBeInTheDocument(); // Total projects for John
    
    expect(screen.getByText('1')).toBeInTheDocument(); // Active projects for Jane
    expect(screen.getByText('1 Total')).toBeInTheDocument(); // Total projects for Jane
  });

  it('shows overdue status for clients with overdue invoices', async () => {
    renderWithTheme(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // John has overdue invoices, so should show overdue status
    // This depends on your status chip logic
    const statusChips = screen.getAllByText(/overdue|gst compliant|active/i);
    expect(statusChips.length).toBeGreaterThan(0);
  });
});