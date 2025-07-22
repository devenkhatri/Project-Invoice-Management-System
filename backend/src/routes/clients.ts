import { Router, Request, Response } from 'express';
import { GoogleSheetsService } from '../services/googleSheets';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { Client } from '../models/Client';
import { Project } from '../models/Project';
import { Communication } from '../models/Communication';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeClientRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

/**
 * Get all clients
 * GET /api/clients
 */
router.get('/',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { search, has_gstin } = req.query;
      
      // Get all clients from Google Sheets
      const clientsData = await sheetsService.read('Clients');
      
      // Convert to Client instances and filter
      let clients = clientsData.map(data => Client.fromSheetRow(data));
      
      // Apply filters
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        clients = clients.filter(c => 
          c.name.toLowerCase().includes(searchTerm) ||
          c.email.toLowerCase().includes(searchTerm) ||
          c.phone.includes(searchTerm)
        );
      }
      
      if (has_gstin !== undefined) {
        const hasGstin = has_gstin === 'true';
        clients = clients.filter(c => hasGstin ? c.hasGSTIN() : !c.hasGSTIN());
      }
      
      // Sort by name ascending
      clients.sort((a, b) => a.name.localeCompare(b.name));
      
      res.json({
        clients: clients.map(c => c.toSheetRow()),
        total: clients.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get clients error:', error);
      res.status(500).json({
        error: 'Failed to fetch clients',
        code: 'FETCH_CLIENTS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get client by ID
 * GET /api/clients/:id
 */
router.get('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const clientsData = await sheetsService.read('Clients', id);
      
      if (clientsData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const client = Client.fromSheetRow(clientsData[0]);
      
      res.json({
        client: client.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get client error:', error);
      res.status(500).json({
        error: 'Failed to fetch client',
        code: 'FETCH_CLIENT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get client projects
 * GET /api/clients/:id/projects
 */
router.get('/:id/projects',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.query;
      
      // Check if client exists
      const clientsData = await sheetsService.read('Clients', id);
      if (clientsData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Get client projects
      const projectsData = await sheetsService.query('Projects', [
        { field: 'client_id', operator: 'eq', value: id }
      ]);
      
      let projects = projectsData.map(data => Project.fromSheetRow(data));
      
      // Apply status filter if provided
      if (status) {
        projects = projects.filter(p => p.status === status);
      }
      
      // Sort by created_at descending
      projects.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
      // Calculate client statistics
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
      
      res.json({
        client: Client.fromSheetRow(clientsData[0]).toSheetRow(),
        projects: projects.map(p => p.toSheetRow()),
        stats: {
          totalProjects,
          activeProjects,
          completedProjects,
          totalBudget
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get client projects error:', error);
      res.status(500).json({
        error: 'Failed to fetch client projects',
        code: 'FETCH_CLIENT_PROJECTS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Create new client
 * POST /api/clients
 */
router.post('/',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const client = new Client(req.body);
      
      // Validate client data
      const validation = client.validate();
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Check for duplicate email
      const existingClients = await sheetsService.query('Clients', [
        { field: 'email', operator: 'eq', value: client.email }
      ]);
      
      if (existingClients.length > 0) {
        res.status(409).json({
          error: 'Client with this email already exists',
          code: 'DUPLICATE_EMAIL',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Save to Google Sheets
      const id = await sheetsService.create('Clients', client.toSheetRow());
      client.id = id;
      
      res.status(201).json({
        message: 'Client created successfully',
        client: client.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({
        error: 'Failed to create client',
        code: 'CREATE_CLIENT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update client
 * PUT /api/clients/:id
 */
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if client exists
      const existingData = await sheetsService.read('Clients', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingClient = Client.fromSheetRow(existingData[0]);
      
      // Check for duplicate email if email is being changed
      if (req.body.email && req.body.email !== existingClient.email) {
        const duplicateClients = await sheetsService.query('Clients', [
          { field: 'email', operator: 'eq', value: req.body.email }
        ]);
        
        if (duplicateClients.length > 0) {
          res.status(409).json({
            error: 'Client with this email already exists',
            code: 'DUPLICATE_EMAIL',
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
      
      // Update client data
      const updatedClient = new Client({
        ...existingClient,
        ...req.body,
        id, // Ensure ID doesn't change
        updated_at: new Date()
      });
      
      // Validate updated client
      const validation = updatedClient.validate();
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Update in Google Sheets
      await sheetsService.update('Clients', id, updatedClient.toSheetRow());
      
      res.json({
        message: 'Client updated successfully',
        client: updatedClient.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({
        error: 'Failed to update client',
        code: 'UPDATE_CLIENT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Delete client
 * DELETE /api/clients/:id
 */
router.delete('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if client exists
      const existingData = await sheetsService.read('Clients', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Check if client has associated projects
      const clientProjects = await sheetsService.query('Projects', [
        { field: 'client_id', operator: 'eq', value: id }
      ]);
      
      if (clientProjects.length > 0) {
        res.status(409).json({
          error: 'Cannot delete client with associated projects',
          code: 'CLIENT_HAS_PROJECTS',
          projectCount: clientProjects.length,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Delete the client
      await sheetsService.delete('Clients', id);
      
      res.json({
        message: 'Client deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({
        error: 'Failed to delete client',
        code: 'DELETE_CLIENT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get client communication history
 * GET /api/clients/:id/communications
 */
router.get('/:id/communications',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, direction, project_id, follow_up_due } = req.query;
      
      // Check if client exists
      const clientsData = await sheetsService.read('Clients', id);
      if (clientsData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Get client communications
      let filters = [{ field: 'client_id', operator: 'eq', value: id }];
      
      if (type) {
        filters.push({ field: 'type', operator: 'eq', value: type as string });
      }
      if (direction) {
        filters.push({ field: 'direction', operator: 'eq', value: direction as string });
      }
      if (project_id) {
        filters.push({ field: 'project_id', operator: 'eq', value: project_id as string });
      }
      
      const communicationsData = await sheetsService.query('Communications', filters);
      let communications = communicationsData.map(data => Communication.fromSheetRow(data));
      
      // Filter for follow-up due if requested
      if (follow_up_due === 'true') {
        communications = communications.filter(c => c.isFollowUpDue());
      }
      
      // Sort by created_at descending
      communications.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
      res.json({
        client: Client.fromSheetRow(clientsData[0]).toSheetRow(),
        communications: communications.map(c => c.toSheetRow()),
        total: communications.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get client communications error:', error);
      res.status(500).json({
        error: 'Failed to fetch client communications',
        code: 'FETCH_CLIENT_COMMUNICATIONS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Add communication to client
 * POST /api/clients/:id/communications
 */
router.post('/:id/communications',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if client exists
      const clientsData = await sheetsService.read('Clients', id);
      if (clientsData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Create communication
      const communication = new Communication({
        ...req.body,
        client_id: id,
        follow_up_date: req.body.follow_up_date ? new Date(req.body.follow_up_date) : undefined
      });
      
      // Validate communication data
      const validation = communication.validate();
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Save to Google Sheets
      const commId = await sheetsService.create('Communications', communication.toSheetRow());
      communication.id = commId;
      
      res.status(201).json({
        message: 'Communication added successfully',
        communication: communication.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Add client communication error:', error);
      res.status(500).json({
        error: 'Failed to add communication',
        code: 'ADD_COMMUNICATION_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update communication
 * PUT /api/clients/:clientId/communications/:commId
 */
router.put('/:clientId/communications/:commId',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clientId, commId } = req.params;
      
      // Check if communication exists and belongs to client
      const existingData = await sheetsService.read('Communications', commId);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Communication not found',
          code: 'COMMUNICATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingComm = Communication.fromSheetRow(existingData[0]);
      if (existingComm.client_id !== clientId) {
        res.status(403).json({
          error: 'Communication does not belong to this client',
          code: 'COMMUNICATION_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Update communication data
      const updateData = { ...req.body };
      if (updateData.follow_up_date) {
        updateData.follow_up_date = new Date(updateData.follow_up_date);
      }
      
      const updatedComm = new Communication({
        ...existingComm,
        ...updateData,
        id: commId, // Ensure ID doesn't change
        client_id: clientId, // Ensure client_id doesn't change
        updated_at: new Date()
      });
      
      // Validate updated communication
      const validation = updatedComm.validate();
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Update in Google Sheets
      await sheetsService.update('Communications', commId, updatedComm.toSheetRow());
      
      res.json({
        message: 'Communication updated successfully',
        communication: updatedComm.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update communication error:', error);
      res.status(500).json({
        error: 'Failed to update communication',
        code: 'UPDATE_COMMUNICATION_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Delete communication
 * DELETE /api/clients/:clientId/communications/:commId
 */
router.delete('/:clientId/communications/:commId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clientId, commId } = req.params;
      
      // Check if communication exists and belongs to client
      const existingData = await sheetsService.read('Communications', commId);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Communication not found',
          code: 'COMMUNICATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingComm = Communication.fromSheetRow(existingData[0]);
      if (existingComm.client_id !== clientId) {
        res.status(403).json({
          error: 'Communication does not belong to this client',
          code: 'COMMUNICATION_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Delete the communication
      await sheetsService.delete('Communications', commId);
      
      res.json({
        message: 'Communication deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete communication error:', error);
      res.status(500).json({
        error: 'Failed to delete communication',
        code: 'DELETE_COMMUNICATION_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;