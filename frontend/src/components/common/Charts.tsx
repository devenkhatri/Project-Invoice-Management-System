import React from 'react';
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
import { Box, Typography, useTheme } from '@mui/material';

interface ChartProps {
  data: any[];
  title?: string;
  height?: number;
  loading?: boolean;
}

// Line Chart Component
interface LineChartProps extends ChartProps {
  xKey: string;
  yKey: string;
  color?: string;
}

export const CustomLineChart: React.FC<LineChartProps> = ({
  data,
  title,
  xKey,
  yKey,
  color,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();
  const lineColor = color || theme.palette.primary.main;

  if (loading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={lineColor}
            strokeWidth={2}
            dot={{ fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Area Chart Component
interface AreaChartProps extends ChartProps {
  xKey: string;
  yKey: string;
  color?: string;
}

export const CustomAreaChart: React.FC<AreaChartProps> = ({
  data,
  title,
  xKey,
  yKey,
  color,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();
  const areaColor = color || theme.palette.primary.main;

  if (loading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={areaColor}
            fill={areaColor}
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Bar Chart Component
interface BarChartProps extends ChartProps {
  xKey: string;
  yKey: string;
  color?: string;
}

export const CustomBarChart: React.FC<BarChartProps> = ({
  data,
  title,
  xKey,
  yKey,
  color,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();
  const barColor = color || theme.palette.primary.main;

  if (loading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey} fill={barColor} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Pie Chart Component
interface PieChartProps extends ChartProps {
  dataKey: string;
  nameKey: string;
  colors?: string[];
}

export const CustomPieChart: React.FC<PieChartProps> = ({
  data,
  title,
  dataKey,
  nameKey,
  colors,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();
  const defaultColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main,
  ];

  const chartColors = colors || defaultColors;

  if (loading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Multi-line Chart Component
interface MultiLineChartProps extends ChartProps {
  xKey: string;
  lines: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  title,
  xKey,
  lines,
  height = 300,
  loading = false,
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">Loading chart...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || theme.palette.primary.main}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};