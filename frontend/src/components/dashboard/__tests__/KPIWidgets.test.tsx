import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import KPIWidgets from '../KPIWidgets';

const theme = createTheme();

const mockKPIData = {
  revenue: 150000,
  expenses: 75000,
  profit: 75000,
  outstandingInvoices: 25000,
  activeProjects: 8,
  completedTasks: 45,
  totalClients: 12,
  averageProjectValue: 18750,
};

const renderKPIWidgets = (data = mockKPIData) => {
  return render(
    <ThemeProvider theme={theme}>
      <KPIWidgets data={data} />
    </ThemeProvider>
  );
};

describe('KPIWidgets Component', () => {
  it('renders all KPI widgets', () => {
    renderKPIWidgets();
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Invoices')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.getByText('Avg Project Value')).toBeInTheDocument();
  });

  it('formats currency values correctly', () => {
    renderKPIWidgets();
    
    expect(screen.getByText('₹1,50,000')).toBeInTheDocument(); // Revenue
    expect(screen.getByText('₹75,000')).toBeInTheDocument(); // Expenses and Profit
    expect(screen.getByText('₹25,000')).toBeInTheDocument(); // Outstanding Invoices
    expect(screen.getByText('₹18,750')).toBeInTheDocument(); // Average Project Value
  });

  it('formats number values correctly', () => {
    renderKPIWidgets();
    
    expect(screen.getByText('8')).toBeInTheDocument(); // Active Projects
    expect(screen.getByText('45')).toBeInTheDocument(); // Completed Tasks
    expect(screen.getByText('12')).toBeInTheDocument(); // Total Clients
  });

  it('displays trend indicators', () => {
    renderKPIWidgets();
    
    // Check for trend percentages (these are hardcoded in the component)
    expect(screen.getByText('12.5% vs last month')).toBeInTheDocument();
    expect(screen.getByText('3.2% vs last month')).toBeInTheDocument();
    expect(screen.getByText('18.7% vs last month')).toBeInTheDocument();
  });

  it('handles negative profit correctly', () => {
    const dataWithLoss = {
      ...mockKPIData,
      profit: -25000,
    };
    
    renderKPIWidgets(dataWithLoss);
    
    expect(screen.getByText('-₹25,000')).toBeInTheDocument();
  });

  it('handles zero values correctly', () => {
    const dataWithZeros = {
      revenue: 0,
      expenses: 0,
      profit: 0,
      outstandingInvoices: 0,
      activeProjects: 0,
      completedTasks: 0,
      totalClients: 0,
      averageProjectValue: 0,
    };
    
    renderKPIWidgets(dataWithZeros);
    
    expect(screen.getByText('₹0')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders widget icons', () => {
    renderKPIWidgets();
    
    // Check that icons are rendered (they should be in the DOM)
    const widgets = screen.getAllByRole('button');
    expect(widgets.length).toBeGreaterThan(0);
  });
});