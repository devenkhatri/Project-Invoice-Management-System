import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card,
  CardContent,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Delete,
  Save,
  Preview,
  Send,
  ArrowBack,
  Calculate,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Invoice, InvoiceFormData, InvoiceLineItem, InvoiceStatus } from '../../types/invoice';
import { invoiceService, clientService, projectService } from '../../services/api';

interface InvoiceFormProps {
  invoice?: Invoice;
  onSave?: (invoice: Invoice) => void;
  onCancel?: () => void;
  onPreview?: (invoice: Invoice) => void;
}

interface Client {
  id: string;
  name: string;
  email: string;
  address: string;
  gstin?: string;
  payment_terms?: string;
  default_currency?: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
}

const steps = ['Invoice Details', 'Line Items', 'Terms & Preview'];

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  onSave,
  onCancel,
  onPreview,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<InvoiceFormData>({
    client_id: '',
    project_id: '',
    line_items: [
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 18,
        hsn_sac_code: '',
      },
    ],
    currency: 'INR',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: 'Net 30',
    notes: '',
    terms_conditions: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
    discount_percentage: 0,
    discount_amount: 0,
  });

  // Load initial data
  useEffect(() => {
    loadClients();
    if (invoice) {
      populateFormFromInvoice(invoice);
    }
  }, [invoice]);

  // Load projects when client changes
  useEffect(() => {
    if (formData.client_id) {
      loadClientProjects(formData.client_id);
      const client = clients.find(c => c.id === formData.client_id);
      setSelectedClient(client || null);
      
      // Update form defaults based on client
      if (client && !invoice) {
        setFormData(prev => ({
          ...prev,
          currency: client.default_currency || 'INR',
          payment_terms: client.payment_terms || 'Net 30',
        }));
      }
    }
  }, [formData.client_id, clients]);

  const loadClients = async () => {
    try {
      const response = await clientService.get();
      setClients(response.data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadClientProjects = async (clientId: string) => {
    try {
      const response = await clientService.getProjects(clientId);
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const populateFormFromInvoice = (invoice: Invoice) => {
    setFormData({
      client_id: invoice.client_id,
      project_id: invoice.project_id || '',
      line_items: invoice.line_items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        hsn_sac_code: item.hsn_sac_code || '',
      })),
      currency: invoice.currency,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      payment_terms: invoice.payment_terms,
      notes: invoice.notes || '',
      terms_conditions: invoice.terms_conditions || '',
      is_recurring: invoice.is_recurring,
      recurring_frequency: invoice.recurring_frequency || 'monthly',
      discount_percentage: invoice.discount_percentage || 0,
      discount_amount: invoice.discount_amount || 0,
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_id) {
      newErrors.client_id = 'Client is required';
    }

    if (!formData.issue_date) {
      newErrors.issue_date = 'Issue date is required';
    }

    if (!formData.due_date) {
      newErrors.due_date = 'Due date is required';
    }

    if (formData.line_items.length === 0) {
      newErrors.line_items = 'At least one line item is required';
    }

    formData.line_items.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`line_item_${index}_description`] = 'Description is required';
      }
      if (item.quantity <= 0) {
        newErrors[`line_item_${index}_quantity`] = 'Quantity must be greater than 0';
      }
      if (item.unit_price < 0) {
        newErrors[`line_item_${index}_unit_price`] = 'Unit price cannot be negative';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateLineItemTotal = (item: Omit<InvoiceLineItem, 'id' | 'total_price' | 'tax_amount'>) => {
    const subtotal = item.quantity * item.unit_price;
    const taxAmount = (subtotal * item.tax_rate) / 100;
    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  };

  const calculateInvoiceTotals = () => {
    const lineItemTotals = formData.line_items.map(calculateLineItemTotal);
    const subtotal = lineItemTotals.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTax = lineItemTotals.reduce((sum, item) => sum + item.taxAmount, 0);
    
    let total = subtotal + totalTax;
    
    if (formData.discount_amount) {
      total -= formData.discount_amount;
    } else if (formData.discount_percentage) {
      total -= (total * formData.discount_percentage) / 100;
    }

    return {
      subtotal,
      totalTax,
      total: Math.max(0, total),
    };
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          description: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 18,
          hsn_sac_code: '',
        },
      ],
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleNext = () => {
    if (activeStep === 0 && !formData.client_id) {
      setErrors({ client_id: 'Please select a client' });
      return;
    }
    if (activeStep === 1 && formData.line_items.length === 0) {
      setErrors({ line_items: 'Please add at least one line item' });
      return;
    }
    setActiveStep(prev => prev + 1);
    setErrors({});
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSave = async (sendInvoice = false) => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      let savedInvoice: Invoice;
      if (invoice) {
        // Update existing invoice
        const response = await invoiceService.put(invoice.id, formData);
        savedInvoice = response.data;
      } else {
        // Create new invoice
        const response = await invoiceService.post(formData);
        savedInvoice = response.data;
      }

      // Send invoice if requested
      if (sendInvoice && savedInvoice.status === InvoiceStatus.DRAFT) {
        await invoiceService.post({}, `${savedInvoice.id}/send`);
        savedInvoice.status = InvoiceStatus.SENT;
      }

      onSave?.(savedInvoice);
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErrors({ submit: 'Failed to save invoice. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: formData.currency,
    }).format(amount);
  };

  const totals = calculateInvoiceTotals();

  const renderInvoiceDetails = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Autocomplete
          options={clients}
          getOptionLabel={(option) => option.name}
          value={clients.find(c => c.id === formData.client_id) || null}
          onChange={(_, value) => setFormData(prev => ({ ...prev, client_id: value?.id || '' }))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Client *"
              error={!!errors.client_id}
              helperText={errors.client_id}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Autocomplete
          options={projects}
          getOptionLabel={(option) => option.name}
          value={projects.find(p => p.id === formData.project_id) || null}
          onChange={(_, value) => setFormData(prev => ({ ...prev, project_id: value?.id || '' }))}
          renderInput={(params) => (
            <TextField {...params} label="Project (Optional)" />
          )}
          disabled={!formData.client_id}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Issue Date *"
            value={new Date(formData.issue_date)}
            onChange={(date) => setFormData(prev => ({ 
              ...prev, 
              issue_date: date?.toISOString().split('T')[0] || '' 
            }))}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                error={!!errors.issue_date}
                helperText={errors.issue_date}
              />
            )}
          />
        </LocalizationProvider>
      </Grid>
      <Grid item xs={12} md={6}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Due Date *"
            value={new Date(formData.due_date)}
            onChange={(date) => setFormData(prev => ({ 
              ...prev, 
              due_date: date?.toISOString().split('T')[0] || '' 
            }))}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                error={!!errors.due_date}
                helperText={errors.due_date}
              />
            )}
          />
        </LocalizationProvider>
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Currency</InputLabel>
          <Select
            value={formData.currency}
            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
          >
            <MenuItem value="INR">INR (₹)</MenuItem>
            <MenuItem value="USD">USD ($)</MenuItem>
            <MenuItem value="EUR">EUR (€)</MenuItem>
            <MenuItem value="GBP">GBP (£)</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Payment Terms"
          value={formData.payment_terms}
          onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
          placeholder="e.g., Net 30, Due on receipt"
        />
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.is_recurring}
              onChange={(e) => setFormData(prev => ({ ...prev, is_recurring: e.target.checked }))}
            />
          }
          label="Recurring Invoice"
        />
      </Grid>
      {formData.is_recurring && (
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={formData.recurring_frequency}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                recurring_frequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'yearly'
              }))}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      )}
    </Grid>
  );

  const renderLineItems = () => (
    <Box>
      <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
        <Typography variant="h6">Line Items</Typography>
        <Button startIcon={<Add />} onClick={addLineItem} variant="outlined">
          Add Item
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Description *</TableCell>
              <TableCell width={100}>Qty *</TableCell>
              <TableCell width={120}>Unit Price *</TableCell>
              <TableCell width={100}>Tax %</TableCell>
              <TableCell width={120}>HSN/SAC</TableCell>
              <TableCell width={120}>Total</TableCell>
              <TableCell width={60}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {formData.line_items.map((item, index) => {
              const itemTotal = calculateLineItemTotal(item);
              return (
                <TableRow key={index}>
                  <TableCell>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      error={!!errors[`line_item_${index}_description`]}
                      helperText={errors[`line_item_${index}_description`]}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      error={!!errors[`line_item_${index}_quantity`]}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      error={!!errors[`line_item_${index}_unit_price`]}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.tax_rate}
                      onChange={(e) => updateLineItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, max: 100, step: 0.01 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.hsn_sac_code}
                      onChange={(e) => updateLineItem(index, 'hsn_sac_code', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(itemTotal.total)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tax: {formatCurrency(itemTotal.taxAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => removeLineItem(index)}
                      disabled={formData.line_items.length === 1}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {errors.line_items && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errors.line_items}
        </Alert>
      )}

      {/* Discount Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Discount
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Discount Percentage"
                type="number"
                value={formData.discount_percentage}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  discount_percentage: parseFloat(e.target.value) || 0,
                  discount_amount: 0 
                }))}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Discount Amount"
                type="number"
                value={formData.discount_amount}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  discount_amount: parseFloat(e.target.value) || 0,
                  discount_percentage: 0 
                }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Totals Summary */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Invoice Summary
          </Typography>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography>Subtotal:</Typography>
            <Typography>{formatCurrency(totals.subtotal)}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography>Tax:</Typography>
            <Typography>{formatCurrency(totals.totalTax)}</Typography>
          </Box>
          {(formData.discount_amount > 0 || formData.discount_percentage > 0) && (
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography>Discount:</Typography>
              <Typography color="success.main">
                -{formatCurrency(
                  formData.discount_amount || 
                  ((totals.subtotal + totals.totalTax) * formData.discount_percentage) / 100
                )}
              </Typography>
            </Box>
          )}
          <Divider sx={{ my: 1 }} />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="h6">Total:</Typography>
            <Typography variant="h6">{formatCurrency(totals.total)}</Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const renderTermsAndPreview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Notes"
          multiline
          rows={4}
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes for the client..."
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Terms and Conditions"
          multiline
          rows={4}
          value={formData.terms_conditions}
          onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
          placeholder="Payment terms, late fees, etc..."
        />
      </Grid>
      
      {/* Invoice Preview Summary */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Invoice Preview
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Client:</Typography>
                <Typography>{selectedClient?.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Issue Date:
                </Typography>
                <Typography>{new Date(formData.issue_date).toLocaleDateString()}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Due Date:</Typography>
                <Typography>{new Date(formData.due_date).toLocaleDateString()}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Total Amount:
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(totals.total)}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Line Items: {formData.line_items.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Payment Terms: {formData.payment_terms}
                </Typography>
                {formData.is_recurring && (
                  <Typography variant="body2" color="text.secondary">
                    Recurring: {formData.recurring_frequency}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderInvoiceDetails();
      case 1:
        return renderLineItems();
      case 2:
        return renderTermsAndPreview();
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={onCancel} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">
            {invoice ? 'Edit Invoice' : 'Create Invoice'}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {activeStep === steps.length - 1 && (
            <>
              <Button
                startIcon={<Preview />}
                onClick={() => onPreview?.(formData as any)}
                variant="outlined"
              >
                Preview
              </Button>
              <Button
                startIcon={<Save />}
                onClick={() => handleSave(false)}
                variant="outlined"
                disabled={loading}
              >
                Save Draft
              </Button>
              <Button
                startIcon={<Send />}
                onClick={() => handleSave(true)}
                variant="contained"
                disabled={loading}
              >
                Save & Send
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Form Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {getStepContent(activeStep)}
      </Paper>

      {/* Navigation */}
      <Box display="flex" justifyContent="space-between">
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={activeStep === steps.length - 1}
          variant="contained"
        >
          Next
        </Button>
      </Box>

      {/* Error Display */}
      {errors.submit && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errors.submit}
        </Alert>
      )}
    </Box>
  );
};

export default InvoiceForm;