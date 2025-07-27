import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Schedule,
  Warning,
  CheckCircle,
  GetApp,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { InvoiceAnalytics as IInvoiceAnalytics, InvoiceStatus } from '../../types/invoice';
import { reportService } from '../../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const InvoiceAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<IInvoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last_30_days');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await reportService.get('invoice-analytics', { date_range: dateRange });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID: return 'success';
      case InvoiceStatus.SENT: return 'info';
      case InvoiceStatus.OVERDUE: return 'error';
      case InvoiceStatus.DRAFT: return 'default';
      case InvoiceStatus.CANCELLED: return 'secondary';
      default: return 'default';
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const exportReport = async () => {
    try {
      // Implementation would depend on backend export endpoint
      console.log('Exporting report...');
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!analytics) {
    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="h6" color="text.secondary">
          No analytics data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Invoice Analytics
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Date Range"
            >
              <MenuItem value="last_7_days">Last 7 Days</MenuItem>
              <MenuItem value="last_30_days">Last 30 Days</MenuItem>
              <MenuItem value="last_90_days">Last 90 Days</MenuItem>
              <MenuItem value="last_year">Last Year</MenuItem>
              <MenuItem value="this_month">This Month</MenuItem>
              <MenuItem value="this_year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Button startIcon={<GetApp />} onClick={exportReport} variant="outlined">
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="primary">
                    {analytics.total_invoices}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Invoices
                  </Typography>
                </Box>
                <AttachMoney color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(analytics.paid_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid Amount
                  </Typography>
                </Box>
                <CheckCircle color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {formatCurrency(analytics.pending_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Amount
                  </Typography>
                </Box>
                <Schedule color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="error.main">
                    {formatCurrency(analytics.overdue_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overdue Amount
                  </Typography>
                </Box>
                <Warning color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={4}>
        {/* Revenue Trends */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.revenue_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Status Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Invoice Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.status_distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.status_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Performance
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Average Payment Time</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {analytics.average_payment_time} days
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((30 - analytics.average_payment_time) / 30 * 100, 100)}
                  color={analytics.average_payment_time <= 15 ? 'success' : analytics.average_payment_time <= 30 ? 'warning' : 'error'}
                />
              </Box>
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Payment Success Rate</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {analytics.payment_success_rate.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={analytics.payment_success_rate}
                  color={analytics.payment_success_rate >= 80 ? 'success' : analytics.payment_success_rate >= 60 ? 'warning' : 'error'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Invoice Count
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.revenue_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Invoice Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Client Payment Behavior */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Client Payment Behavior
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell align="center">Total Invoices</TableCell>
                  <TableCell align="center">Avg Payment Time</TableCell>
                  <TableCell align="center">Overdue Count</TableCell>
                  <TableCell align="center">Payment Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.client_payment_behavior.map((client) => {
                  const paymentScore = Math.max(0, 100 - (client.average_payment_time * 2) - (client.overdue_count * 10));
                  const scoreColor = paymentScore >= 80 ? 'success' : paymentScore >= 60 ? 'warning' : 'error';
                  
                  return (
                    <TableRow key={client.client_id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {client.client_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{client.total_invoices}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${client.average_payment_time} days`}
                          size="small"
                          color={client.average_payment_time <= 15 ? 'success' : client.average_payment_time <= 30 ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {client.overdue_count > 0 ? (
                          <Chip label={client.overdue_count} size="small" color="error" />
                        ) : (
                          <Typography variant="body2">0</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={paymentScore}
                            color={scoreColor}
                            sx={{ width: 60, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="body2" color={`${scoreColor}.main`}>
                            {paymentScore.toFixed(0)}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default InvoiceAnalytics;