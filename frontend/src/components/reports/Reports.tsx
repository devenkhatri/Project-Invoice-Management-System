import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Menu,
  MenuItem,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  GetApp as ExportIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import { FinancialReports } from './FinancialReports';
import { ProjectReports } from './ProjectReports';
import { ClientReports } from './ClientReports';
import { ExportDialog } from './ExportDialog';
import { ScheduleReportDialog } from './ScheduleReportDialog';

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
      id={`reports-tabpanel-${index}`}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

export const Reports: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleExportClick = () => {
    setExportDialogOpen(true);
    handleMenuClose();
  };

  const handleScheduleClick = () => {
    setScheduleDialogOpen(true);
    handleMenuClose();
  };

  const getActiveReportType = () => {
    switch (activeTab) {
      case 0:
        return 'financial';
      case 1:
        return 'project';
      case 2:
        return 'client';
      default:
        return 'financial';
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Reports & Analytics
        </Typography>
        
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportClick}
          >
            Export
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<ScheduleIcon />}
            onClick={handleScheduleClick}
          >
            Schedule
          </Button>
          
          <IconButton onClick={handleMenuClick}>
            <SettingsIcon />
          </IconButton>
          
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleExportClick}>
              <ExportIcon sx={{ mr: 1 }} />
              Export Current Report
            </MenuItem>
            <MenuItem onClick={handleScheduleClick}>
              <ScheduleIcon sx={{ mr: 1 }} />
              Schedule Reports
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <SettingsIcon sx={{ mr: 1 }} />
              Report Settings
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Report Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            px: 2,
          }}
        >
          <Tab label="Financial Reports" />
          <Tab label="Project Analytics" />
          <Tab label="Client Analysis" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <FinancialReports />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ProjectReports />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ClientReports />
        </TabPanel>
      </Paper>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        reportType={getActiveReportType()}
      />

      {/* Schedule Report Dialog */}
      <ScheduleReportDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        reportType={getActiveReportType()}
      />
    </Box>
  );
};

export default Reports;