import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Button,
  Alert,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Chat as ChatIcon,
  Visibility as VisibilityIcon,
  Payment as PaymentIcon,
  Business as BusinessIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import LoadingOverlay from '../layout/LoadingOverlay';
import { Charts } from '../common/Charts';
import { clientPortalService } from '../../services/api';
import { ClientPortalData } from '../../types/client';
import { useApi } from '../../hooks/useApi';

interface ClientPortalDashboardProps {
  onProjectClick: (projectId: string) => void;
  onInvoiceClick: (invoiceId: string) => void;
  onCommunicationClick: () => void;
}

export const ClientPortalDashboard: React.FC<ClientPortalDashboardProps> = ({
  onProjectClick,
  onInvoiceClick,
  onCommunicationClick
}) => {
  const [dashboardData, setDashboardData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { execute: fetchDashboard } = useApi(clientPortalService.getDashboard.bind(clientPortalService));

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchDashboard();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'primary';
      case 'completed':
        return 'success';
      case 'on-hold':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'sent':
        return 'warning';
      default:
        return 'default';
    }
  };

  const renderWelcomeSection = () => (
    <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ width: 60, height: 60, bgcolor: 'rgba(255,255,255,0.2)' }}>
            {dashboardData?.client.company ? <BusinessIcon /> : <PersonIcon />}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Welcome back, {dashboardData?.client.name}!
            </Typography>
            {dashboardData?.client.company && (
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                {dashboardData.client.company}
              </Typography>
            )}
            <Typography variant="body1" sx={{ opacity: 0.8, mt: 1 }}>
              Here's what's happening with your projects and invoices
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderSummaryCards = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {/* Projects Summary */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="between">
              <Box>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {dashboardData?.summary.projects.active || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Projects
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'primary.light' }}>
                <AssignmentIcon />
              </Avatar>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {dashboardData?.summary.projects.total || 0} total projects
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Invoices Summary */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="between">
              <Box>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {dashboardData?.summary.invoices.pending || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending Invoices
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'warning.light' }}>
                <ReceiptIcon />
              </Avatar>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {dashboardData?.summary.invoices.total || 0} total invoices
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Outstanding Amount */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="between">
              <Box>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  {formatCurrency(
                    dashboardData?.summary.financial.outstanding_amount || 0,
                    dashboardData?.summary.financial.currency
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Outstanding
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'error.light' }}>
                <PaymentIcon />
              </Avatar>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {dashboardData?.summary.invoices.overdue || 0} overdue invoices
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Total Paid */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="between">
              <Box>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {formatCurrency(
                    dashboardData?.summary.financial.paid_amount || 0,
                    dashboardData?.summary.financial.currency
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Paid
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'success.light' }}>
                <CheckCircleIcon />
              </Avatar>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {dashboardData?.summary.invoices.paid || 0} paid invoices
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderRecentProjects = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Recent Projects
          </Typography>
          <Button size="small" onClick={() => onProjectClick('')}>
            View All
          </Button>
        </Box>
        
        {!dashboardData?.recent_projects.length ? (
          <Alert severity="info">No recent projects found.</Alert>
        ) : (
          <List>
            {dashboardData.recent_projects.map((project, index) => (
              <React.Fragment key={project.id}>
                <ListItem
                  button
                  onClick={() => onProjectClick(project.id)}
                  sx={{ px: 0 }}
                >
                  <ListItemIcon>
                    <AssignmentIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="between" alignItems="center">
                        <Typography variant="subtitle1">
                          {project.name}
                        </Typography>
                        <Chip
                          label={project.status}
                          color={getProjectStatusColor(project.status) as any}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress_percentage}
                          sx={{ my: 1 }}
                        />
                        <Box display="flex" justifyContent="between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Progress: {project.progress_percentage}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Due: {new Date(project.end_date).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <IconButton size="small">
                    <VisibilityIcon />
                  </IconButton>
                </ListItem>
                {index < dashboardData.recent_projects.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  const renderRecentInvoices = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Recent Invoices
          </Typography>
          <Button size="small" onClick={() => onInvoiceClick('')}>
            View All
          </Button>
        </Box>
        
        {!dashboardData?.recent_invoices.length ? (
          <Alert severity="info">No recent invoices found.</Alert>
        ) : (
          <List>
            {dashboardData.recent_invoices.map((invoice, index) => (
              <React.Fragment key={invoice.id}>
                <ListItem
                  button
                  onClick={() => onInvoiceClick(invoice.id)}
                  sx={{ px: 0 }}
                >
                  <ListItemIcon>
                    <ReceiptIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="between" alignItems="center">
                        <Typography variant="subtitle1">
                          {invoice.invoice_number}
                        </Typography>
                        <Chip
                          label={invoice.status}
                          color={getInvoiceStatusColor(invoice.status) as any}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Amount: {formatCurrency(
                            invoice.total_amount,
                            dashboardData?.summary.financial.currency
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <IconButton size="small">
                    <VisibilityIcon />
                  </IconButton>
                </ListItem>
                {index < dashboardData.recent_invoices.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  const renderUpcomingDeadlines = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Upcoming Deadlines
        </Typography>
        
        {!dashboardData?.upcoming_deadlines.length ? (
          <Alert severity="success">No upcoming deadlines.</Alert>
        ) : (
          <List>
            {dashboardData.upcoming_deadlines.map((deadline, index) => (
              <React.Fragment key={deadline.project_id}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <ScheduleIcon color={deadline.days_remaining <= 7 ? 'error' : 'warning'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={deadline.project_name}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Due: {new Date(deadline.end_date).toLocaleDateString()}
                        </Typography>
                        <Chip
                          label={`${deadline.days_remaining} days remaining`}
                          color={deadline.days_remaining <= 7 ? 'error' : 'warning'}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
                {index < dashboardData.upcoming_deadlines.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  const renderRecentCommunications = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Recent Communications
          </Typography>
          <Button size="small" onClick={onCommunicationClick}>
            View All
          </Button>
        </Box>
        
        {!dashboardData?.recent_communications.length ? (
          <Alert severity="info">No recent communications.</Alert>
        ) : (
          <List>
            {dashboardData.recent_communications.slice(0, 3).map((comm, index) => (
              <React.Fragment key={comm.id}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <ChatIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={comm.subject}
                    secondary={
                      <Box>
                        <Typography variant="body2" noWrap>
                          {comm.message.substring(0, 60)}...
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          From: {comm.sender_name} • {new Date(comm.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  {!comm.is_read && (
                    <Chip label="New" color="primary" size="small" />
                  )}
                </ListItem>
                {index < Math.min(dashboardData.recent_communications.length, 3) - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <LoadingOverlay message="Loading your dashboard..." />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={loadDashboardData} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!dashboardData) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        No dashboard data available
      </Alert>
    );
  }

  return (
    <Box>
      {/* Welcome Section */}
      {renderWelcomeSection()}

      {/* Summary Cards */}
      {renderSummaryCards()}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} lg={8}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderRecentProjects()}
            </Grid>
            <Grid item xs={12}>
              {renderRecentInvoices()}
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} lg={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {renderUpcomingDeadlines()}
            </Grid>
            <Grid item xs={12}>
              {renderRecentCommunications()}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClientPortalDashboard;