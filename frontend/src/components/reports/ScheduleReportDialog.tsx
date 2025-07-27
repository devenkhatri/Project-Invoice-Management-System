import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Grid,
  TextField,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface ScheduleReportDialogProps {
  open: boolean;
  onClose: () => void;
  reportType: 'financial' | 'project' | 'client';
}

interface ScheduleConfig {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: Dayjs;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  includeCharts: boolean;
  active: boolean;
}

interface ExistingSchedule extends ScheduleConfig {
  id: string;
  nextRun: string;
  lastRun?: string;
}

export const ScheduleReportDialog: React.FC<ScheduleReportDialogProps> = ({
  open,
  onClose,
  reportType,
}) => {
  const [newSchedule, setNewSchedule] = useState<ScheduleConfig>({
    name: '',
    frequency: 'monthly',
    time: dayjs().hour(9).minute(0),
    recipients: [],
    format: 'pdf',
    includeCharts: true,
    active: true,
  });

  const [existingSchedules] = useState<ExistingSchedule[]>([
    {
      id: '1',
      name: 'Monthly Financial Report',
      frequency: 'monthly',
      time: dayjs().hour(9).minute(0),
      dayOfMonth: 1,
      recipients: ['admin@company.com', 'finance@company.com'],
      format: 'pdf',
      includeCharts: true,
      active: true,
      nextRun: dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm'),
      lastRun: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm'),
    },
    {
      id: '2',
      name: 'Weekly Project Status',
      frequency: 'weekly',
      time: dayjs().hour(10).minute(0),
      dayOfWeek: 1, // Monday
      recipients: ['pm@company.com'],
      format: 'excel',
      includeCharts: false,
      active: true,
      nextRun: dayjs().day(1).add(1, 'week').format('YYYY-MM-DD HH:mm'),
      lastRun: dayjs().day(1).format('YYYY-MM-DD HH:mm'),
    },
  ]);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];

  const dayOfWeekOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  const getReportTitle = () => {
    switch (reportType) {
      case 'financial':
        return 'Financial Report';
      case 'project':
        return 'Project Analytics Report';
      case 'client':
        return 'Client Analysis Report';
      default:
        return 'Report';
    }
  };

  const addRecipient = () => {
    if (recipientEmail && !newSchedule.recipients.includes(recipientEmail)) {
      setNewSchedule(prev => ({
        ...prev,
        recipients: [...prev.recipients, recipientEmail],
      }));
      setRecipientEmail('');
    }
  };

  const removeRecipient = (email: string) => {
    setNewSchedule(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email),
    }));
  };

  const handleSave = () => {
    // In a real implementation, save the schedule to the backend
    console.log('Saving schedule:', newSchedule);
    onClose();
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    // In a real implementation, delete the schedule from the backend
    console.log('Deleting schedule:', scheduleId);
  };

  const toggleScheduleActive = (scheduleId: string) => {
    // In a real implementation, toggle the schedule status
    console.log('Toggling schedule:', scheduleId);
  };

  const getNextRunText = (schedule: ExistingSchedule) => {
    const nextRun = dayjs(schedule.nextRun);
    const now = dayjs();
    
    if (nextRun.isSame(now, 'day')) {
      return `Today at ${nextRun.format('HH:mm')}`;
    } else if (nextRun.isSame(now.add(1, 'day'), 'day')) {
      return `Tomorrow at ${nextRun.format('HH:mm')}`;
    } else {
      return nextRun.format('MMM DD, YYYY [at] HH:mm');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ScheduleIcon />
          Schedule {getReportTitle()}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box>
          {/* Existing Schedules */}
          {existingSchedules.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Existing Schedules
              </Typography>
              <List>
                {existingSchedules.map((schedule) => (
                  <ListItem key={schedule.id} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2">
                            {schedule.name}
                          </Typography>
                          <Chip
                            label={schedule.frequency}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            label={schedule.format.toUpperCase()}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Recipients: {schedule.recipients.join(', ')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Next run: {getNextRunText(schedule)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Switch
                          checked={schedule.active}
                          onChange={() => toggleScheduleActive(schedule.id)}
                          size="small"
                        />
                        <IconButton
                          size="small"
                          onClick={() => setEditingSchedule(schedule.id)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* New Schedule Form */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Create New Schedule
          </Typography>

          <Grid container spacing={3}>
            {/* Schedule Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Schedule Name"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
                placeholder={`${getReportTitle()} - ${newSchedule.frequency}`}
              />
            </Grid>

            {/* Frequency */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={newSchedule.frequency}
                  onChange={(e) => setNewSchedule(prev => ({
                    ...prev,
                    frequency: e.target.value as any
                  }))}
                  label="Frequency"
                >
                  {frequencyOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Time */}
            <Grid item xs={12} md={4}>
              <TimePicker
                label="Time"
                value={newSchedule.time}
                onChange={(time) => time && setNewSchedule(prev => ({
                  ...prev,
                  time
                }))}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>

            {/* Day of Week (for weekly) */}
            {newSchedule.frequency === 'weekly' && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Day of Week</InputLabel>
                  <Select
                    value={newSchedule.dayOfWeek || 1}
                    onChange={(e) => setNewSchedule(prev => ({
                      ...prev,
                      dayOfWeek: e.target.value as number
                    }))}
                    label="Day of Week"
                  >
                    {dayOfWeekOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Day of Month (for monthly) */}
            {newSchedule.frequency === 'monthly' && (
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Day of Month"
                  value={newSchedule.dayOfMonth || 1}
                  onChange={(e) => setNewSchedule(prev => ({
                    ...prev,
                    dayOfMonth: parseInt(e.target.value)
                  }))}
                  inputProps={{ min: 1, max: 31 }}
                />
              </Grid>
            )}

            {/* Format */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={newSchedule.format}
                  onChange={(e) => setNewSchedule(prev => ({
                    ...prev,
                    format: e.target.value as any
                  }))}
                  label="Export Format"
                >
                  <MenuItem value="pdf">PDF Report</MenuItem>
                  <MenuItem value="excel">Excel Workbook</MenuItem>
                  <MenuItem value="csv">CSV Data</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Include Charts */}
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newSchedule.includeCharts}
                    onChange={(e) => setNewSchedule(prev => ({
                      ...prev,
                      includeCharts: e.target.checked
                    }))}
                    disabled={newSchedule.format === 'csv'}
                  />
                }
                label="Include Charts and Visualizations"
              />
            </Grid>

            {/* Recipients */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Email Recipients
              </Typography>
              <Box display="flex" gap={1} mb={1}>
                <TextField
                  size="small"
                  label="Email Address"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                  sx={{ flex: 1 }}
                />
                <Button onClick={addRecipient} variant="outlined">
                  Add
                </Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {newSchedule.recipients.map((email) => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => removeRecipient(email)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!newSchedule.name || newSchedule.recipients.length === 0}
        >
          Create Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleReportDialog;