import React from 'react';
import {
  Paper,
  Typography,
  Box,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Circle as CircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface ProjectStats {
  statusDistribution: Array<{ status: string; count: number; }>;
  progressOverview: Array<{
    project: string;
    progress: number;
    health: 'good' | 'warning' | 'critical';
  }>;
}

interface ProjectOverviewProps {
  data: ProjectStats;
}

const getHealthIcon = (health: string) => {
  switch (health) {
    case 'good':
      return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    case 'warning':
      return <WarningIcon sx={{ color: 'warning.main' }} />;
    case 'critical':
      return <ErrorIcon sx={{ color: 'error.main' }} />;
    default:
      return <CircleIcon sx={{ color: 'grey.500' }} />;
  }
};

const getHealthColor = (health: string, theme: any) => {
  switch (health) {
    case 'good':
      return theme.palette.success.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'critical':
      return theme.palette.error.main;
    default:
      return theme.palette.grey[500];
  }
};

const getStatusColor = (status: string, theme: any) => {
  switch (status.toLowerCase()) {
    case 'active':
      return theme.palette.primary.main;
    case 'completed':
      return theme.palette.success.main;
    case 'on-hold':
      return theme.palette.warning.main;
    case 'cancelled':
      return theme.palette.error.main;
    default:
      return theme.palette.grey[500];
  }
};

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ data }) => {
  const theme = useTheme();

  const statusColors = data.statusDistribution.map((_, index) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.secondary.main,
    ];
    return colors[index % colors.length];
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1, border: '1px solid #ccc' }}>
          <Typography variant="body2">
            {payload[0].name}: {payload[0].value} projects
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper sx={{ p: 3, height: '500px' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Project Overview</Typography>
        <IconButton>
          <MoreVertIcon />
        </IconButton>
      </Box>

      <Box sx={{ height: '450px', overflow: 'auto' }}>
        {/* Status Distribution Chart */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Project Status Distribution
          </Typography>
          <Box sx={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {data.statusDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={statusColors[index]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          
          {/* Legend */}
          <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center" mt={1}>
            {data.statusDistribution.map((item, index) => (
              <Chip
                key={item.status}
                label={`${item.status} (${item.count})`}
                size="small"
                sx={{
                  backgroundColor: statusColors[index],
                  color: 'white',
                  '& .MuiChip-label': {
                    fontSize: '0.75rem',
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Project Progress List */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Project Health & Progress
          </Typography>
          <List dense>
            {data.progressOverview.map((project, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getHealthIcon(project.health)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>
                        {project.project}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.progress}%
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <LinearProgress
                      variant="determinate"
                      value={project.progress}
                      sx={{
                        mt: 0.5,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getHealthColor(project.health, theme),
                          borderRadius: 3,
                        },
                      }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Paper>
  );
};

export default ProjectOverview;