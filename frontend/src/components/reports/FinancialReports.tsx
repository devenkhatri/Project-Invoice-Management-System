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
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
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

import { reportService } from '../../services/api';

interface FinancialData {
  profitLoss: {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    trends: Array<{
      period: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
  };
  cashFlow: {
    inflow: number;
    outflow: number;
    netFlow: number;
    projections: Array<{
      period: string;
      inflow: number;
      outflow: number;
      netFlow: number;
    }>;
  };
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  clientProfitability: Array<{
    clientId: string;
    clientName: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;
}

export const FinancialReports: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(12, 'months'),
    end: dayjs(),
  });
  const [reportType, setReportType] = useState('profit-loss');

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange, reportType]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange.start.format('YYYY-MM-DD'),
        end_date: dateRange.end.format('YYYY-MM-DD'),
        report_type: reportType,
      };
      
      const financialData = await reportService.getFinancialReport(params);
      setData(financialData);
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
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

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading financial reports...</Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>No financial data available</Typography>
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
              <MenuItem value="profit-loss">Profit & Loss</MenuItem>
              <MenuItem value="cash-flow">Cash Flow</MenuItem>
              <MenuItem value="expense-analysis">Expense Analysis</MenuItem>
              <MenuItem value="client-profitability">Client Profitability</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            variant="contained"
            onClick={fetchFinancialData}
            fullWidth
            sx={{ height: '40px' }}
          >
            Generate Report
          </Button>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {formatCurrency(data.profitLoss.revenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {formatCurrency(data.profitLoss.expenses)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                color={data.profitLoss.profit >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(data.profitLoss.profit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Net Profit
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                color={data.profitLoss.profitMargin >= 0 ? 'success.main' : 'error.main'}
              >
                {data.profitLoss.profitMargin.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Profit Margin
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Profit & Loss Trend */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Profit & Loss Trend
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={data.profitLoss.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={theme.palette.success.main}
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={theme.palette.error.main}
                  strokeWidth={2}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={theme.palette.primary.main}
                  strokeWidth={3}
                  name="Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Expense Breakdown */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Expense Breakdown
            </Typography>
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={data.expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="amount"
                  nameKey="category"
                >
                  {data.expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2 }}>
              {data.expenseBreakdown.map((item, index) => (
                <Box key={item.category} display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      backgroundColor: COLORS[index % COLORS.length],
                      borderRadius: '50%',
                    }}
                  />
                  <Typography variant="body2" flex={1}>
                    {item.category}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Cash Flow Analysis */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Cash Flow Analysis & Projections
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={data.cashFlow.projections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stackId="1"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.light}
                  name="Cash Inflow"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stackId="2"
                  stroke={theme.palette.error.main}
                  fill={theme.palette.error.light}
                  name="Cash Outflow"
                />
                <Line
                  type="monotone"
                  dataKey="netFlow"
                  stroke={theme.palette.primary.main}
                  strokeWidth={3}
                  name="Net Cash Flow"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Client Profitability Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Client Profitability Analysis
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Expenses</TableCell>
                <TableCell align="right">Profit</TableCell>
                <TableCell align="right">Margin</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.clientProfitability.map((client) => (
                <TableRow key={client.clientId}>
                  <TableCell>{client.clientName}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(client.revenue)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(client.expenses)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: client.profit >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'medium',
                    }}
                  >
                    {formatCurrency(client.profit)}
                  </TableCell>
                  <TableCell align="right">
                    {client.profitMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={client.profitMargin >= 20 ? 'Excellent' : 
                             client.profitMargin >= 10 ? 'Good' : 
                             client.profitMargin >= 0 ? 'Fair' : 'Loss'}
                      color={client.profitMargin >= 20 ? 'success' : 
                             client.profitMargin >= 10 ? 'primary' : 
                             client.profitMargin >= 0 ? 'warning' : 'error'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default FinancialReports;