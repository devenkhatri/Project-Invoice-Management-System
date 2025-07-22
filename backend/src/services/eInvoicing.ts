import { Invoice } from '../models/Invoice';
import { Client } from '../models/Client';
import { Project } from '../models/Project';
import { GoogleSheetsService } from './googleSheets';
import { generateGSTInvoicePDF } from './invoicePDF';
import QRCode from 'qrcode';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';

// E-Invoice status
export enum EInvoiceStatus {
  PENDING = 'pending',
  GENERATED = 'generated',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

// E-Invoice data interface
export interface EInvoiceData {
  id: string;
  invoice_id: string;
  irn: string; // Invoice Reference Number
  ack_no: string; // Acknowledgement Number
  ack_date: string; // Acknowledgement Date
  signed_qr_code: string; // Base64 encoded QR code
  signed_invoice: string; // Base64 encoded signed invoice
  status: EInvoiceStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * E-Invoicing Service
 * Handles e-invoicing for GST compliance
 */
export class EInvoicingService {
  private sheetsService: GoogleSheetsService;
  private apiBaseUrl: string;
  private apiKey: string;
  private gstin: string;
  private username: string;
  private password: string;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
    
    // Load configuration
    this.apiBaseUrl = config.einvoice?.apiBaseUrl || 'https://einvoicing.gst.gov.in/v1/';
    this.apiKey = config.einvoice?.apiKey || 'test_api_key';
    this.gstin = config.einvoice?.gstin || '27AAAAA0000A1Z5';
    this.username = config.einvoice?.username || 'testuser';
    this.password = config.einvoice?.password || 'testpass';
    
    // Initialize E-Invoice sheet if needed
    this.initializeEInvoiceSheet();
  }

  /**
   * Initialize E-Invoice sheet if it doesn't exist
   */
  private async initializeEInvoiceSheet(): Promise<void> {
    try {
      // Check if E-Invoices sheet exists
      try {
        await this.sheetsService.read('E_Invoices', null, 1);
        console.log('E-Invoices sheet exists');
      } catch (error) {
        // Create the sheet
        console.log('Creating E-Invoices sheet');
        await this.sheetsService.createSheet('E_Invoices', [
          'id',
          'invoice_id',
          'irn',
          'ack_no',
          'ack_date',
          'signed_qr_code',
          'signed_invoice',
          'status',
          'created_at',
          'updated_at'
        ]);
      }
    } catch (error) {
      console.error('Error initializing E-Invoice sheet:', error);
    }
  }

