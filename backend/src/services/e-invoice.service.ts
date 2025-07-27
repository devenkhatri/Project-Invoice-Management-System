import crypto from 'crypto';
import QRCode from 'qrcode';
import { SheetsService } from './sheets.service';

export interface EInvoiceData {
  version: string;
  tranDtls: {
    taxSch: string;
    supTyp: string;
    regRev: string;
    ecmGstin?: string;
    igstOnIntra: string;
  };
  docDtls: {
    typ: string;
    no: string;
    dt: string;
  };
  sellerDtls: {
    gstin: string;
    lglNm: string;
    trdNm?: string;
    addr1: string;
    addr2?: string;
    loc: string;
    pin: number;
    stcd: string;
    ph?: string;
    em?: string;
  };
  buyerDtls: {
    gstin?: string;
    lglNm: string;
    trdNm?: string;
    pos: string;
    addr1: string;
    addr2?: string;
    loc: string;
    pin: number;
    stcd: string;
    ph?: string;
    em?: string;
  };
  itemList: Array<{
    slNo: string;
    prdDesc: string;
    isServc: string;
    hsnCd: string;
    qty?: number;
    freeQty?: number;
    unit?: string;
    unitPrice: number;
    totAmt: number;
    discount?: number;
    preVatVal?: number;
    assAmt: number;
    gstRt: number;
    igstAmt?: number;
    cgstAmt?: number;
    sgstAmt?: number;
    cesRt?: number;
    cesAmt?: number;
    cesNonAdvlAmt?: number;
    stateCesRt?: number;
    stateCesAmt?: number;
    stateCesNonAdvlAmt?: number;
    othChrg?: number;
    totItemVal: number;
  }>;
  valDtls: {
    assVal: number;
    cgstVal?: number;
    sgstVal?: number;
    igstVal?: number;
    cesVal?: number;
    stCesVal?: number;
    discount?: number;
    othChrg?: number;
    rndOffAmt?: number;
    totInvVal: number;
  };
}

export interface EInvoiceResponse {
  irn: string;
  ackNo: string;
  ackDt: string;
  signedInvoice: string;
  signedQRCode: string;
  status: string;
  ewbNo?: string;
  ewbDt?: string;
  ewbValidTill?: string;
}

export class EInvoiceService {
  private sheetsService: SheetsService;
  private gstinApiUrl: string;
  private apiKey: string;

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    this.sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
    this.gstinApiUrl = process.env.GSTN_API_URL || 'https://api.mastergst.com/einvoice/type/GENERATE/version/V1_03';
    this.apiKey = process.env.GSTN_API_KEY || '';
  }

  async generateEInvoice(invoiceId: string): Promise<EInvoiceResponse> {
    try {
      // Get invoice data
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (!invoices.length) {
        throw new Error('Invoice not found');
      }

      const invoice = invoices[0];
      
      // Get client data
      const clients = await this.sheetsService.query('Clients', { id: invoice.client_id });
      if (!clients.length) {
        throw new Error('Client not found');
      }

      const client = clients[0];

      // Generate e-invoice data
      const eInvoiceData = await this.buildEInvoiceData(invoice, client);

      // Submit to GSTN
      const response = await this.submitToGSTN(eInvoiceData);

      // Store IRN and other details back to invoice
      await this.sheetsService.update('Invoices', invoiceId, {
        irn: response.irn,
        ack_no: response.ackNo,
        ack_date: response.ackDt,
        e_invoice_status: 'generated',
        signed_qr_code: response.signedQRCode
      });

      return response;
    } catch (error) {
      throw new Error(`Failed to generate e-invoice: ${error.message}`);
    }
  }

  private async buildEInvoiceData(invoice: any, client: any): Promise<EInvoiceData> {
    const sellerDetails = {
      gstin: process.env.BUSINESS_GSTIN || '',
      lglNm: process.env.BUSINESS_LEGAL_NAME || '',
      trdNm: process.env.BUSINESS_TRADE_NAME || '',
      addr1: process.env.BUSINESS_ADDRESS_1 || '',
      addr2: process.env.BUSINESS_ADDRESS_2 || '',
      loc: process.env.BUSINESS_LOCATION || '',
      pin: parseInt(process.env.BUSINESS_PIN || '400001'),
      stcd: process.env.BUSINESS_STATE_CODE || '27',
      ph: process.env.BUSINESS_PHONE || '',
      em: process.env.BUSINESS_EMAIL || ''
    };

    const buyerDetails = {
      gstin: client.gstin || undefined,
      lglNm: client.name,
      trdNm: client.trade_name || client.name,
      pos: this.getStateCode(client.address),
      addr1: client.address.split(',')[0] || '',
      addr2: client.address.split(',')[1] || '',
      loc: client.city || '',
      pin: parseInt(client.pin_code || '400001'),
      stcd: this.getStateCode(client.address),
      ph: client.phone || '',
      em: client.email || ''
    };

    // Get invoice line items (simplified - assuming single service)
    const itemList = [{
      slNo: '1',
      prdDesc: invoice.description || 'Professional Services',
      isServc: 'Y',
      hsnCd: invoice.hsn_code || '998314',
      qty: 1,
      unit: 'NOS',
      unitPrice: invoice.amount,
      totAmt: invoice.amount,
      assAmt: invoice.amount,
      gstRt: invoice.tax_rate || 18,
      igstAmt: this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount : 0,
      cgstAmt: !this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount / 2 : 0,
      sgstAmt: !this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount / 2 : 0,
      totItemVal: invoice.total_amount
    }];

    const valDtls = {
      assVal: invoice.amount,
      cgstVal: !this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount / 2 : 0,
      sgstVal: !this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount / 2 : 0,
      igstVal: this.isInterState(sellerDetails.stcd, buyerDetails.stcd) ? invoice.tax_amount : 0,
      totInvVal: invoice.total_amount
    };

    return {
      version: '1.1',
      tranDtls: {
        taxSch: 'GST',
        supTyp: 'B2B',
        regRev: 'N',
        igstOnIntra: 'N'
      },
      docDtls: {
        typ: 'INV',
        no: invoice.invoice_number,
        dt: this.formatDate(invoice.created_at)
      },
      sellerDtls: sellerDetails,
      buyerDtls: buyerDetails,
      itemList,
      valDtls
    };
  }

  private async submitToGSTN(eInvoiceData: EInvoiceData): Promise<EInvoiceResponse> {
    try {
      const response = await fetch(this.gstinApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': process.env.GSTN_CLIENT_ID || '',
          'client_secret': process.env.GSTN_CLIENT_SECRET || '',
          'gstin': process.env.BUSINESS_GSTIN || ''
        },
        body: JSON.stringify(eInvoiceData)
      });

      if (!response.ok) {
        throw new Error(`GSTN API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status_cd !== '1') {
        throw new Error(`GSTN error: ${result.status_desc}`);
      }

      return {
        irn: result.data.Irn,
        ackNo: result.data.AckNo,
        ackDt: result.data.AckDt,
        signedInvoice: result.data.SignedInvoice,
        signedQRCode: result.data.SignedQRCode,
        status: 'success',
        ewbNo: result.data.EwbNo,
        ewbDt: result.data.EwbDt,
        ewbValidTill: result.data.EwbValidTill
      };
    } catch (error) {
      throw new Error(`Failed to submit to GSTN: ${error.message}`);
    }
  }

  async generateQRCode(invoiceId: string): Promise<string> {
    try {
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (!invoices.length) {
        throw new Error('Invoice not found');
      }

      const invoice = invoices[0];
      
      if (!invoice.irn) {
        throw new Error('Invoice does not have IRN. Generate e-invoice first.');
      }

      // QR Code data format as per GSTN specifications
      const qrData = {
        irn: invoice.irn,
        dt: this.formatDate(invoice.created_at),
        amt: invoice.total_amount.toString()
      };

      const qrString = Object.entries(qrData)
        .map(([key, value]) => `${key}:${value}`)
        .join('|');

      const qrCodeDataURL = await QRCode.toDataURL(qrString);
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  async cancelEInvoice(invoiceId: string, reason: string): Promise<boolean> {
    try {
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (!invoices.length) {
        throw new Error('Invoice not found');
      }

      const invoice = invoices[0];
      
      if (!invoice.irn) {
        throw new Error('Invoice does not have IRN');
      }

      const cancelData = {
        irn: invoice.irn,
        cnlRsn: reason,
        cnlRem: 'Invoice cancelled'
      };

      const response = await fetch(`${this.gstinApiUrl}/CANCEL`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': process.env.GSTN_CLIENT_ID || '',
          'client_secret': process.env.GSTN_CLIENT_SECRET || '',
          'gstin': process.env.BUSINESS_GSTIN || ''
        },
        body: JSON.stringify(cancelData)
      });

      if (!response.ok) {
        throw new Error(`GSTN API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status_cd === '1') {
        // Update invoice status
        await this.sheetsService.update('Invoices', invoiceId, {
          e_invoice_status: 'cancelled',
          cancellation_date: new Date().toISOString()
        });
        return true;
      }

      throw new Error(`Cancellation failed: ${result.status_desc}`);
    } catch (error) {
      throw new Error(`Failed to cancel e-invoice: ${error.message}`);
    }
  }

  private getStateCode(address: string): string {
    const stateMapping = {
      'Maharashtra': '27',
      'Karnataka': '29',
      'Tamil Nadu': '33',
      'Delhi': '07',
      'Gujarat': '24',
      'Rajasthan': '08',
      'Uttar Pradesh': '09',
      'West Bengal': '19'
    };

    for (const [state, code] of Object.entries(stateMapping)) {
      if (address.includes(state)) {
        return code;
      }
    }

    return '27'; // Default to Maharashtra
  }

  private isInterState(sellerState: string, buyerState: string): boolean {
    return sellerState !== buyerState;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0].replace(/-/g, '/');
  }

  async getEInvoiceStatus(irn: string): Promise<any> {
    try {
      const response = await fetch(`${this.gstinApiUrl}/STATUS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': process.env.GSTN_CLIENT_ID || '',
          'client_secret': process.env.GSTN_CLIENT_SECRET || '',
          'gstin': process.env.BUSINESS_GSTIN || ''
        },
        body: JSON.stringify({ irn })
      });

      if (!response.ok) {
        throw new Error(`GSTN API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get e-invoice status: ${error.message}`);
    }
  }
}