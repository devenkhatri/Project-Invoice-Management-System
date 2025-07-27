import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
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
  Checkbox,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Send,
  GetApp,
  Payment,
  FileCopy,
  Delete,
  FilterList,
  Visibility,
  Edit,
  MoreVert,
  AttachMoney,
  Schedule,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DataTable, { Column } from '../common/DataTable';
import { Invoice, InvoiceStatus, PaymentStatus, InvoiceFilter, BulkInvoiceAction } from '../../types/invoice';
import { invoiceService } from '../../services/api';

interface InvoiceListProps {
  onCreateInvoice?: () => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  onCreateInvoice,
  onEditInvoice,
  onViewInvoice,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [filters, setFilters] = useState<InvoiceFilter>({
    status: [],
    payment_status: [],
    overdue_only: false,
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });

  // Load invoices
  useEffect(() => {
    loadInvoices();
  }, [filters]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        status: filters.status?.join(','),
        payment_status: filters.payment_status?.join(','),
      };
      const response = await invoiceService.get('', params);
      setInvoices(response.data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      showSnackbar('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const getStatusColor = (status: InvoiceStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case InvoiceStatus.DRAFT: return 'default';
      case InvoiceStatus.SENT: return 'info';
      case InvoiceStatus.PAID: return 'success';
      case InvoiceStatus.OVERDUE: return 'error';
      case InvoiceStatus.CANCELLED: return 'secondary';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case PaymentStatus.PENDING: return 'warning';
      case PaymentStatus.PARTIAL: return 'info';
      case PaymentStatus.PAID: return 'success';
      case PaymentStatus.FAILED: return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      await invoiceService.post({}, `${invoice.id}/send`);
      showSnackbar('Invoice sent successfully', 'success');
      loadInvoices();
    } catch (error) {
      showSnackbar('Failed to send invoice', 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;

    try {
      await invoiceService.post(paymentData, `${selectedInvoice.id}/payment`);
      showSnackbar('Payment recorded successfully', 'success');
      setPaymentDialogOpen(false);
      setPaymentData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        notes: '',
      });
      loadInvoices();
    } catch (error) {
      showSnackbar('Failed to record payment', 'error');
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    try {
      const duplicateData = {
        ...invoice,
        invoice_number: undefined,
        status: InvoiceStatus.DRAFT,
        payment_status: PaymentStatus.PENDING,
        paid_amount: 0,
        issue_date: new Date().toISOString().split('T')[0],
      };
      await invoiceService.post(duplicateData);
      showSnackbar('Invoice duplicated successfully', 'success');
      loadInvoices();
    } catch (error) {
      showSnackbar('Failed to duplicate invoice', 'error');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await invoiceService.delete(invoice.id);
        showSnackbar('Invoice deleted successfully', 'success');
        loadInvoices();
      } catch (error) {
        showSnackbar('Failed to delete invoice', 'error');
      }
    }
  };

  const handleBulkAction = async (action: BulkInvoiceAction) => {
    try {
      // Implementation would depend on backend bulk action endpoint
      showSnackbar(`Bulk ${action.action} completed successfully`, 'success');
      setSelectedInvoices([]);
      setBulkActionOpen(false);
      loadInvoices();
    } catch (error) {
      showSnackbar(`Failed to perform bulk ${action.action}`, 'error');
    }
  };

