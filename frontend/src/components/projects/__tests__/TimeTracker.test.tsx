import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import TimeTracker from '../TimeTracker';
import { timeEntryService } from '../../../services/api';

// Mock the API services
jest.mock('../../../services/api');
const mockTimeEntryService = timeEntryService as jest.Mocked<typeof timeEntryService>;

// Mock timers
jest.useFakeTimers();

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

const mockTasks = [
  {
    id: '1',
    project_id: 'project1',
    title: 'Task 1',
    description: 'First task',
    status: 'in-progress' as const,
    priority: 'high' as const,
    due_date: '2024-02-01',
    estimated_hours: 8,
    actual_hours: 4,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '2',
    project_id: 'project1',
    title: 'Task 2',
    description: 'Second task',
    status: 'todo' as const,
    priority: 'medium' as const,
    due_date: '2024-02-05',
    estimated_hours: 12,
    actual_hours: 0,
    created_at: '2024-01-02',
    updated_at: '2024-01-02',
  },
];

const mockTimeEntries = [
  {
    id: '1',
    task_id: '1',
    project_id: 'project1',
    hours: 2.5,
    description: 'Working on feature implementation',
    date: '2024-01-15',
    billable: true,
    created_at: '2024-01-15',
  },
  {
    id: '2',
    task_id: '2',
    project_id: 'project1',
    hours: 1.0,
    description: 'Code review',
    date: '2024-01-16',
    billable: false,
    created_at: '2024-01-16',
  },
];

describe('TimeTracker', () => {
  const defaultProps = {
    projectId: 'project1',
    tasks: mockTasks,
    timeEntries: mockTimeEntries,
    onTimeUpdate: jest.fn(),
  };

  beforeEach(() => {
    mockTimeEntryService.post.mockResolvedValue({});
    mockTimeEntryService.put.mockResolvedValue({});
    mockTimeEntryService.delete.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('renders timer interface with initial state', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Task')).toBeInTheDocument();
    expect(screen.getByLabelText('Billable')).toBeInTheDocument();
  });

  it('displays task options in select dropdown', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    const taskSelect = screen.getByLabelText('Select Task');
    fireEvent.mouseDown(taskSelect);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('starts timer when start button is clicked', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Select a task first
    const taskSelect = screen.getByLabelText('Select Task');
    fireEvent.mouseDown(taskSelect);
    fireEvent.click(screen.getByText('Task 1'));

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
  });

  it('prevents starting timer without selecting a task', () => {
    // Mock alert
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProviders(<TimeTracker {...defaultProps} />);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(alertSpy).toHaveBeenCalledWith('Please select a task first');
    expect(screen.getByText('Start')).toBeInTheDocument(); // Should still show start button

    alertSpy.mockRestore();
  });

  it('updates timer display when running', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Select a task
    const taskSelect = screen.getByLabelText('Select Task');
    fireEvent.mouseDown(taskSelect);
    fireEvent.click(screen.getByText('Task 1'));

    // Start timer
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText('00:00:05')).toBeInTheDocument();
  });

  it('pauses timer when pause button is clicked', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Select task and start timer
    const taskSelect = screen.getByLabelText('Select Task');
    fireEvent.mouseDown(taskSelect);
    fireEvent.click(screen.getByText('Task 1'));

    fireEvent.click(screen.getByText('Start'));

    // Advance time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Pause timer
    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('00:00:03')).toBeInTheDocument();
  });

  it('stops timer and saves time entry', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Select task and start timer
    const taskSelect = screen.getByLabelText('Select Task');
    fireEvent.mouseDown(taskSelect);
    fireEvent.click(screen.getByText('Task 1'));

    fireEvent.click(screen.getByText('Start'));

    // Advance time by 1 hour
    act(() => {
      jest.advanceTimersByTime(3600000);
    });

    // Add description
    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'Test work description' } });

    // Stop timer
    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockTimeEntryService.post).toHaveBeenCalledWith({
        task_id: '1',
        project_id: 'project1',
        hours: 1,
        description: 'Test work description',
        date: expect.any(String),
        billable: true,
      });
    });

    // Timer should reset
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('displays time entries in the time entries tab', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Working on feature implementation')).toBeInTheDocument();
    expect(screen.getByText('Code review')).toBeInTheDocument();
  });

  it('opens manual entry dialog when Add Manual Entry is clicked', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    const addButton = screen.getByText('Add Manual Entry');
    fireEvent.click(addButton);

    expect(screen.getByText('Add Manual Time Entry')).toBeInTheDocument();
  });

  it('creates manual time entry', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    const addButton = screen.getByText('Add Manual Entry');
    fireEvent.click(addButton);

    // Fill out form
    const taskSelect = screen.getByLabelText('Task');
    fireEvent.mouseDown(taskSelect);
    fireEvent.click(screen.getByText('Task 1'));

    const hoursInput = screen.getByLabelText('Hours');
    fireEvent.change(hoursInput, { target: { value: '3.5' } });

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'Manual entry description' } });

    const addEntryButton = screen.getByText('Add Entry');
    fireEvent.click(addEntryButton);

    await waitFor(() => {
      expect(mockTimeEntryService.post).toHaveBeenCalledWith({
        task_id: '1',
        hours: 3.5,
        description: 'Manual entry description',
        date: expect.any(String),
        billable: true,
        project_id: 'project1',
      });
    });
  });

  it('edits existing time entry', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    // Click edit button on first entry
    const editButtons = screen.getAllByLabelText('edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Time Entry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
  });

  it('deletes time entry', async () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    // Click delete button on first entry
    const deleteButtons = screen.getAllByLabelText('delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockTimeEntryService.delete).toHaveBeenCalledWith('1');
    });
  });

  it('displays analytics in analytics tab', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to analytics tab
    const analyticsTab = screen.getByText('Analytics');
    fireEvent.click(analyticsTab);

    expect(screen.getByText('Daily Time Tracking')).toBeInTheDocument();
    expect(screen.getByText('Time by Task')).toBeInTheDocument();
    expect(screen.getByText('Time Summary')).toBeInTheDocument();
  });

  it('calculates time statistics correctly', () => {
    renderWithProviders(<TimeTracker {...defaultProps} />);

    // Switch to analytics tab
    const analyticsTab = screen.getByText('Analytics');
    fireEvent.click(analyticsTab);

    // Total hours: 2.5 + 1.0 = 3.5
    expect(screen.getByText('3.5h')).toBeInTheDocument();
    
    // Billable hours: 2.5 (only first entry is billable)
    expect(screen.getByText('2.5h')).toBeInTheDocument();
    
    // Billable rate: 2.5/3.5 = 71%
    expect(screen.getByText('71%')).toBeInTheDocument();
  });

  it('shows today\'s hours in quick stats', () => {
    // Mock dayjs to return a specific date for today
    const today = '2024-01-15';
    const todayEntry = {
      ...mockTimeEntries[0],
      date: today,
    };

    renderWithProviders(<TimeTracker {...defaultProps} timeEntries={[todayEntry]} />);

    expect(screen.getByText('2.5h')).toBeInTheDocument(); // Today's hours
  });

  it('handles empty time entries list', () => {
    renderWithProviders(<TimeTracker {...defaultProps} timeEntries={[]} />);

    // Switch to time entries tab
    const timeEntriesTab = screen.getByText('Time Entries');
    fireEvent.click(timeEntriesTab);

    expect(screen.getByText('No time entries yet')).toBeInTheDocument();
  });
});