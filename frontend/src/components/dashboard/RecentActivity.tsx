import React from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Button,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  BusinessCenter as ProjectIcon,
  Receipt as InvoiceIcon,
  Payment as PaymentIcon,
  People as ClientIcon,
  MoreVert as MoreVertIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'project' | 'invoice' | 'payment' | 'client';
  title: string;
  description: string;
  timestamp: string;
  actionable: boolean;
  actionUrl?: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'project':
      return <ProjectIcon />;
    case 'invoice':
      return <InvoiceIcon />;
    case 'payment':
      return <PaymentIcon />;
    case 'client':
      return <ClientIcon />;
    default:
      return <ProjectIcon />;
  }
};

const getActivityColor = (type: string, theme: any) => {
  switch (type) {
    case 'project':
      return theme.palette.primary.main;
    case 'invoice':
      return theme.palette.warning.main;
    case 'payment':
      return theme.palette.success.main;
    case 'client':
      return theme.palette.secondary.main;
    default:
      return theme.palette.grey[500];
  }
};

const getActivityTypeLabel = (type: string) => {
  switch (type) {
    case 'project':
      return 'Project';
    case 'invoice':
      return 'Invoice';
    case 'payment':
      return 'Payment';
    case 'client':
      return 'Client';
    default:
      return 'Activity';
  }
};

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const theme = useTheme();

  const handleActionClick = (actionUrl?: string) => {
    if (actionUrl) {
      // Navigate to the action URL
      window.location.href = actionUrl;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <Paper sx={{ p: 3, height: '500px' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Recent Activity</Typography>
        <IconButton>
          <MoreVertIcon />
        </IconButton>
      </Box>

      <Box sx={{ height: '450px', overflow: 'auto' }}>
        {activities.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
            flexDirection="column"
          >
            <Typography variant="body2" color="text.secondary" align="center">
              No recent activities
            </Typography>
            <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>
              Activities will appear here as you work on projects and invoices
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {activities.map((activity) => (
              <ListItem
                key={activity.id}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '&:last-child': {
                    borderBottom: 'none',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      backgroundColor: getActivityColor(activity.type, theme),
                    }}
                  >
                    {getActivityIcon(activity.type)}
                  </Avatar>
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="body2" fontWeight="medium">
                        {activity.title}
                      </Typography>
                      <Chip
                        label={getActivityTypeLabel(activity.type)}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          borderColor: getActivityColor(activity.type, theme),
                          color: getActivityColor(activity.type, theme),
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {activity.description}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(activity.timestamp)}
                        </Typography>
                        {activity.actionable && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LaunchIcon />}
                            onClick={() => handleActionClick(activity.actionUrl)}
                            sx={{
                              minWidth: 'auto',
                              px: 1,
                              py: 0.25,
                              fontSize: '0.7rem',
                            }}
                          >
                            View
                          </Button>
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {activities.length > 0 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Button variant="outlined" size="small">
            View All Activities
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default RecentActivity;