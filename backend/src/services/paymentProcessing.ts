import { Invoice } from '../models/Invoice';
import { InvoiceStatus, PaymentGateway, PaymentStatus } from '../models/types';
import { GoogleSheetsService } from './googleSheets';

// Payment record interface
export interface IPayment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  gateway_payment_id: string;
  status: PaymentStatus;
  payment_date: Date;
  payment_method: string;
  transaction_fee: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Payment gateway configuration
export interface PaymentGatewayConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret?: string;
  mode: 'test' | 'live';
  additionalConfig?: Record<string, any>;
}

// Payment link generation options
export interface PaymentLinkOptions {
  description?: string;
  expiresInDays?: number;
  redirectUrl?: string;
  callbackUrl?: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, any>;
}

// Late fee configuration
export interface LateFeeConfig {
  enabled: boolean;
  gracePeriodDays: number;
  feeType: 'fixed' | 'percentage';
  feeAmount: number; // Fixed amount or percentage
  maxFeeAmount?: number; // Maximum fee amount (for percentage)
  compoundingPeriodDays?: number; // For recurring late fees
}

/**
 * Payment Processing Service
 * Handles integration with payment gateways and payment-related operations
 */
export class PaymentProcessingService {
  private sheetsService: GoogleSheetsService;
  private stripeConfig?: PaymentGatewayConfig;
  private paypalConfig?: PaymentGatewayConfig;
  private razorpayConfig?: PaymentGatewayConfig;
  private lateFeeConfig: LateFeeConfig;

  constructor(
    sheetsService: GoogleSheetsService,
    stripeConfig?: PaymentGatewayConfig,
    paypalConfig?: PaymentGatewayConfig,
    razorpayConfig?: PaymentGatewayConfig
  ) {
    this.sheetsService = sheetsService;
    this.stripeConfig = stripeConfig;
    this.paypalConfig = paypalConfig;
    this.razorpayConfig = razorpayConfig;

    // Default late fee configuration
    this.lateFeeConfig = {
      enabled: true,
      gracePeriodDays: 3,
      feeType: 'percentage',
      feeAmount: 2, // 2% per month
      maxFeeAmount: 10, // Maximum 10% of invoice amount
      compoundingPeriodDays: 30 // Monthly compounding
    };
  }

  /**
   * Initialize the Payments sheet if it doesn't exist
   */
  async initializePaymentsSheet(): Promise<boolean> {
    try {
      const spreadsheetInfo = await this.sheetsService.getSpreadsheetInfo();
      const existingSheets = spreadsheetInfo.sheets?.map((sheet: any) => sheet.properties.title) || [];

      if (!existingSheets.includes('Payments')) {
        const headers = [
          'id', 'invoice_id', 'amount', 'currency', 'gateway', 'gateway_payment_id',
          'status', 'payment_date', 'payment_method', 'transaction_fee', 'metadata',
          'created_at', 'updated_at'
        ];

        const created = await this.sheetsService.createSheet('Payments', headers);
        return created;
      }

      return true;
    } catch (error) {
      console.error('Error initializing Payments sheet:', error);
      return false;
    }
  }

  /**
   * Generate a payment link for an invoice
   */
  async generatePaymentLink(
    invoiceId: string,
    gateway: PaymentGateway,
    options?: PaymentLinkOptions
  ): Promise<string> {
    try {
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Don't generate payment link for paid invoices
      if (invoice.isPaid()) {
        throw new Error('Cannot generate payment link for paid invoices');
      }

      // Generate payment link based on gateway
      let paymentLink = '';
      const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}`;
      
      switch (gateway) {
        case PaymentGateway.STRIPE:
          paymentLink = await this.generateStripePaymentLink(invoice, paymentRef, options);
          break;
        case PaymentGateway.PAYPAL:
          paymentLink = await this.generatePayPalPaymentLink(invoice, paymentRef, options);
          break;
        case PaymentGateway.RAZORPAY:
          paymentLink = await this.generateRazorpayPaymentLink(invoice, paymentRef, options);
          break;
        default:
          throw new Error(`Unsupported payment gateway: ${gateway}`);
      }
      
      // Update invoice with payment link
      invoice.setPaymentLink(paymentLink);
      await this.sheetsService.update('Invoices', invoiceId, invoice.toSheetRow());

      return paymentLink;
    } catch (error) {
      console.error('Error generating payment link:', error);
      throw error;
    }
  }

  /**
   * Generate a Stripe payment link
   */
  private async generateStripePaymentLink(
    invoice: Invoice,
    paymentRef: string,
    options?: PaymentLinkOptions
  ): Promise<string> {
    if (!this.stripeConfig) {
      // For demo purposes, return a mock link if no config
      return `https://stripe.com/pay/${paymentRef}?amount=${invoice.total_amount}&currency=${invoice.currency}`;
    }

