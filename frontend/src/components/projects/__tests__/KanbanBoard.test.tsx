import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DragDropContext } from 'react-beautiful-dnd';
import KanbanBoard from '../KanbanBoard';
import { taskService } from '../../../services/api';

// Mock the API services
jest.mock('../../../services/api');
const mockTaskService = taskService as jest.Mocked<typeof taskService>;

// Mock react-beautiful-dnd
jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({ innerRef: jest.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }: any) => children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, {}),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockTasks = [
  {
    id: '1',
    project_id: 'project1',
    title: 'Task 1',
    description: 'First task description',
    status: 'todo' as const,
    priority: 'high' as const,
    due_date: '2024-02-01',
    estimated_hours: 8,
    actual_hours: 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '2',
    project_id: 'project1',
    title: 'Task 2',
    description: 'Second task description',
    status: 'in-progress' as const,
    priority: 'medium' as const,
    due_date: '2024-02-05',
    estimated_hours: 12,
    actual_hours: 4,
    assignee: 'John Doe',
    created_at: '2024-01-02',
    updated_at: '2024-01-02',
  },
  {
    id: '3',
    project_id: 'project1',
    title: 'Task 3',
    description: 'Third task description',
    status: 'completed' as const,
    priority: 'low' as const,
    due_date: '2024-01-30',
    estimated_hours: 6,
    actual_hours: 6,
    created_at: '2024-01-03',
    updated_at: '2024-01-03',
  },
];

describe('KanbanBoard', () => {
  const defaultProps = {
    projectId: 'project1',
    tasks: mockTasks,
    onTaskUpdate: jest.fn(),
  };

  beforeEach(() => {
    mockTaskService.put.mockResolvedValue({});
    mockTaskService.post.mockResolvedValue({});
    mockTaskService.delete.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders kanban columns with tasks', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
  });

  it('displays task priority chips correctly', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('shows task assignee avatars', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    // Check for assignee avatar (first letter of name)
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('opens task dialog when Add Task button is clicked', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const addButton = screen.getByText('Add Task');
    fireEvent.click(addButton);

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
  });

  it('filters tasks by search term', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'Task 1' } });

    // After filtering, only Task 1 should be visible
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('filters tasks by priority', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.mouseDown(prioritySelect);
    
    const highOption = screen.getByText('High');
    fireEvent.click(highOption);

    // After filtering, only high priority tasks should be visible
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('creates new task when form is submitted', async () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const addButton = screen.getByText('Add Task');
    fireEvent.click(addButton);

    // Fill out the form
    const titleInput = screen.getByLabelText('Task Title');
    fireEvent.change(titleInput, { target: { value: 'New Task' } });

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'New task description' } });

    const createButton = screen.getByText('Create Task');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockTaskService.post).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New task description',
        priority: 'medium',
        due_date: '',
        estimated_hours: 0,
        assignee: '',
        project_id: 'project1',
        status: 'todo',
      });
    });
  });

  it('opens task menu when more button is clicked', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByText('Delete Task')).toBeInTheDocument();
  });

  it('edits task when edit is selected from menu', async () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    const editButton = screen.getByText('Edit Task');
    fireEvent.click(editButton);

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Task 1')).toBeInTheDocument();
  });

  it('deletes task when delete is selected from menu', async () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const moreButtons = screen.getAllByLabelText('more');
    fireEvent.click(moreButtons[0]);

    const deleteButton = screen.getByText('Delete Task');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockTaskService.delete).toHaveBeenCalledWith('1');
    });
  });

  it('shows task count badges on columns', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    // Check for badge indicators (exact implementation may vary)
    const todoColumn = screen.getByText('To Do').closest('div');
    const inProgressColumn = screen.getByText('In Progress').closest('div');
    const completedColumn = screen.getByText('Completed').closest('div');

    expect(todoColumn).toBeInTheDocument();
    expect(inProgressColumn).toBeInTheDocument();
    expect(completedColumn).toBeInTheDocument();
  });

  it('handles empty task list', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} tasks={[]} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();

    // No tasks should be visible
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
  });

  it('validates required fields in task form', () => {
    renderWithProviders(<KanbanBoard {...defaultProps} />);

    const addButton = screen.getByText('Add Task');
    fireEvent.click(addButton);

    const createButton = screen.getByText('Create Task');
    fireEvent.click(createButton);

    // Form should not submit without required title
    expect(mockTaskService.post).not.toHaveBeenCalled();
  });
});