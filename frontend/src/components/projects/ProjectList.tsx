import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Grid,
  Paper,
  Divider,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add,
  FilterList,
  Sort,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  DateRange,
  Search,
  Clear,
  GetApp,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import DataTable, { Column } from '../common/DataTable';
import { Project, ProjectFilter, ProjectStats } from '../../types/project';
import { projectService, clientService } from '../../services/api';
import { useApi } from '../../hooks/useApi';

interface ProjectListProps {
  onProjectSelect?: (project: Project) => void;
  onProjectEdit?: (project: Project) => void;
  onProjectCreate?: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  onProjectSelect,
  onProjectEdit,
  onProjectCreate,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  
  // Filter states
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProjectFilter>({
    status: [],
    client: [],
    search: '',
  });
  
  // Bulk action states
  const [bulkActionAnchor, setBulkActionAnchor] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { data: projectStats } = useApi<ProjectStats>('/projects/stats');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, clientsData] = await Promise.all([
        projectService.get(),
        clientService.get(),
      ]);
      setProjects(projectsData as Project[]);
      setClients(clientsData as any[]);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(project.status)) return false;
      }
      
      // Client filter
      if (filters.client && filters.client.length > 0) {
        if (!filters.client.includes(project.client_id)) return false;
      }
      
      // Date range filter
      if (filters.dateRange) {
        const projectDate = dayjs(project.start_date);
        const startDate = dayjs(filters.dateRange.start);
        const endDate = dayjs(filters.dateRange.end);
        if (!projectDate.isBetween(startDate, endDate, 'day', '[]')) return false;
      }
      
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        return (
          project.name.toLowerCase().includes(searchTerm) ||
          project.description.toLowerCase().includes(searchTerm) ||
          project.client_name?.toLowerCase().includes(searchTerm)
        );
      }
      
      return true;
    });
  }, [projects, filters]);

  // Table columns
  const columns: Column<Project>[] = [
    {
      id: 'name',
      label: 'Project Name',
      sortable: true,
      render: (value, row) => (
        <Box>
          <Typography variant="subtitle2" fontWeight="medium">
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.client_name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Chip
          label={value}
          size="small"
          color={
            value === 'active' ? 'success' :
            value === 'completed' ? 'primary' :
            value === 'on-hold' ? 'warning' : 'error'
          }
        />
      ),
    },
    {
      id: 'progress',
      label: 'Progress',
      sortable: true,
      render: (value) => (
        <Box sx={{ minWidth: 100 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {value}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={value} />
        </Box>
      ),
    },
    {
      id: 'end_date',
      label: 'Deadline',
      sortable: true,
      render: (value) => {
        const deadline = dayjs(value);
        const isOverdue = deadline.isBefore(dayjs()) && deadline.isValid();
        return (
          <Typography
            variant="body2"
            color={isOverdue ? 'error' : 'text.primary'}
          >
            {deadline.format('MMM DD, YYYY')}
          </Typography>
        );
      },
    },
    {
      id: 'budget',
      label: 'Budget',
      sortable: true,
      align: 'right',
      render: (value) => (
        <Typography variant="body2">
          ₹{value.toLocaleString()}
        </Typography>
      ),
    },
  ];

  // Handle filter changes
  const handleFilterChange = (key: keyof ProjectFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      client: [],
      search: '',
    });
  };

  // Handle bulk actions
  const handleBulkStatusUpdate = async (status: Project['status']) => {
    try {
      await Promise.all(
        selectedProjects.map(project =>
          projectService.put(project.id, { ...project, status })
        )
      );
      await loadData();
      setSelectedProjects([]);
      setBulkActionAnchor(null);
    } catch (err) {
      setError('Failed to update project status');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedProjects.map(project => projectService.delete(project.id))
      );
      await loadData();
      setSelectedProjects([]);
      setDeleteDialogOpen(false);
    } catch (err) {
      setError('Failed to delete projects');
    }
  };

  // Export functionality
  const handleExport = () => {
    const csvContent = [
      ['Name', 'Client', 'Status', 'Progress', 'Deadline', 'Budget'].join(','),
      ...filteredProjects.map(project => [
        project.name,
        project.client_name || '',
        project.status,
        `${project.progress}%`,
        dayjs(project.end_date).format('YYYY-MM-DD'),
        project.budget,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadData} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Stats Cards */}
      {projectStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Projects
                </Typography>
                <Typography variant="h4">
                  {projectStats.totalProjects}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Projects
                </Typography>
                <Typography variant="h4" color="success.main">
                  {projectStats.activeProjects}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Budget
                </Typography>
                <Typography variant="h4">
                  ₹{projectStats.totalBudget.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Hours
                </Typography>
                <Typography variant="h4">
                  {projectStats.totalHours}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFilterOpen(true)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<GetApp />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onProjectCreate}
          >
            New Project
          </Button>
        </Box>
      </Box>

      {/* Bulk Actions */}
      {selectedProjects.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography>
              {selectedProjects.length} project(s) selected
            </Typography>
            <Box>
              <Button
                color="inherit"
                startIcon={<Edit />}
                onClick={(e) => setBulkActionAnchor(e.currentTarget)}
              >
                Bulk Actions
              </Button>
              <Button
                color="inherit"
                startIcon={<Delete />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Projects Table */}
      <DataTable
        columns={columns}
        data={filteredProjects}
        loading={loading}
        selectable
        searchable
        exportable
        onSelectionChange={setSelectedProjects}
        onExport={handleExport}
        actions={[
          {
            label: 'View',
            icon: <Visibility />,
            onClick: (project) => onProjectSelect?.(project),
          },
          {
            label: 'Edit',
            icon: <Edit />,
            onClick: (project) => onProjectEdit?.(project),
          },
          {
            label: 'Delete',
            icon: <Delete />,
            onClick: (project) => {
              setSelectedProjects([project]);
              setDeleteDialogOpen(true);
            },
          },
        ]}
        emptyMessage="No projects found. Create your first project to get started."
      />

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Projects</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Search */}
            <TextField
              fullWidth
              label="Search"
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            {/* Status Filter */}
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                multiple
                value={filters.status || []}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                input={<OutlinedInput label="Status" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {['active', 'completed', 'on-hold', 'cancelled'].map((status) => (
                  <MenuItem key={status} value={status}>
                    <Checkbox checked={(filters.status || []).includes(status)} />
                    <ListItemText primary={status} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Client Filter */}
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                multiple
                value={filters.client || []}
                onChange={(e) => handleFilterChange('client', e.target.value)}
                input={<OutlinedInput label="Client" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const client = clients.find(c => c.id === value);
                      return (
                        <Chip key={value} label={client?.name || value} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    <Checkbox checked={(filters.client || []).includes(client.id)} />
                    <ListItemText primary={client.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date Range */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange?.start ? dayjs(filters.dateRange.start) : null}
                onChange={(date) => handleFilterChange('dateRange', {
                  ...filters.dateRange,
                  start: date?.toISOString(),
                })}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="End Date"
                value={filters.dateRange?.end ? dayjs(filters.dateRange.end) : null}
                onChange={(date) => handleFilterChange('dateRange', {
                  ...filters.dateRange,
                  end: date?.toISOString(),
                })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearFilters} startIcon={<Clear />}>
            Clear All
          </Button>
          <Button onClick={() => setFilterOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setFilterOpen(false)} variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionAnchor}
        open={Boolean(bulkActionAnchor)}
        onClose={() => setBulkActionAnchor(null)}
      >
        <MenuItem onClick={() => handleBulkStatusUpdate('active')}>
          Mark as Active
        </MenuItem>
        <MenuItem onClick={() => handleBulkStatusUpdate('on-hold')}>
          Mark as On Hold
        </MenuItem>
        <MenuItem onClick={() => handleBulkStatusUpdate('completed')}>
          Mark as Completed
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Projects</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedProjects.length} project(s)? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectList;