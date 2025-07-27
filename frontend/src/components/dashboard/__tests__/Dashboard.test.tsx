import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Dashboard from '../Dashboard';
import { reportService } from '../../../services/api';

// Mock the services
jest.mock('../../../services/api', () => ({
  reportService: {
    getDashboardData: jest.fn(),
  },
  projectService: {
    get: jest.fn(),
  },
  clientService: {
    get: jest.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockDashboardData = {
  kpis: {
    revenue: 150000,
    expenses: 75000,
    profit: 75000,
    outstandingInvoices: 25000,
    activeProjects: 8,
    completedTasks: 45,
    totalClients: 12,
    averageProjectValue: 18750,
  },
  financialTrends: {
    revenue: [
      { period: 'Jan', amount: 120000 },
      { period: 'Feb', amount: 135000 },
      { period: 'Mar', amount: 150000 },
    ],
    expenses: [
      { period: 'Jan', amount: 60000 },
      { period: 'Feb', amount: 70000 },
      { period: 'Mar', amount: 75000 },
    ],
    profit: [
      { period: 'Jan', amount: 60000 },
      { period: 'Feb', amount: 65000 },
      { period: 'Mar', amount: 75000 },
    ],
  },
  projectStats: {
    statusDistribution: [
      { status: 'active', count: 8 },
      { status: 'completed', count: 15 },
      { status: 'on-hold', count: 2 },
    ],
    progressOverview: [
      { project: 'Website Redesign', progress: 75, health: 'good' as const },
      { project: 'Mobile App', progress: 45, health: 'warning' as const },
      { project: 'API Integration', progress: 20, health: 'critical' as const },
    ],
  },
  recentActivities: [
    {
      id: '1',
      type: 'project' as const,
      title: 'Project Updated',
      description: 'Website Redesign project progress updated to 75%',
      timestamp: new Date().toISOString(),
      actionable: true,
      actionUrl: '/projects/1',
    },
    {
      id: '2',
      type: 'invoice' as const,
      title: 'Invoice Sent',
      description: 'Invoice #INV-001 sent to Client ABC',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      actionable: true,
      actionUrl: '/invoices/1',
    },
  ],
};

const theme = createTheme();

// Mock useMediaQuery
jest.mock('@mui/material/useMediaQuery', () => jest.fn(() => false));

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Dashboard />
        </LocalizationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reportService.getDashboardData as jest.Mock).mockResolvedValue(mockDashboardData);
  });

  it('renders dashboard title', async () => {
    renderDashboard();
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    renderDashboard();
    
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('displays dashboard data after loading', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('₹1,50,000')).toBeInTheDocument();
    });
  });

  it('displays KPI widgets with correct values', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
      expect(screen.getByText('Net Profit')).toBeInTheDocument();
      expect(screen.getByText('Outstanding Invoices')).toBeInTheDocument();
    });
  });

  it('displays financial charts', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Financial Trends')).toBeInTheDocument();
    });
  });

  it('displays project overview', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Project Overview')).toBeInTheDocument();
      expect(screen.getByText('Project Status Distribution')).toBeInTheDocument();
    });
  });

  it('displays recent activities', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Project Updated')).toBeInTheDocument();
      expect(screen.getByText('Invoice Sent')).toBeInTheDocument();
    });
  });

  it('displays quick actions', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('New Project')).toBeInTheDocument();
      expect(screen.getByText('Create Invoice')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const refreshButton = screen.getByLabelText(/refresh/i);
    fireEvent.click(refreshButton);

    expect(reportService.getDashboardData).toHaveBeenCalledTimes(2);
  });

  it('toggles filters panel', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const filterButton = screen.getByLabelText(/filter/i);
    fireEvent.click(filterButton);

    expect(screen.getByText('Dashboard Filters')).toBeInTheDocument();
  });

  it('opens widget customizer', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const settingsButton = screen.getByLabelText(/settings/i);
    fireEvent.click(settingsButton);

    const customizeOption = screen.getByText('Customize Dashboard');
    fireEvent.click(customizeOption);

    expect(screen.getByText('Customize Dashboard')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (reportService.getDashboardData as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    });
  });

  it('updates data when filters change', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(reportService.getDashboardData).toHaveBeenCalledTimes(1);
    });

    // This would be triggered by filter changes in a real scenario
    // For now, we just verify the initial call
    expect(reportService.getDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: expect.any(String),
        end_date: expect.any(String),
      })
    );
  });
});