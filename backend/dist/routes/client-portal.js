"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Client_1 = require("../models/Client");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
const authService = auth_1.AuthService.getInstance();
const authenticateClientPortal = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Access token is required'
            });
            return;
        }
        const decoded = authService.verifyAccessToken(token);
        if (decoded.role !== 'client') {
            res.status(403).json({
                error: 'Forbidden',
                message: 'Client portal access only'
            });
            return;
        }
        const clients = await sheetsService.query('Clients', {
            filters: [
                { column: 'email', operator: 'eq', value: decoded.email },
                { column: 'is_active', operator: 'eq', value: true }
            ]
        });
        if (clients.length === 0) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Client not found or inactive'
            });
            return;
        }
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name
        };
        req.client = new Client_1.Client(clients[0]);
        next();
    }
    catch (error) {
        res.status(401).json({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid token'
        });
        return;
    }
};
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email and password are required'
            });
        }
        const clients = await sheetsService.query('Clients', {
            filters: [
                { column: 'email', operator: 'eq', value: email },
                { column: 'is_active', operator: 'eq', value: true }
            ]
        });
        if (clients.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials'
            });
        }
        const client = clients[0];
        if (!client.portal_access_enabled) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Portal access not enabled for this client'
            });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, client.portal_password_hash || '');
        if (!isValidPassword) {
            await logClientActivity(client.id, 'portal_login_failed', {
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials'
            });
        }
        const tokens = authService.generateTokens({
            id: client.id,
            email: client.email,
            role: 'client',
            name: client.name
        });
        await sheetsService.update('Clients', client.id, {
            last_portal_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        await logClientActivity(client.id, 'portal_login_success', {
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        });
        console.log(`✅ Client portal login successful: ${client.email}`);
        return res.json({
            message: 'Login successful',
            tokens,
            client: {
                id: client.id,
                name: client.name,
                email: client.email,
                company: client.company_name
            }
        });
    }
    catch (error) {
        console.error('Client portal login error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed'
        });
    }
});
router.post('/logout', authenticateClientPortal, async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;
        if (refreshToken) {
            await authService.revokeRefreshToken(refreshToken);
        }
        await logClientActivity(req.client.id, 'portal_logout', {
            ip_address: req.ip
        });
        return res.json({
            message: 'Logout successful'
        });
    }
    catch (error) {
        console.error('Client portal logout error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Logout failed'
        });
    }
});
router.get('/dashboard', authenticateClientPortal, async (req, res) => {
    try {
        const client = req.client;
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'client_id', operator: 'eq', value: client.id }],
            sortBy: 'created_at',
            sortOrder: 'desc'
        });
        const invoices = await sheetsService.query('Invoices', {
            filters: [{ column: 'client_id', operator: 'eq', value: client.id }],
            sortBy: 'created_at',
            sortOrder: 'desc'
        });
        const communications = await sheetsService.query('Client_Communications', {
            filters: [{ column: 'client_id', operator: 'eq', value: client.id }],
            sortBy: 'created_at',
            sortOrder: 'desc',
            limit: 10
        }).catch(() => []);
        const activeProjects = projects.filter(p => p.status === 'active');
        const completedProjects = projects.filter(p => p.status === 'completed');
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const paidAmount = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
        const outstandingAmount = totalInvoiced - paidAmount;
        const pendingInvoices = invoices.filter(inv => inv.status === 'sent' || inv.status === 'draft');
        const overdueInvoices = invoices.filter(inv => inv.status === 'overdue' ||
            (inv.status === 'sent' && new Date(inv.due_date) < new Date()));
        const upcomingDeadlines = projects
            .filter(p => p.status === 'active' && p.end_date)
            .map(p => ({
            project_id: p.id,
            project_name: p.name,
            end_date: p.end_date,
            days_remaining: Math.ceil((new Date(p.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        }))
            .filter(p => p.days_remaining >= 0 && p.days_remaining <= 30)
            .sort((a, b) => a.days_remaining - b.days_remaining);
        return res.json({
            client: {
                id: client.id,
                name: client.name,
                email: client.email,
                company: client.company_name,
                contact_person: client.contact_person
            },
            summary: {
                projects: {
                    total: projects.length,
                    active: activeProjects.length,
                    completed: completedProjects.length,
                    on_hold: projects.filter(p => p.status === 'on-hold').length
                },
                invoices: {
                    total: invoices.length,
                    pending: pendingInvoices.length,
                    overdue: overdueInvoices.length,
                    paid: invoices.filter(inv => inv.status === 'paid').length
                },
                financial: {
                    total_invoiced: totalInvoiced,
                    paid_amount: paidAmount,
                    outstanding_amount: outstandingAmount,
                    currency: client.default_currency
                }
            },
            recent_projects: projects.slice(0, 5).map(p => ({
                id: p.id,
                name: p.name,
                status: p.status,
                progress_percentage: p.progress_percentage || 0,
                end_date: p.end_date,
                budget: p.budget
            })),
            recent_invoices: invoices.slice(0, 5).map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                total_amount: inv.total_amount,
                paid_amount: inv.paid_amount,
                status: inv.status,
                due_date: inv.due_date,
                issue_date: inv.issue_date
            })),
            upcoming_deadlines: upcomingDeadlines,
            recent_communications: communications.map(comm => ({
                id: comm.id,
                subject: comm.subject,
                message: comm.message,
                created_at: comm.created_at,
                sender: comm.sender
            }))
        });
    }
    catch (error) {
        console.error('Client portal dashboard error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch dashboard data'
        });
    }
});
router.get('/projects/:id', [
    authenticateClientPortal,
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const client = req.client;
        const projects = await sheetsService.query('Projects', {
            filters: [
                { column: 'id', operator: 'eq', value: id },
                { column: 'client_id', operator: 'eq', value: client.id }
            ]
        });
        if (projects.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        const project = projects[0];
        const tasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'project_id', operator: 'eq', value: id }],
            sortBy: 'created_at',
            sortOrder: 'asc'
        });
        const invoices = await sheetsService.query('Invoices', {
            filters: [{ column: 'project_id', operator: 'eq', value: id }],
            sortBy: 'created_at',
            sortOrder: 'desc'
        });
        const communications = await sheetsService.query('Client_Communications', {
            filters: [
                { column: 'client_id', operator: 'eq', value: client.id },
                { column: 'project_id', operator: 'eq', value: id }
            ],
            sortBy: 'created_at',
            sortOrder: 'desc'
        }).catch(() => []);
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const progressPercentage = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
        const tasksByStatus = {
            todo: tasks.filter(t => t.status === 'todo').length,
            'in-progress': tasks.filter(t => t.status === 'in-progress').length,
            completed: completedTasks.length
        };
        return res.json({
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                status: project.status,
                start_date: project.start_date,
                end_date: project.end_date,
                budget: project.budget,
                progress_percentage: progressPercentage,
                currency: project.currency,
                is_overdue: new Date(project.end_date) < new Date() && project.status !== 'completed'
            },
            tasks: {
                total: tasks.length,
                by_status: tasksByStatus,
                recent: tasks.slice(-5).map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    due_date: t.due_date,
                    priority: t.priority
                }))
            },
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                total_amount: inv.total_amount,
                paid_amount: inv.paid_amount,
                status: inv.status,
                due_date: inv.due_date,
                issue_date: inv.issue_date
            })),
            communications: communications.map(comm => ({
                id: comm.id,
                subject: comm.subject,
                message: comm.message,
                created_at: comm.created_at,
                sender: comm.sender
            }))
        });
    }
    catch (error) {
        console.error('Client portal project details error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch project details'
        });
    }
});
router.post('/messages', [
    authenticateClientPortal
], async (req, res) => {
    try {
        const { subject, message, project_id } = req.body;
        const client = req.client;
        if (!subject || !message) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Subject and message are required'
            });
        }
        if (project_id) {
            const projects = await sheetsService.query('Projects', {
                filters: [
                    { column: 'id', operator: 'eq', value: project_id },
                    { column: 'client_id', operator: 'eq', value: client.id }
                ]
            });
            if (projects.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid project ID'
                });
            }
        }
        const communicationData = {
            id: (0, uuid_1.v4)(),
            client_id: client.id,
            project_id: project_id || null,
            subject,
            message,
            sender: 'client',
            sender_name: client.name,
            sender_email: client.email,
            status: 'unread',
            thread_id: (0, uuid_1.v4)(),
            created_at: new Date().toISOString()
        };
        await sheetsService.create('Client_Communications', communicationData);
        await logClientActivity(client.id, 'message_sent', {
            subject,
            project_id,
            message_length: message.length
        });
        console.log(`✅ Client message sent: ${client.email} - ${subject}`);
        return res.status(201).json({
            message: 'Message sent successfully',
            communication: {
                id: communicationData.id,
                subject: communicationData.subject,
                created_at: communicationData.created_at
            }
        });
    }
    catch (error) {
        console.error('Client portal message error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to send message'
        });
    }
});
router.get('/invoices', authenticateClientPortal, async (req, res) => {
    try {
        const client = req.client;
        const { status, page = 1, limit = 10 } = req.query;
        const filters = [
            { column: 'client_id', operator: 'eq', value: client.id }
        ];
        if (status) {
            filters.push({ column: 'status', operator: 'eq', value: status });
        }
        const offset = (Number(page) - 1) * Number(limit);
        const invoices = await sheetsService.query('Invoices', {
            filters,
            sortBy: 'created_at',
            sortOrder: 'desc',
            limit: Number(limit),
            offset
        });
        const totalInvoices = await sheetsService.query('Invoices', { filters });
        return res.json({
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                total_amount: inv.total_amount,
                paid_amount: inv.paid_amount,
                outstanding_amount: inv.total_amount - inv.paid_amount,
                status: inv.status,
                due_date: inv.due_date,
                issue_date: inv.issue_date,
                payment_terms: inv.payment_terms,
                currency: inv.currency,
                project_name: inv.project_id ? 'Loading...' : null
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalInvoices.length,
                totalPages: Math.ceil(totalInvoices.length / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Client portal invoices error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch invoices'
        });
    }
});
router.get('/communications', authenticateClientPortal, async (req, res) => {
    try {
        const client = req.client;
        const { project_id, page = 1, limit = 20 } = req.query;
        const filters = [
            { column: 'client_id', operator: 'eq', value: client.id }
        ];
        if (project_id) {
            filters.push({ column: 'project_id', operator: 'eq', value: project_id });
        }
        const communications = await sheetsService.query('Client_Communications', {
            filters,
            sortBy: 'created_at',
            sortOrder: 'desc'
        });
        const total = communications.length;
        const totalPages = Math.ceil(total / Number(limit));
        const offset = (Number(page) - 1) * Number(limit);
        const paginatedCommunications = communications.slice(offset, offset + Number(limit));
        const threaded = paginatedCommunications.reduce((acc, comm) => {
            const threadId = comm.thread_id || comm.id;
            if (!acc[threadId]) {
                acc[threadId] = [];
            }
            acc[threadId].push(comm);
            return acc;
        }, {});
        return res.json({
            communications: paginatedCommunications.map(comm => ({
                id: comm.id,
                subject: comm.subject,
                message: comm.message,
                sender: comm.sender,
                sender_name: comm.sender_name,
                status: comm.status,
                project_id: comm.project_id,
                thread_id: comm.thread_id,
                created_at: comm.created_at,
                is_read: comm.status === 'read'
            })),
            threads: Object.keys(threaded).map(threadId => ({
                thread_id: threadId,
                messages: threaded[threadId],
                last_message: threaded[threadId][0],
                message_count: threaded[threadId].length
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('Client portal communications error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch communications'
        });
    }
});
router.put('/communications/:id/read', [
    authenticateClientPortal,
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const client = req.client;
        const communications = await sheetsService.query('Client_Communications', {
            filters: [
                { column: 'id', operator: 'eq', value: id },
                { column: 'client_id', operator: 'eq', value: client.id }
            ]
        });
        if (communications.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Communication not found'
            });
        }
        const success = await sheetsService.update('Client_Communications', id, {
            status: 'read',
            read_at: new Date().toISOString()
        });
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Communication not found'
            });
        }
        return res.json({
            message: 'Communication marked as read'
        });
    }
    catch (error) {
        console.error('Mark communication read error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to mark communication as read'
        });
    }
});
router.get('/invoices/:id', [
    authenticateClientPortal,
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const client = req.client;
        const invoices = await sheetsService.query('Invoices', {
            filters: [
                { column: 'id', operator: 'eq', value: id },
                { column: 'client_id', operator: 'eq', value: client.id }
            ]
        });
        if (invoices.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Invoice not found'
            });
        }
        const invoice = invoices[0];
        let project = null;
        if (invoice.project_id) {
            const projects = await sheetsService.query('Projects', {
                filters: [{ column: 'id', operator: 'eq', value: invoice.project_id }]
            });
            project = projects[0] || null;
        }
        return res.json({
            invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                line_items: invoice.line_items,
                subtotal: invoice.subtotal,
                tax_breakdown: invoice.tax_breakdown,
                total_amount: invoice.total_amount,
                paid_amount: invoice.paid_amount,
                outstanding_amount: invoice.total_amount - invoice.paid_amount,
                currency: invoice.currency,
                status: invoice.status,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                payment_terms: invoice.payment_terms,
                notes: invoice.notes,
                terms_conditions: invoice.terms_conditions,
                payment_date: invoice.payment_date,
                payment_method: invoice.payment_method
            },
            project: project ? {
                id: project.id,
                name: project.name,
                description: project.description
            } : null,
            client: {
                name: client.name,
                email: client.email,
                address: client.getFullAddress(),
                gstin: client.gstin,
                pan: client.pan
            }
        });
    }
    catch (error) {
        console.error('Client portal invoice details error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch invoice details'
        });
    }
});
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
//# sourceMappingURL=client-portal.js.map