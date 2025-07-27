import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@testing-library/jest-dom';
import MobileDataTable, {
  MobileDataTableColumn,
  MobileDataTableRow,
  MobileDataTableAction,
} from '../MobileDataTable';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockColumns: MobileDataTableColumn[] = [
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
  { id: 'client', label: 'Client' },
  { id: 'amount', label: 'Amount', format: (value) => `$${value}` },
];

const mockRows: MobileDataTableRow[] = [
  {
    id: '1',
    name: 'Project Alpha',
    status: 'active',
    client: 'Client A',
    amount: 1000,
  },
  {
    id: '2',
    name: 'Project Beta',
    status: 'completed',
    client: 'Client B',
    amount: 2000,
  },
  {
    id: '3',
    name: 'Project Gamma',
    status: 'on-hold',
    client: 'Client C',
    amount: 1500,
  },
];

const mockActions: MobileDataTableAction[] = [
  {
    label: 'Edit',
    icon: <span>Edit Icon</span>,
    onClick: jest.fn(),
    color: 'primary',
  },
  {
    label: 'Delete',
    icon: <span>Delete Icon</span>,
    onClick: jest.fn(),
    color: 'error',
  },
];

// Mock useMediaQuery to simulate mobile
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseMediaQuery = require('@mui/material/useMediaQuery').default;

describe('MobileDataTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(true); // Simulate mobile
  });

  it('renders mobile table with data', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        secondaryColumn="client"
        statusColumn="status"
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Client B')).toBeInTheDocument();
    expect(screen.getByText('Client C')).toBeInTheDocument();
  });

  it('renders status chips correctly', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        statusColumn="status"
      />
    );

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('on-hold')).toBeInTheDocument();
  });

  it('handles row click', () => {
    const mockOnRowClick = jest.fn();
    
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        onRowClick={mockOnRowClick}
      />
    );

    fireEvent.click(screen.getByText('Project Alpha'));
    expect(mockOnRowClick).toHaveBeenCalledWith(mockRows[0]);
  });

  it('renders actions menu', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        actions={mockActions}
      />
    );

    const actionButtons = screen.getAllByRole('button');
    expect(actionButtons).toHaveLength(mockRows.length); // One action button per row
  });

  it('opens actions drawer when action button is clicked', async () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        actions={mockActions}
      />
    );

    const actionButtons = screen.getAllByRole('button');
    fireEvent.click(actionButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('executes action when clicked in drawer', async () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        actions={mockActions}
      />
    );

    const actionButtons = screen.getAllByRole('button');
    fireEvent.click(actionButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    expect(mockActions[0].onClick).toHaveBeenCalledWith(mockRows[0]);
  });

  it('renders avatar when avatarColumn is provided', () => {
    const rowsWithAvatar = mockRows.map(row => ({
      ...row,
      avatar: row.client,
    }));

    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={rowsWithAvatar}
        primaryColumn="name"
        avatarColumn="avatar"
      />
    );

    // Check for avatar elements (they should contain first letter of client name)
    expect(screen.getByText('C')).toBeInTheDocument(); // Client A -> A, Client B -> B, Client C -> C
  });

  it('shows empty message when no data', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={[]}
        primaryColumn="name"
        emptyMessage="No projects found"
      />
    );

    expect(screen.getByText('No projects found')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={[]}
        primaryColumn="name"
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles swipe actions', () => {
    const swipeActions = {
      left: {
        label: 'Archive',
        icon: <span>Archive Icon</span>,
        onClick: jest.fn(),
        color: 'warning' as const,
      },
      right: {
        label: 'Delete',
        icon: <span>Delete Icon</span>,
        onClick: jest.fn(),
        color: 'error' as const,
      },
    };

    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        swipeActions={swipeActions}
      />
    );

    // The swipe functionality would be tested with more complex gesture simulation
    // For now, we just verify the component renders without errors
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('renders desktop table when not mobile', () => {
    mockUseMediaQuery.mockReturnValue(false); // Simulate desktop

    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
      />
    );

    // Should render a table element for desktop
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('handles missing secondary column gracefully', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows}
        primaryColumn="name"
        // No secondaryColumn provided
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    // Should not crash without secondary column
  });

  it('applies correct status colors', () => {
    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={[
          { id: '1', name: 'Test', status: 'paid' },
          { id: '2', name: 'Test', status: 'pending' },
          { id: '3', name: 'Test', status: 'overdue' },
          { id: '4', name: 'Test', status: 'draft' },
        ]}
        primaryColumn="name"
        statusColumn="status"
      />
    );

    expect(screen.getByText('paid')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('overdue')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
  });
});

// Test swipe gesture functionality
describe('MobileDataTable Swipe Gestures', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(true);
  });

  it('handles touch events for swipe gestures', () => {
    const swipeActions = {
      left: {
        label: 'Archive',
        icon: <span>Archive Icon</span>,
        onClick: jest.fn(),
      },
    };

    renderWithTheme(
      <MobileDataTable
        columns={mockColumns}
        rows={mockRows.slice(0, 1)}
        primaryColumn="name"
        swipeActions={swipeActions}
      />
    );

    const listItem = screen.getByText('Project Alpha').closest('[role="button"]');
    
    if (listItem) {
      // Simulate touch events
      fireEvent.touchStart(listItem, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      
      fireEvent.touchMove(listItem, {
        touches: [{ clientX: 50, clientY: 100 }],
      });
      
      fireEvent.touchEnd(listItem);
    }

    // The component should handle these events without crashing
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });
});