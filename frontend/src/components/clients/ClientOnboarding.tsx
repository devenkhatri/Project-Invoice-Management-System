import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  VpnKey as VpnKeyIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import LoadingOverlay from '../layout/LoadingOverlay';
import { ClientForm } from './ClientForm';
import { clientService } from '../../services/api';
import { Client, ClientFormData, ClientDocument, ClientOnboardingData } from '../../types/client';
import { useApi } from '../../hooks/useApi';

interface ClientOnboardingProps {
  onComplete: (client: Client) => void;
  onCancel: () => void;
}

const DOCUMENT_TYPES = [
  'GST Certificate',
  'PAN Card',
  'Business License',
  'Address Proof',
  'Bank Details',
  'Other'
];

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({
  onComplete,
  onCancel
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [clientData, setClientData] = useState<ClientFormData | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [portalAccess, setPortalAccess] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newDocument, setNewDocument] = useState<Partial<ClientDocument>>({
    document_type: '',
    document_name: '',
    file_url: ''
  });
  const [uploadProgress, setUploadProgress] = useState(0);

  const { execute: onboardClient } = useApi(clientService.onboard.bind(clientService));

  const steps = [
    'Client Information',
    'Document Collection',
    'Portal Setup',
    'Review & Complete'
  ];

  const handleClientSave = (client: ClientFormData) => {
    setClientData(client);
    setActiveStep(1);
  };

  const handleDocumentUpload = async (file: File) => {
    try {
      setUploadProgress(0);
      
      // Simulate file upload progress
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // In a real implementation, you would upload to your file storage service
      // For now, we'll simulate with a timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(uploadInterval);
      setUploadProgress(100);

      // Simulate getting a file URL back from the upload service
      const fileUrl = `https://storage.example.com/documents/${Date.now()}-${file.name}`;
      
      return fileUrl;
    } catch (err) {
      throw new Error('Failed to upload file');
    }
  };

  const handleAddDocument = async () => {
    if (!newDocument.document_type || !newDocument.document_name) {
      setError('Document type and name are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // In a real implementation, you would handle file upload here
      // For now, we'll just add the document to the list
      const document: ClientDocument = {
        id: Date.now().toString(),
        document_type: newDocument.document_type!,
        document_name: newDocument.document_name!,
        file_url: newDocument.file_url || `https://example.com/doc-${Date.now()}`,
        status: 'pending_review',
        uploaded_at: new Date().toISOString()
      };

      setDocuments(prev => [...prev, document]);
      setNewDocument({ document_type: '', document_name: '', file_url: '' });
      setUploadDialogOpen(false);
      setUploadProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDocument = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleComplete = async () => {
    if (!clientData) {
      setError('Client data is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const onboardingData: ClientOnboardingData = {
        client_data: clientData,
        documents,
        portal_access: portalAccess
      };

      const response = await onboardClient(onboardingData);
      onComplete(response.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPortalPassword(password);
  };

  const renderClientInformation = () => (
    <ClientForm
      onSave={handleClientSave}
      onCancel={onCancel}
    />
  );

  const renderDocumentCollection = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Document Collection
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Collect important documents from the client for compliance and record-keeping.
        Documents are optional but recommended for business clients.
      </Typography>

      {/* Document List */}
      {documents.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Uploaded Documents ({documents.length})
            </Typography>
            <List>
              {documents.map((doc, index) => (
                <ListItem
                  key={doc.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveDocument(doc.id!)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <DescriptionIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.document_name}
                    secondary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip label={doc.document_type} size="small" />
                        <Chip 
                          label={doc.status} 
                          size="small" 
                          color={doc.status === 'approved' ? 'success' : 'warning'}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Add Document Button */}
      <Button
        variant="outlined"
        startIcon={<CloudUploadIcon />}
        onClick={() => setUploadDialogOpen(true)}
        fullWidth
        sx={{ mb: 2 }}
      >
        Add Document
      </Button>

      {/* Navigation */}
      <Box display="flex" justifyContent="between" mt={3}>
        <Button onClick={() => setActiveStep(0)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setActiveStep(2)}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );

  const renderPortalSetup = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Client Portal Setup
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Set up secure portal access for your client to view projects, invoices, and communicate with you.
      </Typography>

      <Card>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={portalAccess}
                onChange={(e) => setPortalAccess(e.target.checked)}
              />
            }
            label="Enable Client Portal Access"
          />
          
          {portalAccess && (
            <Box mt={3}>
              <Grid container spacing={2} alignItems="end">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Portal Password"
                    type="password"
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    helperText="Client will use this password to access their portal"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    onClick={generateRandomPassword}
                    fullWidth
                  >
                    Generate Password
                  </Button>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  The client will receive an email with their portal login credentials after onboarding is complete.
                </Typography>
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Box display="flex" justifyContent="between" mt={3}>
        <Button onClick={() => setActiveStep(1)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setActiveStep(3)}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );

  const renderReviewAndComplete = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review & Complete Onboarding
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Review all information before completing the client onboarding process.
      </Typography>

      {/* Client Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Client Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>Name:</strong> {clientData?.name}
              </Typography>
              <Typography variant="body2">
                <strong>Email:</strong> {clientData?.email}
              </Typography>
              <Typography variant="body2">
                <strong>Phone:</strong> {clientData?.phone}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>Company:</strong> {clientData?.company_name || 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Country:</strong> {clientData?.country}
              </Typography>
              <Typography variant="body2">
                <strong>Currency:</strong> {clientData?.default_currency}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Documents Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Documents ({documents.length})
          </Typography>
          {documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No documents uploaded
            </Typography>
          ) : (
            <List dense>
              {documents.map((doc) => (
                <ListItem key={doc.id}>
                  <ListItemText
                    primary={doc.document_name}
                    secondary={doc.document_type}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Portal Access Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <VpnKeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Portal Access
          </Typography>
          <Typography variant="body2">
            <strong>Status:</strong> {portalAccess ? 'Enabled' : 'Disabled'}
          </Typography>
          {portalAccess && (
            <Typography variant="body2">
              <strong>Password:</strong> {portalPassword ? '••••••••••••' : 'Not set'}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Next Steps
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Client will be created in the system" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Documents will be stored for review" />
            </ListItem>
            {portalAccess && (
              <ListItem>
                <ListItemText primary="Client will receive portal access credentials via email" />
              </ListItem>
            )}
            <ListItem>
              <ListItemText primary="You can start creating projects and invoices" />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Navigation */}
      <Box display="flex" justifyContent="between" mt={3}>
        <Button onClick={() => setActiveStep(2)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleComplete}
          disabled={loading}
          startIcon={<CheckCircleIcon />}
        >
          Complete Onboarding
        </Button>
      </Box>
    </Box>
  );

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderClientInformation();
      case 1:
        return renderDocumentCollection();
      case 2:
        return renderPortalSetup();
      case 3:
        return renderReviewAndComplete();
      default:
        return null;
    }
  };

  if (loading && activeStep !== 0) {
    return <LoadingOverlay message="Processing onboarding..." />;
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
            Client Onboarding
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      {activeStep > 0 && (
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
      )}

      {/* Step Content */}
      <Box>
        {renderStepContent(activeStep)}
      </Box>

      {/* Document Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Document</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Document Type"
                value={newDocument.document_type}
                onChange={(e) => setNewDocument(prev => ({ ...prev, document_type: e.target.value }))}
                SelectProps={{ native: true }}
                margin="normal"
              >
                <option value="">Select document type</option>
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Document Name"
                value={newDocument.document_name}
                onChange={(e) => setNewDocument(prev => ({ ...prev, document_name: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="File URL"
                value={newDocument.file_url}
                onChange={(e) => setNewDocument(prev => ({ ...prev, file_url: e.target.value }))}
                helperText="In a real implementation, this would be a file upload"
                margin="normal"
              />
            </Grid>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Grid item xs={12}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="text.secondary">
                  Uploading... {uploadProgress}%
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddDocument} variant="contained" disabled={loading}>
            Add Document
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientOnboarding;