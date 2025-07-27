import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ProjectList from '../ProjectList';

// Mock the API services completely
jest.mock('../../../services/api', () => ({
  projectService: {
    get: jest.fn().mockResolvedValue([]),
    put: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  clientService: {
    get: jest.fn().mockResolvedValue([]),
  },
}));

// Mock the useApi hook
jest.mock('../../../hooks/useApi', () => ({
  useApi: jest.fn(() => ({ data: null, loading: false, error: null })),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ProjectList Component', () => {
  it('renders without crashing', () => {
    renderWithProviders(<ProjectList />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('displays the new project button', () => {
    renderWithProviders(<ProjectList />);
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('displays filter and export buttons', () => {
    renderWithProviders(<ProjectList />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});