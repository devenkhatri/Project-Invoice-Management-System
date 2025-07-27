import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Chip,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  AccountBalance as AccountBalanceIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import LoadingOverlay from '../layout/LoadingOverlay';
import { clientService } from '../../services/api';
import { Client, ClientFormData } from '../../types/client';
import { useApi } from '../../hooks/useApi';

interface ClientFormProps {
  client?: Client;
  onSave: (client: Client) => void;
  onCancel: () => void;
}

const COUNTRIES = [
  'India',
  'USA',
  'UK',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Singapore',
  'UAE'
];

const CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'SGD',
  'AED'
];

const PAYMENT_TERMS = [
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Due on Receipt',
  'COD'
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Puducherry'
];

export const ClientForm: React.FC<ClientFormProps> = ({
  client,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    gstin: '',
    pan: '',
    payment_terms: 'Net 30',
    default_currency: 'INR',
    billing_address: '',
    shipping_address: '',
    contact_person: '',
    website: '',
    notes: '',
    company_name: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [gstinValid, setGstinValid] = useState<boolean | null>(null);
  const [panValid, setPanValid] = useState<boolean | null>(null);

  const { execute: createClient } = useApi(clientService.post.bind(clientService));
  const { execute: updateClient } = useApi(clientService.put.bind(clientService));

  const steps = ['Basic Information', 'Address Details', 'Business Information', 'Additional Settings'];

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        city: client.city || '',
        state: client.state || '',
        country: client.country,
        postal_code: client.postal_code || '',
        gstin: client.gstin || '',
        pan: client.pan || '',
        payment_terms: client.payment_terms,
        default_currency: client.default_currency,
        billing_address: client.billing_address || '',
        shipping_address: client.shipping_address || '',
        contact_person: client.contact_person || '',
        website: client.website || '',
        notes: client.notes || '',
        company_name: client.company_name || ''
      });
    }
  }, [client]);

  const validateGSTIN = (gstin: string): boolean => {
    if (!gstin) return true; // Optional field
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  };

  const validatePAN = (pan: string): boolean => {
    if (!pan) return true; // Optional field
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Real-time validation for specific fields
    if (field === 'gstin') {
      setGstinValid(validateGSTIN(value));
    }
    if (field === 'pan') {
      setPanValid(validatePAN(value));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email format';
        if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
        else if (!validatePhone(formData.phone)) newErrors.phone = 'Invalid phone format';
        break;

      case 1: // Address Details
        if (!formData.address.trim()) newErrors.address = 'Address is required';
        if (!formData.country.trim()) newErrors.country = 'Country is required';
        break;

      case 2: // Business Information
        if (formData.gstin && !validateGSTIN(formData.gstin)) {
          newErrors.gstin = 'Invalid GSTIN format';
        }
        if (formData.pan && !validatePAN(formData.pan)) {
          newErrors.pan = 'Invalid PAN format';
        }
        break;

      case 3: // Additional Settings
        // No required fields in this step
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    // Validate all steps
    let isValid = true;
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) {
        isValid = false;
        setActiveStep(i); // Go to first invalid step
        break;
      }
    }

    if (!isValid) return;

    try {
      setLoading(true);
      
      let savedClient: Client;
      if (client) {
        // Update existing client
        const response = await updateClient(client.id, formData);
        savedClient = response.client;
      } else {
        // Create new client
        const response = await createClient(formData);
        savedClient = response.client;
      }

      onSave(savedClient);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save client' });
    } finally {
      setLoading(false);
    }
  };

  const renderBasicInformation = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Client Name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          required
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Company Name"
          value={formData.company_name}
          onChange={(e) => handleInputChange('company_name', e.target.value)}
          helperText="Optional - if different from client name"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          error={!!errors.email}
          helperText={errors.email}
          required
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Phone"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          error={!!errors.phone}
          helperText={errors.phone}
          required
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Contact Person"
          value={formData.contact_person}
          onChange={(e) => handleInputChange('contact_person', e.target.value)}
          helperText="Primary contact person if different from client name"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Website"
          value={formData.website}
          onChange={(e) => handleInputChange('website', e.target.value)}
          helperText="Optional website URL"
        />
      </Grid>
    </Grid>
  );

  const renderAddressDetails = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Address"
          multiline
          rows={2}
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          error={!!errors.address}
          helperText={errors.address}
          required
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="City"
          value={formData.city}
          onChange={(e) => handleInputChange('city', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>State</InputLabel>
          <Select
            value={formData.state}
            onChange={(e) => handleInputChange('state', e.target.value)}
            label="State"
          >
            {formData.country === 'India' ? (
              INDIAN_STATES.map(state => (
                <MenuItem key={state} value={state}>{state}</MenuItem>
              ))
            ) : (
              <MenuItem value={formData.state}>{formData.state}</MenuItem>
            )}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth required>
          <InputLabel>Country</InputLabel>
          <Select
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            label="Country"
          >
            {COUNTRIES.map(country => (
              <MenuItem key={country} value={country}>{country}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Postal Code"
          value={formData.postal_code}
          onChange={(e) => handleInputChange('postal_code', e.target.value)}
        />
      </Grid>
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          Billing & Shipping Address
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Leave empty to use the primary address above
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Billing Address"
          multiline
          rows={2}
          value={formData.billing_address}
          onChange={(e) => handleInputChange('billing_address', e.target.value)}
          helperText="If different from primary address"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Shipping Address"
          multiline
          rows={2}
          value={formData.shipping_address}
          onChange={(e) => handleInputChange('shipping_address', e.target.value)}
          helperText="If different from primary address"
        />
      </Grid>
    </Grid>
  );

  const renderBusinessInformation = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          Business information is required for GST compliance and invoicing in India
        </Alert>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="GSTIN"
          value={formData.gstin}
          onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
          error={!!errors.gstin}
          helperText={errors.gstin || 'GST Identification Number (for Indian clients)'}
          InputProps={{
            endAdornment: gstinValid !== null && (
              <Box ml={1}>
                {gstinValid ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <ErrorIcon color="error" />
                )}
              </Box>
            )
          }}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="PAN"
          value={formData.pan}
          onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
          error={!!errors.pan}
          helperText={errors.pan || 'Permanent Account Number (for Indian clients)'}
          InputProps={{
            endAdornment: panValid !== null && (
              <Box ml={1}>
                {panValid ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <ErrorIcon color="error" />
                )}
              </Box>
            )
          }}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Payment Terms</InputLabel>
          <Select
            value={formData.payment_terms}
            onChange={(e) => handleInputChange('payment_terms', e.target.value)}
            label="Payment Terms"
          >
            {PAYMENT_TERMS.map(term => (
              <MenuItem key={term} value={term}>{term}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Default Currency</InputLabel>
          <Select
            value={formData.default_currency}
            onChange={(e) => handleInputChange('default_currency', e.target.value)}
            label="Default Currency"
          >
            {CURRENCIES.map(currency => (
              <MenuItem key={currency} value={currency}>{currency}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );

  const renderAdditionalSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Notes"
          multiline
          rows={4}
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          helperText="Internal notes about this client"
        />
      </Grid>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Summary
        </Typography>
        <Card variant="outlined">
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Client Information
                </Typography>
                <Typography variant="body2">
                  Name: {formData.name}
                </Typography>
                <Typography variant="body2">
                  Email: {formData.email}
                </Typography>
                <Typography variant="body2">
                  Phone: {formData.phone}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Address
                </Typography>
                <Typography variant="body2">
                  {formData.address}
                </Typography>
                <Typography variant="body2">
                  {formData.city}, {formData.state}
                </Typography>
                <Typography variant="body2">
                  {formData.country} {formData.postal_code}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Business Details
                </Typography>
                {formData.gstin && (
                  <Typography variant="body2">
                    GSTIN: {formData.gstin}
                  </Typography>
                )}
                {formData.pan && (
                  <Typography variant="body2">
                    PAN: {formData.pan}
                  </Typography>
                )}
                <Typography variant="body2">
                  Payment Terms: {formData.payment_terms}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Settings
                </Typography>
                <Typography variant="body2">
                  Currency: {formData.default_currency}
                </Typography>
                <Typography variant="body2">
                  Country: {formData.country}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderAddressDetails();
      case 2:
        return renderBusinessInformation();
      case 3:
        return renderAdditionalSettings();
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingOverlay message={client ? 'Updating client...' : 'Creating client...'} />;
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={onCancel}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            {client ? 'Edit Client' : 'Create New Client'}
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent>
          {renderStepContent(activeStep)}

          {/* Error Alert */}
          {errors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.submit}
            </Alert>
          )}

          {/* Navigation Buttons */}
          <Box display="flex" justifyContent="between" mt={4}>
            <Button
              onClick={activeStep === 0 ? onCancel : handleBack}
              disabled={loading}
            >
              {activeStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Box display="flex" gap={1}>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={loading}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {client ? 'Update Client' : 'Create Client'}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClientForm;