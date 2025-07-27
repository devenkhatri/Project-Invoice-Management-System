import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Grid,
  TextField,
  Chip,
  LinearProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import {
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Description as CsvIcon,
} from '@mui/icons-material';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  reportType: 'financial' | 'project' | 'client';
}

interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  dateRange: {
    start: Dayjs;
    end: Dayjs;
  };
  includeCharts: boolean;
  includeRawData: boolean;
  includeSummary: boolean;
  customFields: string[];
  filters: {
    clients?: string[];
    projects?: string[];
    status?: string[];
  };
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  reportType,
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    dateRange: {
      start: dayjs().subtract(30, 'days'),
      end: dayjs(),
    },
    includeCharts: true,
    includeRawData: false,
    includeSummary: true,
    customFields: [],
    filters: {},
  });
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const formatOptions = [
    {
      value: 'pdf',
      label: 'PDF Report',
      icon: <PdfIcon />,
      description: 'Professional formatted report with charts and branding',
    },
    {
      value: 'excel',
      label: 'Excel Workbook',
      icon: <ExcelIcon />,
      description: 'Spreadsheet with multiple sheets, formulas, and pivot tables',
    },
    {
      value: 'csv',
      label: 'CSV Data',
      icon: <CsvIcon />,
      description: 'Raw data export for analysis and integration',
    },
  ];

  const getReportTitle = () => {
    switch (reportType) {
      case 'financial':
        return 'Financial Report';
      case 'project':
        return 'Project Analytics Report';
      case 'client':
        return 'Client Analysis Report';
      default:
        return 'Report';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);

    try {
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete progress
      setExportProgress(100);
      
      // Simulate file download
      const filename = `${reportType}-report-${dayjs().format('YYYY-MM-DD')}.${options.format}`;
      
      // In a real implementation, you would:
      // 1. Call the export API with the options
      // 2. Receive the file blob or download URL
      // 3. Trigger the download
      
      console.log('Exporting report:', {
        reportType,
        options,
        filename,
      });

      // Reset and close
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
        onClose();
      }, 500);

    } catch (error) {
      console.error('Export failed:', error);
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleCancel = () => {
    if (!exporting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>Export {getReportTitle()}</DialogTitle>
      
      <DialogContent>
        {exporting ? (
          <Box sx={{ py: 4 }}>
            <Typography variant="h6" align="center" sx={{ mb: 2 }}>
              Generating Report...
            </Typography>
            <LinearProgress
              variant="determinate"
              value={exportProgress}
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" align="center" color="text.secondary">
              {exportProgress < 30 ? 'Collecting data...' :
               exportProgress < 60 ? 'Processing charts...' :
               exportProgress < 90 ? 'Formatting report...' :
               'Finalizing export...'}
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Format Selection */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Export Format
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {formatOptions.map((format) => (
                <Grid item xs={12} md={4} key={format.value}>
                  <Box
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: options.format === format.value ? 'primary.main' : 'grey.300',
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: options.format === format.value ? 'primary.light' : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => setOptions(prev => ({ ...prev, format: format.value as any }))}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {format.icon}
                      <Typography variant="subtitle2">
                        {format.label}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {format.description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Date Range */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Date Range
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <DatePicker
                  label="Start Date"
                  value={options.dateRange.start}
                  onChange={(date) => date && setOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: date }
                  }))}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <DatePicker
                  label="End Date"
                  value={options.dateRange.end}
                  onChange={(date) => date && setOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: date }
                  }))}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </Grid>

            {/* Content Options */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Content Options
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeSummary}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      includeSummary: e.target.checked
                    }))}
                  />
                }
                label="Include Executive Summary"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeCharts}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      includeCharts: e.target.checked
                    }))}
                    disabled={options.format === 'csv'}
                  />
                }
                label="Include Charts and Visualizations"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeRawData}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      includeRawData: e.target.checked
                    }))}
                  />
                }
                label="Include Raw Data Tables"
              />
            </Box>

            {/* Advanced Options */}
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Advanced Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Custom Report Title"
                  placeholder={`${getReportTitle()} - ${dayjs().format('MMMM YYYY')}`}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="Additional Notes"
                  placeholder="Add any additional notes or context for this report..."
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;