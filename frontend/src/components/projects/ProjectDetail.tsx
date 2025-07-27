import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Grid,
  Chip,
  LinearProgress,
  Button,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Add,
  AttachFile,
  Message,
  Timeline,
  Assessment,
  Schedule,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { CustomLineChart, CustomPieChart } from '../common/Charts';
import KanbanBoard from './KanbanBoard';
import TimeTracker from './TimeTracker';
import { Project, Task, TimeEntry } from '../../types/project';
import { projectService, taskService, timeEntryService } from '../../services/api';

interface ProjectDetailProps {
  projectId: string;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onClose?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`project-tabpanel-${index}`}
    aria-labelledby={`project-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const ProjectDetail: React.FC<ProjectDetailProps> = ({
  projectId,
  onEdit,
  onDelete,
  onClose,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, tasksData, timeData] = await Promise.all([
        projectService.get(projectId),
        projectService.getTasks(projectId),
        timeEntryService.get(undefined, { project_id: projectId }),
      ]);
      
      setProject(projectData as Project);
      setTasks(tasksData as Task[]);
      setTimeEntries(timeData as TimeEntry[]);
    } catch (err) {
      setError('Failed to load project details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getProjectStats = () => {
    if (!project || !tasks.length) return null;

    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const billableHours = timeEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
    
    const tasksByStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const timeByDate = timeEntries.reduce((acc, entry) => {
      const date = dayjs(entry.date).format('MMM DD');
      acc[date] = (acc[date] || 0) + entry.hours;
      return acc;
    }, {} as Record<string, number>);

    return {
      completedTasks,
      totalTasks: tasks.length,
      completionRate: Math.round((completedTasks / tasks.length) * 100),
      totalHours,
      billableHours,
      tasksByStatus,
      timeByDate: Object.entries(timeByDate).map(([date, hours]) => ({ date, hours })),
    };
  };

  const stats = getProjectStats();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Typography>Loading project details...</Typography>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error || 'Project not found'}
        <Button onClick={loadProjectData} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Project Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {project.name}
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {project.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={project.status}
                  color={
                    project.status === 'active' ? 'success' :
                    project.status === 'completed' ? 'primary' :
                    project.status === 'on-hold' ? 'warning' : 'error'
                  }
                />
                <Typography variant="body2" color="text.secondary">
                  Client: {project.client_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Budget: ₹{project.budget.toLocaleString()}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => onEdit?.(project)}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => onDelete?.(project)}
              >
                Delete
              </Button>
            </Box>
          </Box>

          {/* Project Progress */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {project.progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={project.progress} sx={{ height: 8, borderRadius: 4 }} />
          </Box>

          {/* Project Timeline */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Start Date
              </Typography>
              <Typography variant="body1">
                {dayjs(project.start_date).format('MMM DD, YYYY')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                End Date
              </Typography>
              <Typography variant="body1" color={dayjs(project.end_date).isBefore(dayjs()) ? 'error.main' : 'text.primary'}>
                {dayjs(project.end_date).format('MMM DD, YYYY')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Tasks Completed
                </Typography>
                <Typography variant="h4">
                  {stats.completedTasks}/{stats.totalTasks}
                </Typography>
                <Typography variant="body2" color="success.main">
                  {stats.completionRate}% complete
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Hours
                </Typography>
                <Typography variant="h4">
                  {stats.totalHours}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.billableHours} billable
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Budget Used
                </Typography>
                <Typography variant="h4">
                  ₹{Math.round(stats.billableHours * 1000).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  of ₹{project.budget.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Days Remaining
                </Typography>
                <Typography variant="h4">
                  {Math.max(0, dayjs(project.end_date).diff(dayjs(), 'day'))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  until deadline
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="project tabs">
            <Tab label="Overview" icon={<Assessment />} />
            <Tab label="Tasks" icon={<Timeline />} />
            <Tab label="Time Tracking" icon={<Schedule />} />
            <Tab label="Files" icon={<AttachFile />} />
            <Tab label="Communication" icon={<Message />} />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            {/* Task Status Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                {stats && (
                  <CustomPieChart
                    title="Tasks by Status"
                    data={Object.entries(stats.tasksByStatus).map(([status, count]) => ({
                      name: status,
                      value: count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    height={300}
                  />
                )}
              </Paper>
            </Grid>

            {/* Time Tracking Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                {stats && (
                  <CustomLineChart
                    title="Daily Time Tracking"
                    data={stats.timeByDate}
                    xKey="date"
                    yKey="hours"
                    height={300}
                  />
                )}
              </Paper>
            </Grid>

            {/* Recent Activity */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <List>
                  {timeEntries.slice(0, 5).map((entry, index) => (
                    <React.Fragment key={entry.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar>
                            <Schedule />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${entry.hours} hours logged`}
                          secondary={`${entry.description} - ${dayjs(entry.date).format('MMM DD, YYYY')}`}
                        />
                      </ListItem>
                      {index < 4 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tasks Tab */}
        <TabPanel value={activeTab} index={1}>
          <KanbanBoard
            projectId={projectId}
            tasks={tasks}
            onTaskUpdate={loadProjectData}
          />
        </TabPanel>

        {/* Time Tracking Tab */}
        <TabPanel value={activeTab} index={2}>
          <TimeTracker
            projectId={projectId}
            tasks={tasks}
            timeEntries={timeEntries}
            onTimeUpdate={loadProjectData}
          />
        </TabPanel>

        {/* Files Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AttachFile sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              File Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              File management functionality will be implemented in a future update.
            </Typography>
            <Button variant="outlined" startIcon={<Add />}>
              Upload Files
            </Button>
          </Box>
        </TabPanel>

        {/* Communication Tab */}
        <TabPanel value={activeTab} index={4}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Project Notes & Communication
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setNoteDialogOpen(true)}
              >
                Add Note
              </Button>
            </Box>
            
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Message sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Communication History
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Communication features will be implemented in a future update.
              </Typography>
            </Paper>
          </Box>
        </TabPanel>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Project Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              // TODO: Save note
              setNewNote('');
              setNoteDialogOpen(false);
            }}
            variant="contained"
          >
            Save Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectDetail;