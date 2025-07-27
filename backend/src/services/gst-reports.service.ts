import { SheetsService } from './sheets.service';
import { Invoice } from '../models/Invoice';
import { Client } from '../models/Client';

export interface GSTR1Record {
  gstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: boolean;
  invoiceType: 'B2B' | 'B2C';
  ecommerceGstin?: string;
  rate: number;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cessAmount: number;
  hsnCode: string;
}

export interface GSTR3BData {
  outwardSupplies: {
    taxableSupplies: number;
    exemptSupplies: number;
    nilRatedSupplies: number;
  };
  inwardSupplies: {
    reverseChargeSupplies: number;
    importOfGoods: number;
    importOfServices: number;
  };
  taxLiability: {
    integratedTax: number;
    centralTax: number;
    stateTax: number;
    cessAmount: number;
  };
  taxPaid: {
    integratedTax: number;
    centralTax: number;
    stateTax: number;
    cessAmount: number;
  };
}

export class GSTReportsService {
  private sheetsService: SheetsService;

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    this.sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
  }

  async generateGSTR1Report(month: number, year: number): Promise<GSTR1Record[]> {
    try {
      // Get all invoices for the specified month/year
      const invoices = await this.sheetsService.query('Invoices', {
        dateRange: {
          start: new Date(year, month - 1, 1),
          end: new Date(year, month, 0)
        }
      });

      // Get all clients for GSTIN lookup
      const clients = await this.sheetsService.read('Clients');
      const clientMap = new Map(clients.map(c => [c.id, c]));

      const gstr1Records: GSTR1Record[] = [];

      for (const invoice of invoices) {
        const client = clientMap.get(invoice.client_id);
        if (!client || !client.gstin) continue;

        const record: GSTR1Record = {
          gstin: client.gstin,
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.created_at,
          invoiceValue: invoice.total_amount,
          placeOfSupply: this.getPlaceOfSupply(client.address),
          reverseCharge: this.isReverseCharge(invoice),
          invoiceType: this.determineInvoiceType(invoice, client),
          rate: this.getTaxRate(invoice),
          taxableValue: invoice.amount,
          integratedTax: this.calculateIGST(invoice, client),
          centralTax: this.calculateCGST(invoice, client),
          stateTax: this.calculateSGST(invoice, client),
          cessAmount: this.calculateCess(invoice),
          hsnCode: this.getHSNCode(invoice)
        };

        gstr1Records.push(record);
      }

      return gstr1Records;
    } catch (error) {
      throw new Error(`Failed to generate GSTR1 report: ${error.message}`);
    }
  }

  async generateGSTR3BReport(month: number, year: number): Promise<GSTR3BData> {
    try {
      const invoices = await this.sheetsService.query('Invoices', {
        dateRange: {
          start: new Date(year, month - 1, 1),
          end: new Date(year, month, 0)
        }
      });

      const expenses = await this.sheetsService.query('Expenses', {
        dateRange: {
          start: new Date(year, month - 1, 1),
          end: new Date(year, month, 0)
        }
      });

      const clients = await this.sheetsService.read('Clients');
      const clientMap = new Map(clients.map(c => [c.id, c]));

      let totalTaxableSupplies = 0;
      let totalIGST = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalCess = 0;

      // Calculate outward supplies
      for (const invoice of invoices) {
        const client = clientMap.get(invoice.client_id);
        if (!client) continue;

        totalTaxableSupplies += invoice.amount;
        totalIGST += this.calculateIGST(invoice, client);
        totalCGST += this.calculateCGST(invoice, client);
        totalSGST += this.calculateSGST(invoice, client);
        totalCess += this.calculateCess(invoice);
      }

      // Calculate inward supplies from expenses
      let reverseChargeSupplies = 0;
      for (const expense of expenses) {
        if (expense.reverse_charge) {
          reverseChargeSupplies += expense.amount;
        }
      }

      const gstr3bData: GSTR3BData = {
        outwardSupplies: {
          taxableSupplies: totalTaxableSupplies,
          exemptSupplies: 0, // Calculate based on exempt transactions
          nilRatedSupplies: 0 // Calculate based on nil-rated transactions
        },
        inwardSupplies: {
          reverseChargeSupplies,
          importOfGoods: 0, // Calculate from import expenses
          importOfServices: 0 // Calculate from import services
        },
        taxLiability: {
          integratedTax: totalIGST,
          centralTax: totalCGST,
          stateTax: totalSGST,
          cessAmount: totalCess
        },
        taxPaid: {
          integratedTax: totalIGST, // Assume paid in full
          centralTax: totalCGST,
          stateTax: totalSGST,
          cessAmount: totalCess
        }
      };

      return gstr3bData;
    } catch (error) {
      throw new Error(`Failed to generate GSTR3B report: ${error.message}`);
    }
  }

  private getPlaceOfSupply(address: string): string {
    // Extract state code from address
    // This is a simplified implementation
    const stateMapping = {
      'Maharashtra': '27',
      'Karnataka': '29',
      'Tamil Nadu': '33',
      'Delhi': '07',
      'Gujarat': '24'
    };

    for (const [state, code] of Object.entries(stateMapping)) {
      if (address.includes(state)) {
        return code;
      }
    }

    return '27'; // Default to Maharashtra
  }

  private isReverseCharge(invoice: any): boolean {
    // Determine if reverse charge applies
    return invoice.reverse_charge || false;
  }

  private determineInvoiceType(invoice: any, client: any): 'B2B' | 'B2C' {
    // B2B if client has GSTIN, B2C otherwise
    return client.gstin ? 'B2B' : 'B2C';
  }

  private getTaxRate(invoice: any): number {
    // Extract tax rate from invoice
    return invoice.tax_rate || 18; // Default 18%
  }

  private calculateIGST(invoice: any, client: any): number {
    // Calculate IGST for inter-state transactions
    const supplierState = '27'; // Your business state
    const clientState = this.getPlaceOfSupply(client.address);
    
    if (supplierState !== clientState) {
      return invoice.amount * (this.getTaxRate(invoice) / 100);
    }
    return 0;
  }

  private calculateCGST(invoice: any, client: any): number {
    // Calculate CGST for intra-state transactions
    const supplierState = '27'; // Your business state
    const clientState = this.getPlaceOfSupply(client.address);
    
    if (supplierState === clientState) {
      return invoice.amount * (this.getTaxRate(invoice) / 200); // Half of total tax
    }
    return 0;
  }

  private calculateSGST(invoice: any, client: any): number {
    // Calculate SGST for intra-state transactions
    const supplierState = '27'; // Your business state
    const clientState = this.getPlaceOfSupply(client.address);
    
    if (supplierState === clientState) {
      return invoice.amount * (this.getTaxRate(invoice) / 200); // Half of total tax
    }
    return 0;
  }

  private calculateCess(invoice: any): number {
    // Calculate cess if applicable
    return invoice.cess_amount || 0;
  }

  private getHSNCode(invoice: any): string {
    // Get HSN/SAC code for the service/product
    return invoice.hsn_code || '998314'; // Default for IT services
  }

  async exportGSTR1ToJSON(month: number, year: number): Promise<string> {
    const data = await this.generateGSTR1Report(month, year);
    return JSON.stringify(data, null, 2);
  }

  async exportGSTR3BToJSON(month: number, year: number): Promise<string> {
    const data = await this.generateGSTR3BReport(month, year);
    return JSON.stringify(data, null, 2);
  }
}