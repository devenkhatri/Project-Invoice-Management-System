import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  GetApp,
  Fullscreen,
  Today,
  ViewWeek,
  ViewMonth,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Task, Project } from '../../types/project';

dayjs.extend(isBetween);

interface GanttChartProps {
  project: Project;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
}

interface GanttTask extends Task {
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  duration: number;
  progress: number;
  dependencies?: string[];
}

type ViewMode = 'day' | 'week' | 'month';

const GanttChart: React.FC<GanttChartProps> = ({
  project,
  tasks,
  onTaskClick,
  onTaskUpdate,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Convert tasks to Gantt format
  const ganttTasks: GanttTask[] = useMemo(() => {
    return tasks.map(task => {
      const startDate = task.created_at ? dayjs(task.created_at) : dayjs();
      const endDate = task.due_date ? dayjs(task.due_date) : startDate.add(task.estimated_hours || 8, 'hour');
      const duration = endDate.diff(startDate, 'day') || 1;
      const progress = task.status === 'completed' ? 100 : 
                     task.status === 'in-progress' ? 50 : 0;

      return {
        ...task,
        startDate,
        endDate,
        duration,
        progress,
      };
    });
  }, [tasks]);

  // Calculate chart dimensions and timeline
  const chartConfig = useMemo(() => {
    if (ganttTasks.length === 0) {
      return {
        startDate: dayjs(),
        endDate: dayjs().add(30, 'day'),
        totalDays: 30,
        columns: [],
      };
    }

    const projectStart = dayjs(project.start_date);
    const projectEnd = dayjs(project.end_date);
    const totalDays = projectEnd.diff(projectStart, 'day') || 30;

    // Generate timeline columns based on view mode
    const columns = [];
    let current = projectStart;
    
    while (current.isBefore(projectEnd) || current.isSame(projectEnd)) {
      columns.push({
        date: current,
        label: viewMode === 'day' ? current.format('DD') :
               viewMode === 'week' ? current.format('MMM DD') :
               current.format('MMM YYYY'),
      });
      
      current = current.add(
        viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30,
        viewMode === 'day' ? 'day' : viewMode === 'week' ? 'day' : 'day'
      );
    }

    return {
      startDate: projectStart,
      endDate: projectEnd,
      totalDays,
      columns,
    };
  }, [project, ganttTasks, viewMode]);

  // Calculate task position and width
  const getTaskStyle = (task: GanttTask) => {
    const startOffset = task.startDate.diff(chartConfig.startDate, 'day');
    const taskDuration = task.endDate.diff(task.startDate, 'day') || 1;
    
    const left = (startOffset / chartConfig.totalDays) * 100;
    const width = (taskDuration / chartConfig.totalDays) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
    };
  };

  // Get task color based on status and priority
  const getTaskColor = (task: GanttTask) => {
    if (task.status === 'completed') return '#4caf50';
    if (task.status === 'in-progress') return '#2196f3';
    if (task.status === 'blocked') return '#f44336';
    
    // Color by priority
    switch (task.priority) {
      case 'urgent': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#1976d2';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  };

  // Check if task is on critical path (simplified)
  const isOnCriticalPath = (task: GanttTask) => {
    // Simplified critical path detection
    // In a real implementation, this would use proper CPM algorithm
    return task.priority === 'urgent' || task.status === 'blocked';
  };

  // Export functionality
  const handleExport = () => {
    // Create a simple CSV export
    const csvContent = [
      ['Task', 'Start Date', 'End Date', 'Duration', 'Status', 'Priority', 'Progress'].join(','),
      ...ganttTasks.map(task => [
        task.title,
        task.startDate.format('YYYY-MM-DD'),
        task.endDate.format('YYYY-MM-DD'),
        task.duration,
        task.status,
        task.priority,
        `${task.progress}%`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-gantt.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (ganttTasks.length === 0) {
    return (
      <Alert severity="info">
        No tasks available for Gantt chart. Create some tasks to visualize the project timeline.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>View Mode</InputLabel>
            <Select
              value={viewMode}
              label="View Mode"
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <MenuItem value="day">
                <ViewWeek sx={{ mr: 1 }} />
                Daily
              </MenuItem>
              <MenuItem value="week">
                <ViewMonth sx={{ mr: 1 }} />
                Weekly
              </MenuItem>
              <MenuItem value="month">
                <Today sx={{ mr: 1 }} />
                Monthly
              </MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={showCriticalPath}
                onChange={(e) => setShowCriticalPath(e.target.checked)}
              />
            }
            label="Critical Path"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Zoom In">
            <IconButton
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2))}
              disabled={zoomLevel >= 2}
            >
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={handleExport}>
              <GetApp />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Gantt Chart */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ overflow: 'auto', minHeight: 400 }}>
            <Box sx={{ minWidth: 800, transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
              {/* Timeline Header */}
              <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Box sx={{ width: 200, p: 1, borderRight: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Task
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, display: 'flex' }}>
                  {chartConfig.columns.map((column, index) => (
                    <Box
                      key={index}
                      sx={{
                        flex: 1,
                        p: 1,
                        borderRight: 1,
                        borderColor: 'divider',
                        textAlign: 'center',
                        minWidth: 60,
                      }}
                    >
                      <Typography variant="caption">
                        {column.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Task Rows */}
              {ganttTasks.map((task, index) => (
                <Box
                  key={task.id}
                  sx={{
                    display: 'flex',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: selectedTask === task.id ? 'action.selected' : 
                            index % 2 === 0 ? 'background.default' : 'grey.50',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {/* Task Info */}
                  <Box
                    sx={{
                      width: 200,
                      p: 1,
                      borderRight: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedTask(task.id);
                      onTaskClick?.(task);
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium" noWrap>
                      {task.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={task.priority}
                        color={
                          task.priority === 'urgent' ? 'error' :
                          task.priority === 'high' ? 'warning' :
                          task.priority === 'medium' ? 'info' : 'success'
                        }
                      />
                      <Chip
                        size="small"
                        label={task.status}
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  {/* Timeline */}
                  <Box sx={{ flex: 1, position: 'relative', height: 60, p: 1 }}>
                    {/* Task Bar */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: 20,
                        bgcolor: getTaskColor(task),
                        borderRadius: 1,
                        cursor: 'pointer',
                        border: showCriticalPath && isOnCriticalPath(task) ? 
                               '2px solid red' : 'none',
                        ...getTaskStyle(task),
                      }}
                      onClick={() => {
                        setSelectedTask(task.id);
                        onTaskClick?.(task);
                      }}
                    >
                      {/* Progress Bar */}
                      <Box
                        sx={{
                          height: '100%',
                          width: `${task.progress}%`,
                          bgcolor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 1,
                        }}
                      />
                      
                      {/* Task Label */}
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          left: 4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'white',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 'calc(100% - 8px)',
                        }}
                      >
                        {task.title}
                      </Typography>
                    </Box>

                    {/* Milestone Markers */}
                    {task.status === 'completed' && (
                      <Box
                        sx={{
                          position: 'absolute',
                          right: -5,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 10,
                          height: 10,
                          bgcolor: 'success.main',
                          borderRadius: '50%',
                          border: '2px solid white',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Legend
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#4caf50', borderRadius: 1 }} />
            <Typography variant="caption">Completed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#2196f3', borderRadius: 1 }} />
            <Typography variant="caption">In Progress</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#757575', borderRadius: 1 }} />
            <Typography variant="caption">To Do</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#f44336', borderRadius: 1 }} />
            <Typography variant="caption">Blocked</Typography>
          </Box>
          {showCriticalPath && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, border: '2px solid red', borderRadius: 1 }} />
              <Typography variant="caption">Critical Path</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default GanttChart;