import { Router, Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken, authorizeRoles, authorizeResourceAccess } from '../middleware/auth';
import { ValidationSets } from '../middleware/validation';
import { Client } from '../models/Client';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const sheetsService = SheetsService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all clients with search, filtering, and pagination
 * GET /api/clients
 */
router.get('/', ...ValidationSets.queryWithPagination, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      country,
      is_active,
      gstin,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters: any[] = [];
    
    if (search) {
      // For search, we'll need to get all clients and filter in memory
      // since Google Sheets doesn't support OR queries directly
    }
    
    if (country) {
      filters.push({ column: 'country', operator: 'eq', value: country });
    }
    
    if (is_active !== undefined) {
      filters.push({ column: 'is_active', operator: 'eq', value: is_active === 'true' });
    }
    
    if (gstin) {
      filters.push({ column: 'gstin', operator: 'contains', value: gstin });
    }

    // For client users, only show their own record
    if (req.user?.role === 'client') {
      filters.push({ column: 'email', operator: 'eq', value: req.user.email });
    }

    // Get all clients first (for search functionality)
    let clients = await sheetsService.query('Clients', {
      filters: filters.filter(f => f.column !== 'search'), // Remove search filter for initial query
      sortBy: sort_by as string,
      sortOrder: sort_order as 'asc' | 'desc'
    });

    // Apply search filter in memory if provided
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      clients = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm) ||
        client.email.toLowerCase().includes(searchTerm) ||
        (client.phone && client.phone.includes(searchTerm)) ||
        (client.contact_person && client.contact_person.toLowerCase().includes(searchTerm))
      );
    }

    // Calculate pagination
    const total = clients.length;
    const totalPages = Math.ceil(total / Number(limit));
    const offset = (Number(page) - 1) * Number(limit);
    const paginatedClients = clients.slice(offset, offset + Number(limit));

    // Enhance clients with additional data
    const enhancedClients = await Promise.all(
      paginatedClients.map(async (clientData) => {
        const client = new Client(clientData);
        
        // Get projects for this client
        const projects = await sheetsService.query('Projects', {
          filters: [{ column: 'client_id', operator: 'eq', value: client.id }]
        });
        
        // Get invoices for this client
        const invoices = await sheetsService.query('Invoices', {
          filters: [{ column: 'client_id', operator: 'eq', value: client.id }]
        });

        // Calculate financial metrics
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const paidAmount = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
        const outstandingAmount = totalInvoiced - paidAmount;
        const overdueInvoices = invoices.filter(inv => 
          inv.status === 'overdue' || 
          (inv.status === 'sent' && new Date(inv.due_date) < new Date())
        );

        return {
          ...client.toJSON(),
          project_count: projects.length,
          active_projects: projects.filter(p => p.status === 'active').length,
          invoice_count: invoices.length,
          total_invoiced: totalInvoiced,
          paid_amount: paidAmount,
          outstanding_amount: outstandingAmount,
          overdue_invoices: overdueInvoices.length,
          last_invoice_date: invoices.length > 0 ? 
            Math.max(...invoices.map(inv => new Date(inv.created_at).getTime())) : null,
          gst_compliant: client.validateGSTIN(),
          payment_terms_days: client.getPaymentTermsDays()
        };
      })
    );

    return res.json({
      clients: enhancedClients,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch clients'
    });
  }
});

/**
 * Create a new client with GST validation
 * POST /api/clients
 */
router.post('/', [
  authorizeRoles('admin'),
  ...ValidationSets.createClient
], async (req: Request, res: Response) => {
  try {
    const clientData = {
      ...req.body,
      id: uuidv4(),
      country: req.body.country || 'India',
      default_currency: req.body.default_currency || 'INR',
      payment_terms: req.body.payment_terms || 'Net 30',
      is_active: req.body.is_active !== undefined ? req.body.is_active : true
    };

    // Check if client with same email already exists
    const existingClients = await sheetsService.query('Clients', {
      filters: [{ column: 'email', operator: 'eq', value: clientData.email }]
    });

    if (existingClients.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Client with this email already exists'
      });
    }

    // Create client instance for validation
    const client = new Client(clientData);

    // Additional GST validation for Indian clients
    if (client.isIndianClient() && client.gstin) {
      if (!client.validateGSTIN()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid GSTIN format'
        });
      }
    }

    // PAN validation if provided
    if (client.pan && !client.validatePAN()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid PAN format'
      });
    }

    // Save to sheets
    await sheetsService.create('Clients', client.toJSON());

    console.log(`✅ Client created successfully: ${client.name} (${client.id})`);

    return res.status(201).json({
      message: 'Client created successfully',
      client: {
        ...client.toJSON(),
        gst_compliant: client.validateGSTIN(),
        payment_terms_days: client.getPaymentTermsDays()
      }
    });
  } catch (error) {
    console.error('Create client error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create client'
    });
  }
});

