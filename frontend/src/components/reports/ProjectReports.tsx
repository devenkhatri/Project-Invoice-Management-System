import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

import { reportService } from '../../services/api';

interface ProjectReportData {
  summary: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    totalBudget: number;
    totalHours: number;
    averageCompletion: number;
  };
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  timeTracking: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    productivity: number;
    trends: Array<{
      period: string;
      hours: number;
      billableHours: number;
      productivity: number;
    }>;
  };
  profitability: Array<{
    projectId: string;
    projectName: string;
    budget: number;
    actualCost: number;
    revenue: number;
    profit: number;
    profitMargin: number;
    hoursSpent: number;
    completion: number;
    status: string;
  }>;
  resourceUtilization: Array<{
    resource: string;
    allocatedHours: number;
    actualHours: number;
    utilization: number;
    efficiency: number;
  }>;
}

export const ProjectReports: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<ProjectReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(6, 'months'),
    end: dayjs(),
  });
  const [reportType, setReportType] = useState('overview');

  useEffect(() => {
    fetchProjectData();
  }, [dateRange, reportType]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange.start.format('YYYY-MM-DD'),
        end_date: dateRange.end.format('YYYY-MM-DD'),
        report_type: reportType,
      };
      
      const projectData = await reportService.getProjectReport(params);
      setData(projectData);
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'active':
        return 'primary';
      case 'on-hold':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading project reports...</Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>No project data available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Filters */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <DatePicker
            label="Start Date"
            value={dateRange.start}
            onChange={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
            slotProps={{ textField: { fullWidth: true, size: 'small' } }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <DatePicker
            label="End Date"
            value={dateRange.end}
            onChange={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
            slotProps={{ textField: { fullWidth: true, size: 'small' } }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Report Type</InputLabel>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              label="Report Type"
            >
              <MenuItem value="overview">Project Overview</MenuItem>
              <MenuItem value="time-tracking">Time Tracking</MenuItem>
              <MenuItem value="profitability">Profitability</MenuItem>
              <MenuItem value="resource-utilization">Resource Utilization</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            variant="contained"
            onClick={fetchProjectData}
            fullWidth
            sx={{ height: '40px' }}
          >
            Generate Report
          </Button>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {data.summary.totalProjects}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Projects
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {data.summary.activeProjects}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Projects
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {data.summary.completedProjects}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {formatCurrency(data.summary.totalBudget)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Budget
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="secondary.main">
                {data.summary.totalHours.toLocaleString()}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {data.summary.averageCompletion.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Completion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Project Status Distribution */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Project Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="70%">
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2 }}>
              {data.statusDistribution.map((item, index) => (
                <Box key={item.status} display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      backgroundColor: COLORS[index % COLORS.length],
                      borderRadius: '50%',
                    }}
                  />
                  <Typography variant="body2" flex={1}>
                    {item.status}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.count} ({item.percentage.toFixed(1)}%)
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Time Tracking Trends */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Time Tracking & Productivity Trends
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={data.timeTracking.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="hours" orientation="left" />
                <YAxis yAxisId="productivity" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="hours"
                  dataKey="hours"
                  fill={theme.palette.primary.light}
                  name="Total Hours"
                />
                <Bar
                  yAxisId="hours"
                  dataKey="billableHours"
                  fill={theme.palette.success.main}
                  name="Billable Hours"
                />
                <Line
                  yAxisId="productivity"
                  type="monotone"
                  dataKey="productivity"
                  stroke={theme.palette.error.main}
                  strokeWidth={3}
                  name="Productivity %"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Project Profitability Analysis */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Project Profitability Analysis
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Actual Cost</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Profit</TableCell>
                <TableCell align="right">Margin</TableCell>
                <TableCell align="center">Progress</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.profitability.map((project) => (
                <TableRow key={project.projectId}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {project.projectName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.hoursSpent}h spent
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(project.budget)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(project.actualCost)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(project.revenue)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: project.profit >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'medium',
                    }}
                  >
                    {formatCurrency(project.profit)}
                  </TableCell>
                  <TableCell align="right">
                    {project.profitMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ width: 100 }}>
                      <LinearProgress
                        variant="determinate"
                        value={project.completion}
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="caption">
                        {project.completion.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={project.status}
                      color={getStatusColor(project.status) as any}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Resource Utilization */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Resource Utilization Analysis
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.resourceUtilization}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="resource" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="allocatedHours"
                  fill={theme.palette.primary.light}
                  name="Allocated Hours"
                />
                <Bar
                  dataKey="actualHours"
                  fill={theme.palette.primary.main}
                  name="Actual Hours"
                />
              </BarChart>
            </ResponsiveContainer>
          </Grid>
          <Grid item xs={12} md={4}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell align="right">Utilization</TableCell>
                    <TableCell align="right">Efficiency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.resourceUtilization.map((resource) => (
                    <TableRow key={resource.resource}>
                      <TableCell>{resource.resource}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={resource.utilization >= 80 ? 'success.main' : 
                                 resource.utilization >= 60 ? 'warning.main' : 'error.main'}
                        >
                          {resource.utilization.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={resource.efficiency >= 90 ? 'success.main' : 
                                 resource.efficiency >= 70 ? 'warning.main' : 'error.main'}
                        >
                          {resource.efficiency.toFixed(1)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ProjectReports;