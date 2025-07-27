import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  Divider,
  Paper,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Flag,
  Schedule,
  Person,
  Search,
  FilterList,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import dayjs from 'dayjs';
import { Task, KanbanColumn } from '../../types/project';
import { taskService } from '../../services/api';

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onTaskUpdate?: () => void;
}

interface TaskFormData {
  title: string;
  description: string;
  priority: Task['priority'];
  due_date: string;
  estimated_hours: number;
  assignee?: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  tasks,
  onTaskUpdate,
}) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskMenuAnchor, setTaskMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  
  const [taskForm, setTaskForm] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: 0,
    assignee: '',
  });

  // Initialize columns
  useEffect(() => {
    const defaultColumns: KanbanColumn[] = [
      {
        id: 'todo',
        title: 'To Do',
        status: 'todo',
        tasks: [],
        color: '#f5f5f5',
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        status: 'in-progress',
        tasks: [],
        color: '#e3f2fd',
      },
      {
        id: 'completed',
        title: 'Completed',
        status: 'completed',
        tasks: [],
        color: '#e8f5e8',
      },
      {
        id: 'blocked',
        title: 'Blocked',
        status: 'blocked',
        tasks: [],
        color: '#ffebee',
      },
    ];

    // Filter tasks based on search and priority
    const filteredTasks = tasks.filter(task => {
      const matchesSearch = !searchTerm || 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = !priorityFilter || task.priority === priorityFilter;
      
      return matchesSearch && matchesPriority;
    });

    // Distribute tasks into columns
    const columnsWithTasks = defaultColumns.map(column => ({
      ...column,
      tasks: filteredTasks.filter(task => task.status === column.status),
    }));

    setColumns(columnsWithTasks);
  }, [tasks, searchTerm, priorityFilter]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = columns.find(col => col.id === source.droppableId);
    const destColumn = columns.find(col => col.id === destination.droppableId);

    if (!sourceColumn || !destColumn) return;

    const task = sourceColumn.tasks.find(t => t.id === draggableId);
    if (!task) return;

    try {
      // Update task status
      await taskService.put(task.id, {
        ...task,
        status: destColumn.status,
      });

      // Update local state
      const newColumns = columns.map(column => {
        if (column.id === source.droppableId) {
          return {
            ...column,
            tasks: column.tasks.filter(t => t.id !== draggableId),
          };
        }
        if (column.id === destination.droppableId) {
          const newTasks = [...column.tasks];
          newTasks.splice(destination.index, 0, { ...task, status: destColumn.status });
          return {
            ...column,
            tasks: newTasks,
          };
        }
        return column;
      });

      setColumns(newColumns);
      onTaskUpdate?.();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleTaskSubmit = async () => {
    try {
      if (editingTask) {
        await taskService.put(editingTask.id, {
          ...editingTask,
          ...taskForm,
        });
      } else {
        await taskService.post({
          ...taskForm,
          project_id: projectId,
          status: 'todo',
        });
      }

      setTaskDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
      onTaskUpdate?.();
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleTaskDelete = async (task: Task) => {
    try {
      await taskService.delete(task.id);
      onTaskUpdate?.();
      setTaskMenuAnchor(null);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      estimated_hours: 0,
      assignee: '',
    });
  };

  const openTaskDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        assignee: task.assignee || '',
      });
    } else {
      setEditingTask(null);
      resetTaskForm();
    }
    setTaskDialogOpen(true);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <Box>
      {/* Header with Search and Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => openTaskDialog()}
        >
          Add Task
        </Button>
      </Box>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
          {columns.map((column) => (
            <Paper
              key={column.id}
              sx={{
                minWidth: 300,
                maxWidth: 300,
                bgcolor: column.color,
                p: 1,
              }}
            >
              {/* Column Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h3">
                  {column.title}
                </Typography>
                <Badge badgeContent={column.tasks.length} color="primary">
                  <Box sx={{ width: 20, height: 20 }} />
                </Badge>
              </Box>

              {/* Droppable Area */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      minHeight: 400,
                      bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                      borderRadius: 1,
                      p: 1,
                    }}
                  >
                    {column.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{
                              mb: 1,
                              cursor: 'grab',
                              transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                              boxShadow: snapshot.isDragging ? 4 : 1,
                            }}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              {/* Task Header */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {task.title}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTask(task);
                                    setTaskMenuAnchor(e.currentTarget);
                                  }}
                                >
                                  <MoreVert fontSize="small" />
                                </IconButton>
                              </Box>

                              {/* Task Description */}
                              {task.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {task.description.length > 100
                                    ? `${task.description.substring(0, 100)}...`
                                    : task.description
                                  }
                                </Typography>
                              )}

                              {/* Task Metadata */}
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                <Chip
                                  size="small"
                                  label={task.priority}
                                  color={getPriorityColor(task.priority)}
                                  icon={<span>{getPriorityIcon(task.priority)}</span>}
                                />
                                {task.due_date && (
                                  <Chip
                                    size="small"
                                    label={dayjs(task.due_date).format('MMM DD')}
                                    color={dayjs(task.due_date).isBefore(dayjs()) ? 'error' : 'default'}
                                    icon={<Schedule fontSize="small" />}
                                  />
                                )}
                              </Box>

                              {/* Task Footer */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                  {task.estimated_hours}h estimated
                                </Typography>
                                {task.assignee && (
                                  <Tooltip title={task.assignee}>
                                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                      {task.assignee.charAt(0).toUpperCase()}
                                    </Avatar>
                                  </Tooltip>
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Paper>
          ))}
        </Box>
      </DragDropContext>

      {/* Task Menu */}
      <Menu
        anchorEl={taskMenuAnchor}
        open={Boolean(taskMenuAnchor)}
        onClose={() => setTaskMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            openTaskDialog(selectedTask!);
            setTaskMenuAnchor(null);
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Task
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleTaskDelete(selectedTask!)}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Task
        </MenuItem>
      </Menu>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTask ? 'Edit Task' : 'Create New Task'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Task Title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={taskForm.priority}
                label="Priority"
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Task['priority'] })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="date"
              label="Due Date"
              value={taskForm.due_date ? dayjs(taskForm.due_date).format('YYYY-MM-DD') : ''}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              type="number"
              label="Estimated Hours"
              value={taskForm.estimated_hours}
              onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: Number(e.target.value) })}
              inputProps={{ min: 0, step: 0.5 }}
            />
            <TextField
              fullWidth
              label="Assignee"
              value={taskForm.assignee}
              onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleTaskSubmit} variant="contained">
            {editingTask ? 'Update Task' : 'Create Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanBoard;