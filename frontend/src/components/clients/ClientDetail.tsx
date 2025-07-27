import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  AccountBalance as AccountBalanceIcon,
  Assignment as AssignmentIcon,
  Receipt as ReceiptIcon,
  Chat as ChatIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  VpnKey as VpnKeyIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import LoadingOverlay from '../layout/LoadingOverlay';
import { CustomLineChart, CustomBarChart, CustomPieChart } from '../common/Charts';
import { clientService } from '../../services/api';
import { Client, ClientActivity, ClientCommunication } from '../../types/client';
import { Project } from '../../types/project';
import { Invoice } from '../../types/invoice';
import { useApi } from '../../hooks/useApi';

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
  onEdit: (client: Client) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const ClientDetail: React.FC<ClientDetailProps> = ({
  clientId,
  onBack,
  onEdit
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [communications, setCommunications] = useState<ClientCommunication[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalEnabled, setPortalEnabled] = useState(false);

  const { execute: fetchClient } = useApi(clientService.get.bind(clientService));
  const { execute: fetchActivities } = useApi(clientService.getActivities.bind(clientService));
  const { execute: updatePortalAccess } = useApi(clientService.updatePortalAccess.bind(clientService));

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch client details with related data
      const clientData = await fetchClient(clientId);
      setClient(clientData.client);
      setProjects(clientData.projects.all || []);
      setInvoices(clientData.invoices.all || []);
      setCommunications(clientData.communications.recent || []);
      setPortalEnabled(clientData.client.portal_access_enabled || false);

      // Fetch activities
      const activitiesData = await fetchActivities(clientId, { limit: 20 });
      setActivities(activitiesData.activities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const handlePortalAccessUpdate = async () => {
    try {
      await updatePortalAccess(clientId, {
        enabled: portalEnabled,
        password: portalPassword || undefined
      });
      
      setPortalDialogOpen(false);
      setPortalPassword('');
      loadClientData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update portal access');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
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

  const renderOverview = () => (
    <Grid container spacing={3}>
      {/* Client Information */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon />
                </ListItemIcon>
                <ListItemText primary="Email" secondary={client?.email} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PhoneIcon />
                </ListItemIcon>
                <ListItemText primary="Phone" secondary={client?.phone} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <LocationIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Address" 
                  secondary={`${client?.address}, ${client?.city}, ${client?.state}, ${client?.country} ${client?.postal_code}`} 
                />
              </ListItem>
              {client?.contact_person && (
                <ListItem>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary="Contact Person" secondary={client.contact_person} />
                </ListItem>
              )}
              {client?.website && (
                <ListItem>
                  <ListItemIcon>
                    <BusinessIcon />
                  </ListItemIcon>
                  <ListItemText primary="Website" secondary={client.website} />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Business Information */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Business Information
            </Typography>
            <List>
              {client?.gstin && (
                <ListItem>
                  <ListItemIcon>
                    <AccountBalanceIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="GSTIN" 
                    secondary={client.gstin}
                    secondaryTypographyProps={{
                      color: client.gst_compliant ? 'success.main' : 'error.main'
                    }}
                  />
                </ListItem>
              )}
              {client?.pan && (
                <ListItem>
                  <ListItemIcon>
                    <AccountBalanceIcon />
                  </ListItemIcon>
                  <ListItemText primary="PAN" secondary={client.pan} />
                </ListItem>
              )}
              <ListItem>
                <ListItemIcon>
                  <ReceiptIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Payment Terms" 
                  secondary={`${client?.payment_terms} (${client?.payment_terms_days} days)`} 
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <TrendingUpIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Default Currency" 
                  secondary={client?.default_currency} 
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Financial Summary */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Financial Summary
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(client?.paid_amount || 0, client?.default_currency)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Paid
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {formatCurrency(client?.outstanding_amount || 0, client?.default_currency)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Outstanding
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary.main">
                    {client?.active_projects || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Projects
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {client?.overdue_invoices || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overdue Invoices
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderProjects = () => (
    <Box>
      {projects.length === 0 ? (
        <Alert severity="info">No projects found for this client.</Alert>
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid item xs={12} md={6} key={project.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="between" alignItems="start" mb={2}>
                    <Typography variant="h6">{project.name}</Typography>
                    <Chip 
                      label={project.status} 
                      color={project.status === 'active' ? 'primary' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {project.description}
                  </Typography>
                  <Box display="flex" justifyContent="between" alignItems="center">
                    <Typography variant="body2">
                      Budget: {formatCurrency(project.budget || 0, client?.default_currency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due: {new Date(project.end_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const renderInvoices = () => (
    <Box>
      {invoices.length === 0 ? (
        <Alert severity="info">No invoices found for this client.</Alert>
      ) : (
        <List>
          {invoices.map((invoice, index) => (
            <React.Fragment key={invoice.id}>
              <ListItem>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="between" alignItems="center">
                      <Typography variant="subtitle1">
                        {invoice.invoice_number}
                      </Typography>
                      <Chip 
                        label={invoice.status} 
                        color={
                          invoice.status === 'paid' ? 'success' :
                          invoice.status === 'overdue' ? 'error' : 'warning'
                        }
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        Amount: {formatCurrency(invoice.total_amount, client?.default_currency)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < invoices.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  const renderCommunications = () => (
    <Box>
      {communications.length === 0 ? (
        <Alert severity="info">No communications found for this client.</Alert>
      ) : (
        <List>
          {communications.map((comm, index) => (
            <React.Fragment key={comm.id}>
              <ListItem>
                <ListItemIcon>
                  <ChatIcon />
                </ListItemIcon>
                <ListItemText
                  primary={comm.subject}
                  secondary={
                    <Box>
                      <Typography variant="body2" paragraph>
                        {comm.message.substring(0, 100)}...
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        From: {comm.sender_name} • {new Date(comm.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < communications.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  const renderActivities = () => (
    <Box>
      {activities.length === 0 ? (
        <Alert severity="info">No activities found for this client.</Alert>
      ) : (
        <List>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <ListItem>
                <ListItemIcon>
                  <HistoryIcon />
                </ListItemIcon>
                <ListItemText
                  primary={activity.activity.replace(/_/g, ' ').toUpperCase()}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {activity.formatted_time}
                      </Typography>
                      {Object.keys(activity.metadata).length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
              {index < activities.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  if (loading) {
    return <LoadingOverlay message="Loading client details..." />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!client) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Client not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ width: 56, height: 56 }}>
            {client.company_name ? <BusinessIcon /> : <PersonIcon />}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {client.name}
            </Typography>
            {client.company_name && (
              <Typography variant="subtitle1" color="text.secondary">
                {client.company_name}
              </Typography>
            )}
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              {getStatusChip(client)}
              {client.portal_access_enabled && (
                <Chip 
                  label="Portal Access" 
                  color="info" 
                  size="small" 
                  icon={<VpnKeyIcon />} 
                />
              )}
            </Box>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<SecurityIcon />}
            onClick={() => setPortalDialogOpen(true)}
          >
            Portal Access
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onEdit(client)}
          >
            Edit Client
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label={`Projects (${projects.length})`} />
          <Tab label={`Invoices (${invoices.length})`} />
          <Tab label={`Communications (${communications.length})`} />
          <Tab label={`Activities (${activities.length})`} />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {renderOverview()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderProjects()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderInvoices()}
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          {renderCommunications()}
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          {renderActivities()}
        </TabPanel>
      </Card>

      {/* Portal Access Dialog */}
      <Dialog open={portalDialogOpen} onClose={() => setPortalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Client Portal Access</DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={portalEnabled}
                  onChange={(e) => setPortalEnabled(e.target.checked)}
                />
              }
              label="Enable Portal Access"
            />
          </Box>
          {portalEnabled && (
            <TextField
              fullWidth
              label="Portal Password"
              type="password"
              value={portalPassword}
              onChange={(e) => setPortalPassword(e.target.value)}
              helperText="Leave empty to keep existing password"
              margin="normal"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPortalDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePortalAccessUpdate} variant="contained">
            Update Access
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetail;