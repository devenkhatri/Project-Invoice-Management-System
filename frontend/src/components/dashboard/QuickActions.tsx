import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  BusinessCenter as ProjectIcon,
  Receipt as InvoiceIcon,
  People as ClientIcon,
  Timer as TimerIcon,
  Assessment as ReportIcon,
  Payment as PaymentIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  badge?: number;
}

export const QuickActions: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const quickActions: QuickAction[] = [
    {
      title: 'New Project',
      description: 'Create a new project',
      icon: <ProjectIcon />,
      color: theme.palette.primary.main,
      path: '/projects/new',
    },
    {
      title: 'Create Invoice',
      description: 'Generate new invoice',
      icon: <InvoiceIcon />,
      color: theme.palette.warning.main,
      path: '/invoices/new',
    },
    {
      title: 'Add Client',
      description: 'Register new client',
      icon: <ClientIcon />,
      color: theme.palette.secondary.main,
      path: '/clients/new',
    },
    {
      title: 'Track Time',
      description: 'Start time tracking',
      icon: <TimerIcon />,
      color: theme.palette.success.main,
      path: '/time-tracking',
    },
    {
      title: 'View Reports',
      description: 'Financial reports',
      icon: <ReportIcon />,
      color: theme.palette.info.main,
      path: '/reports',
    },
    {
      title: 'Record Payment',
      description: 'Log payment received',
      icon: <PaymentIcon />,
      color: theme.palette.success.main,
      path: '/payments/new',
    },
  ];

  const handleActionClick = (path: string) => {
    navigate(path);
  };

  return (
    <Paper sx={{ p: 3, height: '500px' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Quick Actions</Typography>
        <IconButton>
          <MoreVertIcon />
        </IconButton>
      </Box>

      <Box sx={{ height: '450px', overflow: 'auto' }}>
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} key={index}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                  },
                }}
                onClick={() => handleActionClick(action.path)}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: `${action.color}20`,
                        color: action.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {action.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                    {action.badge && (
                      <Box
                        sx={{
                          backgroundColor: theme.palette.error.main,
                          color: 'white',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                        }}
                      >
                        {action.badge}
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Additional Quick Stats */}
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Today's Summary
          </Typography>
          
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Box textAlign="center" sx={{ p: 1 }}>
                <Typography variant="h6" color="primary">
                  5
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Tasks Due
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box textAlign="center" sx={{ p: 1 }}>
                <Typography variant="h6" color="warning.main">
                  3
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Overdue Invoices
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box textAlign="center" sx={{ p: 1 }}>
                <Typography variant="h6" color="success.main">
                  8.5h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Hours Logged
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box textAlign="center" sx={{ p: 1 }}>
                <Typography variant="h6" color="secondary.main">
                  ₹45K
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Revenue Today
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Paper>
  );
};

export default QuickActions;