    try {
      // In a real implementation, we would use the Stripe SDK
      // For now, we'll return a mock payment link
      const expiresAt = options?.expiresInDays || 7;
      const mockLink = `https://stripe.com/pay/${paymentRef}?amount=${invoice.total_amount}&currency=${invoice.currency}&expires=${expiresAt}d`;
      
      return mockLink;
    } catch (error) {
      console.error('Error generating Stripe payment link:', error);
      throw error;
    }
  }

  /**
   * Generate a PayPal payment link
   */
  private async generatePayPalPaymentLink(
    invoice: Invoice,
    paymentRef: string,
    options?: PaymentLinkOptions
  ): Promise<string> {
    if (!this.paypalConfig) {
      // For demo purposes, return a mock link if no config
      return `https://paypal.me/yourcompany/${invoice.total_amount}?ref=${paymentRef}&currency=${invoice.currency}`;
    }

    try {
      // In a real implementation, we would use the PayPal SDK
      // For now, we'll return a mock payment link
      const description = options?.description || `Payment for invoice ${invoice.invoice_number}`;
      const mockLink = `https://paypal.me/yourcompany/${invoice.total_amount}?ref=${paymentRef}&currency=${invoice.currency}&description=${encodeURIComponent(description)}`;
      
      return mockLink;
    } catch (error) {
      console.error('Error generating PayPal payment link:', error);
      throw error;
    }
  }

  /**
   * Generate a Razorpay payment link
   */
  private async generateRazorpayPaymentLink(
    invoice: Invoice,
    paymentRef: string,
    options?: PaymentLinkOptions
  ): Promise<string> {
    if (!this.razorpayConfig) {
      // For demo purposes, return a mock link if no config
      return `https://rzp.io/i/${paymentRef}`;
    }

    try {
      // In a real implementation, we would use the Razorpay SDK
      // For now, we'll return a mock payment link
      const expiresAt = options?.expiresInDays || 7;
      const customerEmail = options?.customerEmail || '';
      const mockLink = `https://rzp.io/i/${paymentRef}?amount=${invoice.total_amount * 100}&currency=${invoice.currency}&expires=${expiresAt}d&email=${encodeURIComponent(customerEmail)}`;
      
      return mockLink;
    } catch (error) {
      console.error('Error generating Razorpay payment link:', error);
      throw error;
    }
  }

  /**
   * Process a payment for an invoice
   */
  async processPayment(
    invoiceId: string,
    paymentData: {
      amount: number;
      gateway: PaymentGateway;
      gateway_payment_id: string;
      payment_method: string;
      transaction_fee?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<IPayment> {
    try {
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Create payment record
      const payment: IPayment = {
        id: `payment_${Date.now().toString(36)}${Math.random().toString(36).substr(2)}`,
        invoice_id: invoiceId,
        amount: paymentData.amount,
        currency: invoice.currency,
        gateway: paymentData.gateway,
        gateway_payment_id: paymentData.gateway_payment_id,
        status: PaymentStatus.COMPLETED,
        payment_date: new Date(),
        payment_method: paymentData.payment_method,
        transaction_fee: paymentData.transaction_fee || 0,
        metadata: paymentData.metadata || {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Save payment to Payments sheet
      await this.initializePaymentsSheet(); // Ensure sheet exists
      await this.sheetsService.create('Payments', {
        id: payment.id,
        invoice_id: payment.invoice_id,
        amount: payment.amount,
        currency: payment.currency,
        gateway: payment.gateway,
        gateway_payment_id: payment.gateway_payment_id,
        status: payment.status,
        payment_date: payment.payment_date.toISOString(),
        payment_method: payment.payment_method,
        transaction_fee: payment.transaction_fee,
        metadata: JSON.stringify(payment.metadata),
        created_at: payment.created_at.toISOString(),
        updated_at: payment.updated_at.toISOString()
      });

      // Update invoice status to paid
      invoice.markAsPaid();
      await this.sheetsService.update('Invoices', invoiceId, invoice.toSheetRow());

      return payment;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Get payment history for an invoice
   */
  async getPaymentHistory(invoiceId: string): Promise<IPayment[]> {
    try {
      // Query payments for the invoice
      const paymentRows = await this.sheetsService.query('Payments', { invoice_id: invoiceId });
      
      // Convert to payment objects
      return paymentRows.map(row => ({
        id: row.id,
        invoice_id: row.invoice_id,
        amount: parseFloat(row.amount) || 0,
        currency: row.currency,
        gateway: row.gateway as PaymentGateway,
        gateway_payment_id: row.gateway_payment_id,
        status: row.status as PaymentStatus,
        payment_date: new Date(row.payment_date),
        payment_method: row.payment_method,
        transaction_fee: parseFloat(row.transaction_fee) || 0,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }

  /**
   * Check for overdue invoices and apply late fees if configured
   */
  async checkOverdueInvoicesAndApplyLateFees(): Promise<{
    checked: number;
    overdue: number;
    feesApplied: number;
  }> {
    try {
      // Get all invoices
      const invoiceRows = await this.sheetsService.read('Invoices');
      const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
      
      let overdueCount = 0;
      let feesAppliedCount = 0;
      
      // Check each invoice
      for (const invoice of invoices) {
        // Skip paid invoices
        if (invoice.isPaid()) {
          continue;
        }
        
        // Check if overdue
        if (invoice.isOverdue()) {
          overdueCount++;
          
          // Mark as overdue if not already
          if (invoice.status !== InvoiceStatus.OVERDUE) {
            invoice.markAsOverdue();
            await this.sheetsService.update('Invoices', invoice.id, invoice.toSheetRow());
          }
          
          // Apply late fees if enabled and grace period has passed
          if (this.lateFeeConfig.enabled) {
            const daysOverdue = invoice.getDaysOverdue();
            
            // Only apply late fee if past grace period
            if (daysOverdue > this.lateFeeConfig.gracePeriodDays) {
              const lateFeeApplied = await this.applyLateFee(invoice);
              if (lateFeeApplied) {
                feesAppliedCount++;
              }
            }
          }
        }
      }
      
      return {
        checked: invoices.length,
        overdue: overdueCount,
        feesApplied: feesAppliedCount
      };
    } catch (error) {
      console.error('Error checking overdue invoices:', error);
      throw error;
    }
  }

  /**
   * Apply late fee to an invoice
   */
  private async applyLateFee(invoice: Invoice): Promise<boolean> {
    try {
      // Check if we already have a late fee item for this invoice
      const invoiceItemRows = await this.sheetsService.query('Invoice_Items', { invoice_id: invoice.id });
      const existingLateFeeItem = invoiceItemRows.find(item => 
        item.description.toLowerCase().includes('late fee') || 
        item.description.toLowerCase().includes('late payment')
      );
      
      // Calculate late fee
      let lateFeeAmount = 0;
      
      if (this.lateFeeConfig.feeType === 'fixed') {
        lateFeeAmount = this.lateFeeConfig.feeAmount;
      } else {
        // Percentage-based fee
        lateFeeAmount = (invoice.amount * this.lateFeeConfig.feeAmount) / 100;
        
        // Apply maximum if configured
        if (this.lateFeeConfig.maxFeeAmount && 
            lateFeeAmount > (invoice.amount * this.lateFeeConfig.maxFeeAmount / 100)) {
          lateFeeAmount = invoice.amount * this.lateFeeConfig.maxFeeAmount / 100;
        }
      }
      
      // Round to 2 decimal places
      lateFeeAmount = Math.round(lateFeeAmount * 100) / 100;
      
      if (existingLateFeeItem) {
        // Update existing late fee item
        const updatedItem = {
          ...existingLateFeeItem,
          amount: lateFeeAmount,
          updated_at: new Date().toISOString()
        };
        
        await this.sheetsService.update('Invoice_Items', existingLateFeeItem.id, updatedItem);
      } else {
        // Create new late fee item
        const lateFeeItem = {
          invoice_id: invoice.id,
          description: 'Late Payment Fee',
          quantity: 1,
          rate: lateFeeAmount,
          amount: lateFeeAmount,
          type: 'fee',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await this.sheetsService.create('Invoice_Items', lateFeeItem);
      }
      
      // Update invoice total
      const newTotal = invoice.total_amount + lateFeeAmount;
      await this.sheetsService.update('Invoices', invoice.id, {
        ...invoice.toSheetRow(),
        total_amount: newTotal,
        updated_at: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Error applying late fee:', error);
      return false;
    }
  }

  /**
   * Send payment reminders for overdue invoices
   */
  async sendPaymentReminders(options: {
    daysOverdue?: number;
    reminderTemplate?: string;
    includePaymentLink?: boolean;
  } = {}): Promise<{
    total: number;
    sent: number;
    failed: number;
    details: Array<{ invoice_id: string; invoice_number: string; client_email: string; days_overdue: number; status: 'sent' | 'failed' }>
  }> {
    try {
      const { daysOverdue = 0, includePaymentLink = true } = options;
      
      // Get all invoices
      const invoiceRows = await this.sheetsService.read('Invoices');
      const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
      
      // Filter to overdue invoices
      const overdueInvoices = invoices.filter(invoice => 
        invoice.status === InvoiceStatus.OVERDUE && 
        invoice.getDaysOverdue() >= daysOverdue
      );
      
      const results = {
        total: overdueInvoices.length,
        sent: 0,
        failed: 0,
        details: [] as Array<{ 
          invoice_id: string; 
          invoice_number: string; 
          client_email: string; 
          days_overdue: number; 
          status: 'sent' | 'failed' 
        }>
      };
      
      // Process each overdue invoice
      for (const invoice of overdueInvoices) {
        try {
          // Get client details
          const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
          if (clientRows.length === 0) {
            throw new Error('Client not found');
          }
          
          const client = clientRows[0];
          const clientEmail = client.email;
          
          if (!clientEmail) {
            throw new Error('Client email not found');
          }
          
          // In a real implementation, we would send an email here
          // For now, we'll just log the reminder
          console.log(`Would send payment reminder for invoice ${invoice.invoice_number} to ${clientEmail}`);
          
          // Generate payment link if needed and not already present
          if (includePaymentLink && !invoice.payment_link) {
            await this.generatePaymentLink(invoice.id, PaymentGateway.RAZORPAY);
          }
          
          // Record communication
          await this.recordReminderCommunication(invoice, client);
          
          results.sent++;
          results.details.push({
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            client_email: clientEmail,
            days_overdue: invoice.getDaysOverdue(),
            status: 'sent'
          });
        } catch (error) {
          console.error(`Error sending reminder for invoice ${invoice.id}:`, error);
          
          results.failed++;
          results.details.push({
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            client_email: 'unknown',
            days_overdue: invoice.getDaysOverdue(),
            status: 'failed'
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      throw error;
    }
  }

  /**
   * Record a payment reminder communication
   */
  private async recordReminderCommunication(invoice: Invoice, client: any): Promise<void> {
    try {
      const communication = {
        client_id: client.id,
        project_id: invoice.project_id,
        type: 'email',
        direction: 'outbound',
        subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
        content: `This is a reminder that invoice ${invoice.invoice_number} for ${invoice.currency} ${invoice.total_amount} is overdue by ${invoice.getDaysOverdue()} days. Please make payment at your earliest convenience.${invoice.payment_link ? ` You can pay online at: ${invoice.payment_link}` : ''}`,
        contact_person: client.name,
        follow_up_required: true,
        follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        attachments: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await this.sheetsService.create('Communications', communication);
    } catch (error) {
      console.error('Error recording reminder communication:', error);
    }
  }

  /**
   * Configure late fee settings
   */
  setLateFeeConfig(config: Partial<LateFeeConfig>): void {
    this.lateFeeConfig = {
      ...this.lateFeeConfig,
      ...config
    };
  }

  /**
   * Get late fee configuration
   */
  getLateFeeConfig(): LateFeeConfig {
    return { ...this.lateFeeConfig };
  }
}

// Factory function to create PaymentProcessingService instance
export function createPaymentProcessingService(
  sheetsService: GoogleSheetsService
): PaymentProcessingService {
  // Get payment gateway configurations from environment variables
  const stripeConfig = process.env.STRIPE_API_KEY ? {
    apiKey: process.env.STRIPE_API_KEY,
    apiSecret: process.env.STRIPE_API_SECRET || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    mode: (process.env.STRIPE_MODE || 'test') as 'test' | 'live'
  } : undefined;

  const paypalConfig = process.env.PAYPAL_CLIENT_ID ? {
    apiKey: process.env.PAYPAL_CLIENT_ID,
    apiSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: (process.env.PAYPAL_MODE || 'test') as 'test' | 'live'
  } : undefined;

  const razorpayConfig = process.env.RAZORPAY_KEY_ID ? {
    apiKey: process.env.RAZORPAY_KEY_ID,
    apiSecret: process.env.RAZORPAY_KEY_SECRET || '',
    mode: (process.env.RAZORPAY_MODE || 'test') as 'test' | 'live'
  } : undefined;

  return new PaymentProcessingService(
    sheetsService,
    stripeConfig,
    paypalConfig,
    razorpayConfig
  );
}