/**
 * Get a single client with projects and invoices
 * GET /api/clients/:id
 */
router.get('/:id', [
  ...ValidationSets.getById,
  authorizeResourceAccess('client')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get client
    const clients = await sheetsService.query('Clients', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (clients.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const client = new Client(clients[0]);

    // Get related data
    const [projects, invoices, communications] = await Promise.all([
      sheetsService.query('Projects', {
        filters: [{ column: 'client_id', operator: 'eq', value: id }],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }),
      sheetsService.query('Invoices', {
        filters: [{ column: 'client_id', operator: 'eq', value: id }],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }),
      sheetsService.query('Client_Communications', {
        filters: [{ column: 'client_id', operator: 'eq', value: id }],
        sortBy: 'created_at',
        sortOrder: 'desc'
      }).catch(() => []) // Communications might not exist yet
    ]);

    // Calculate financial metrics
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const paidAmount = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
    const outstandingAmount = totalInvoiced - paidAmount;
    
    // Group invoices by status
    const invoicesByStatus = {
      draft: invoices.filter(inv => inv.status === 'draft'),
      sent: invoices.filter(inv => inv.status === 'sent'),
      paid: invoices.filter(inv => inv.status === 'paid'),
      overdue: invoices.filter(inv => inv.status === 'overdue'),
      cancelled: invoices.filter(inv => inv.status === 'cancelled')
    };

    // Group projects by status
    const projectsByStatus = {
      active: projects.filter(p => p.status === 'active'),
      completed: projects.filter(p => p.status === 'completed'),
      'on-hold': projects.filter(p => p.status === 'on-hold')
    };

    // Calculate project metrics
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalActualCost = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);

    return res.json({
      client: {
        ...client.toJSON(),
        gst_compliant: client.validateGSTIN(),
        pan_valid: client.validatePAN(),
        payment_terms_days: client.getPaymentTermsDays(),
        full_address: client.getFullAddress(),
        billing_address: client.getBillingAddress(),
        shipping_address: client.getShippingAddress(),
        primary_contact: client.getPrimaryContact()
      },
      projects: {
        all: projects,
        by_status: projectsByStatus,
        total: projects.length,
        total_budget: totalBudget,
        total_actual_cost: totalActualCost
      },
      invoices: {
        all: invoices,
        by_status: invoicesByStatus,
        total: invoices.length,
        total_invoiced: totalInvoiced,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount
      },
      communications: {
        recent: communications.slice(0, 10),
        total: communications.length
      },
      financial_summary: {
        total_invoiced: totalInvoiced,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        payment_success_rate: totalInvoiced > 0 ? (paidAmount / totalInvoiced) * 100 : 0,
        average_payment_time: calculateAveragePaymentTime(invoices),
        overdue_amount: invoicesByStatus.overdue.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0)
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client'
    });
  }
});

/**
 * Update client information
 * PUT /api/clients/:id
 */
