import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Fab,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

import { KPIWidgets } from './KPIWidgets';
import { FinancialCharts } from './FinancialCharts';
import { ProjectOverview } from './ProjectOverview';
import { RecentActivity } from './RecentActivity';
import { QuickActions } from './QuickActions';
import { DashboardFilters } from './DashboardFilters';
import { WidgetCustomizer } from './WidgetCustomizer';
import { reportService } from '../../services/api';

export interface DashboardData {
  kpis: {
    revenue: number;
    expenses: number;
    profit: number;
    outstandingInvoices: number;
    activeProjects: number;
    completedTasks: number;
    totalClients: number;
    averageProjectValue: number;
  };
  financialTrends: {
    revenue: Array<{ period: string; amount: number; }>;
    expenses: Array<{ period: string; amount: number; }>;
    profit: Array<{ period: string; amount: number; }>;
  };
  projectStats: {
    statusDistribution: Array<{ status: string; count: number; }>;
    progressOverview: Array<{ project: string; progress: number; health: 'good' | 'warning' | 'critical'; }>;
  };
  recentActivities: Array<{
    id: string;
    type: 'project' | 'invoice' | 'payment' | 'client';
    title: string;
    description: string;
    timestamp: string;
    actionable: boolean;
    actionUrl?: string;
  }>;
}

export interface DashboardFilters {
  dateRange: {
    start: Dayjs;
    end: Dayjs;
  };
  projects?: string[];
  clients?: string[];
  currency?: string;
}

export const Dashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: dayjs().subtract(30, 'days'),
      end: dayjs(),
    },
  });
  
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        start_date: filters.dateRange.start.format('YYYY-MM-DD'),
        end_date: filters.dateRange.end.format('YYYY-MM-DD'),
        projects: filters.projects,
        clients: filters.clients,
        currency: filters.currency,
      };
      
      const dashboardData = await reportService.getDashboardData(params);
      setData(dashboardData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleFiltersChange = (newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => setShowFilters(!showFilters)}>
            <FilterIcon />
          </IconButton>
          
          <IconButton onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
          
          <IconButton onClick={handleSettingsClick}>
            <SettingsIcon />
          </IconButton>
          
          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={handleSettingsClose}
          >
            <MenuItem onClick={() => {
              setShowCustomizer(true);
              handleSettingsClose();
            }}>
              Customize Dashboard
            </MenuItem>
            <MenuItem onClick={handleSettingsClose}>
              Export Data
            </MenuItem>
            <MenuItem onClick={handleSettingsClose}>
              Schedule Reports
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <DashboardFilters
            filters={filters}
            onChange={handleFiltersChange}
          />
        </Paper>
      )}

      {data && (
        <>
          {/* KPI Widgets */}
          <KPIWidgets data={data.kpis} />

          {/* Main Content Grid */}
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {/* Financial Charts */}
            <Grid item xs={12} lg={8}>
              <FinancialCharts data={data.financialTrends} />
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} lg={4}>
              <QuickActions />
            </Grid>

            {/* Project Overview */}
            <Grid item xs={12} md={6}>
              <ProjectOverview data={data.projectStats} />
            </Grid>

            {/* Recent Activity */}
            <Grid item xs={12} md={6}>
              <RecentActivity activities={data.recentActivities} />
            </Grid>
          </Grid>
        </>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>

      {/* Widget Customizer Modal */}
      {showCustomizer && (
        <WidgetCustomizer
          open={showCustomizer}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </Box>
  );
};

export default Dashboard;