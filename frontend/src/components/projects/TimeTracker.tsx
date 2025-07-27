import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Add,
  Edit,
  Delete,
  Timer,
  Schedule,
  Assessment,
  History,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { CustomBarChart, CustomLineChart } from '../common/Charts';
import { Task, TimeEntry } from '../../types/project';
import { timeEntryService } from '../../services/api';

dayjs.extend(duration);

interface TimeTrackerProps {
  projectId: string;
  tasks: Task[];
  timeEntries: TimeEntry[];
  onTimeUpdate?: () => void;
}

interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedTime: number;
  selectedTaskId: string;
  description: string;
  billable: boolean;
}

interface TimeEntryForm {
  task_id: string;
  hours: number;
  description: string;
  date: string;
  billable: boolean;
}

const TimeTracker: React.FC<TimeTrackerProps> = ({
  projectId,
  tasks,
  timeEntries,
  onTimeUpdate,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [timer, setTimer] = useState<TimerState>({
    isRunning: false,
    startTime: null,
    elapsedTime: 0,
    selectedTaskId: '',
    description: '',
    billable: true,
  });
  
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [entryForm, setEntryForm] = useState<TimeEntryForm>({
    task_id: '',
    hours: 0,
    description: '',
    date: dayjs().format('YYYY-MM-DD'),
    billable: true,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (timer.isRunning && timer.startTime) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime!,
        }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer.isRunning, timer.startTime]);

  const formatTime = (milliseconds: number) => {
    const duration = dayjs.duration(milliseconds);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (!timer.selectedTaskId) {
      alert('Please select a task first');
      return;
    }

    setTimer(prev => ({
      ...prev,
      isRunning: true,
      startTime: Date.now() - prev.elapsedTime,
    }));
  };

  const pauseTimer = () => {
    setTimer(prev => ({
      ...prev,
      isRunning: false,
    }));
  };

  const stopTimer = async () => {
    if (timer.elapsedTime === 0) return;

    const hours = timer.elapsedTime / (1000 * 60 * 60);
    
    try {
      await timeEntryService.post({
        task_id: timer.selectedTaskId,
        project_id: projectId,
        hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
        description: timer.description,
        date: dayjs().toISOString(),
        billable: timer.billable,
      });

      // Reset timer
      setTimer({
        isRunning: false,
        startTime: null,
        elapsedTime: 0,
        selectedTaskId: timer.selectedTaskId,
        description: '',
        billable: true,
      });

      onTimeUpdate?.();
    } catch (error) {
      console.error('Failed to save time entry:', error);
    }
  };

  const handleManualEntry = async () => {
    try {
      if (editingEntry) {
        await timeEntryService.put(editingEntry.id, {
          ...editingEntry,
          ...entryForm,
        });
      } else {
        await timeEntryService.post({
          ...entryForm,
          project_id: projectId,
        });
      }

      setManualEntryOpen(false);
      setEditingEntry(null);
      resetEntryForm();
      onTimeUpdate?.();
    } catch (error) {
      console.error('Failed to save time entry:', error);
    }
  };

  const handleDeleteEntry = async (entry: TimeEntry) => {
    try {
      await timeEntryService.delete(entry.id);
      onTimeUpdate?.();
    } catch (error) {
      console.error('Failed to delete time entry:', error);
    }
  };

  const resetEntryForm = () => {
    setEntryForm({
      task_id: '',
      hours: 0,
      description: '',
      date: dayjs().format('YYYY-MM-DD'),
      billable: true,
    });
  };

  const openManualEntry = (entry?: TimeEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setEntryForm({
        task_id: entry.task_id,
        hours: entry.hours,
        description: entry.description,
        date: dayjs(entry.date).format('YYYY-MM-DD'),
        billable: entry.billable,
      });
    } else {
      setEditingEntry(null);
      resetEntryForm();
    }
    setManualEntryOpen(true);
  };

  // Analytics data
  const getAnalyticsData = () => {
    const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const billableHours = timeEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
    const nonBillableHours = totalHours - billableHours;

    const hoursByDate = timeEntries.reduce((acc, entry) => {
      const date = dayjs(entry.date).format('MMM DD');
      acc[date] = (acc[date] || 0) + entry.hours;
      return acc;
    }, {} as Record<string, number>);

    const hoursByTask = timeEntries.reduce((acc, entry) => {
      const task = tasks.find(t => t.id === entry.task_id);
      const taskName = task?.title || 'Unknown Task';
      acc[taskName] = (acc[taskName] || 0) + entry.hours;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalHours,
      billableHours,
      nonBillableHours,
      hoursByDate: Object.entries(hoursByDate).map(([date, hours]) => ({ date, hours })),
      hoursByTask: Object.entries(hoursByTask).map(([task, hours]) => ({ task, hours })),
    };
  };

  const analytics = getAnalyticsData();

  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Timer" icon={<Timer />} />
        <Tab label="Time Entries" icon={<History />} />
        <Tab label="Analytics" icon={<Assessment />} />
      </Tabs>

      {/* Timer Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Timer Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" component="div" sx={{ mb: 2, fontFamily: 'monospace' }}>
                  {formatTime(timer.elapsedTime)}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
                  {!timer.isRunning ? (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<PlayArrow />}
                      onClick={startTimer}
                      size="large"
                    >
                      Start
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<Pause />}
                      onClick={pauseTimer}
                      size="large"
                    >
                      Pause
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Stop />}
                    onClick={stopTimer}
                    disabled={timer.elapsedTime === 0}
                    size="large"
                  >
                    Stop
                  </Button>
                </Box>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Task</InputLabel>
                  <Select
                    value={timer.selectedTaskId}
                    label="Select Task"
                    onChange={(e) => setTimer(prev => ({ ...prev, selectedTaskId: e.target.value }))}
                  >
                    {tasks.map((task) => (
                      <MenuItem key={task.id} value={task.id}>
                        {task.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={timer.description}
                  onChange={(e) => setTimer(prev => ({ ...prev, description: e.target.value }))}
                  sx={{ mb: 2 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={timer.billable}
                      onChange={(e) => setTimer(prev => ({ ...prev, billable: e.target.checked }))}
                    />
                  }
                  label="Billable"
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Stats */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Today's Hours
                    </Typography>
                    <Typography variant="h4">
                      {timeEntries
                        .filter(entry => dayjs(entry.date).isSame(dayjs(), 'day'))
                        .reduce((sum, entry) => sum + entry.hours, 0)
                        .toFixed(1)}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Billable
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {analytics.billableHours.toFixed(1)}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Non-Billable
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      {analytics.nonBillableHours.toFixed(1)}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}

      {/* Time Entries Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Time Entries</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => openManualEntry()}
            >
              Add Manual Entry
            </Button>
          </Box>

          <Paper>
            <List>
              {timeEntries.map((entry, index) => {
                const task = tasks.find(t => t.id === entry.task_id);
                return (
                  <React.Fragment key={entry.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">
                              {task?.title || 'Unknown Task'}
                            </Typography>
                            <Chip
                              size="small"
                              label={entry.billable ? 'Billable' : 'Non-billable'}
                              color={entry.billable ? 'success' : 'default'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {entry.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(entry.date).format('MMM DD, YYYY')} • {entry.hours}h
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => openManualEntry(entry)}>
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteEntry(entry)} color="error">
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < timeEntries.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
              {timeEntries.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No time entries yet"
                    secondary="Start tracking time or add manual entries to see them here"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Box>
      )}

      {/* Analytics Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <CustomLineChart
                title="Daily Time Tracking"
                data={analytics.hoursByDate}
                xKey="date"
                yKey="hours"
                height={300}
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <CustomBarChart
                title="Time by Task"
                data={analytics.hoursByTask}
                xKey="task"
                yKey="hours"
                height={300}
              />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Time Summary
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Typography color="text.secondary">Total Hours</Typography>
                    <Typography variant="h4">{analytics.totalHours.toFixed(1)}h</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography color="text.secondary">Billable Hours</Typography>
                    <Typography variant="h4" color="success.main">
                      {analytics.billableHours.toFixed(1)}h
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography color="text.secondary">Billable Rate</Typography>
                    <Typography variant="h4">
                      {analytics.totalHours > 0 
                        ? Math.round((analytics.billableHours / analytics.totalHours) * 100)
                        : 0
                      }%
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryOpen} onClose={() => setManualEntryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingEntry ? 'Edit Time Entry' : 'Add Manual Time Entry'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Task</InputLabel>
              <Select
                value={entryForm.task_id}
                label="Task"
                onChange={(e) => setEntryForm({ ...entryForm, task_id: e.target.value })}
              >
                {tasks.map((task) => (
                  <MenuItem key={task.id} value={task.id}>
                    {task.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              type="number"
              label="Hours"
              value={entryForm.hours}
              onChange={(e) => setEntryForm({ ...entryForm, hours: Number(e.target.value) })}
              inputProps={{ min: 0, step: 0.25 }}
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={entryForm.description}
              onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
            />
            
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={entryForm.date}
              onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={entryForm.billable}
                  onChange={(e) => setEntryForm({ ...entryForm, billable: e.target.checked })}
                />
              }
              label="Billable"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualEntryOpen(false)}>Cancel</Button>
          <Button onClick={handleManualEntry} variant="contained">
            {editingEntry ? 'Update Entry' : 'Add Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimeTracker;