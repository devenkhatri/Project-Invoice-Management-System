"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonHSNCodes = void 0;
exports.generateInvoicePDF = generateInvoicePDF;
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.calculateGSTBreakdown = calculateGSTBreakdown;
exports.validateGSTIN = validateGSTIN;
exports.getStateCodeFromGSTIN = getStateCodeFromGSTIN;
exports.getHSNCodeForService = getHSNCodeForService;
exports.generateInvoiceNumber = generateInvoiceNumber;
exports.calculateNextInvoiceDate = calculateNextInvoiceDate;
exports.shouldSendReminder = shouldSendReminder;
exports.generatePaymentReminderEmail = generatePaymentReminderEmail;
const pdfkit_1 = __importDefault(require("pdfkit"));
const nodemailer_1 = __importDefault(require("nodemailer"));
async function generateInvoicePDF(invoice, client) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.fontSize(20)
                .text('INVOICE', 50, 50, { align: 'center' })
                .fontSize(12)
                .text('Your Company Name', 50, 80)
                .text('Your Address Line 1', 50, 95)
                .text('Your Address Line 2', 50, 110)
                .text('Phone: +91-XXXXXXXXXX', 50, 125)
                .text('Email: your-email@company.com', 50, 140)
                .text('GSTIN: YOUR_GSTIN_NUMBER', 50, 155);
            doc.text(`Invoice #: ${invoice.invoice_number}`, 350, 80)
                .text(`Issue Date: ${formatDate(invoice.issue_date)}`, 350, 95)
                .text(`Due Date: ${formatDate(invoice.due_date)}`, 350, 110)
                .text(`Currency: ${invoice.currency}`, 350, 125);
            doc.fontSize(14)
                .text('Bill To:', 50, 200)
                .fontSize(12)
                .text(client.name, 50, 220)
                .text(client.address, 50, 235);
            if (client.city || client.state) {
                doc.text(`${client.city || ''} ${client.state || ''}`, 50, 250);
            }
            if (client.postal_code) {
                doc.text(`PIN: ${client.postal_code}`, 50, 265);
            }
            if (client.gstin) {
                doc.text(`GSTIN: ${client.gstin}`, 50, 280);
            }
            const tableTop = 320;
            const itemCodeX = 50;
            const descriptionX = 120;
            const quantityX = 300;
            const priceX = 350;
            const taxX = 400;
            const amountX = 450;
            doc.fontSize(10)
                .text('S.No', itemCodeX, tableTop)
                .text('Description', descriptionX, tableTop)
                .text('Qty', quantityX, tableTop)
                .text('Rate', priceX, tableTop)
                .text('Tax%', taxX, tableTop)
                .text('Amount', amountX, tableTop);
            doc.moveTo(50, tableTop + 15)
                .lineTo(550, tableTop + 15)
                .stroke();
            let currentY = tableTop + 25;
            invoice.line_items.forEach((item, index) => {
                doc.text((index + 1).toString(), itemCodeX, currentY)
                    .text(item.description, descriptionX, currentY, { width: 170 })
                    .text(item.quantity.toString(), quantityX, currentY)
                    .text(formatCurrency(item.unit_price, invoice.currency), priceX, currentY)
                    .text(`${item.tax_rate}%`, taxX, currentY)
                    .text(formatCurrency(item.total_price, invoice.currency), amountX, currentY);
                if (item.hsn_sac_code) {
                    currentY += 12;
                    doc.fontSize(8)
                        .text(`HSN/SAC: ${item.hsn_sac_code}`, descriptionX, currentY)
                        .fontSize(10);
                }
                currentY += 20;
            });
            doc.moveTo(50, currentY)
                .lineTo(550, currentY)
                .stroke();
            currentY += 20;
            const totalsX = 350;
            doc.text('Subtotal:', totalsX, currentY)
                .text(formatCurrency(invoice.subtotal, invoice.currency), amountX, currentY);
            currentY += 15;
            if (invoice.tax_breakdown.cgst_amount > 0) {
                doc.text(`CGST (${invoice.tax_breakdown.cgst_rate}%):`, totalsX, currentY)
                    .text(formatCurrency(invoice.tax_breakdown.cgst_amount, invoice.currency), amountX, currentY);
                currentY += 15;
            }
            if (invoice.tax_breakdown.sgst_amount > 0) {
                doc.text(`SGST (${invoice.tax_breakdown.sgst_rate}%):`, totalsX, currentY)
                    .text(formatCurrency(invoice.tax_breakdown.sgst_amount, invoice.currency), amountX, currentY);
                currentY += 15;
            }
            if (invoice.tax_breakdown.igst_amount > 0) {
                doc.text(`IGST (${invoice.tax_breakdown.igst_rate}%):`, totalsX, currentY)
                    .text(formatCurrency(invoice.tax_breakdown.igst_amount, invoice.currency), amountX, currentY);
                currentY += 15;
            }
            if (invoice.discount_amount && invoice.discount_amount > 0) {
                doc.text('Discount:', totalsX, currentY)
                    .text(`-${formatCurrency(invoice.discount_amount, invoice.currency)}`, amountX, currentY);
                currentY += 15;
            }
            if (invoice.discount_percentage && invoice.discount_percentage > 0) {
                const discountAmount = (invoice.subtotal + invoice.tax_breakdown.total_tax_amount) * invoice.discount_percentage / 100;
                doc.text(`Discount (${invoice.discount_percentage}%):`, totalsX, currentY)
                    .text(`-${formatCurrency(discountAmount, invoice.currency)}`, amountX, currentY);
                currentY += 15;
            }
            if (invoice.late_fee_applied && invoice.late_fee_applied > 0) {
                doc.text('Late Fee:', totalsX, currentY)
                    .text(formatCurrency(invoice.late_fee_applied, invoice.currency), amountX, currentY);
                currentY += 15;
            }
            doc.fontSize(12)
                .text('Total Amount:', totalsX, currentY)
                .text(formatCurrency(invoice.total_amount, invoice.currency), amountX, currentY);
            doc.moveTo(totalsX, currentY - 5)
                .lineTo(550, currentY - 5)
                .stroke();
            currentY += 30;
            if (invoice.paid_amount > 0) {
                doc.fontSize(10)
                    .text('Payment Information:', 50, currentY);
                currentY += 15;
                doc.text(`Amount Paid: ${formatCurrency(invoice.paid_amount, invoice.currency)}`, 50, currentY);
                currentY += 12;
                if (invoice.payment_date) {
                    doc.text(`Payment Date: ${formatDate(invoice.payment_date)}`, 50, currentY);
                    currentY += 12;
                }
                if (invoice.payment_method) {
                    doc.text(`Payment Method: ${invoice.payment_method}`, 50, currentY);
                    currentY += 12;
                }
                const remainingAmount = invoice.getRemainingAmount();
                if (remainingAmount > 0) {
                    doc.text(`Amount Due: ${formatCurrency(remainingAmount, invoice.currency)}`, 50, currentY);
                    currentY += 12;
                }
            }
            currentY += 20;
            doc.fontSize(10)
                .text('Payment Terms:', 50, currentY);
            currentY += 15;
            doc.text(invoice.payment_terms, 50, currentY);
            if (invoice.notes) {
                currentY += 30;
                doc.text('Notes:', 50, currentY);
                currentY += 15;
                doc.text(invoice.notes, 50, currentY, { width: 500 });
            }
            if (invoice.terms_conditions) {
                currentY += 30;
                doc.text('Terms and Conditions:', 50, currentY);
                currentY += 15;
                doc.text(invoice.terms_conditions, 50, currentY, { width: 500 });
            }
            const footerY = doc.page.height - 100;
            doc.fontSize(8)
                .text('Thank you for your business!', 50, footerY, { align: 'center' })
                .text('This is a computer generated invoice.', 50, footerY + 15, { align: 'center' });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