router.put('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.updateClient,
  authorizeResourceAccess('client')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get existing client
    const clients = await sheetsService.query('Clients', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (clients.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const existingClient = clients[0];

    // Check if email is being changed and if new email already exists
    if (req.body.email && req.body.email !== existingClient.email) {
      const emailExists = await sheetsService.query('Clients', {
        filters: [
          { column: 'email', operator: 'eq', value: req.body.email },
          { column: 'id', operator: 'ne', value: id }
        ]
      });

      if (emailExists.length > 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client with this email already exists'
        });
      }
    }

    // Merge updates with existing data
    const updatedData = {
      ...existingClient,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Create client instance for validation
    const client = new Client(updatedData);

    // Additional GST validation for Indian clients
    if (client.isIndianClient() && client.gstin) {
      if (!client.validateGSTIN()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid GSTIN format'
        });
      }
    }

    // PAN validation if provided
    if (client.pan && !client.validatePAN()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid PAN format'
      });
    }

    // Update in sheets
    const success = await sheetsService.update('Clients', id, client.toJSON());

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    // Log the activity
    await logClientActivity(id, 'client_updated', {
      updated_fields: Object.keys(req.body),
      updated_by: req.user?.id
    });

    console.log(`✅ Client updated successfully: ${client.name} (${client.id})`);

    return res.json({
      message: 'Client updated successfully',
      client: {
        ...client.toJSON(),
        gst_compliant: client.validateGSTIN(),
        payment_terms_days: client.getPaymentTermsDays()
      }
    });
  } catch (error) {
    console.error('Update client error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update client'
    });
  }
});

/**
 * Client onboarding workflow - create client with document collection
 * POST /api/clients/onboard
 */
router.post('/onboard', [
  authorizeRoles('admin'),
  ...ValidationSets.createClient
], async (req: Request, res: Response) => {
  try {
    const { client_data, documents = [], portal_access = false } = req.body;

    // Create client first
    const clientData = {
      ...client_data,
      id: uuidv4(),
      country: client_data.country || 'India',
      default_currency: client_data.default_currency || 'INR',
      payment_terms: client_data.payment_terms || 'Net 30',
      is_active: true,
      portal_access_enabled: portal_access
    };

    // Check if client with same email already exists
    const existingClients = await sheetsService.query('Clients', {
      filters: [{ column: 'email', operator: 'eq', value: clientData.email }]
    });

    if (existingClients.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Client with this email already exists'
      });
    }

    // Create client instance for validation
    const client = new Client(clientData);

    // Additional GST validation for Indian clients
    if (client.isIndianClient() && client.gstin) {
      if (!client.validateGSTIN()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid GSTIN format'
        });
      }
    }

    // PAN validation if provided
    if (client.pan && !client.validatePAN()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid PAN format'
      });
    }

    // Save client to sheets
    await sheetsService.create('Clients', client.toJSON());

    // Process documents if provided
    const processedDocuments = [];
    for (const doc of documents) {
      const documentData = {
        id: uuidv4(),
        client_id: client.id,
        document_type: doc.type,
        document_name: doc.name,
        file_url: doc.file_url,
        status: 'pending_review',
        uploaded_at: new Date().toISOString()
      };
      
      await sheetsService.create('Client_Documents', documentData);
      processedDocuments.push(documentData);
    }

    // Log onboarding activity
    await logClientActivity(client.id, 'client_onboarded', {
      onboarded_by: req.user?.id,
      documents_count: documents.length,
      portal_access_enabled: portal_access
    });

    console.log(`✅ Client onboarded successfully: ${client.name} (${client.id})`);

    return res.status(201).json({
      message: 'Client onboarded successfully',
      client: {
        ...client.toJSON(),
        gst_compliant: client.validateGSTIN(),
        payment_terms_days: client.getPaymentTermsDays()
      },
      documents: processedDocuments,
      next_steps: [
        'Review uploaded documents',
        portal_access ? 'Send portal access credentials' : 'Set up portal access if needed',
        'Create first project or send welcome email'
      ]
    });
  } catch (error) {
    console.error('Client onboarding error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to onboard client'
    });
  }
});

/**
 * Get client activity audit trail
 * GET /api/clients/:id/activities
 */
router.get('/:id/activities', [
  ...ValidationSets.getById,
  authorizeResourceAccess('client')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Get client activities
    const activities = await sheetsService.query('Client_Activities', {
      filters: [{ column: 'client_id', operator: 'eq', value: id }],
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });

    // Calculate pagination
    const total = activities.length;
    const totalPages = Math.ceil(total / Number(limit));
    const offset = (Number(page) - 1) * Number(limit);
    const paginatedActivities = activities.slice(offset, offset + Number(limit));

    // Format activities for response
    const formattedActivities = paginatedActivities.map(activity => ({
      id: activity.id,
      activity: activity.activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {},
      timestamp: activity.timestamp,
      formatted_time: new Date(activity.timestamp).toLocaleString()
    }));

    return res.json({
      activities: formattedActivities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get client activities error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client activities'
    });
  }
});

