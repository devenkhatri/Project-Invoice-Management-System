import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  AccountBalance,
  Assignment,
  People,
  BusinessCenter,
  MoreVert,
} from '@mui/icons-material';

interface KPIData {
  revenue: number;
  expenses: number;
  profit: number;
  outstandingInvoices: number;
  activeProjects: number;
  completedTasks: number;
  totalClients: number;
  averageProjectValue: number;
}

interface KPIWidgetProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    period: string;
  };
  format?: 'currency' | 'number' | 'percentage';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const KPIWidget: React.FC<KPIWidgetProps> = ({
  title,
  value,
  icon,
  trend,
  format = 'number',
  color = 'primary',
}) => {
  const theme = useTheme();

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'inherit';
    return trend.direction === 'up' ? theme.palette.success.main : theme.palette.error.main;
  };

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            
            <Typography variant="h4" component="div" sx={{ mb: 1 }}>
              {formatValue(value)}
            </Typography>
            
            {trend && (
              <Box display="flex" alignItems="center" gap={0.5}>
                {trend.direction === 'up' ? (
                  <TrendingUp sx={{ fontSize: 16, color: getTrendColor() }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 16, color: getTrendColor() }} />
                )}
                <Typography
                  variant="body2"
                  sx={{ color: getTrendColor() }}
                >
                  {Math.abs(trend.value)}% {trend.period}
                </Typography>
              </Box>
            )}
          </Box>
          
          <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                backgroundColor: theme.palette[color].light,
                color: theme.palette[color].main,
              }}
            >
              {icon}
            </Box>
            <IconButton size="small">
              <MoreVert fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

interface KPIWidgetsProps {
  data: KPIData;
}

export const KPIWidgets: React.FC<KPIWidgetsProps> = ({ data }) => {
  const widgets = [
    {
      title: 'Total Revenue',
      value: data.revenue,
      icon: <AttachMoney />,
      format: 'currency' as const,
      color: 'success' as const,
      trend: {
        value: 12.5,
        direction: 'up' as const,
        period: 'vs last month',
      },
    },
    {
      title: 'Total Expenses',
      value: data.expenses,
      icon: <Receipt />,
      format: 'currency' as const,
      color: 'warning' as const,
      trend: {
        value: 3.2,
        direction: 'down' as const,
        period: 'vs last month',
      },
    },
    {
      title: 'Net Profit',
      value: data.profit,
      icon: <AccountBalance />,
      format: 'currency' as const,
      color: data.profit >= 0 ? 'success' : 'error',
      trend: {
        value: 18.7,
        direction: 'up' as const,
        period: 'vs last month',
      },
    },
    {
      title: 'Outstanding Invoices',
      value: data.outstandingInvoices,
      icon: <Receipt />,
      format: 'currency' as const,
      color: 'error' as const,
      trend: {
        value: 5.1,
        direction: 'down' as const,
        period: 'vs last month',
      },
    },
    {
      title: 'Active Projects',
      value: data.activeProjects,
      icon: <BusinessCenter />,
      color: 'primary' as const,
    },
    {
      title: 'Completed Tasks',
      value: data.completedTasks,
      icon: <Assignment />,
      color: 'success' as const,
      trend: {
        value: 24.3,
        direction: 'up' as const,
        period: 'this week',
      },
    },
    {
      title: 'Total Clients',
      value: data.totalClients,
      icon: <People />,
      color: 'secondary' as const,
    },
    {
      title: 'Avg Project Value',
      value: data.averageProjectValue,
      icon: <BusinessCenter />,
      format: 'currency' as const,
      color: 'primary' as const,
      trend: {
        value: 8.9,
        direction: 'up' as const,
        period: 'vs last quarter',
      },
    },
  ];

  return (
    <Grid container spacing={3}>
      {widgets.map((widget, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <KPIWidget {...widget} />
        </Grid>
      ))}
    </Grid>
  );
};

export default KPIWidgets;