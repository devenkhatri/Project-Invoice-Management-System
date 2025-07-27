import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview';
import InvoiceAnalytics from './InvoiceAnalytics';
import InvoiceTemplates from './InvoiceTemplates';
import { Invoice } from '../../types/invoice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`invoice-tabpanel-${index}`}
      aria-labelledby={`invoice-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const InvoiceManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [currentView, setCurrentView] = useState<'list' | 'form' | 'preview'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setCurrentView('list');
    setSelectedInvoice(null);
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setCurrentView('form');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView('form');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView('preview');
  };

  const handleSaveInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView('preview');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedInvoice(null);
  };

  const renderInvoiceContent = () => {
    switch (currentView) {
      case 'form':
        return (
          <InvoiceForm
            invoice={selectedInvoice || undefined}
            onSave={handleSaveInvoice}
            onCancel={handleBackToList}
            onPreview={handleViewInvoice}
          />
        );
      case 'preview':
        return (
          <InvoicePreview
            invoice={selectedInvoice!}
            onEdit={() => handleEditInvoice(selectedInvoice!)}
            onClose={handleBackToList}
          />
        );
      default:
        return (
          <InvoiceList
            onCreateInvoice={handleCreateInvoice}
            onEditInvoice={handleEditInvoice}
            onViewInvoice={handleViewInvoice}
          />
        );
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="invoice management tabs">
          <Tab label="Invoices" />
          <Tab label="Analytics" />
          <Tab label="Templates" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {renderInvoiceContent()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <InvoiceAnalytics />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <InvoiceTemplates />
      </TabPanel>
    </Box>
  );
};

export default InvoiceManagement;