/**
 * Enable/disable client portal access
 * PUT /api/clients/:id/portal-access
 */
router.put('/:id/portal-access', [
  authorizeRoles('admin'),
  ...ValidationSets.getById,
  authorizeResourceAccess('client')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled, password } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'enabled field is required and must be boolean'
      });
    }

    // Get existing client
    const clients = await sheetsService.query('Clients', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (clients.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const updateData: any = {
      portal_access_enabled: enabled,
      updated_at: new Date().toISOString()
    };

    // If enabling portal access and password provided, hash it
    if (enabled && password) {
      const bcrypt = require('bcrypt');
      updateData.portal_password_hash = await bcrypt.hash(password, 10);
    }

    // Update client
    const success = await sheetsService.update('Clients', id, updateData);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    // Log the activity
    await logClientActivity(id, enabled ? 'portal_access_enabled' : 'portal_access_disabled', {
      updated_by: req.user?.id,
      password_set: enabled && !!password
    });

    console.log(`✅ Client portal access ${enabled ? 'enabled' : 'disabled'}: ${id}`);

    return res.json({
      message: `Portal access ${enabled ? 'enabled' : 'disabled'} successfully`,
      portal_access_enabled: enabled,
      password_set: enabled && !!password
    });
  } catch (error) {
    console.error('Update portal access error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update portal access'
    });
  }
});

/**
 * Soft delete a client (with dependency checks)
 * DELETE /api/clients/:id
 */
router.delete('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.getById,
  authorizeResourceAccess('client')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const clients = await sheetsService.query('Clients', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (clients.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    const client = clients[0];

    // Check for dependencies
    const [projects, invoices] = await Promise.all([
      sheetsService.query('Projects', {
        filters: [{ column: 'client_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Invoices', {
        filters: [{ column: 'client_id', operator: 'eq', value: id }]
      })
    ]);

    // Check if there are active projects or unpaid invoices (prevent deletion)
    const activeProjects = projects.filter(p => p.status === 'active');
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
    
    if (activeProjects.length > 0 || unpaidInvoices.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete client with active projects or unpaid invoices. Deactivate the client instead.',
        dependencies: {
          active_projects: activeProjects.length,
          unpaid_invoices: unpaidInvoices.length
        }
      });
    }

    // Soft delete: mark as inactive instead of actual deletion
    const success = await sheetsService.update('Clients', id, {
      is_active: false,
      updated_at: new Date().toISOString()
    });

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Client not found'
      });
    }

    // Log the activity
    await logClientActivity(id, 'client_deactivated', {
      deactivated_by: req.user?.id,
      reason: 'soft_delete'
    });

    console.log(`✅ Client deactivated successfully: ${client.name} (${client.id})`);

    return res.json({
      message: 'Client deactivated successfully',
      dependencies: {
        projects: projects.length,
        invoices: invoices.length,
        active_projects: activeProjects.length,
        unpaid_invoices: unpaidInvoices.length
      }
    });
  } catch (error) {
    console.error('Delete client error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete client'
    });
  }
});

// Helper method to calculate average payment time
const calculateAveragePaymentTime = (invoices: any[]): number => {
  const paidInvoices = invoices.filter(inv => inv.payment_date && inv.issue_date);
  
  if (paidInvoices.length === 0) return 0;
  
  const totalDays = paidInvoices.reduce((sum, inv) => {
    const issueDate = new Date(inv.issue_date);
    const paymentDate = new Date(inv.payment_date);
    const daysDiff = Math.floor((paymentDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
    return sum + daysDiff;
  }, 0);
  
  return Math.round(totalDays / paidInvoices.length);
};

// Helper method to log client activities
const logClientActivity = async (clientId: string, activity: string, metadata: any = {}): Promise<void> => {
  try {
    const activityData = {
      id: uuidv4(),
      client_id: clientId,
      activity,
      metadata: JSON.stringify(metadata),
      timestamp: new Date().toISOString()
    };

    await sheetsService.create('Client_Activities', activityData);
  } catch (error) {
    console.error('Failed to log client activity:', error);
    // Don't throw error as this is not critical
  }
};

export default router;