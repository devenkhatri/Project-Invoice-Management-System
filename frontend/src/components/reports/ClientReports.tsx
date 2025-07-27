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
  Avatar,
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

interface ClientReportData {
  summary: {
    totalClients: number;
    activeClients: number;
    totalRevenue: number;
    averageProjectValue: number;
    averagePaymentTime: number;
    clientRetentionRate: number;
  };
  profitability: Array<{
    clientId: string;
    clientName: string;
    totalProjects: number;
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    lifetimeValue: number;
    lastProjectDate: string;
  }>;
  paymentBehavior: Array<{
    clientId: string;
    clientName: string;
    averagePaymentTime: number;
    overdueInvoices: number;
    paymentSuccessRate: number;
    totalInvoices: number;
    riskScore: number;
  }>;
  geographicDistribution: Array<{
    region: string;
    clientCount: number;
    revenue: number;
    averageValue: number;
  }>;
  communicationAnalysis: Array<{
    clientId: string;
    clientName: string;
    communicationFrequency: number;
    responseTime: number;
    satisfactionScore: number;
    lastCommunication: string;
  }>;
}

export const ClientReports: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<ClientReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(12, 'months'),
    end: dayjs(),
  });
  const [reportType, setReportType] = useState('profitability');

  useEffect(() => {
    fetchClientData();
  }, [dateRange, reportType]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange.start.format('YYYY-MM-DD'),
        end_date: dateRange.end.format('YYYY-MM-DD'),
        report_type: reportType,
      };
      
      const clientData = await reportService.get('clients', params);
      setData(clientData);
    } catch (error) {
      console.error('Failed to fetch client data:', error);
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

  const getRiskColor = (riskScore: number) => {
    if (riskScore <= 30) return 'success';
    if (riskScore <= 60) return 'warning';
    return 'error';
  };

  const getSatisfactionColor = (score: number) => {
    if (score >= 4) return 'success';
    if (score >= 3) return 'warning';
    return 'error';
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
        <Typography>Loading client reports...</Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>No client data available</Typography>
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
              <MenuItem value="profitability">Client Profitability</MenuItem>
              <MenuItem value="payment-behavior">Payment Behavior</MenuItem>
              <MenuItem value="geographic">Geographic Analysis</MenuItem>
              <MenuItem value="communication">Communication Analysis</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            variant="contained"
            onClick={fetchClientData}
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
                {data.summary.totalClients}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Clients
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {data.summary.activeClients}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Clients
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {formatCurrency(data.summary.totalRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="secondary.main">
                {formatCurrency(data.summary.averageProjectValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Project Value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {data.summary.averagePaymentTime.toFixed(1)} days
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Payment Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {data.summary.clientRetentionRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Retention Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Geographic Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Geographic Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={data.geographicDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis yAxisId="clients" orientation="left" />
                <YAxis yAxisId="revenue" orientation="right" />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'clientCount' ? 'Clients' : 'Revenue'
                  ]}
                />
                <Legend />
                <Bar
                  yAxisId="clients"
                  dataKey="clientCount"
                  fill={theme.palette.primary.main}
                  name="Client Count"
                />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill={theme.palette.success.main}
                  name="Revenue"
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Payment Behavior Analysis */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Payment Behavior vs Risk Score
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <ScatterChart data={data.paymentBehavior}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="averagePaymentTime"
                  name="Payment Time"
                  unit=" days"
                />
                <YAxis
                  dataKey="riskScore"
                  name="Risk Score"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: number, name: string) => [
                    name === 'averagePaymentTime' ? `${value} days` : `${value}%`,
                    name === 'averagePaymentTime' ? 'Avg Payment Time' : 'Risk Score'
                  ]}
                />
                <Scatter
                  dataKey="riskScore"
                  fill={theme.palette.warning.main}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Client Profitability Table */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Client Profitability Analysis
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Projects</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Expenses</TableCell>
                <TableCell align="right">Profit</TableCell>
                <TableCell align="right">Margin</TableCell>
                <TableCell align="right">Lifetime Value</TableCell>
                <TableCell align="center">Last Project</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.profitability.map((client) => (
                <TableRow key={client.clientId}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {client.clientName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" fontWeight="medium">
                        {client.clientName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {client.totalProjects}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(client.totalRevenue)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(client.totalExpenses)}
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
                  <TableCell align="right">
                    {formatCurrency(client.lifetimeValue)}
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(client.lastProjectDate).format('MMM DD, YYYY')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Payment Behavior Analysis */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Payment Behavior Analysis
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Avg Payment Time</TableCell>
                <TableCell align="right">Overdue Invoices</TableCell>
                <TableCell align="right">Success Rate</TableCell>
                <TableCell align="right">Total Invoices</TableCell>
                <TableCell align="center">Risk Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.paymentBehavior.map((client) => (
                <TableRow key={client.clientId}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {client.clientName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" fontWeight="medium">
                        {client.clientName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {client.averagePaymentTime.toFixed(1)} days
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={client.overdueInvoices > 0 ? 'error.main' : 'text.primary'}
                    >
                      {client.overdueInvoices}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={client.paymentSuccessRate >= 90 ? 'success.main' : 
                             client.paymentSuccessRate >= 70 ? 'warning.main' : 'error.main'}
                    >
                      {client.paymentSuccessRate.toFixed(1)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {client.totalInvoices}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${client.riskScore.toFixed(0)}%`}
                      color={getRiskColor(client.riskScore) as any}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Communication Analysis */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Communication & Satisfaction Analysis
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Communication Frequency</TableCell>
                <TableCell align="right">Response Time</TableCell>
                <TableCell align="center">Satisfaction Score</TableCell>
                <TableCell align="center">Last Communication</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.communicationAnalysis.map((client) => (
                <TableRow key={client.clientId}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {client.clientName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" fontWeight="medium">
                        {client.clientName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {client.communicationFrequency.toFixed(1)}/week
                  </TableCell>
                  <TableCell align="right">
                    {client.responseTime.toFixed(1)}h
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${client.satisfactionScore.toFixed(1)}/5`}
                      color={getSatisfactionColor(client.satisfactionScore) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(client.lastCommunication).format('MMM DD, YYYY')}
                    </Typography>
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

export default ClientReports;