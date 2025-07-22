import { GoogleSheetsService } from './googleSheets';
import { Invoice, InvoiceStatus } from '../models/Invoice';
import { Client } from '../models/Client';
import { FinancialReportingService, ReportFormat } from './financialReporting';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import NodeCache from 'node-cache';

// Cache configuration (TTL in seconds)
const CACHE_TTL = 300; // 5 minutes

// Define GST report types
export enum GSTReportType {
  GSTR1 = 'gstr1',  // Outward supplies
  GSTR2 = 'gstr2',  // Inward supplies
  GSTR3B = 'gstr3b', // Monthly summary
  GSTR9 = 'gstr9'   // Annual return
}

// Interface for GST report filters
export interface GSTReportFilters {
  startDate: Date;
  endDate: Date;
  gstType?: 'intra' | 'inter' | 'all'; // Intra-state or Inter-state
  clientId?: string;
  invoiceStatus?: InvoiceStatus[];
}

// Interface for GSTR1 report data
export interface GSTR1ReportData {
  b2b: B2BInvoice[]; // B2B invoices
  b2c: B2CInvoice[]; // B2C invoices (large)
  b2cs: B2CSInvoice[]; // B2C small invoices (aggregated)
  hsn: HSNSummary[]; // HSN summary
}

// Interface for B2B invoice data
export interface B2BInvoice {
  gstin: string;
  receiverName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: 'Y' | 'N';
  applicableRate: number;
  taxableValue: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cessAmount?: number;
}

// Interface for B2C large invoice data
export interface B2CInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  applicableRate: number;
  taxableValue: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cessAmount?: number;
}

// Interface for B2C small invoice data (aggregated)
export interface B2CSInvoice {
  placeOfSupply: string;
  applicableRate: number;
  taxableValue: number;
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cessAmount?: number;
}

// Interface for HSN summary
export interface HSNSummary {
  hsnCode: string;
  description: string;
  uqc: string; // Unit Quantity Code
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

/**
 * GST Reporting Service
 * Handles GST report generation and compliance
 */
export class GSTReportingService {
  private sheetsService: GoogleSheetsService;
  private financialReportingService: FinancialReportingService;
  private cache: NodeCache;
  private companyGSTIN: string;
  private companyState: string;

  constructor(sheetsService: GoogleSheetsService, financialReportingService: FinancialReportingService) {
    this.sheetsService = sheetsService;
    this.financialReportingService = financialReportingService;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });
    
