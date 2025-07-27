import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Print,
  GetApp,
  Send,
  Edit,
  Close,
  Payment,
  Share,
  FileCopy,
} from '@mui/icons-material';
import { Invoice, InvoiceStatus, PaymentStatus } from '../../types/invoice';
import { invoiceService } from '../../services/api';

interface InvoicePreviewProps {
  invoice: Invoice;
  onEdit?: () => void;
  onClose?: () => void;
  showActions?: boolean;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice,
  onEdit,
  onClose,
  showActions = true,
}) => {
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const printRef = useRef<HTMLDivElement>(null);

  const [emailData, setEmailData] = useState({
    email: invoice.client?.email || '',
    subject: `Invoice ${invoice.invoice_number}`,
    message: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: invoice.remaining_amount?.toString() || '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
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
      month: 'long',
      day: 'numeric',
    });
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

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      const pdfBlob = await invoiceService.generatePdf(invoice.id);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSnackbar('PDF downloaded successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to download PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    try {
      setLoading(true);
      await invoiceService.post(emailData, `${invoice.id}/send`);
      showSnackbar('Invoice sent successfully', 'success');
      setSendDialogOpen(false);
    } catch (error) {
      showSnackbar('Failed to send invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    try {
      setLoading(true);
      await invoiceService.post(paymentData, `${invoice.id}/payment`);
      showSnackbar('Payment recorded successfully', 'success');
      setPaymentDialogOpen(false);
    } catch (error) {
      showSnackbar('Failed to record payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
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
    } catch (error) {
      showSnackbar('Failed to duplicate invoice', 'error');
    }
  };

  return (
    <Box>
      {/* Action Bar */}
      {showActions && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                color={getStatusColor(invoice.status)}
              />
              {invoice.is_overdue && (
                <Chip label={`${invoice.days_overdue} days overdue`} color="error" size="small" />
              )}
              {invoice.is_recurring && (
                <Chip label="Recurring" color="info" size="small" />
              )}
            </Box>
            
            <Box display="flex" gap={1}>
              {onClose && (
                <IconButton onClick={onClose}>
                  <Close />
                </IconButton>
              )}
              <Button startIcon={<Print />} onClick={handlePrint} variant="outlined">
                Print
              </Button>
              <Button startIcon={<GetApp />} onClick={handleDownloadPDF} variant="outlined" disabled={loading}>
                Download PDF
              </Button>
              <Button startIcon={<FileCopy />} onClick={handleDuplicate} variant="outlined">
                Duplicate
              </Button>
              {invoice.status !== InvoiceStatus.PAID && (
                <Button
                  startIcon={<Payment />}
                  onClick={() => setPaymentDialogOpen(true)}
                  variant="outlined"
                  color="success"
                >
                  Record Payment
                </Button>
              )}
              <Button startIcon={<Send />} onClick={() => setSendDialogOpen(true)} variant="outlined">
                Send
              </Button>
              {onEdit && (
                <Button startIcon={<Edit />} onClick={onEdit} variant="contained">
                  Edit
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Invoice Content */}
      <Paper ref={printRef} sx={{ p: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
          <Box>
            <Typography variant="h3" color="primary" gutterBottom>
              INVOICE
            </Typography>
            <Typography variant="h6" gutterBottom>
              Your Company Name
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your Address Line 1<br />
              Your Address Line 2<br />
              Phone: +91-XXXXXXXXXX<br />
              Email: your-email@company.com<br />
              GSTIN: YOUR_GSTIN_NUMBER
            </Typography>
          </Box>
          
          <Box textAlign="right">
            <Typography variant="h6" gutterBottom>
              Invoice #{invoice.invoice_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Issue Date: {formatDate(invoice.issue_date)}<br />
              Due Date: {formatDate(invoice.due_date)}<br />
              Currency: {invoice.currency}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Client Information */}
        <Grid container spacing={4} mb={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Bill To:
            </Typography>
            <Typography variant="body1" gutterBottom>
              {invoice.client?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.client?.address}
              {invoice.client?.gstin && (
                <>
                  <br />
                  GSTIN: {invoice.client.gstin}
                </>
              )}
            </Typography>
          </Grid>
          
          {invoice.project && (
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Project:
              </Typography>
              <Typography variant="body1">
                {invoice.project.name}
              </Typography>
            </Grid>
          )}
        </Grid>

        {/* Line Items */}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Qty</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="center">Tax%</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.line_items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.description}</Typography>
                    {item.hsn_sac_code && (
                      <Typography variant="caption" color="text.secondary">
                        HSN/SAC: {item.hsn_sac_code}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(item.unit_price, invoice.currency)}
                  </TableCell>
                  <TableCell align="center">{item.tax_rate}%</TableCell>
                  <TableCell align="right">
                    {formatCurrency(item.total_price, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Totals */}
        <Grid container justifyContent="flex-end">
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Subtotal:</Typography>
                  <Typography>{formatCurrency(invoice.subtotal, invoice.currency)}</Typography>
                </Box>
                
                {/* Tax Breakdown */}
                {invoice.tax_breakdown.cgst_amount > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>CGST ({invoice.tax_breakdown.cgst_rate}%):</Typography>
                    <Typography>{formatCurrency(invoice.tax_breakdown.cgst_amount, invoice.currency)}</Typography>
                  </Box>
                )}
                
                {invoice.tax_breakdown.sgst_amount > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>SGST ({invoice.tax_breakdown.sgst_rate}%):</Typography>
                    <Typography>{formatCurrency(invoice.tax_breakdown.sgst_amount, invoice.currency)}</Typography>
                  </Box>
                )}
                
                {invoice.tax_breakdown.igst_amount > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>IGST ({invoice.tax_breakdown.igst_rate}%):</Typography>
                    <Typography>{formatCurrency(invoice.tax_breakdown.igst_amount, invoice.currency)}</Typography>
                  </Box>
                )}

                {/* Discount */}
                {invoice.discount_amount && invoice.discount_amount > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Discount:</Typography>
                    <Typography color="success.main">
                      -{formatCurrency(invoice.discount_amount, invoice.currency)}
                    </Typography>
                  </Box>
                )}

                {/* Late Fee */}
                {invoice.late_fee_applied && invoice.late_fee_applied > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Late Fee:</Typography>
                    <Typography color="error.main">
                      {formatCurrency(invoice.late_fee_applied, invoice.currency)}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />
                
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">Total Amount:</Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </Typography>
                </Box>

                {/* Payment Information */}
                {invoice.paid_amount > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Amount Paid:</Typography>
                      <Typography color="success.main">
                        {formatCurrency(invoice.paid_amount, invoice.currency)}
                      </Typography>
                    </Box>
                    {invoice.remaining_amount && invoice.remaining_amount > 0 && (
                      <Box display="flex" justifyContent="space-between">
                        <Typography fontWeight="medium">Amount Due:</Typography>
                        <Typography fontWeight="medium" color="error.main">
                          {formatCurrency(invoice.remaining_amount, invoice.currency)}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Payment Terms */}
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Payment Terms:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {invoice.payment_terms}
          </Typography>
        </Box>

        {/* Notes */}
        {invoice.notes && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              Notes:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.notes}
            </Typography>
          </Box>
        )}

        {/* Terms and Conditions */}
        {invoice.terms_conditions && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              Terms and Conditions:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.terms_conditions}
            </Typography>
          </Box>
        )}

        {/* Footer */}
        <Box mt={6} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Thank you for your business!
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This is a computer generated invoice.
          </Typography>
        </Box>
      </Paper>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Invoice</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={emailData.email}
                onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message"
                multiline
                rows={4}
                value={emailData.message}
                onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                placeholder="Optional custom message..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSendInvoice} variant="contained" disabled={loading}>
            Send Invoice
          </Button>
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
          <Button onClick={handleRecordPayment} variant="contained" disabled={loading}>
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

export default InvoicePreview;