async function sendInvoiceEmail(options) {
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        const defaultSubject = `Invoice ${options.invoice.invoice_number} from Your Company`;
        const defaultMessage = `
Dear ${options.client.name},

Please find attached invoice ${options.invoice.invoice_number} for the amount of ${formatCurrency(options.invoice.total_amount, options.invoice.currency)}.

Invoice Details:
- Invoice Number: ${options.invoice.invoice_number}
- Issue Date: ${formatDate(options.invoice.issue_date)}
- Due Date: ${formatDate(options.invoice.due_date)}
- Amount: ${formatCurrency(options.invoice.total_amount, options.invoice.currency)}

Payment Terms: ${options.invoice.payment_terms}

Please process the payment by the due date to avoid any late fees.

Thank you for your business!

Best regards,
Your Company Name
    `.trim();
        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: options.recipientEmail,
            subject: options.subject || defaultSubject,
            text: options.message || defaultMessage,
            html: (options.message || defaultMessage).replace(/\n/g, '<br>'),
            attachments: [
                {
                    filename: `invoice-${options.invoice.invoice_number}.pdf`,
                    content: options.pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };
        await transporter.sendMail(mailOptions);
        return { success: true };
    }
    catch (error) {
        console.error('Email sending error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown email error'
        };
    }
}
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}
function calculateGSTBreakdown(amount, gstRate, isInterState) {
    const taxAmount = (amount * gstRate) / 100;
    if (isInterState) {
        return {
            cgst_rate: 0,
            cgst_amount: 0,
            sgst_rate: 0,
            sgst_amount: 0,
            igst_rate: gstRate,
            igst_amount: taxAmount,
            total_tax_amount: taxAmount
        };
    }
    else {
        const halfRate = gstRate / 2;
        const halfAmount = taxAmount / 2;
        return {
            cgst_rate: halfRate,
            cgst_amount: halfAmount,
            sgst_rate: halfRate,
            sgst_amount: halfAmount,
            igst_rate: 0,
            igst_amount: 0,
            total_tax_amount: taxAmount
        };
    }
}
function validateGSTIN(gstin) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
}
function getStateCodeFromGSTIN(gstin) {
    if (!validateGSTIN(gstin)) {
        throw new Error('Invalid GSTIN format');
    }
    return gstin.substring(0, 2);
}
exports.commonHSNCodes = {
    'software_development': '998314',
    'consulting': '998313',
    'training': '998312',
    'maintenance': '998315',
    'hosting': '998316'
};
function getHSNCodeForService(serviceType) {
    return exports.commonHSNCodes[serviceType] || '998399';
}
function generateInvoiceNumber(prefix = 'INV', year) {
    const currentYear = year || new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${currentYear}-${timestamp}`;
}
function calculateNextInvoiceDate(currentDate, frequency) {
    const date = new Date(currentDate);
    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            throw new Error(`Invalid frequency: ${frequency}`);
    }
    return date.toISOString().split('T')[0];
}
function shouldSendReminder(invoice, reminderType) {
    const now = new Date();
    const dueDate = new Date(invoice.due_date);
    const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (invoice.isFullyPaid()) {
        return false;
    }
    switch (reminderType) {
        case 'before_due':
            return daysDiff <= 3 && daysDiff > 0;
        case 'after_due':
            return daysDiff < 0;
        default:
            return false;
    }
}
async function generatePaymentReminderEmail(invoice, client, reminderType) {
    const daysUntilDue = invoice.getDaysUntilDue();
    const daysOverdue = invoice.getDaysOverdue();
    const remainingAmount = invoice.getRemainingAmount();
    let subject;
    let message;
    if (reminderType === 'before_due') {
        subject = `Payment Reminder: Invoice ${invoice.invoice_number} due in ${daysUntilDue} days`;
        message = `
Dear ${client.name},

This is a friendly reminder that invoice ${invoice.invoice_number} is due in ${daysUntilDue} days.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Due Date: ${formatDate(invoice.due_date)}
- Amount Due: ${formatCurrency(remainingAmount, invoice.currency)}

Please ensure payment is made by the due date to avoid any late fees.

Thank you for your prompt attention to this matter.

Best regards,
Your Company Name
    `.trim();
    }
    else {
        subject = `Overdue Payment Notice: Invoice ${invoice.invoice_number} - ${daysOverdue} days overdue`;
        message = `
Dear ${client.name},

This is to inform you that invoice ${invoice.invoice_number} is now ${daysOverdue} days overdue.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Due Date: ${formatDate(invoice.due_date)}
- Amount Due: ${formatCurrency(remainingAmount, invoice.currency)}
- Days Overdue: ${daysOverdue}

Please arrange for immediate payment to avoid additional late fees and potential service interruption.

If you have already made the payment, please disregard this notice and send us the payment confirmation.

Best regards,
Your Company Name
    `.trim();
    }
    return { subject, message };
}
//# sourceMappingURL=invoice.service.js.map