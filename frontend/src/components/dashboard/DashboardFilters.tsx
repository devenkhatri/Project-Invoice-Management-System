import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Button,
  Typography,
  Autocomplete,
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Dayjs } from 'dayjs';
import { DashboardFilters as DashboardFiltersType } from './Dashboard';
import { projectService, clientService } from '../../services/api';

interface DashboardFiltersProps {
  filters: DashboardFiltersType;
  onChange: (filters: Partial<DashboardFiltersType>) => void;
}

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

const CURRENCIES = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
];

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 365 },
];

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  onChange,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [projectsData, clientsData] = await Promise.all([
          projectService.get<Project[]>(),
          clientService.get<Client[]>(),
        ]);
        setProjects(projectsData);
        setClients(clientsData);
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    onChange({
      dateRange: {
        start: dayjs(start),
        end: dayjs(end),
      },
    });
  };

  const handleProjectsChange = (event: any) => {
    const value = event.target.value;
    onChange({
      projects: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleClientsChange = (event: any) => {
    const value = event.target.value;
    onChange({
      clients: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleCurrencyChange = (event: any) => {
    onChange({ currency: event.target.value });
  };

  const handleStartDateChange = (date: Dayjs | null) => {
    if (date) {
      onChange({
        dateRange: {
          ...filters.dateRange,
          start: date,
        },
      });
    }
  };

  const handleEndDateChange = (date: Dayjs | null) => {
    if (date) {
      onChange({
        dateRange: {
          ...filters.dateRange,
          end: date,
        },
      });
    }
  };

  const clearFilters = () => {
    onChange({
      projects: undefined,
      clients: undefined,
      currency: undefined,
    });
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Dashboard Filters
      </Typography>
      
      <Grid container spacing={3}>
        {/* Date Range */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Date Range
          </Typography>
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.days}
                size="small"
                variant="outlined"
                onClick={() => handleDatePreset(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </Box>
          <Box display="flex" gap={2}>
            <DatePicker
              label="Start Date"
              value={filters.dateRange.start}
              onChange={handleStartDateChange}
              slotProps={{
                textField: { size: 'small', fullWidth: true },
              }}
            />
            <DatePicker
              label="End Date"
              value={filters.dateRange.end}
              onChange={handleEndDateChange}
              slotProps={{
                textField: { size: 'small', fullWidth: true },
              }}
            />
          </Box>
        </Grid>

        {/* Projects Filter */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Projects</InputLabel>
            <Select
              multiple
              value={filters.projects || []}
              onChange={handleProjectsChange}
              input={<OutlinedInput label="Projects" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const project = projects.find(p => p.id === value);
                    return (
                      <Chip
                        key={value}
                        label={project?.name || value}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
              disabled={loading}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Clients Filter */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Clients</InputLabel>
            <Select
              multiple
              value={filters.clients || []}
              onChange={handleClientsChange}
              input={<OutlinedInput label="Clients" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const client = clients.find(c => c.id === value);
                    return (
                      <Chip
                        key={value}
                        label={client?.name || value}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
              disabled={loading}
            >
              {clients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Currency Filter */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Currency</InputLabel>
            <Select
              value={filters.currency || ''}
              onChange={handleCurrencyChange}
              label="Currency"
            >
              <MenuItem value="">All Currencies</MenuItem>
              {CURRENCIES.map((currency) => (
                <MenuItem key={currency.value} value={currency.value}>
                  {currency.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={6}>
          <Box display="flex" gap={2} alignItems="center" height="100%">
            <Button
              variant="outlined"
              onClick={clearFilters}
              size="small"
            >
              Clear Filters
            </Button>
            <Typography variant="body2" color="text.secondary">
              Showing data from {filters.dateRange.start.format('MMM DD')} to{' '}
              {filters.dateRange.end.format('MMM DD, YYYY')}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardFilters;