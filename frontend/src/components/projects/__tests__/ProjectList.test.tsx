import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import ProjectList from '../ProjectList';
import { projectService, clientService } from '../../../services/api';

// Mock the API services
jest.mock('../../../services/api');
const mockProjectService = projectService as jest.Mocked<typeof projectService>;
const mockClientService = clientService as jest.Mocked<typeof clientService>;

// Mock the useApi hook
jest.mock('../../../hooks/useApi', () => ({
  useApi: jest.fn(() => ({ data: null, loading: false, error: null })),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {component}
      </LocalizationProvider>
    </ThemeProvider>
  );
};

const mockProjects = [
  {
    id: '1',
    name: 'Test Project 1',
    client_id: 'client1',
    client_name: 'Test Client 1',
    status: 'active' as const,
    start_date: '2024-01-01',
    end_date: '2024-03-01',
    budget: 10000,
    description: 'Test project description',
    progress: 50,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '2',
    name: 'Test Project 2',
    client_id: 'client2',
    client_name: 'Test Client 2',
    status: 'completed' as const,
    start_date: '2023-10-01',
    end_date: '2023-12-01',
    budget: 15000,
    description: 'Another test project',
    progress: 100,
    created_at: '2023-10-01',
    updated_at: '2023-12-01',
  },
];

const mockClients = [
  { id: 'client1', name: 'Test Client 1' },
  { id: 'client2', name: 'Test Client 2' },
];

describe('ProjectList', () => {
  beforeEach(() => {
    mockProjectService.get.mockResolvedValue(mockProjects);
    mockClientService.get.mockResolvedValue(mockClients);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders project list with projects', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
    });
  });

  it('displays project status chips correctly', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('shows progress bars for projects', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('opens filter dialog when filter button is clicked', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);
    });

    expect(screen.getByText('Filter Projects')).toBeInTheDocument();
  });

  it('filters projects by search term', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'Test Project 1' } });
    });

    // The filtering is handled by the DataTable component
    // This test verifies the search input is rendered
    expect(screen.getByDisplayValue('Test Project 1')).toBeInTheDocument();
  });

  it('calls onProjectSelect when project is viewed', async () => {
    const mockOnProjectSelect = jest.fn();
    renderWithProviders(<ProjectList onProjectSelect={mockOnProjectSelect} />);

    await waitFor(() => {
      const moreButton = screen.getAllByLabelText('more')[0];
      fireEvent.click(moreButton);
    });

    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);

    expect(mockOnProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
  });

  it('calls onProjectEdit when project is edited', async () => {
    const mockOnProjectEdit = jest.fn();
    renderWithProviders(<ProjectList onProjectEdit={mockOnProjectEdit} />);

    await waitFor(() => {
      const moreButton = screen.getAllByLabelText('more')[0];
      fireEvent.click(moreButton);
    });

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(mockOnProjectEdit).toHaveBeenCalledWith(mockProjects[0]);
  });

  it('calls onProjectCreate when new project button is clicked', async () => {
    const mockOnProjectCreate = jest.fn();
    renderWithProviders(<ProjectList onProjectCreate={mockOnProjectCreate} />);

    await waitFor(() => {
      const newProjectButton = screen.getByText('New Project');
      fireEvent.click(newProjectButton);
    });

    expect(mockOnProjectCreate).toHaveBeenCalled();
  });

  it('handles bulk selection of projects', async () => {
    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
    });

    expect(screen.getByText(/2 project\(s\) selected/)).toBeInTheDocument();
  });

  it('exports projects to CSV', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock createElement and click
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);
    });

    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('projects.csv');
  });

  it('handles API errors gracefully', async () => {
    mockProjectService.get.mockRejectedValue(new Error('API Error'));

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
    });
  });

  it('shows empty state when no projects exist', async () => {
    mockProjectService.get.mockResolvedValue([]);

    renderWithProviders(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('No projects found. Create your first project to get started.')).toBeInTheDocument();
    });
  });
});