  const columns: Column<Invoice>[] = [
    {
      id: 'invoice_number',
      label: 'Invoice #',
      minWidth: 120,
      render: (value, row) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {value}
          </Typography>
          {row.is_recurring && (
            <Chip size="small" label="Recurring" color="info" sx={{ mt: 0.5 }} />
          )}
        </Box>
      ),
    },
    {
      id: 'client',
      label: 'Client',
      minWidth: 150,
      render: (value, row) => (
        <Box>
          <Typography variant="body2">{row.client?.name || 'Unknown'}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.client?.email}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'issue_date',
      label: 'Issue Date',
      minWidth: 100,
      render: (value) => formatDate(value),
    },
    {
      id: 'due_date',
      label: 'Due Date',
      minWidth: 100,
      render: (value, row) => (
        <Box>
          <Typography variant="body2">{formatDate(value)}</Typography>
          {row.is_overdue && (
            <Typography variant="caption" color="error">
              {row.days_overdue} days overdue
            </Typography>
          )}
          {!row.is_overdue && row.days_until_due !== undefined && row.days_until_due <= 3 && (
            <Typography variant="caption" color="warning.main">
              Due in {row.days_until_due} days
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'total_amount',
      label: 'Amount',
      minWidth: 120,
      align: 'right',
      render: (value, row) => (
        <Box textAlign="right">
          <Typography variant="body2" fontWeight="medium">
            {formatCurrency(value, row.currency)}
          </Typography>
          {row.paid_amount > 0 && (
            <Typography variant="caption" color="success.main">
              Paid: {formatCurrency(row.paid_amount, row.currency)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      render: (value) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          color={getStatusColor(value)}
          size="small"
        />
      ),
    },
    {
      id: 'payment_status',
      label: 'Payment',
      minWidth: 100,
      render: (value, row) => (
        <Box>
          <Chip
            label={value.charAt(0).toUpperCase() + value.slice(1)}
            color={getPaymentStatusColor(value)}
            size="small"
          />
          {row.remaining_amount && row.remaining_amount > 0 && (
            <Typography variant="caption" display="block" color="text.secondary">
              Due: {formatCurrency(row.remaining_amount, row.currency)}
            </Typography>
          )}
        </Box>
      ),
    },
  ];

  const actions = [
    {
      label: 'View',
      icon: <Visibility />,
      onClick: (invoice: Invoice) => onViewInvoice?.(invoice),
    },
    {
      label: 'Edit',
      icon: <Edit />,
      onClick: (invoice: Invoice) => onEditInvoice?.(invoice),
    },
    {
      label: 'Send',
      icon: <Send />,
      onClick: handleSendInvoice,
    },
    {
      label: 'Record Payment',
      icon: <Payment />,
      onClick: (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentData({
          ...paymentData,
          amount: invoice.remaining_amount?.toString() || '',
        });
        setPaymentDialogOpen(true);
      },
    },
    {
      label: 'Duplicate',
      icon: <FileCopy />,
      onClick: handleDuplicateInvoice,
    },
    {
      label: 'Delete',
      icon: <Delete />,
      onClick: handleDeleteInvoice,
    },
  ];

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (filters.status?.length && !filters.status.includes(invoice.status)) return false;
      if (filters.payment_status?.length && !filters.payment_status.includes(invoice.payment_status)) return false;
      if (filters.client_id && invoice.client_id !== filters.client_id) return false;
      if (filters.overdue_only && !invoice.is_overdue) return false;
      if (filters.from_date && invoice.issue_date < filters.from_date) return false;
      if (filters.to_date && invoice.issue_date > filters.to_date) return false;
      return true;
    });
  }, [invoices, filters]);

  const summaryStats = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const paid = filteredInvoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
    const pending = total - paid;
    const overdue = filteredInvoices
      .filter(inv => inv.is_overdue)
      .reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0);

    return { total, paid, pending, overdue };
  }, [filteredInvoices]);

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Invoices
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            startIcon={<FilterList />}
            onClick={() => setFilterOpen(true)}
            variant="outlined"
          >
            Filter
          </Button>
          {selectedInvoices.length > 0 && (
            <Button
              startIcon={<MoreVert />}
              onClick={() => setBulkActionOpen(true)}
              variant="outlined"
            >
              Bulk Actions ({selectedInvoices.length})
            </Button>
          )}
          <Button
            startIcon={<Add />}
            onClick={onCreateInvoice}
            variant="contained"
          >
            Create Invoice
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AttachMoney color="primary" />
                <Box ml={1}>
                  <Typography variant="h6">{formatCurrency(summaryStats.total)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircle color="success" />
                <Box ml={1}>
                  <Typography variant="h6">{formatCurrency(summaryStats.paid)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Schedule color="warning" />
                <Box ml={1}>
                  <Typography variant="h6">{formatCurrency(summaryStats.pending)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Warning color="error" />
                <Box ml={1}>
                  <Typography variant="h6">{formatCurrency(summaryStats.overdue)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overdue Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        selectable
        searchable
        exportable
        actions={actions}
        onSelectionChange={setSelectedInvoices}
        emptyMessage="No invoices found"
      />

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Invoices</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={filters.status || []}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as InvoiceStatus[] })}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {Object.values(InvoiceStatus).map((status) => (
                    <MenuItem key={status} value={status}>
                      <Checkbox checked={filters.status?.includes(status) || false} />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  multiple
                  value={filters.payment_status || []}
                  onChange={(e) => setFilters({ ...filters, payment_status: e.target.value as PaymentStatus[] })}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {Object.values(PaymentStatus).map((status) => (
                    <MenuItem key={status} value={status}>
                      <Checkbox checked={filters.payment_status?.includes(status) || false} />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From Date"
                  value={filters.from_date ? new Date(filters.from_date) : null}
                  onChange={(date) => setFilters({ ...filters, from_date: date?.toISOString().split('T')[0] })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="To Date"
                  value={filters.to_date ? new Date(filters.to_date) : null}
                  onChange={(date) => setFilters({ ...filters, to_date: date?.toISOString().split('T')[0] })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.overdue_only || false}
                    onChange={(e) => setFilters({ ...filters, overdue_only: e.target.checked })}
                  />
                }
                label="Show only overdue invoices"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilters({})}>Clear</Button>
          <Button onClick={() => setFilterOpen(false)}>Apply</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payment Date"
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Payment Method"
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                placeholder="e.g., Bank Transfer, Credit Card, Cash"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment} variant="contained">
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InvoiceList;