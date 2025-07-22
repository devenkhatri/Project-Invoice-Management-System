import { Invoice, Client, Project } from '../models';
import jsPDF from 'jspdf';

// Professional PDF generation for invoices
export async function generateInvoicePDF(
  invoice: Invoice, 
  client: Client, 
  project: Project
): Promise<Buffer> {
  const pdf = new jsPDF();
  
  // Set up fonts and colors
  pdf.setFont('helvetica');
  
  // Header
  pdf.setFontSize(24);
  pdf.setTextColor(0, 123, 255); // Blue color
  pdf.text('INVOICE', 20, 30);
  
  // Company info (right side)
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Your Company Name', 140, 20);
  pdf.text('Your Address', 140, 25);
  pdf.text('Your City, State, ZIP', 140, 30);
  pdf.text('Email: your@email.com', 140, 35);
  
  // Invoice details
  pdf.setFontSize(12);
  pdf.text(`Invoice #: ${invoice.invoice_number}`, 140, 45);
  pdf.text(`Date: ${invoice.created_at.toLocaleDateString()}`, 140, 50);
  pdf.text(`Due Date: ${invoice.due_date.toLocaleDateString()}`, 140, 55);
  
  // Status badge
  const statusColor = getStatusColor(invoice.status);
  pdf.setFillColor(statusColor.r, statusColor.g, statusColor.b);
  pdf.rect(140, 60, 30, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text(invoice.status.toUpperCase(), 142, 66);
  
  // Bill To section
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.text('Bill To:', 20, 70);
  pdf.setFontSize(10);
  pdf.text(client.name, 20, 80);
  pdf.text(client.email, 20, 85);
  if (client.phone) pdf.text(client.phone, 20, 90);
  if (client.address) pdf.text(client.address, 20, 95);
  if (client.gstin) pdf.text(`GSTIN: ${client.gstin}`, 20, 100);
  
  // Project info
  pdf.setFontSize(12);
  pdf.text('Project:', 20, 115);
  pdf.setFontSize(10);
  pdf.text(project.name, 20, 125);
  if (project.description) {
    const description = project.description.length > 50 
      ? project.description.substring(0, 50) + '...' 
      : project.description;
    pdf.text(description, 20, 130);
  }
  
  // Invoice table
  const tableY = 145;
  
  // Table header
  pdf.setFillColor(248, 249, 250);
  pdf.rect(20, tableY, 170, 10, 'F');
  pdf.setFontSize(10);
  pdf.text('Description', 25, tableY + 7);
  pdf.text('Qty', 120, tableY + 7);
  pdf.text('Rate', 140, tableY + 7);
  pdf.text('Amount', 165, tableY + 7);
  
  // Table content
  pdf.rect(20, tableY + 10, 170, 15);
  pdf.text(`Project Work - ${project.name}`, 25, tableY + 20);
  pdf.text('1', 120, tableY + 20);
  pdf.text(`₹${invoice.amount.toFixed(2)}`, 140, tableY + 20);
  pdf.text(`₹${invoice.amount.toFixed(2)}`, 165, tableY + 20);
  
  // Totals section
  const totalsY = tableY + 35;
  pdf.text('Subtotal:', 130, totalsY);
  pdf.text(`₹${invoice.amount.toFixed(2)}`, 165, totalsY);
  
  pdf.text(`Tax (${invoice.getTaxRate()}%):`, 130, totalsY + 8);
  pdf.text(`₹${invoice.tax_amount.toFixed(2)}`, 165, totalsY + 8);
  
  // Total line
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total:', 130, totalsY + 20);
  pdf.text(`₹${invoice.total_amount.toFixed(2)}`, 165, totalsY + 20);
  
  // Payment info
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const paymentY = totalsY + 35;
  pdf.text('Payment Information:', 20, paymentY);
  pdf.text(`Please make payment by ${invoice.due_date.toLocaleDateString()}.`, 20, paymentY + 8);
  
  if (invoice.isOverdue()) {
    pdf.setTextColor(220, 53, 69); // Red color
    pdf.text(`This invoice is ${invoice.getDaysOverdue()} days overdue.`, 20, paymentY + 16);
  } else {
    pdf.text(`Payment is due in ${invoice.getDaysUntilDue()} days.`, 20, paymentY + 16);
  }
  
  pdf.setTextColor(0, 0, 0);
  pdf.text('Thank you for your business!', 20, paymentY + 24);
  
  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(102, 102, 102);
  pdf.text(`Generated on ${new Date().toLocaleDateString()} | Invoice Management System`, 20, 280);
  
  return Buffer.from(pdf.output('arraybuffer'));
}

// Generate GST-compliant PDF
export async function generateGSTInvoicePDF(
  invoice: Invoice, 
  client: Client, 
  project: Project
): Promise<Buffer> {
  const pdf = new jsPDF();
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TAX INVOICE', 105, 20, { align: 'center' });
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Under GST)', 105, 28, { align: 'center' });
  
  // Company details
  pdf.setFontSize(10);
  pdf.text('Your Company Name', 20, 45);
  pdf.text('Your Address', 20, 50);
  pdf.text('City, State - PIN', 20, 55);
  pdf.text('GSTIN: YOUR_GSTIN_NUMBER', 20, 60);
  pdf.text('Email: your@email.com', 20, 65);
  pdf.text('Phone: +91-XXXXXXXXXX', 20, 70);
  
  // Invoice details (right side)
  pdf.text(`Invoice No: ${invoice.invoice_number}`, 140, 45);
  pdf.text(`Date: ${invoice.created_at.toLocaleDateString('en-IN')}`, 140, 50);
  pdf.text(`Due Date: ${invoice.due_date.toLocaleDateString('en-IN')}`, 140, 55);
  pdf.text('Place of Supply: Your State', 140, 60);
  pdf.text(`Status: ${invoice.status.toUpperCase()}`, 140, 65);
  
  // Bill To section
  pdf.rect(20, 80, 80, 35);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Bill To', 25, 88);
  pdf.setFont('helvetica', 'normal');
  pdf.text(client.name, 25, 95);
  pdf.text(client.address || 'Address not provided', 25, 100);
  pdf.text(`Email: ${client.email}`, 25, 105);
  if (client.phone) pdf.text(`Phone: ${client.phone}`, 25, 110);
  pdf.text(`GSTIN: ${client.gstin || 'Not Registered'}`, 25, 115);
  
  // Ship To section
  pdf.rect(110, 80, 80, 35);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Ship To', 115, 88);
  pdf.setFont('helvetica', 'normal');
  pdf.text(client.name, 115, 95);
  pdf.text(client.address || 'Same as billing address', 115, 100);
  pdf.text(`State: ${client.state || 'Not specified'}`, 115, 105);
  pdf.text(`PIN: ${client.pincode || 'Not specified'}`, 115, 110);
  
  // Invoice table
  const tableY = 125;
  
  // Table headers
  pdf.rect(20, tableY, 170, 10);
  pdf.setFontSize(8);
  pdf.text('S.No', 25, tableY + 7);
  pdf.text('Description', 40, tableY + 7);
  pdf.text('HSN/SAC', 100, tableY + 7);
  pdf.text('Qty', 120, tableY + 7);
  pdf.text('Unit', 135, tableY + 7);
  pdf.text('Rate', 150, tableY + 7);
  pdf.text('Amount', 170, tableY + 7);
  
  // Table content - use invoice items if available
  let rowY = tableY + 10;
  const rowHeight = 10;
  
  if (invoice.items && invoice.items.length > 0) {
    // Draw items from the invoice
    invoice.items.forEach((item, index) => {
      pdf.rect(20, rowY, 170, rowHeight);
      pdf.text((index + 1).toString(), 25, rowY + 7);
      pdf.text(item.description, 40, rowY + 7);
      pdf.text(item.hsn_sac || '998314', 100, rowY + 7);
      pdf.text(item.quantity.toString(), 120, rowY + 7);
      pdf.text(item.type === 'service' ? 'Service' : 'Unit', 135, rowY + 7);
      pdf.text(`₹${item.rate.toFixed(2)}`, 150, rowY + 7);
      pdf.text(`₹${item.amount.toFixed(2)}`, 170, rowY + 7);
      
      rowY += rowHeight;
    });
  } else {
    // Default single row with project name
    pdf.rect(20, rowY, 170, rowHeight);
    pdf.text('1', 25, rowY + 7);
    pdf.text(`Professional Services - ${project.name}`, 40, rowY + 7);
    pdf.text('998314', 100, rowY + 7);
    pdf.text('1', 120, rowY + 7);
    pdf.text('Service', 135, rowY + 7);
    pdf.text(`₹${invoice.amount.toFixed(2)}`, 150, rowY + 7);
    pdf.text(`₹${invoice.amount.toFixed(2)}`, 170, rowY + 7);
    
    rowY += rowHeight;
  }
  
  // Tax calculations
  const gstRate = invoice.getTaxRate();
  const isInterState = false; // Determine based on client state vs company state
  
  let taxBreakdown;
  if (isInterState) {
    // Inter-state: IGST only
    taxBreakdown = {
      igst: {
        rate: gstRate,
        amount: invoice.tax_amount
      }
    };
  } else {
    // Intra-state: CGST + SGST
    const halfRate = gstRate / 2;
    const halfAmount = invoice.tax_amount / 2;
    taxBreakdown = {
      cgst: {
        rate: halfRate,
        amount: halfAmount
      },
      sgst: {
        rate: halfRate,
        amount: halfAmount
      }
    };
  }
  
  // Totals table
  const totalsY = rowY + 10;
  pdf.setFontSize(10);
  
  pdf.rect(20, totalsY, 120, 8);
  pdf.text('Total Amount Before Tax', 25, totalsY + 6);
  pdf.rect(140, totalsY, 50, 8);
  pdf.text(`₹${invoice.amount.toFixed(2)}`, 165, totalsY + 6);
  
  let currentY = totalsY + 8;
  
  // Show appropriate tax breakdown
  if (taxBreakdown.cgst && taxBreakdown.sgst) {
    // CGST
    pdf.rect(20, currentY, 120, 8);
    pdf.text(`CGST @ ${taxBreakdown.cgst.rate}%`, 25, currentY + 6);
    pdf.rect(140, currentY, 50, 8);
    pdf.text(`₹${taxBreakdown.cgst.amount.toFixed(2)}`, 165, currentY + 6);
    currentY += 8;
    
    // SGST
    pdf.rect(20, currentY, 120, 8);
    pdf.text(`SGST @ ${taxBreakdown.sgst.rate}%`, 25, currentY + 6);
    pdf.rect(140, currentY, 50, 8);
    pdf.text(`₹${taxBreakdown.sgst.amount.toFixed(2)}`, 165, currentY + 6);
    currentY += 8;
  } else if (taxBreakdown.igst) {
    // IGST
    pdf.rect(20, currentY, 120, 8);
    pdf.text(`IGST @ ${taxBreakdown.igst.rate}%`, 25, currentY + 6);
    pdf.rect(140, currentY, 50, 8);
    pdf.text(`₹${taxBreakdown.igst.amount.toFixed(2)}`, 165, currentY + 6);
    currentY += 8;
  }
  
  // Total tax amount
  pdf.rect(20, currentY, 120, 8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total Tax Amount', 25, currentY + 6);
  pdf.rect(140, currentY, 50, 8);
  pdf.text(`₹${invoice.tax_amount.toFixed(2)}`, 165, currentY + 6);
  currentY += 8;
  
  // Total amount after tax
  pdf.rect(20, currentY, 120, 8);
  pdf.text('Total Amount After Tax', 25, currentY + 6);
  pdf.rect(140, currentY, 50, 8);
  pdf.text(`₹${invoice.total_amount.toFixed(2)}`, 165, currentY + 6);
  currentY += 8;
  
  // Amount in words
  pdf.setFont('helvetica', 'normal');
  pdf.rect(20, currentY + 5, 170, 15);
  pdf.text(`Amount in Words: ${numberToWords(invoice.total_amount)} Rupees Only`, 25, currentY + 15);
  
  // Bank details
  currentY += 25;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Bank Details:', 20, currentY);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Bank Name: YOUR BANK', 20, currentY + 5);
  pdf.text('Account Number: XXXXXXXXXXXX', 20, currentY + 10);
  pdf.text('IFSC Code: XXXXXXXX', 20, currentY + 15);
  pdf.text('Branch: Your Branch', 20, currentY + 20);
  
  // Terms and signature
  currentY += 30;
  pdf.setFontSize(8);
  pdf.text('Terms & Conditions:', 20, currentY);
  pdf.text(`1. Payment due within ${invoice.getDaysUntilDue()} days`, 20, currentY + 5);
  pdf.text('2. Interest @ 18% p.a. will be charged on delayed payments', 20, currentY + 10);
  pdf.text('3. Subject to local jurisdiction only', 20, currentY + 15);
  
  if (invoice.terms) {
    pdf.text(`4. ${invoice.terms}`, 20, currentY + 20);
  }
  
  pdf.text('For Your Company Name', 140, currentY);
  pdf.text('_____________________', 140, currentY + 20);
  pdf.text('Authorized Signatory', 140, currentY + 25);
  
  // E-Invoice QR code placeholder (for actual e-invoicing)
  if (client.gstin && parseFloat(invoice.total_amount.toString()) >= 50000) {
    pdf.rect(140, currentY - 40, 40, 40);
    pdf.text('E-Invoice QR', 150, currentY - 20);
  }
  
  // Footer
  pdf.text('This is a computer generated invoice and does not require physical signature', 105, 280, { align: 'center' });
  
  return Buffer.from(pdf.output('arraybuffer'));
}

