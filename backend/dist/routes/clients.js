"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Client_1 = require("../models/Client");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
router.use(auth_1.authenticateToken);
router.get('/', ...validation_1.ValidationSets.queryWithPagination, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, country, is_active, gstin, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const filters = [];
        if (search) {
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
        if (req.user?.role === 'client') {
            filters.push({ column: 'email', operator: 'eq', value: req.user.email });
        }
        let clients = await sheetsService.query('Clients', {
            filters: filters.filter(f => f.column !== 'search'),
            sortBy: sort_by,
            sortOrder: sort_order
        });
        if (search) {
            const searchTerm = search.toLowerCase();
            clients = clients.filter(client => client.name.toLowerCase().includes(searchTerm) ||
                client.email.toLowerCase().includes(searchTerm) ||
                (client.phone && client.phone.includes(searchTerm)) ||
                (client.contact_person && client.contact_person.toLowerCase().includes(searchTerm)));
        }
        const total = clients.length;
        const totalPages = Math.ceil(total / Number(limit));
        const offset = (Number(page) - 1) * Number(limit);
        const paginatedClients = clients.slice(offset, offset + Number(limit));
        const enhancedClients = await Promise.all(paginatedClients.map(async (clientData) => {
            const client = new Client_1.Client(clientData);
            const projects = await sheetsService.query('Projects', {
                filters: [{ column: 'client_id', operator: 'eq', value: client.id }]
            });
            const invoices = await sheetsService.query('Invoices', {
                filters: [{ column: 'client_id', operator: 'eq', value: client.id }]
            });
            const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
            const paidAmount = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
            const outstandingAmount = totalInvoiced - paidAmount;
            const overdueInvoices = invoices.filter(inv => inv.status === 'overdue' ||
                (inv.status === 'sent' && new Date(inv.due_date) < new Date()));
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
        }));
        return res.json({
            clients: enhancedClients,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('Get clients error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch clients'
        });
    }
});
router.post('/', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createClient
], async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            id: (0, uuid_1.v4)(),
            country: req.body.country || 'India',
            default_currency: req.body.default_currency || 'INR',
            payment_terms: req.body.payment_terms || 'Net 30',
            is_active: req.body.is_active !== undefined ? req.body.is_active : true
        };
        const existingClients = await sheetsService.query('Clients', {
            filters: [{ column: 'email', operator: 'eq', value: clientData.email }]
        });
        if (existingClients.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Client with this email already exists'
            });
        }
        const client = new Client_1.Client(clientData);
        if (client.isIndianClient() && client.gstin) {
            if (!client.validateGSTIN()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid GSTIN format'
                });
            }
        }
        if (client.pan && !client.validatePAN()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid PAN format'
            });
        }
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
    }
    catch (error) {
        console.error('Create client error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to create client'
        });
    }
});
router.get('/:id', [
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('client')
], async (req, res) => {
    try {
        const { id } = req.params;
        const clients = await sheetsService.query('Clients', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (clients.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Client not found'
            });
        }
        const client = new Client_1.Client(clients[0]);
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
            }).catch(() => [])
        ]);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const paidAmount = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
        const outstandingAmount = totalInvoiced - paidAmount;
        const invoicesByStatus = {
            draft: invoices.filter(inv => inv.status === 'draft'),
            sent: invoices.filter(inv => inv.status === 'sent'),
            paid: invoices.filter(inv => inv.status === 'paid'),
            overdue: invoices.filter(inv => inv.status === 'overdue'),
            cancelled: invoices.filter(inv => inv.status === 'cancelled')
        };
        const projectsByStatus = {
            active: projects.filter(p => p.status === 'active'),
            completed: projects.filter(p => p.status === 'completed'),
            'on-hold': projects.filter(p => p.status === 'on-hold')
        };
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
    }
    catch (error) {
        console.error('Get client error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch client'
        });
    }
});
router.put('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.updateClient,
    (0, auth_1.authorizeResourceAccess)('client')
], async (req, res) => {
    try {
        const { id } = req.params;
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
        const updatedData = {
            ...existingClient,
            ...req.body,
            updated_at: new Date().toISOString()
        };
        const client = new Client_1.Client(updatedData);
        if (client.isIndianClient() && client.gstin) {
            if (!client.validateGSTIN()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid GSTIN format'
                });
            }
        }
        if (client.pan && !client.validatePAN()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid PAN format'
            });
        }
        const success = await sheetsService.update('Clients', id, client.toJSON());
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Client not found'
            });
        }
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
    }
    catch (error) {
        console.error('Update client error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to update client'
        });
    }
});
router.post('/onboard', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createClient
], async (req, res) => {
    try {
        const { client_data, documents = [], portal_access = false } = req.body;
        const clientData = {
            ...client_data,
            id: (0, uuid_1.v4)(),
            country: client_data.country || 'India',
            default_currency: client_data.default_currency || 'INR',
            payment_terms: client_data.payment_terms || 'Net 30',
            is_active: true,
            portal_access_enabled: portal_access
        };
        const existingClients = await sheetsService.query('Clients', {
            filters: [{ column: 'email', operator: 'eq', value: clientData.email }]
        });
        if (existingClients.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Client with this email already exists'
            });
        }
        const client = new Client_1.Client(clientData);
        if (client.isIndianClient() && client.gstin) {
            if (!client.validateGSTIN()) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid GSTIN format'
                });
            }
        }
        if (client.pan && !client.validatePAN()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid PAN format'
            });
        }
        await sheetsService.create('Clients', client.toJSON());
        const processedDocuments = [];
        for (const doc of documents) {
            const documentData = {
                id: (0, uuid_1.v4)(),
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
    }
    catch (error) {
        console.error('Client onboarding error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to onboard client'
        });
    }
});
router.get('/:id/activities', [
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('client')
], async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const activities = await sheetsService.query('Client_Activities', {
            filters: [{ column: 'client_id', operator: 'eq', value: id }],
            sortBy: 'timestamp',
            sortOrder: 'desc'
        });
        const total = activities.length;
        const totalPages = Math.ceil(total / Number(limit));
        const offset = (Number(page) - 1) * Number(limit);
        const paginatedActivities = activities.slice(offset, offset + Number(limit));
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
    }
    catch (error) {
        console.error('Get client activities error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch client activities'
        });
    }
});
router.put('/:id/portal-access', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('client')
], async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled, password } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'enabled field is required and must be boolean'
            });
        }
        const clients = await sheetsService.query('Clients', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (clients.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Client not found'
            });
        }
        const updateData = {
            portal_access_enabled: enabled,
            updated_at: new Date().toISOString()
        };
        if (enabled && password) {
            const bcrypt = require('bcrypt');
            updateData.portal_password_hash = await bcrypt.hash(password, 10);
        }
        const success = await sheetsService.update('Clients', id, updateData);
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Client not found'
            });
        }
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
    }
    catch (error) {
        console.error('Update portal access error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update portal access'
        });
    }
});
router.delete('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('client')
], async (req, res) => {
    try {
        const { id } = req.params;
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
        const [projects, invoices] = await Promise.all([
            sheetsService.query('Projects', {
                filters: [{ column: 'client_id', operator: 'eq', value: id }]
            }),
            sheetsService.query('Invoices', {
                filters: [{ column: 'client_id', operator: 'eq', value: id }]
            })
        ]);
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
    }
    catch (error) {
        console.error('Delete client error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete client'
        });
    }
});
const calculateAveragePaymentTime = (invoices) => {
    const paidInvoices = invoices.filter(inv => inv.payment_date && inv.issue_date);
    if (paidInvoices.length === 0)
        return 0;
    const totalDays = paidInvoices.reduce((sum, inv) => {
        const issueDate = new Date(inv.issue_date);
        const paymentDate = new Date(inv.payment_date);
        const daysDiff = Math.floor((paymentDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
    }, 0);
    return Math.round(totalDays / paidInvoices.length);
};
const logClientActivity = async (clientId, activity, metadata = {}) => {
    try {
        const activityData = {
            id: (0, uuid_1.v4)(),
            client_id: clientId,
            activity,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString()
        };
        await sheetsService.create('Client_Activities', activityData);
    }
    catch (error) {
        console.error('Failed to log client activity:', error);
    }
};
exports.default = router;
//# sourceMappingURL=clients.js.map