    // Company details - should be loaded from configuration
    this.companyGSTIN = process.env.COMPANY_GSTIN || '27AAAAA0000A1Z5';
    this.companyState = process.env.COMPANY_STATE || 'Maharashtra';
  }

  /**
   * Get all invoices with optional filters for GST reporting
   */
  private async getInvoicesForGST(filters: GSTReportFilters): Promise<Invoice[]> {
    const cacheKey = `gst_invoices_${JSON.stringify(filters)}`;
    const cachedInvoices = this.cache.get<Invoice[]>(cacheKey);
    
    if (cachedInvoices) {
      return cachedInvoices;
    }

    try {
      let invoices = await this.sheetsService.read('Invoices');
      invoices = invoices.map(row => Invoice.fromSheetRow(row));

      // Apply filters
      if (filters.clientId) {
        invoices = invoices.filter(invoice => invoice.client_id === filters.clientId);
      }

      if (filters.invoiceStatus && filters.invoiceStatus.length > 0) {
        invoices = invoices.filter(invoice => filters.invoiceStatus!.includes(invoice.status));
      }

      // Filter by date range
      invoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at);
        return invoiceDate >= filters.startDate && invoiceDate <= filters.endDate;
      });

      this.cache.set(cacheKey, invoices);
      return invoices;
    } catch (error) {
      console.error('Error fetching invoices for GST:', error);
      throw new Error('Failed to fetch invoices for GST reporting');
    }
  }

  /**
   * Get client details for GST reporting
   */
  private async getClientDetails(clientIds: string[]): Promise<Map<string, Client>> {
    try {
      const clientMap = new Map<string, Client>();
      
      // Batch fetch clients
      const clientRows = await this.sheetsService.read('Clients');
      const clients = clientRows.map(row => Client.fromSheetRow(row));
      
      // Create a map for quick lookup
      clients.forEach(client => {
        if (clientIds.includes(client.id)) {
          clientMap.set(client.id, client);
        }
      });
      
      return clientMap;
    } catch (error) {
      console.error('Error fetching client details:', error);
      throw new Error('Failed to fetch client details for GST reporting');
    }
  }

  /**
   * Determine if a transaction is inter-state or intra-state
   */
  private isInterStateTransaction(clientState: string): boolean {
    return clientState !== this.companyState;
  }

  /**
   * Generate GSTR1 report data
   */
  async generateGSTR1Report(filters: GSTReportFilters): Promise<GSTR1ReportData> {
    try {
      // Get invoices for the period
      const invoices = await this.getInvoicesForGST(filters);
      
      // Get unique client IDs
      const clientIds = [...new Set(invoices.map(inv => inv.client_id))];
      
      // Get client details
      const clientMap = await this.getClientDetails(clientIds);
      
      // Initialize report data
      const reportData: GSTR1ReportData = {
        b2b: [],
        b2c: [],
        b2cs: [],
        hsn: []
      };
      
      // Process each invoice
      for (const invoice of invoices) {
        const client = clientMap.get(invoice.client_id);
        
        if (!client) {
          console.warn(`Client not found for invoice ${invoice.id}`);
          continue;
        }
        
        // Determine if B2B or B2C based on GSTIN
        if (client.gstin) {
          // B2B invoice
          const isInterState = this.isInterStateTransaction(client.state || '');
          
          // Apply GST type filter if specified
          if (filters.gstType === 'intra' && isInterState) continue;
          if (filters.gstType === 'inter' && !isInterState) continue;
          
          const b2bInvoice: B2BInvoice = {
            gstin: client.gstin,
            receiverName: client.name,
            invoiceNumber: invoice.invoice_number,
            invoiceDate: invoice.created_at.toISOString().split('T')[0],
            invoiceValue: invoice.total_amount,
            placeOfSupply: client.state || this.companyState,
            reverseCharge: 'N', // Assuming no reverse charge
            applicableRate: invoice.getTaxRate(),
            taxableValue: invoice.amount,
          };
          
          // Set tax amounts based on inter/intra state
          if (isInterState) {
            b2bInvoice.igstAmount = invoice.tax_amount;
          } else {
            b2bInvoice.cgstAmount = invoice.tax_amount / 2;
            b2bInvoice.sgstAmount = invoice.tax_amount / 2;
          }
          
          reportData.b2b.push(b2bInvoice);
        } else {
          // B2C invoice
          const isInterState = this.isInterStateTransaction(client.state || '');
          
          // Apply GST type filter if specified
          if (filters.gstType === 'intra' && isInterState) continue;
          if (filters.gstType === 'inter' && !isInterState) continue;
          
          // For B2C, large invoices (>= 2.5 lakhs) are reported individually
          if (invoice.total_amount >= 250000) {
            const b2cInvoice: B2CInvoice = {
              invoiceNumber: invoice.invoice_number,
              invoiceDate: invoice.created_at.toISOString().split('T')[0],
              invoiceValue: invoice.total_amount,
              placeOfSupply: client.state || this.companyState,
              applicableRate: invoice.getTaxRate(),
              taxableValue: invoice.amount,
            };
            
            // Set tax amounts based on inter/intra state
            if (isInterState) {
              b2cInvoice.igstAmount = invoice.tax_amount;
            } else {
              b2cInvoice.cgstAmount = invoice.tax_amount / 2;
              b2cInvoice.sgstAmount = invoice.tax_amount / 2;
            }
            
            reportData.b2c.push(b2cInvoice);
          } else {
            // Small B2C invoices are aggregated
            const placeOfSupply = client.state || this.companyState;
            const rate = invoice.getTaxRate();
            
            // Find existing entry or create new one
            let b2csEntry = reportData.b2cs.find(entry => 
              entry.placeOfSupply === placeOfSupply && 
              entry.applicableRate === rate
            );
            
            if (!b2csEntry) {
              b2csEntry = {
                placeOfSupply,
                applicableRate: rate,
                taxableValue: 0,
                igstAmount: 0,
                cgstAmount: 0,
                sgstAmount: 0
              };
              reportData.b2cs.push(b2csEntry);
            }
            
            // Update aggregated values
            b2csEntry.taxableValue += invoice.amount;
            
            if (isInterState) {
              b2csEntry.igstAmount! += invoice.tax_amount;
            } else {
              b2csEntry.cgstAmount! += invoice.tax_amount / 2;
              b2csEntry.sgstAmount! += invoice.tax_amount / 2;
            }
          }
        }
        
        // Process HSN data
        // For simplicity, we're assuming a single HSN code for all services
        // In a real implementation, this would come from invoice line items
        const hsnCode = '998314'; // Professional services
        
        // Find existing HSN entry or create new one
        let hsnEntry = reportData.hsn.find(entry => entry.hsnCode === hsnCode);
        
        if (!hsnEntry) {
          hsnEntry = {
            hsnCode,
            description: 'Professional IT Services',
            uqc: 'OTH', // Others
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessAmount: 0
          };
          reportData.hsn.push(hsnEntry);
        }
        
        // Update HSN summary
        hsnEntry.totalQuantity += 1;
        hsnEntry.totalValue += invoice.total_amount;
        hsnEntry.taxableValue += invoice.amount;
        
        const isInterState = this.isInterStateTransaction(client.state || '');
        if (isInterState) {
          hsnEntry.igstAmount += invoice.tax_amount;
        } else {
          hsnEntry.cgstAmount += invoice.tax_amount / 2;
          hsnEntry.sgstAmount += invoice.tax_amount / 2;
        }
      }
      
      return reportData;
    } catch (error) {
      console.error('Error generating GSTR1 report:', error);
      throw new Error('Failed to generate GSTR1 report');
    }
  }

  /**
   * Generate GSTR3B report data
   */
  async generateGSTR3BReport(filters: GSTReportFilters): Promise<any> {
    try {
      // Get GSTR1 data first
      const gstr1Data = await this.generateGSTR1Report(filters);
      
      // Calculate outward supplies
      const outwardSupplies = {
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0
      };
      
      // Add B2B invoices
      gstr1Data.b2b.forEach(invoice => {
        outwardSupplies.taxableValue += invoice.taxableValue;
        outwardSupplies.igstAmount += invoice.igstAmount || 0;
        outwardSupplies.cgstAmount += invoice.cgstAmount || 0;
        outwardSupplies.sgstAmount += invoice.sgstAmount || 0;
        outwardSupplies.cessAmount += invoice.cessAmount || 0;
      });
      
      // Add B2C large invoices
      gstr1Data.b2c.forEach(invoice => {
        outwardSupplies.taxableValue += invoice.taxableValue;
        outwardSupplies.igstAmount += invoice.igstAmount || 0;
        outwardSupplies.cgstAmount += invoice.cgstAmount || 0;
        outwardSupplies.sgstAmount += invoice.sgstAmount || 0;
        outwardSupplies.cessAmount += invoice.cessAmount || 0;
      });
      
      // Add B2C small invoices
      gstr1Data.b2cs.forEach(invoice => {
        outwardSupplies.taxableValue += invoice.taxableValue;
        outwardSupplies.igstAmount += invoice.igstAmount || 0;
        outwardSupplies.cgstAmount += invoice.cgstAmount || 0;
        outwardSupplies.sgstAmount += invoice.sgstAmount || 0;
        outwardSupplies.cessAmount += invoice.cessAmount || 0;
      });
      
      // For a real GSTR3B, we would also need inward supplies (purchases)
      // and ITC (Input Tax Credit) details
      // For this implementation, we'll just use placeholder values
      
      return {
        gstin: this.companyGSTIN,
        legalName: 'Your Company Name',
        tradeName: 'Your Company Name',
        period: {
          month: filters.startDate.getMonth() + 1,
          year: filters.startDate.getFullYear()
        },
        outwardSupplies,
        inwardSupplies: {
          taxableValue: 0,
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          cessAmount: 0
        },
        itcAvailed: {
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          cessAmount: 0
        },
        taxPayable: {
          igstAmount: outwardSupplies.igstAmount,
          cgstAmount: outwardSupplies.cgstAmount,
          sgstAmount: outwardSupplies.sgstAmount,
          cessAmount: outwardSupplies.cessAmount
        }
      };
    } catch (error) {
      console.error('Error generating GSTR3B report:', error);
      throw new Error('Failed to generate GSTR3B report');
    }
  }

  /**
   * Export GST report to specified format
   */
  async exportGSTReport(reportType: GSTReportType, data: any, format: ReportFormat): Promise<Buffer | string> {
    try {
      switch (format) {
        case ReportFormat.JSON:
          return JSON.stringify(data, null, 2);
        
        case ReportFormat.CSV:
          return this.convertGSTReportToCSV(reportType, data);
        
        case ReportFormat.PDF:
          return this.generateGSTReportPDF(reportType, data);
        
        case ReportFormat.EXCEL:
          // This would typically use an Excel generation library
          // For now, we'll just return a placeholder
          return Buffer.from('Excel generation not implemented yet');
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error(`Error exporting GST report to ${format}:`, error);
      throw new Error(`Failed to export GST report to ${format}`);
    }
  }

  /**
   * Convert GST report data to CSV format
   */
  private convertGSTReportToCSV(reportType: GSTReportType, data: any): string {
    switch (reportType) {
      case GSTReportType.GSTR1:
        return this.convertGSTR1ToCSV(data);
      
      case GSTReportType.GSTR3B:
        return this.convertGSTR3BToCSV(data);
      
      default:
        throw new Error(`CSV export not implemented for ${reportType}`);
    }
  }

  /**
   * Convert GSTR1 data to CSV
   */
  private convertGSTR1ToCSV(data: GSTR1ReportData): string {
    let csv = '';
    
    // B2B invoices
    if (data.b2b.length > 0) {
      csv += 'B2B Invoices\n';
      csv += 'GSTIN,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Place of Supply,Reverse Charge,Rate,Taxable Value,IGST,CGST,SGST,Cess\n';
      
      data.b2b.forEach(invoice => {
        csv += `${invoice.gstin},${invoice.receiverName},${invoice.invoiceNumber},${invoice.invoiceDate},${invoice.invoiceValue},${invoice.placeOfSupply},${invoice.reverseCharge},${invoice.applicableRate},${invoice.taxableValue},${invoice.igstAmount || 0},${invoice.cgstAmount || 0},${invoice.sgstAmount || 0},${invoice.cessAmount || 0}\n`;
      });
      
      csv += '\n';
    }
    
    // B2C large invoices
    if (data.b2c.length > 0) {
      csv += 'B2C Large Invoices\n';
      csv += 'Invoice Number,Invoice Date,Invoice Value,Place of Supply,Rate,Taxable Value,IGST,CGST,SGST,Cess\n';
      
      data.b2c.forEach(invoice => {
        csv += `${invoice.invoiceNumber},${invoice.invoiceDate},${invoice.invoiceValue},${invoice.placeOfSupply},${invoice.applicableRate},${invoice.taxableValue},${invoice.igstAmount || 0},${invoice.cgstAmount || 0},${invoice.sgstAmount || 0},${invoice.cessAmount || 0}\n`;
      });
      
      csv += '\n';
    }
    
    // B2C small invoices
    if (data.b2cs.length > 0) {
      csv += 'B2C Small Invoices\n';
      csv += 'Place of Supply,Rate,Taxable Value,IGST,CGST,SGST,Cess\n';
      
      data.b2cs.forEach(invoice => {
        csv += `${invoice.placeOfSupply},${invoice.applicableRate},${invoice.taxableValue},${invoice.igstAmount || 0},${invoice.cgstAmount || 0},${invoice.sgstAmount || 0},${invoice.cessAmount || 0}\n`;
      });
      
      csv += '\n';
    }
    
    // HSN summary
    if (data.hsn.length > 0) {
      csv += 'HSN Summary\n';
      csv += 'HSN Code,Description,UQC,Total Quantity,Total Value,Taxable Value,IGST,CGST,SGST,Cess\n';
      
      data.hsn.forEach(hsn => {
        csv += `${hsn.hsnCode},${hsn.description},${hsn.uqc},${hsn.totalQuantity},${hsn.totalValue},${hsn.taxableValue},${hsn.igstAmount},${hsn.cgstAmount},${hsn.sgstAmount},${hsn.cessAmount}\n`;
      });
    }
    
    return csv;
  }

  /**
   * Convert GSTR3B data to CSV
   */
  private convertGSTR3BToCSV(data: any): string {
    let csv = '';
    
    csv += 'GSTR3B Summary\n';
    csv += `GSTIN,${data.gstin}\n`;
    csv += `Legal Name,${data.legalName}\n`;
    csv += `Trade Name,${data.tradeName}\n`;
    csv += `Period,${data.period.month}/${data.period.year}\n\n`;
    
    csv += 'Outward Supplies\n';
    csv += 'Taxable Value,IGST,CGST,SGST,Cess\n';
    csv += `${data.outwardSupplies.taxableValue},${data.outwardSupplies.igstAmount},${data.outwardSupplies.cgstAmount},${data.outwardSupplies.sgstAmount},${data.outwardSupplies.cessAmount}\n\n`;
    
    csv += 'Inward Supplies\n';
    csv += 'Taxable Value,IGST,CGST,SGST,Cess\n';
    csv += `${data.inwardSupplies.taxableValue},${data.inwardSupplies.igstAmount},${data.inwardSupplies.cgstAmount},${data.inwardSupplies.sgstAmount},${data.inwardSupplies.cessAmount}\n\n`;
    
    csv += 'ITC Availed\n';
    csv += 'IGST,CGST,SGST,Cess\n';
    csv += `${data.itcAvailed.igstAmount},${data.itcAvailed.cgstAmount},${data.itcAvailed.sgstAmount},${data.itcAvailed.cessAmount}\n\n`;
    
    csv += 'Tax Payable\n';
    csv += 'IGST,CGST,SGST,Cess\n';
    csv += `${data.taxPayable.igstAmount},${data.taxPayable.cgstAmount},${data.taxPayable.sgstAmount},${data.taxPayable.cessAmount}\n`;
    
    return csv;
  }

  /**
   * Generate GST report PDF
   */
  private generateGSTReportPDF(reportType: GSTReportType, data: any): Buffer {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`GST Report - ${reportType.toUpperCase()}`, 105, 20, { align: 'center' });
    
    // Add company details
    doc.setFontSize(12);
    doc.text(`GSTIN: ${this.companyGSTIN}`, 20, 30);
    doc.text(`Company: Your Company Name`, 20, 37);
    
    // Add report period
    let period = '';
    if (reportType === GSTReportType.GSTR3B && data.period) {
      period = `${data.period.month}/${data.period.year}`;
    } else {
      const today = new Date();
      period = `${today.getMonth() + 1}/${today.getFullYear()}`;
    }
    doc.text(`Period: ${period}`, 20, 44);
    
    // Add report date
    const reportDate = new Date().toLocaleDateString('en-IN');
    doc.text(`Report Date: ${reportDate}`, 20, 51);
    
    let yPos = 60;
    
    // Add report content based on type
    if (reportType === GSTReportType.GSTR1) {
      yPos = this.addGSTR1ContentToPDF(doc, data, yPos);
    } else if (reportType === GSTReportType.GSTR3B) {
      yPos = this.addGSTR3BContentToPDF(doc, data, yPos);
    }
    
    // Add footer
    doc.setFontSize(10);
    doc.text('This is a computer-generated report and does not require signature.', 105, 280, { align: 'center' });
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Add GSTR1 content to PDF
   */
  private addGSTR1ContentToPDF(doc: any, data: GSTR1ReportData, startY: number): number {
    let yPos = startY;
    
    // B2B invoices
    if (data.b2b.length > 0) {
      doc.setFontSize(14);
      doc.text('B2B Invoices', 20, yPos);
      yPos += 10;
      
      // @ts-ignore - jspdf-autotable types
      doc.autoTable({
        startY: yPos,
        head: [['GSTIN', 'Invoice No', 'Date', 'Value', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST']],
        body: data.b2b.map(inv => [
          inv.gstin,
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.invoiceValue.toFixed(2),
          `${inv.applicableRate}%`,
          inv.taxableValue.toFixed(2),
          (inv.igstAmount || 0).toFixed(2),
          (inv.cgstAmount || 0).toFixed(2),
          (inv.sgstAmount || 0).toFixed(2)
        ])
      });
      
      // @ts-ignore - jspdf-autotable types
      yPos = doc.lastAutoTable.finalY + 10;
    }
    
    // B2C large invoices
    if (data.b2c.length > 0) {
      doc.setFontSize(14);
      doc.text('B2C Large Invoices', 20, yPos);
      yPos += 10;
      
      // @ts-ignore - jspdf-autotable types
      doc.autoTable({
        startY: yPos,
        head: [['Invoice No', 'Date', 'Value', 'Place of Supply', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST']],
        body: data.b2c.map(inv => [
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.invoiceValue.toFixed(2),
          inv.placeOfSupply,
          `${inv.applicableRate}%`,
          inv.taxableValue.toFixed(2),
          (inv.igstAmount || 0).toFixed(2),
          (inv.cgstAmount || 0).toFixed(2),
          (inv.sgstAmount || 0).toFixed(2)
        ])
      });
      
      // @ts-ignore - jspdf-autotable types
      yPos = doc.lastAutoTable.finalY + 10;
    }
    
    // B2C small invoices
    if (data.b2cs.length > 0) {
      doc.setFontSize(14);
      doc.text('B2C Small Invoices (Aggregated)', 20, yPos);
      yPos += 10;
      
      // @ts-ignore - jspdf-autotable types
      doc.autoTable({
        startY: yPos,
        head: [['Place of Supply', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST']],
        body: data.b2cs.map(inv => [
          inv.placeOfSupply,
          `${inv.applicableRate}%`,
          inv.taxableValue.toFixed(2),
          (inv.igstAmount || 0).toFixed(2),
          (inv.cgstAmount || 0).toFixed(2),
          (inv.sgstAmount || 0).toFixed(2)
        ])
      });
      
      // @ts-ignore - jspdf-autotable types
      yPos = doc.lastAutoTable.finalY + 10;
    }
    
    // HSN summary
    if (data.hsn.length > 0) {
      // Check if we need a new page
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.text('HSN Summary', 20, yPos);
      yPos += 10;
      
      // @ts-ignore - jspdf-autotable types
      doc.autoTable({
        startY: yPos,
        head: [['HSN Code', 'Description', 'Quantity', 'Total Value', 'Taxable Value', 'IGST', 'CGST', 'SGST']],
        body: data.hsn.map(hsn => [
          hsn.hsnCode,
          hsn.description,
          hsn.totalQuantity,
          hsn.totalValue.toFixed(2),
          hsn.taxableValue.toFixed(2),
          hsn.igstAmount.toFixed(2),
          hsn.cgstAmount.toFixed(2),
          hsn.sgstAmount.toFixed(2)
        ])
      });
      
      // @ts-ignore - jspdf-autotable types
      yPos = doc.lastAutoTable.finalY + 10;
    }
    
    return yPos;
  }

  /**
   * Add GSTR3B content to PDF
   */
  private addGSTR3BContentToPDF(doc: any, data: any, startY: number): number {
    let yPos = startY;
    
    // Summary
    doc.setFontSize(14);
    doc.text('GSTR3B Summary', 20, yPos);
    yPos += 10;
    
    // Outward supplies
    doc.setFontSize(12);
    doc.text('Outward Supplies', 20, yPos);
    yPos += 10;
    
    // @ts-ignore - jspdf-autotable types
    doc.autoTable({
      startY: yPos,
      head: [['Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']],
      body: [[
        data.outwardSupplies.taxableValue.toFixed(2),
        data.outwardSupplies.igstAmount.toFixed(2),
        data.outwardSupplies.cgstAmount.toFixed(2),
        data.outwardSupplies.sgstAmount.toFixed(2),
        data.outwardSupplies.cessAmount.toFixed(2)
      ]]
    });
    
    // @ts-ignore - jspdf-autotable types
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Inward supplies
    doc.setFontSize(12);
    doc.text('Inward Supplies', 20, yPos);
    yPos += 10;
    
    // @ts-ignore - jspdf-autotable types
    doc.autoTable({
      startY: yPos,
      head: [['Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess']],
      body: [[
        data.inwardSupplies.taxableValue.toFixed(2),
        data.inwardSupplies.igstAmount.toFixed(2),
        data.inwardSupplies.cgstAmount.toFixed(2),
        data.inwardSupplies.sgstAmount.toFixed(2),
        data.inwardSupplies.cessAmount.toFixed(2)
      ]]
    });
    
    // @ts-ignore - jspdf-autotable types
    yPos = doc.lastAutoTable.finalY + 10;
    
    // ITC availed
    doc.setFontSize(12);
    doc.text('ITC Availed', 20, yPos);
    yPos += 10;
    
    // @ts-ignore - jspdf-autotable types
    doc.autoTable({
      startY: yPos,
      head: [['IGST', 'CGST', 'SGST', 'Cess']],
      body: [[
        data.itcAvailed.igstAmount.toFixed(2),
        data.itcAvailed.cgstAmount.toFixed(2),
        data.itcAvailed.sgstAmount.toFixed(2),
        data.itcAvailed.cessAmount.toFixed(2)
      ]]
    });
    
    // @ts-ignore - jspdf-autotable types
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Tax payable
    doc.setFontSize(12);
    doc.text('Tax Payable', 20, yPos);
    yPos += 10;
    
    // @ts-ignore - jspdf-autotable types
    doc.autoTable({
      startY: yPos,
      head: [['IGST', 'CGST', 'SGST', 'Cess']],
      body: [[
        data.taxPayable.igstAmount.toFixed(2),
        data.taxPayable.cgstAmount.toFixed(2),
        data.taxPayable.sgstAmount.toFixed(2),
        data.taxPayable.cessAmount.toFixed(2)
      ]]
    });
    
    // @ts-ignore - jspdf-autotable types
    yPos = doc.lastAutoTable.finalY + 10;
    
    return yPos;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
  }
}

// Factory function to create GSTReportingService instance
export function createGSTReportingService(
  sheetsService: GoogleSheetsService,
  financialReportingService: FinancialReportingService
): GSTReportingService {
  return new GSTReportingService(sheetsService, financialReportingService);
}