// Helper function to get status color
function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status) {
    case 'draft': return { r: 108, g: 117, b: 125 };
    case 'sent': return { r: 0, g: 123, b: 255 };
    case 'paid': return { r: 40, g: 167, b: 69 };
    case 'overdue': return { r: 220, g: 53, b: 69 };
    default: return { r: 108, g: 117, b: 125 };
  }
}

function generateInvoiceHTML(invoice: Invoice, client: Client, project: Project): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
        }
        .company-info {
            flex: 1;
        }
        .invoice-info {
            text-align: right;
            flex: 1;
        }
        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .invoice-number {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .billing-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .bill-to, .project-info {
            flex: 1;
            margin-right: 20px;
        }
        .section-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
            color: #007bff;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .invoice-table th,
        .invoice-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .invoice-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .amount-column {
            text-align: right;
        }
        .totals-section {
            float: right;
            width: 300px;
            margin-top: 20px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .total-row.final {
            font-weight: bold;
            font-size: 18px;
            border-bottom: 2px solid #007bff;
            border-top: 2px solid #007bff;
            margin-top: 10px;
            padding-top: 10px;
        }
        .payment-info {
            margin-top: 40px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }
        .status-draft { background-color: #6c757d; color: white; }
        .status-sent { background-color: #007bff; color: white; }
        .status-paid { background-color: #28a745; color: white; }
        .status-overdue { background-color: #dc3545; color: white; }
        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="invoice-header">
        <div class="company-info">
            <div class="invoice-title">INVOICE</div>
            <div>Your Company Name</div>
            <div>Your Address</div>
            <div>Your City, State, ZIP</div>
            <div>Email: your@email.com</div>
        </div>
        <div class="invoice-info">
            <div class="invoice-number">Invoice #${invoice.invoice_number}</div>
            <div>Date: ${invoice.created_at.toLocaleDateString()}</div>
            <div>Due Date: ${invoice.due_date.toLocaleDateString()}</div>
            <div style="margin-top: 10px;">
                <span class="status-badge status-${invoice.status}">${invoice.status}</span>
            </div>
        </div>
    </div>

    <div class="billing-section">
        <div class="bill-to">
            <div class="section-title">Bill To:</div>
            <div><strong>${client.name}</strong></div>
            <div>${client.email}</div>
            ${client.phone ? `<div>${client.phone}</div>` : ''}
            ${client.address ? `<div>${client.address}</div>` : ''}
            ${client.gstin ? `<div><strong>GSTIN:</strong> ${client.gstin}</div>` : ''}
        </div>
        <div class="project-info">
            <div class="section-title">Project:</div>
            <div><strong>${project.name}</strong></div>
            ${project.description ? `<div>${project.description}</div>` : ''}
            <div><strong>Status:</strong> ${project.status}</div>
        </div>
    </div>

    <table class="invoice-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th class="amount-column">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Project Work - ${project.name}</td>
                <td>1</td>
                <td class="amount-column">₹${invoice.amount.toFixed(2)}</td>
                <td class="amount-column">₹${invoice.amount.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>

    <div class="totals-section">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${invoice.amount.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Tax (${invoice.getTaxRate()}%):</span>
            <span>₹${invoice.tax_amount.toFixed(2)}</span>
        </div>
        <div class="total-row final">
            <span>Total:</span>
            <span>₹${invoice.total_amount.toFixed(2)}</span>
        </div>
    </div>

    <div style="clear: both;"></div>

    <div class="payment-info">
        <div class="section-title">Payment Information:</div>
        <p>Please make payment by ${invoice.due_date.toLocaleDateString()}.</p>
        ${invoice.isOverdue() ? 
          `<p style="color: #dc3545; font-weight: bold;">This invoice is ${invoice.getDaysOverdue()} days overdue.</p>` : 
          `<p>Payment is due in ${invoice.getDaysUntilDue()} days.</p>`
        }
        <p>Thank you for your business!</p>
    </div>

    <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} | Invoice Management System</p>
    </div>
</body>
</html>
  `;
}

// GST-compliant invoice template
export function generateGSTInvoiceHTML(invoice: Invoice, client: Client, project: Project): string {
  const gstRate = invoice.getTaxRate();
  const cgstRate = gstRate / 2;
  const sgstRate = gstRate / 2;
  const cgstAmount = invoice.tax_amount / 2;
  const sgstAmount = invoice.tax_amount / 2;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GST Invoice ${invoice.invoice_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            font-size: 12px;
        }
        .invoice-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .gst-subtitle {
            font-size: 14px;
            color: #666;
        }
        .company-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .company-info, .invoice-info {
            flex: 1;
        }
        .invoice-info {
            text-align: right;
        }
        .billing-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .bill-to, .ship-to {
            flex: 1;
            border: 1px solid #000;
            padding: 10px;
            margin-right: 10px;
        }
        .ship-to {
            margin-right: 0;
        }
        .section-header {
            font-weight: bold;
            background-color: #f0f0f0;
            padding: 5px;
            margin: -10px -10px 10px -10px;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .invoice-table th,
        .invoice-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
        }
        .invoice-table th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .totals-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .totals-table td {
            border: 1px solid #000;
            padding: 8px;
        }
        .total-label {
            font-weight: bold;
            background-color: #f0f0f0;
        }
        .amount-words {
            border: 1px solid #000;
            padding: 10px;
            margin-bottom: 20px;
            background-color: #f9f9f9;
        }
        .footer-info {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
        }
        .terms, .signature {
            flex: 1;
        }
        .signature {
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="invoice-header">
        <div class="invoice-title">TAX INVOICE</div>
        <div class="gst-subtitle">(Under GST)</div>
    </div>

    <div class="company-details">
        <div class="company-info">
            <strong>Your Company Name</strong><br>
            Your Address<br>
            City, State - PIN<br>
            <strong>GSTIN:</strong> YOUR_GSTIN_NUMBER<br>
            <strong>Email:</strong> your@email.com<br>
            <strong>Phone:</strong> +91-XXXXXXXXXX
        </div>
        <div class="invoice-info">
            <strong>Invoice No:</strong> ${invoice.invoice_number}<br>
            <strong>Date:</strong> ${invoice.created_at.toLocaleDateString('en-IN')}<br>
            <strong>Due Date:</strong> ${invoice.due_date.toLocaleDateString('en-IN')}<br>
            <strong>Place of Supply:</strong> Your State<br>
            <strong>Status:</strong> ${invoice.status.toUpperCase()}
        </div>
    </div>

    <div class="billing-details">
        <div class="bill-to">
            <div class="section-header">Bill To</div>
            <strong>${client.name}</strong><br>
            ${client.address || 'Address not provided'}<br>
            <strong>Email:</strong> ${client.email}<br>
            ${client.phone ? `<strong>Phone:</strong> ${client.phone}<br>` : ''}
            ${client.gstin ? `<strong>GSTIN:</strong> ${client.gstin}` : '<strong>GSTIN:</strong> Not Registered'}
        </div>
        <div class="ship-to">
            <div class="section-header">Ship To</div>
            <strong>${client.name}</strong><br>
            ${client.address || 'Same as billing address'}<br>
            <strong>State:</strong> ${client.state || 'Not specified'}<br>
            <strong>PIN:</strong> ${client.pincode || 'Not specified'}
        </div>
    </div>

    <table class="invoice-table">
        <thead>
            <tr>
                <th>S.No</th>
                <th>Description of Goods/Services</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td class="text-left">Professional Services - ${project.name}</td>
                <td>998314</td>
                <td>1</td>
                <td>Service</td>
                <td class="text-right">₹${invoice.amount.toFixed(2)}</td>
                <td class="text-right">₹${invoice.amount.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td class="total-label" style="width: 70%;">Total Amount Before Tax</td>
            <td class="text-right">₹${invoice.amount.toFixed(2)}</td>
        </tr>
        <tr>
            <td class="total-label">CGST @ ${cgstRate}%</td>
            <td class="text-right">₹${cgstAmount.toFixed(2)}</td>
        </tr>
        <tr>
            <td class="total-label">SGST @ ${sgstRate}%</td>
            <td class="text-right">₹${sgstAmount.toFixed(2)}</td>
        </tr>
        <tr>
            <td class="total-label"><strong>Total Tax Amount</strong></td>
            <td class="text-right"><strong>₹${invoice.tax_amount.toFixed(2)}</strong></td>
        </tr>
        <tr>
            <td class="total-label"><strong>Total Amount After Tax</strong></td>
            <td class="text-right"><strong>₹${invoice.total_amount.toFixed(2)}</strong></td>
        </tr>
    </table>

    <div class="amount-words">
        <strong>Amount in Words:</strong> ${numberToWords(invoice.total_amount)} Rupees Only
    </div>

    <div class="footer-info">
        <div class="terms">
            <strong>Terms & Conditions:</strong><br>
            1. Payment due within ${invoice.getDaysUntilDue()} days<br>
            2. Interest @ 18% p.a. will be charged on delayed payments<br>
            3. Subject to local jurisdiction only<br>
            4. All disputes subject to arbitration
        </div>
        <div class="signature">
            <strong>For Your Company Name</strong><br><br><br>
            _____________________<br>
            Authorized Signatory
        </div>
    </div>

    <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
        This is a computer generated invoice and does not require physical signature
    </div>
</body>
</html>
  `;
}

// Helper function to convert numbers to words (Indian numbering system)
function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (amount === 0) return 'Zero';
  
  const integerPart = Math.floor(amount);
  
  function convertHundreds(num: number): string {
    let result = '';
    
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    
    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        result += ' ' + ones[num % 10];
      }
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += ones[num];
    }
    
    return result.trim();
  }
  
  if (integerPart < 1000) {
    return convertHundreds(integerPart);
  }
  
  // Handle thousands
  if (integerPart < 100000) {
    const thousands = Math.floor(integerPart / 1000);
    const remainder = integerPart % 1000;
    let result = convertHundreds(thousands) + ' Thousand';
    if (remainder > 0) {
      result += ' ' + convertHundreds(remainder);
    }
    return result;
  }
  
  // Handle lakhs (Indian numbering system)
  if (integerPart < 10000000) {
    const lakhs = Math.floor(integerPart / 100000);
    const remainder = integerPart % 100000;
    let result = convertHundreds(lakhs) + ' Lakh';
    if (remainder > 0) {
      if (remainder >= 1000) {
        const thousands = Math.floor(remainder / 1000);
        const hundreds = remainder % 1000;
        result += ' ' + convertHundreds(thousands) + ' Thousand';
        if (hundreds > 0) {
          result += ' ' + convertHundreds(hundreds);
        }
      } else {
        result += ' ' + convertHundreds(remainder);
      }
    }
    return result;
  }
  
  // Handle crores
  const crores = Math.floor(integerPart / 10000000);
  const remainder = integerPart % 10000000;
  let result = convertHundreds(crores) + ' Crore';
  
  if (remainder > 0) {
    if (remainder >= 100000) {
      const lakhs = Math.floor(remainder / 100000);
      const remaining = remainder % 100000;
      result += ' ' + convertHundreds(lakhs) + ' Lakh';
      if (remaining >= 1000) {
        const thousands = Math.floor(remaining / 1000);
        const hundreds = remaining % 1000;
        result += ' ' + convertHundreds(thousands) + ' Thousand';
        if (hundreds > 0) {
          result += ' ' + convertHundreds(hundreds);
        }
      } else if (remaining > 0) {
        result += ' ' + convertHundreds(remaining);
      }
    } else if (remainder >= 1000) {
      const thousands = Math.floor(remainder / 1000);
      const hundreds = remainder % 1000;
      result += ' ' + convertHundreds(thousands) + ' Thousand';
      if (hundreds > 0) {
        result += ' ' + convertHundreds(hundreds);
      }
    } else {
      result += ' ' + convertHundreds(remainder);
    }
  }
  
  return result;
}