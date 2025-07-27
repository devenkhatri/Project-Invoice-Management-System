import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
  settings?: Record<string, any>;
}

interface WidgetCustomizerProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customizer-tabpanel-${index}`}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const WidgetCustomizer: React.FC<WidgetCustomizerProps> = ({
  open,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      id: 'kpi-widgets',
      name: 'KPI Widgets',
      enabled: true,
      order: 1,
      size: 'large',
    },
    {
      id: 'financial-charts',
      name: 'Financial Charts',
      enabled: true,
      order: 2,
      size: 'large',
    },
    {
      id: 'project-overview',
      name: 'Project Overview',
      enabled: true,
      order: 3,
      size: 'medium',
    },
    {
      id: 'recent-activity',
      name: 'Recent Activity',
      enabled: true,
      order: 4,
      size: 'medium',
    },
    {
      id: 'quick-actions',
      name: 'Quick Actions',
      enabled: true,
      order: 5,
      size: 'small',
    },
  ]);

  const [dashboardSettings, setDashboardSettings] = useState({
    refreshInterval: 30,
    theme: 'light',
    compactMode: false,
    showAnimations: true,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleWidget = (widgetId: string) => {
    setWidgets(prev =>
      prev.map(widget =>
        widget.id === widgetId
          ? { ...widget, enabled: !widget.enabled }
          : widget
      )
    );
  };

  const updateWidgetSize = (widgetId: string, size: 'small' | 'medium' | 'large') => {
    setWidgets(prev =>
      prev.map(widget =>
        widget.id === widgetId ? { ...widget, size } : widget
      )
    );
  };

  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    setWidgets(prev => {
      const currentIndex = prev.findIndex(w => w.id === widgetId);
      if (
        (direction === 'up' && currentIndex === 0) ||
        (direction === 'down' && currentIndex === prev.length - 1)
      ) {
        return prev;
      }

      const newWidgets = [...prev];
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      [newWidgets[currentIndex], newWidgets[targetIndex]] = 
      [newWidgets[targetIndex], newWidgets[currentIndex]];

      return newWidgets.map((widget, index) => ({
        ...widget,
        order: index + 1,
      }));
    });
  };

  const handleSave = () => {
    // Save configuration to localStorage or API
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
    localStorage.setItem('dashboardSettings', JSON.stringify(dashboardSettings));
    onClose();
  };

  const handleReset = () => {
    // Reset to default configuration
    setWidgets([
      {
        id: 'kpi-widgets',
        name: 'KPI Widgets',
        enabled: true,
        order: 1,
        size: 'large',
      },
      {
        id: 'financial-charts',
        name: 'Financial Charts',
        enabled: true,
        order: 2,
        size: 'large',
      },
      {
        id: 'project-overview',
        name: 'Project Overview',
        enabled: true,
        order: 3,
        size: 'medium',
      },
      {
        id: 'recent-activity',
        name: 'Recent Activity',
        enabled: true,
        order: 4,
        size: 'medium',
      },
      {
        id: 'quick-actions',
        name: 'Quick Actions',
        enabled: true,
        order: 5,
        size: 'small',
      },
    ]);
    setDashboardSettings({
      refreshInterval: 30,
      theme: 'light',
      compactMode: false,
      showAnimations: true,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Customize Dashboard</DialogTitle>
      
      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Widget Layout" />
          <Tab label="Widget Settings" />
          <Tab label="Dashboard Settings" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag widgets to reorder them or toggle visibility
          </Typography>
          
          <List>
            {widgets.map((widget, index) => (
              <React.Fragment key={widget.id}>
                <ListItem>
                  <IconButton
                    size="small"
                    sx={{ mr: 1, cursor: 'grab' }}
                  >
                    <DragIcon />
                  </IconButton>
                  
                  <ListItemText
                    primary={widget.name}
                    secondary={`Order: ${widget.order} | Size: ${widget.size}`}
                  />
                  
                  <ListItemSecondaryAction>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Button
                        size="small"
                        onClick={() => moveWidget(widget.id, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        size="small"
                        onClick={() => moveWidget(widget.id, 'down')}
                        disabled={index === widgets.length - 1}
                      >
                        ↓
                      </Button>
                      <IconButton
                        onClick={() => toggleWidget(widget.id)}
                        color={widget.enabled ? 'primary' : 'default'}
                      >
                        {widget.enabled ? <VisibilityIcon /> : <VisibilityOffIcon />}
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < widgets.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            {widgets.map((widget) => (
              <Grid item xs={12} md={6} key={widget.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <SettingsIcon fontSize="small" />
                      <Typography variant="subtitle2">{widget.name}</Typography>
                    </Box>
                    
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Widget Size</InputLabel>
                      <Select
                        value={widget.size}
                        onChange={(e) => updateWidgetSize(widget.id, e.target.value as any)}
                        label="Widget Size"
                      >
                        <MenuItem value="small">Small</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="large">Large</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={widget.enabled}
                          onChange={() => toggleWidget(widget.id)}
                        />
                      }
                      label="Enabled"
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Auto Refresh Interval</InputLabel>
                <Select
                  value={dashboardSettings.refreshInterval}
                  onChange={(e) => setDashboardSettings(prev => ({
                    ...prev,
                    refreshInterval: e.target.value as number
                  }))}
                  label="Auto Refresh Interval"
                >
                  <MenuItem value={15}>15 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>1 minute</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                  <MenuItem value={0}>Disabled</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={dashboardSettings.theme}
                  onChange={(e) => setDashboardSettings(prev => ({
                    ...prev,
                    theme: e.target.value
                  }))}
                  label="Theme"
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={dashboardSettings.compactMode}
                    onChange={(e) => setDashboardSettings(prev => ({
                      ...prev,
                      compactMode: e.target.checked
                    }))}
                  />
                }
                label="Compact Mode"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={dashboardSettings.showAnimations}
                    onChange={(e) => setDashboardSettings(prev => ({
                      ...prev,
                      showAnimations: e.target.checked
                    }))}
                  />
                }
                label="Show Animations"
              />
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} color="warning">
          Reset to Default
        </Button>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WidgetCustomizer;