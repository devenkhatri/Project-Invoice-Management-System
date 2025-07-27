import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  GetApp as ExportIcon,
  Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface FinancialTrendsData {
  revenue: Array<{ period: string; amount: number; }>;
  expenses: Array<{ period: string; amount: number; }>;
  profit: Array<{ period: string; amount: number; }>;
}

interface FinancialChartsProps {
  data: FinancialTrendsData;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`financial-tabpanel-${index}`}
      aria-labelledby={`financial-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography
            key={index}
            variant="body2"
            sx={{ color: entry.color }}
          >
            {entry.name}: ₹{entry.value.toLocaleString()}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ data }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // Combine data for comprehensive view
  const combinedData = data.revenue.map((item, index) => ({
    period: item.period,
    revenue: item.amount,
    expenses: data.expenses[index]?.amount || 0,
    profit: data.profit[index]?.amount || 0,
  }));

  // Calculate profit margin data
  const profitMarginData = combinedData.map(item => ({
    period: item.period,
    margin: item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0,
  }));

  // Revenue vs Expenses comparison
  const comparisonData = combinedData.map(item => ({
    period: item.period,
    revenue: item.revenue,
    expenses: item.expenses,
  }));

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];

  return (
    <Paper sx={{ p: 3, height: '500px' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Financial Trends</Typography>
        
        <Box>
          <IconButton onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <ExportIcon sx={{ mr: 1 }} />
              Export Chart
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <FullscreenIcon sx={{ mr: 1 }} />
              Full Screen
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Revenue Trend" />
        <Tab label="Profit Analysis" />
        <Tab label="Revenue vs Expenses" />
        <Tab label="Profit Margin" />
      </Tabs>

      <Box sx={{ height: '400px' }}>
        <TabPanel value={activeTab} index={0}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.light}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
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
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="revenue"
                fill={theme.palette.success.main}
                name="Revenue"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                fill={theme.palette.error.main}
                name="Expenses"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profitMarginData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => `${value.toFixed(1)}%`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Profit Margin']}
              />
              <Line
                type="monotone"
                dataKey="margin"
                stroke={theme.palette.secondary.main}
                strokeWidth={3}
                dot={{ fill: theme.palette.secondary.main, strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default FinancialCharts;