  /**
   * Generate e-invoice for a given invoice
   */
  async generateEInvoice(invoiceId: string): Promise<EInvoiceData> {
    try {
      // Check if e-invoice already exists
      const existingEInvoices = await this.sheetsService.query('E_Invoices', { invoice_id: invoiceId });
      
      if (existingEInvoices.length > 0) {
        const existingEInvoice = existingEInvoices[0];
        
        if (existingEInvoice.status === EInvoiceStatus.GENERATED) {
          console.log(`E-Invoice already generated for invoice ${invoiceId}`);
          return {
            id: existingEInvoice.id,
            invoice_id: existingEInvoice.invoice_id,
            irn: existingEInvoice.irn,
            ack_no: existingEInvoice.ack_no,
            ack_date: existingEInvoice.ack_date,
            signed_qr_code: existingEInvoice.signed_qr_code,
            signed_invoice: existingEInvoice.signed_invoice,
            status: existingEInvoice.status as EInvoiceStatus,
            created_at: new Date(existingEInvoice.created_at),
            updated_at: new Date(existingEInvoice.updated_at)
          };
        }
      }
      
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }
      
      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Get client details
      const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
      if (clientRows.length === 0) {
        throw new Error(`Client ${invoice.client_id} not found`);
      }
      
      const client = Client.fromSheetRow(clientRows[0]);
      
      // Check if client has GSTIN (required for e-invoicing)
      if (!client.gstin) {
        throw new Error(`Client ${client.id} does not have a GSTIN, which is required for e-invoicing`);
      }
      
      // Get project details if available
      let project: Project | null = null;
      if (invoice.project_id) {
        const projectRows = await this.sheetsService.read('Projects', invoice.project_id);
        if (projectRows.length > 0) {
          project = Project.fromSheetRow(projectRows[0]);
        }
      }
      
      // Generate e-invoice payload
      const eInvoicePayload = this.createEInvoicePayload(invoice, client, project);
      
      // In a real implementation, we would call the GST e-invoice API
      // For this demo, we'll simulate the API response
      const eInvoiceResponse = await this.simulateEInvoiceAPICall(eInvoicePayload);
      
      // Generate QR code
      const qrCodeData = await this.generateQRCode(eInvoiceResponse.irn);
      
      // Create e-invoice record
      const eInvoiceData: EInvoiceData = {
        id: `einv_${Date.now().toString(36)}`,
        invoice_id: invoiceId,
        irn: eInvoiceResponse.irn,
        ack_no: eInvoiceResponse.ack_no,
        ack_date: eInvoiceResponse.ack_date,
        signed_qr_code: qrCodeData,
        signed_invoice: 'base64_encoded_signed_invoice_data', // In a real implementation, this would be the actual signed invoice
        status: EInvoiceStatus.GENERATED,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Save to Google Sheets
      await this.sheetsService.create('E_Invoices', {
        id: eInvoiceData.id,
        invoice_id: eInvoiceData.invoice_id,
        irn: eInvoiceData.irn,
        ack_no: eInvoiceData.ack_no,
        ack_date: eInvoiceData.ack_date,
        signed_qr_code: eInvoiceData.signed_qr_code,
        signed_invoice: eInvoiceData.signed_invoice,
        status: eInvoiceData.status,
        created_at: eInvoiceData.created_at.toISOString(),
        updated_at: eInvoiceData.updated_at.toISOString()
      });
      
      // Update invoice with e-invoice reference
      invoice.e_invoice_id = eInvoiceData.id;
      await this.sheetsService.update('Invoices', invoice.id, invoice);
      
      return eInvoiceData;
    } catch (error) {
      console.error(`Error generating e-invoice for invoice ${invoiceId}:`, error);
      
      // Create failed e-invoice record
      const failedEInvoiceData: EInvoiceData = {
        id: `einv_${Date.now().toString(36)}`,
        invoice_id: invoiceId,
        irn: '',
        ack_no: '',
        ack_date: '',
        signed_qr_code: '',
        signed_invoice: '',
        status: EInvoiceStatus.FAILED,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Save failed status to Google Sheets
      await this.sheetsService.create('E_Invoices', {
        id: failedEInvoiceData.id,
        invoice_id: failedEInvoiceData.invoice_id,
        irn: failedEInvoiceData.irn,
        ack_no: failedEInvoiceData.ack_no,
        ack_date: failedEInvoiceData.ack_date,
        signed_qr_code: failedEInvoiceData.signed_qr_code,
        signed_invoice: failedEInvoiceData.signed_invoice,
        status: failedEInvoiceData.status,
        created_at: failedEInvoiceData.created_at.toISOString(),
        updated_at: failedEInvoiceData.updated_at.toISOString()
      });
      
      throw new Error(`Failed to generate e-invoice: ${error.message}`);
    }
  }

  /**
   * Create e-invoice payload for API
   */
  private createEInvoicePayload(invoice: Invoice, client: Client, project: Project | null): any {
    // Determine if inter-state or intra-state
    const isInterState = client.state !== 'Maharashtra'; // Assuming company is in Maharashtra
    
    // Calculate tax breakdown
    const taxRate = invoice.getTaxRate();
    let igstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    
    if (isInterState) {
      igstAmount = invoice.tax_amount;
    } else {
      cgstAmount = invoice.tax_amount / 2;
      sgstAmount = invoice.tax_amount / 2;
    }
    
    // Format dates
    const invoiceDate = invoice.created_at.toISOString().split('T')[0];
    
    // Create payload as per e-invoice schema
    return {
      Version: "1.1",
      TranDtls: {
        TaxSch: "GST",
        SupTyp: "B2B", // Business to Business
        RegRev: "N", // Reverse charge
        EcmGstin: null // E-commerce GSTIN
      },
      DocDtls: {
        Typ: "INV", // Invoice
        No: invoice.invoice_number,
        Dt: invoiceDate
      },
      SellerDtls: {
        Gstin: this.gstin,
        LglNm: "Your Company Name",
        TrdNm: "Your Company Name",
        Addr1: "Your Address Line 1",
        Addr2: "Your Address Line 2",
        Loc: "Mumbai",
        Pin: 400001,
        Stcd: "27", // Maharashtra state code
        Ph: "9999999999",
        Em: "contact@yourcompany.com"
      },
      BuyerDtls: {
        Gstin: client.gstin,
        LglNm: client.name,
        TrdNm: client.name,
        Pos: client.state_code || "27", // Place of supply
        Addr1: client.address || "Client Address",
        Addr2: "",
        Loc: client.city || "Client City",
        Pin: parseInt(client.pincode || "400001"),
        Stcd: client.state_code || "27",
        Ph: client.phone || "",
        Em: client.email
      },
      ItemList: [
        {
          SlNo: "1",
          PrdDesc: project ? `Professional Services - ${project.name}` : "Professional Services",
          IsServc: "Y", // Is service
          HsnCd: "998314", // HSN code for IT services
          Qty: 1,
          Unit: "OTH", // Other
          UnitPrice: invoice.amount,
          TotAmt: invoice.amount,
          AssAmt: invoice.amount,
          GstRt: taxRate,
          IgstAmt: igstAmount,
          CgstAmt: cgstAmount,
          SgstAmt: sgstAmount,
          TotItemVal: invoice.total_amount
        }
      ],
      ValDtls: {
        AssVal: invoice.amount,
        CgstVal: cgstAmount,
        SgstVal: sgstAmount,
        IgstVal: igstAmount,
        TotInvVal: invoice.total_amount
      }
    };
  }

  /**
   * Simulate e-invoice API call
   * In a real implementation, this would call the actual GST e-invoice API
   */
  private async simulateEInvoiceAPICall(payload: any): Promise<{
    irn: string;
    ack_no: string;
    ack_date: string;
  }> {
    // In a real implementation, we would make an API call like:
    /*
    const response = await axios.post(
      `${this.apiBaseUrl}/einvoice/v1/generate`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'gstin': this.gstin
        }
      }
    );
    
    return response.data;
    */
    
    // For this demo, we'll simulate the response
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate a random IRN (Invoice Reference Number)
        const irn = crypto.randomBytes(16).toString('hex');
        
        resolve({
          irn,
          ack_no: `${Date.now()}`,
          ack_date: new Date().toISOString()
        });
      }, 500); // Simulate API delay
    });
  }

  /**
   * Generate QR code for e-invoice
   */
  private async generateQRCode(irn: string): Promise<string> {
    try {
      // In a real implementation, the QR code would contain specific data as per e-invoice specs
      // For this demo, we'll just use the IRN
      const qrCodeData = await QRCode.toDataURL(irn);
      
      // Return base64 encoded QR code
      return qrCodeData.split(',')[1];
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Get e-invoice details by invoice ID
   */
  async getEInvoiceByInvoiceId(invoiceId: string): Promise<EInvoiceData | null> {
    try {
      const eInvoiceRows = await this.sheetsService.query('E_Invoices', { invoice_id: invoiceId });
      
      if (eInvoiceRows.length === 0) {
        return null;
      }
      
      const eInvoice = eInvoiceRows[0];
      
      return {
        id: eInvoice.id,
        invoice_id: eInvoice.invoice_id,
        irn: eInvoice.irn,
        ack_no: eInvoice.ack_no,
        ack_date: eInvoice.ack_date,
        signed_qr_code: eInvoice.signed_qr_code,
        signed_invoice: eInvoice.signed_invoice,
        status: eInvoice.status as EInvoiceStatus,
        created_at: new Date(eInvoice.created_at),
        updated_at: new Date(eInvoice.updated_at)
      };
    } catch (error) {
      console.error(`Error getting e-invoice for invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Cancel e-invoice
   */
  async cancelEInvoice(invoiceId: string, reason: string): Promise<boolean> {
    try {
      // Get e-invoice details
      const eInvoice = await this.getEInvoiceByInvoiceId(invoiceId);
      
      if (!eInvoice || eInvoice.status !== EInvoiceStatus.GENERATED) {
        throw new Error(`No active e-invoice found for invoice ${invoiceId}`);
      }
      
      // In a real implementation, we would call the GST e-invoice cancellation API
      // For this demo, we'll simulate the API call
      await this.simulateEInvoiceCancellationAPICall(eInvoice.irn, reason);
      
      // Update e-invoice status
      eInvoice.status = EInvoiceStatus.CANCELLED;
      eInvoice.updated_at = new Date();
      
      // Save to Google Sheets
      await this.sheetsService.update('E_Invoices', eInvoice.id, {
        id: eInvoice.id,
        invoice_id: eInvoice.invoice_id,
        irn: eInvoice.irn,
        ack_no: eInvoice.ack_no,
        ack_date: eInvoice.ack_date,
        signed_qr_code: eInvoice.signed_qr_code,
        signed_invoice: eInvoice.signed_invoice,
        status: eInvoice.status,
        created_at: eInvoice.created_at.toISOString(),
        updated_at: eInvoice.updated_at.toISOString()
      });
      
      return true;
    } catch (error) {
      console.error(`Error cancelling e-invoice for invoice ${invoiceId}:`, error);
      throw new Error(`Failed to cancel e-invoice: ${error.message}`);
    }
  }

  /**
   * Simulate e-invoice cancellation API call
   */
  private async simulateEInvoiceCancellationAPICall(irn: string, reason: string): Promise<void> {
    // In a real implementation, we would make an API call like:
    /*
    await axios.post(
      `${this.apiBaseUrl}/einvoice/v1/cancel`,
      {
        irn,
        CnlRsn: "1", // Reason code
        CnlRem: reason
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'gstin': this.gstin
        }
      }
    );
    */
    
    // For this demo, we'll simulate the response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500); // Simulate API delay
    });
  }

  /**
   * Generate e-invoice PDF with QR code
   */
  async generateEInvoicePDF(invoiceId: string): Promise<Buffer> {
    try {
      // Get e-invoice details
      const eInvoice = await this.getEInvoiceByInvoiceId(invoiceId);
      
      if (!eInvoice || eInvoice.status !== EInvoiceStatus.GENERATED) {
        throw new Error(`No active e-invoice found for invoice ${invoiceId}`);
      }
      
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }
      
      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Get client details
      const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
      if (clientRows.length === 0) {
        throw new Error(`Client ${invoice.client_id} not found`);
      }
      
      const client = Client.fromSheetRow(clientRows[0]);
      
      // Get project details if available
      let project: Project | null = null;
      if (invoice.project_id) {
        const projectRows = await this.sheetsService.read('Projects', invoice.project_id);
        if (projectRows.length > 0) {
          project = Project.fromSheetRow(projectRows[0]);
        }
      }
      
      // Generate GST-compliant invoice PDF
      const pdfBuffer = await generateGSTInvoicePDF(invoice, client, project || new Project());
      
      // In a real implementation, we would embed the QR code in the PDF
      // For this demo, we'll just return the GST invoice PDF
      
      return pdfBuffer;
    } catch (error) {
      console.error(`Error generating e-invoice PDF for invoice ${invoiceId}:`, error);
      throw new Error(`Failed to generate e-invoice PDF: ${error.message}`);
    }
  }
}

// Factory function to create EInvoicingService instance
export function createEInvoicingService(sheetsService: GoogleSheetsService): EInvoicingService {
  return new EInvoicingService(sheetsService);
}