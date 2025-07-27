import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { DataTable } from '../common/DataTable';
import LoadingOverlay from '../layout/LoadingOverlay';
import { clientService } from '../../services/api';
import { Client, ClientFilters } from '../../types/client';
import { useApi } from '../../hooks/useApi';

interface ClientListProps {
  onClientSelect?: (client: Client) => void;
  onClientCreate?: () => void;
  onClientEdit?: (client: Client) => void;
}

export const ClientList: React.FC<ClientListProps> = ({
  onClientSelect,
  onClientCreate,
  onClientEdit
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ClientFilters>({
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { execute: fetchClients } = useApi(clientService.get.bind(clientService));

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        ...filters
      };

      const response = await fetchClients('', params);
      setClients(response.clients);
      setFilteredClients(response.clients);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [fetchClients, page, searchTerm, filters]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page when searching
  }, []);

  const handleFilterChange = (newFilters: Partial<ClientFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filtering
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, client: Client) => {
    setSelectedClient(client);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedClient(null);
  };

  const handleClientAction = (action: string) => {
    if (!selectedClient) return;

    switch (action) {
      case 'view':
        onClientSelect?.(selectedClient);
        break;
      case 'edit':
        onClientEdit?.(selectedClient);
        break;
      case 'projects':
        // Navigate to client projects
        break;
      case 'invoices':
        // Navigate to client invoices
        break;
    }
    handleMenuClose();
  };

  const getStatusChip = (client: Client) => {
    if (!client.is_active) {
      return <Chip label="Inactive" color="default" size="small" />;
    }
    
    if (client.overdue_invoices && client.overdue_invoices > 0) {
      return <Chip label="Overdue" color="error" size="small" icon={<WarningIcon />} />;
    }
    
    if (client.gst_compliant) {
      return <Chip label="GST Compliant" color="success" size="small" icon={<CheckCircleIcon />} />;
    }
    
    return <Chip label="Active" color="primary" size="small" />;
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const columns = [
    {
      id: 'client',
      label: 'Client',
      render: (client: Client) => (
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar>
            {client.company_name ? <BusinessIcon /> : <PersonIcon />}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              {client.name}
            </Typography>
            {client.company_name && (
              <Typography variant="caption" color="text.secondary">
                {client.company_name}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block">
              {client.contact_person || client.email}
            </Typography>
          </Box>
        </Box>
      )
    },
    {
      id: 'contact',
      label: 'Contact',
      render: (client: Client) => (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <EmailIcon fontSize="small" color="action" />
            <Typography variant="body2">{client.email}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <PhoneIcon fontSize="small" color="action" />
            <Typography variant="body2">{client.phone}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body2" noWrap>
              {client.city}, {client.country}
            </Typography>
          </Box>
        </Box>
      )
    },
    {
      id: 'projects',
      label: 'Projects',
      render: (client: Client) => (
        <Box textAlign="center">
          <Typography variant="h6" color="primary">
            {client.active_projects || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Active
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {client.project_count || 0} Total
          </Typography>
        </Box>
      )
    },
    {
      id: 'financial',
      label: 'Financial',
      render: (client: Client) => (
        <Box>
          <Typography variant="body2" fontWeight="bold" color="success.main">
            {formatCurrency(client.paid_amount || 0, client.default_currency)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Paid
          </Typography>
          {client.outstanding_amount && client.outstanding_amount > 0 && (
            <>
              <Typography variant="body2" color="warning.main">
                {formatCurrency(client.outstanding_amount, client.default_currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Outstanding
              </Typography>
            </>
          )}
        </Box>
      )
    },
    {
      id: 'status',
      label: 'Status',
      render: (client: Client) => (
        <Box>
          {getStatusChip(client)}
          {client.gstin && (
            <Box mt={1}>
              <Chip
                label={`GST: ${client.gstin.substring(0, 6)}...`}
                size="small"
                variant="outlined"
                icon={<AccountBalanceIcon />}
              />
            </Box>
          )}
        </Box>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (client: Client) => (
        <IconButton
          onClick={(e) => handleMenuClick(e, client)}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      )
    }
  ];

  if (loading && clients.length === 0) {
    return <LoadingOverlay message="Loading clients..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Client Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onClientCreate}
        >
          Add Client
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search clients by name, email, phone, or contact person..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.is_active ?? ''}
                  onChange={(e) => handleFilterChange({ 
                    is_active: e.target.value === '' ? undefined : e.target.value === 'true' 
                  })}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilters(!showFilters)}
                fullWidth
              >
                More Filters
              </Button>
            </Grid>
          </Grid>

          {/* Advanced Filters */}
          {showFilters && (
            <Box mt={2} pt={2} borderTop={1} borderColor="divider">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={filters.country || ''}
                      onChange={(e) => handleFilterChange({ country: e.target.value || undefined })}
                      label="Country"
                    >
                      <MenuItem value="">All Countries</MenuItem>
                      <MenuItem value="India">India</MenuItem>
                      <MenuItem value="USA">USA</MenuItem>
                      <MenuItem value="UK">UK</MenuItem>
                      <MenuItem value="Canada">Canada</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={filters.sort_by || 'created_at'}
                      onChange={(e) => handleFilterChange({ sort_by: e.target.value })}
                      label="Sort By"
                    >
                      <MenuItem value="created_at">Date Created</MenuItem>
                      <MenuItem value="name">Name</MenuItem>
                      <MenuItem value="total_invoiced">Total Invoiced</MenuItem>
                      <MenuItem value="outstanding_amount">Outstanding Amount</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Sort Order</InputLabel>
                    <Select
                      value={filters.sort_order || 'desc'}
                      onChange={(e) => handleFilterChange({ sort_order: e.target.value as 'asc' | 'desc' })}
                      label="Sort Order"
                    >
                      <MenuItem value="desc">Descending</MenuItem>
                      <MenuItem value="asc">Ascending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Client List */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredClients}
          loading={loading}
          onRowClick={onClientSelect}
          pagination={{
            page,
            totalPages,
            onPageChange: setPage
          }}
          emptyMessage="No clients found. Create your first client to get started."
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleClientAction('view')}>
          <PersonIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => handleClientAction('edit')}>
          <BusinessIcon sx={{ mr: 1 }} />
          Edit Client
        </MenuItem>
        <MenuItem onClick={() => handleClientAction('projects')}>
          <TrendingUpIcon sx={{ mr: 1 }} />
          View Projects
        </MenuItem>
        <MenuItem onClick={() => handleClientAction('invoices')}>
          <AccountBalanceIcon sx={{ mr: 1 }} />
          View Invoices
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ClientList;