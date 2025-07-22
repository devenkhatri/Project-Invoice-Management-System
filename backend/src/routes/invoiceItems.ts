import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { GoogleSheetsService } from '../services/googleSheets';
import { InvoiceItem, Invoice, InvoiceItemType } from '../models';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeInvoiceItemRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

// Get all items for a specific invoice
router.get('/invoice/:invoiceId',
  authenticateToken,
  param('invoiceId').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;

      // Verify invoice exists
      const invoiceRows = await sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      // Get invoice items
      const itemRows = await sheetsService.query('Invoice_Items', { invoice_id: invoiceId });
      const items = itemRows.map(row => InvoiceItem.fromSheetRow(row));

      res.json(items);
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      res.status(500).json({ error: 'Failed to fetch invoice items' });
    }
  }
);

// Get single invoice item by ID
router.get('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const itemRows = await sheetsService.read('Invoice_Items', id);
      if (itemRows.length === 0) {
        res.status(404).json({ error: 'Invoice item not found' });
        return;
      }

      const item = InvoiceItem.fromSheetRow(itemRows[0]);
      res.json(item);
    } catch (error) {
      console.error('Error fetching invoice item:', error);
      res.status(500).json({ error: 'Failed to fetch invoice item' });
    }
  }
);

// Add item to invoice
router.post('/',
  authenticateToken,
  body('invoice_id').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('quantity').isNumeric().custom(value => value > 0),
  body('rate').isNumeric().custom(value => value >= 0),
  body('type').isIn(['service', 'product', 'expense', 'discount']),
  body('hsn_sac').optional().isString(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { invoice_id, description, quantity, rate, type, hsn_sac } = req.body;

      // Verify invoice exists
      const invoiceRows = await sheetsService.read('Invoices', invoice_id);
      if (invoiceRows.length === 0) {
        res.status(400).json({ error: 'Invoice not found' });
        return;
      }

      // Create invoice item
      const itemData = {
        invoice_id,
        description,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        type: type as InvoiceItemType,
        hsn_sac
      };

      const item = new InvoiceItem(itemData);
      item.calculateAmount();

      // Save to Google Sheets
      const itemId = await sheetsService.create('Invoice_Items', item.toSheetRow());
      item.id = itemId;

      // Update invoice totals
      await updateInvoiceTotals(invoice_id);

      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating invoice item:', error);
      res.status(500).json({ error: 'Failed to create invoice item' });
    }
  }
);

// Update invoice item
router.put('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('description').optional().isString(),
  body('quantity').optional().isNumeric().custom(value => value > 0),
  body('rate').optional().isNumeric().custom(value => value >= 0),
  body('type').optional().isIn(['service', 'product', 'expense', 'discount']),
  body('hsn_sac').optional().isString(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get existing item
      const itemRows = await sheetsService.read('Invoice_Items', id);
      if (itemRows.length === 0) {
        res.status(404).json({ error: 'Invoice item not found' });
        return;
      }

      const item = InvoiceItem.fromSheetRow(itemRows[0]);

      // Apply updates
      if (updates.description !== undefined) item.description = updates.description;
      if (updates.quantity !== undefined) item.quantity = parseFloat(updates.quantity);
      if (updates.rate !== undefined) item.rate = parseFloat(updates.rate);
      if (updates.type !== undefined) item.type = updates.type as InvoiceItemType;
      if (updates.hsn_sac !== undefined) item.hsn_sac = updates.hsn_sac;

      // Recalculate amount
      item.calculateAmount();

      // Update in Google Sheets
      await sheetsService.update('Invoice_Items', id, item.toSheetRow());

      // Update invoice totals
      await updateInvoiceTotals(item.invoice_id);

      res.json(item);
    } catch (error) {
      console.error('Error updating invoice item:', error);
      res.status(500).json({ error: 'Failed to update invoice item' });
    }
  }
);

// Delete invoice item
router.delete('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Get existing item to get invoice_id
      const itemRows = await sheetsService.read('Invoice_Items', id);
      if (itemRows.length === 0) {
        res.status(404).json({ error: 'Invoice item not found' });
        return;
      }

      const item = InvoiceItem.fromSheetRow(itemRows[0]);

      // Delete from Google Sheets
      await sheetsService.delete('Invoice_Items', id);

      // Update invoice totals
      await updateInvoiceTotals(item.invoice_id);

      res.json({ message: 'Invoice item deleted successfully' });
    } catch (error) {
      console.error('Error deleting invoice item:', error);
      res.status(500).json({ error: 'Failed to delete invoice item' });
    }
  }
);

// Helper function to update invoice totals when items change
async function updateInvoiceTotals(invoiceId: string): Promise<void> {
  try {
    // Get invoice
    const invoiceRows = await sheetsService.read('Invoices', invoiceId);
    if (invoiceRows.length === 0) return;

    const invoice = Invoice.fromSheetRow(invoiceRows[0]);

    // Get all items for this invoice
    const itemRows = await sheetsService.query('Invoice_Items', { invoice_id: invoiceId });
    const items = itemRows.map(row => InvoiceItem.fromSheetRow(row));

    // Update invoice with items
    invoice.items = items;
    invoice.recalculateTotal();

    // Save updated invoice
    await sheetsService.update('Invoices', invoiceId, invoice.toSheetRow());
  } catch (error) {
    console.error('Error updating invoice totals:', error);
    throw error;
  }
}

export default router;