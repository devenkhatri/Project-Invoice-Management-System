import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Preview,
  Star,
  StarBorder,
  Palette,
} from '@mui/icons-material';
import { InvoiceTemplate } from '../../types/invoice';

const InvoiceTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    layout: 'standard' as 'standard' | 'modern' | 'minimal',
    primary_color: '#1976d2',
    secondary_color: '#f5f5f5',
    text_color: '#333333',
    heading_font: 'Arial',
    body_font: 'Arial',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_gstin: '',
    show_payment_terms: true,
    show_notes: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockTemplates: InvoiceTemplate[] = [
        {
          id: '1',
          name: 'Standard Template',
          description: 'Clean and professional invoice template',
          template_data: {
            company_name: 'Your Company Name',
            company_address: 'Your Address',
            company_phone: '+91-XXXXXXXXXX',
            company_email: 'your-email@company.com',
            company_gstin: 'YOUR_GSTIN_NUMBER',
            colors: {
              primary: '#1976d2',
              secondary: '#f5f5f5',
              text: '#333333',
            },
            fonts: {
              heading: 'Arial',
              body: 'Arial',
            },
            layout: 'standard',
            show_payment_terms: true,
            show_notes: true,
            custom_fields: [],
          },
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Modern Template',
          description: 'Modern design with bold colors',
          template_data: {
            company_name: 'Your Company Name',
            company_address: 'Your Address',
            company_phone: '+91-XXXXXXXXXX',
            company_email: 'your-email@company.com',
            colors: {
              primary: '#2196f3',
              secondary: '#e3f2fd',
              text: '#1a1a1a',
            },
            fonts: {
              heading: 'Roboto',
              body: 'Roboto',
            },
            layout: 'modern',
            show_payment_terms: true,
            show_notes: true,
            custom_fields: [],
          },
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      showSnackbar('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      layout: 'standard',
      primary_color: '#1976d2',
      secondary_color: '#f5f5f5',
      text_color: '#333333',
      heading_font: 'Arial',
      body_font: 'Arial',
      company_name: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      company_gstin: '',
      show_payment_terms: true,
      show_notes: true,
    });
    setDialogOpen(true);
  };

  const handleEditTemplate = (template: InvoiceTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      layout: template.template_data.layout,
      primary_color: template.template_data.colors.primary,
      secondary_color: template.template_data.colors.secondary,
      text_color: template.template_data.colors.text,
      heading_font: template.template_data.fonts.heading,
      body_font: template.template_data.fonts.body,
      company_name: template.template_data.company_name,
      company_address: template.template_data.company_address,
      company_phone: template.template_data.company_phone,
      company_email: template.template_data.company_email,
      company_gstin: template.template_data.company_gstin || '',
      show_payment_terms: template.template_data.show_payment_terms,
      show_notes: template.template_data.show_notes,
    });
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const templateData: Omit<InvoiceTemplate, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        description: formData.description,
        template_data: {
          company_name: formData.company_name,
          company_address: formData.company_address,
          company_phone: formData.company_phone,
          company_email: formData.company_email,
          company_gstin: formData.company_gstin,
          colors: {
            primary: formData.primary_color,
            secondary: formData.secondary_color,
            text: formData.text_color,
          },
          fonts: {
            heading: formData.heading_font,
            body: formData.body_font,
          },
          layout: formData.layout,
          show_payment_terms: formData.show_payment_terms,
          show_notes: formData.show_notes,
          custom_fields: [],
        },
        is_default: false,
      };

      if (selectedTemplate) {
        // Update existing template
        const updatedTemplate = {
          ...selectedTemplate,
          ...templateData,
          updated_at: new Date().toISOString(),
        };
        setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
        showSnackbar('Template updated successfully', 'success');
      } else {
        // Create new template
        const newTemplate: InvoiceTemplate = {
          ...templateData,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setTemplates(prev => [...prev, newTemplate]);
        showSnackbar('Template created successfully', 'success');
      }

      setDialogOpen(false);
    } catch (error) {
      showSnackbar('Failed to save template', 'error');
    }
  };

  const handleDeleteTemplate = async (template: InvoiceTemplate) => {
    if (template.is_default) {
      showSnackbar('Cannot delete default template', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
        showSnackbar('Template deleted successfully', 'success');
      } catch (error) {
        showSnackbar('Failed to delete template', 'error');
      }
    }
  };

  const handleSetDefault = async (template: InvoiceTemplate) => {
    try {
      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === template.id,
      })));
      showSnackbar('Default template updated', 'success');
    } catch (error) {
      showSnackbar('Failed to update default template', 'error');
    }
  };

  const getLayoutPreview = (layout: string) => {
    switch (layout) {
      case 'modern':
        return '🎨 Modern';
      case 'minimal':
        return '📄 Minimal';
      default:
        return '📋 Standard';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Invoice Templates
        </Typography>
        <Button
          startIcon={<Add />}
          onClick={handleCreateTemplate}
          variant="contained"
        >
          Create Template
        </Button>
      </Box>

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h2">
                    {template.name}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    {template.is_default && (
                      <Chip label="Default" color="primary" size="small" />
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleSetDefault(template)}
                      color={template.is_default ? 'primary' : 'default'}
                    >
                      {template.is_default ? <Star /> : <StarBorder />}
                    </IconButton>
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {template.description}
                </Typography>

                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">
                    Layout: {getLayoutPreview(template.template_data.layout)}
                  </Typography>
                </Box>

                {/* Color Preview */}
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Typography variant="caption" color="text.secondary">
                    Colors:
                  </Typography>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: template.template_data.colors.primary,
                      border: '1px solid #ccc',
                    }}
                  />
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: template.template_data.colors.secondary,
                      border: '1px solid #ccc',
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Company: {template.template_data.company_name}
                </Typography>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<Preview />}
                  onClick={() => {/* Preview functionality */}}
                >
                  Preview
                </Button>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => handleEditTemplate(template)}
                >
                  Edit
                </Button>
                {!template.is_default && (
                  <Button
                    size="small"
                    startIcon={<Delete />}
                    onClick={() => handleDeleteTemplate(template)}
                    color="error"
                  >
                    Delete
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Basic Info */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Layout</InputLabel>
                <Select
                  value={formData.layout}
                  onChange={(e) => setFormData({ ...formData, layout: e.target.value as any })}
                  label="Layout"
                >
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="modern">Modern</MenuItem>
                  <MenuItem value="minimal">Minimal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>

            {/* Company Info */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Company Information
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Email"
                value={formData.company_email}
                onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Phone"
                value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="GSTIN"
                value={formData.company_gstin}
                onChange={(e) => setFormData({ ...formData, company_gstin: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Company Address"
                multiline
                rows={2}
                value={formData.company_address}
                onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
              />
            </Grid>

            {/* Colors */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Colors & Fonts
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Primary Color"
                type="color"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Secondary Color"
                type="color"
                value={formData.secondary_color}
                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Text Color"
                type="color"
                value={formData.text_color}
                onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Heading Font</InputLabel>
                <Select
                  value={formData.heading_font}
                  onChange={(e) => setFormData({ ...formData, heading_font: e.target.value })}
                  label="Heading Font"
                >
                  <MenuItem value="Arial">Arial</MenuItem>
                  <MenuItem value="Roboto">Roboto</MenuItem>
                  <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                  <MenuItem value="Helvetica">Helvetica</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Body Font</InputLabel>
                <Select
                  value={formData.body_font}
                  onChange={(e) => setFormData({ ...formData, body_font: e.target.value })}
                  label="Body Font"
                >
                  <MenuItem value="Arial">Arial</MenuItem>
                  <MenuItem value="Roboto">Roboto</MenuItem>
                  <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                  <MenuItem value="Helvetica">Helvetica</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            {selectedTemplate ? 'Update' : 'Create'} Template
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

export default InvoiceTemplates;