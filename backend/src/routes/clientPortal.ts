import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '../services/googleSheets';
import { sanitizeInput } from '../middleware/validation';
import { Client } from '../models/Client';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Communication } from '../models/Communication';
import config from '../config';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeClientPortalRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

// Client portal authentication interface
interface ClientPortalRequest extends Request {
  client?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Client portal authentication middleware
 */
const authenticateClientPortal = async (req: ClientPortalRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'CLIENT_TOKEN_REQUIRED',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    if (decoded.type !== 'client_portal') {
      res.status(403).json({
        error: 'Invalid token type',
        code: 'INVALID_CLIENT_TOKEN',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Verify client still exists
    const clientData = await sheetsService.read('Clients', decoded.clientId);
    if (clientData.length === 0) {
      res.status(403).json({
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const client = Client.fromSheetRow(clientData[0]);
    req.client = {
      id: client.id,
      email: client.email,
      name: client.name
    };

    next();
  } catch (error) {
    console.error('Client portal auth error:', error);
    res.status(403).json({
      error: 'Invalid or expired token',
      code: 'CLIENT_TOKEN_INVALID',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generate client portal access link
 * POST /api/client-portal/generate-access
 */
router.post('/generate-access',
  sanitizeInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { client_id, expires_in = '7d' } = req.body;

      if (!client_id) {
        res.status(400).json({
          error: 'Client ID is required',
          code: 'CLIENT_ID_REQUIRED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Verify client exists
      const clientData = await sheetsService.read('Clients', client_id);
      if (clientData.length === 0) {
        res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const client = Client.fromSheetRow(clientData[0]);

      // Generate client portal token
      const token = jwt.sign(
        {
          clientId: client.id,
          email: client.email,
          type: 'client_portal'
        },
        config.jwt.secret,
        { expiresIn: expires_in }
      );

      // Generate portal URL
      const portalUrl = `${config.server.frontendUrl}/client-portal?token=${token}`;

      res.json({
        message: 'Client portal access generated successfully',
        client: {
          id: client.id,
          name: client.name,
          email: client.email
        },
        token,
        portalUrl,
        expiresIn: expires_in,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Generate client portal access error:', error);
      res.status(500).json({
        error: 'Failed to generate client portal access',
        code: 'GENERATE_ACCESS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Client portal login with token
 * POST /api/client-portal/login
 */
router.post('/login',
  sanitizeInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          error: 'Access token is required',
          code: 'TOKEN_REQUIRED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      if (decoded.type !== 'client_portal') {
        res.status(403).json({
          error: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Verify client still exists
      const clientData = await sheetsService.read('Clients', decoded.clientId);
      if (clientData.length === 0) {
        res.status(403).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const client = Client.fromSheetRow(clientData[0]);

      res.json({
        message: 'Client portal login successful',
        client: {
          id: client.id,
          name: client.name,
          email: client.email
        },
        token,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Client portal login error:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(403).json({
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'Login failed',
          code: 'LOGIN_ERROR',
          message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

/**
 * Get client portal dashboard
 * GET /api/client-portal/dashboard
 */
router.get('/dashboard',
  authenticateClientPortal,
  async (req: ClientPortalRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.client!.id;

      // Get client projects
      const projectsData = await sheetsService.query('Projects', [
        { field: 'client_id', operator: 'eq', value: clientId }
      ]);
      const projects = projectsData.map(data => Project.fromSheetRow(data));

      // Get project statistics
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);

      // Get recent communications
      const recentCommsData = await sheetsService.query('Communications', [
        { field: 'client_id', operator: 'eq', value: clientId }
      ]);
      const recentComms = recentCommsData
        .map(data => Communication.fromSheetRow(data))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, 5);

      // Get pending follow-ups
      const pendingFollowUps = recentCommsData
        .map(data => Communication.fromSheetRow(data))
        .filter(c => c.isFollowUpDue());

      res.json({
        client: {
          id: req.client!.id,
          name: req.client!.name,
          email: req.client!.email
        },
        stats: {
          totalProjects,
          activeProjects,
          completedProjects,
          totalBudget
        },
        projects: projects.map(p => p.toSheetRow()),
        recentCommunications: recentComms.map(c => c.toSheetRow()),
        pendingFollowUps: pendingFollowUps.map(c => c.toSheetRow()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Client portal dashboard error:', error);
      res.status(500).json({
        error: 'Failed to load dashboard',
        code: 'DASHBOARD_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get client projects (portal view)
 * GET /api/client-portal/projects
 */
router.get('/projects',
  authenticateClientPortal,
  async (req: ClientPortalRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.client!.id;
      const { status } = req.query;

      // Get client projects
      const projectsData = await sheetsService.query('Projects', [
        { field: 'client_id', operator: 'eq', value: clientId }
      ]);
      
      let projects = projectsData.map(data => Project.fromSheetRow(data));

      // Apply status filter if provided
      if (status) {
        projects = projects.filter(p => p.status === status);
      }

      // Sort by created_at descending
      projects.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      res.json({
        projects: projects.map(p => p.toSheetRow()),
        total: projects.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Client portal projects error:', error);
      res.status(500).json({
        error: 'Failed to fetch projects',
        code: 'FETCH_PROJECTS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get project details (portal view)
 * GET /api/client-portal/projects/:id
 */
router.get('/projects/:id',
  authenticateClientPortal,
  async (req: ClientPortalRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const clientId = req.client!.id;

      // Get project and verify it belongs to client
      const projectsData = await sheetsService.read('Projects', id);
      if (projectsData.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const project = Project.fromSheetRow(projectsData[0]);
      if (project.client_id !== clientId) {
        res.status(403).json({
          error: 'Access denied to this project',
          code: 'PROJECT_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get project tasks
      const tasksData = await sheetsService.query('Tasks', [
        { field: 'project_id', operator: 'eq', value: id }
      ]);
      const tasks = tasksData.map(data => Task.fromSheetRow(data));

      // Get project communications
      const commsData = await sheetsService.query('Communications', [
        { field: 'client_id', operator: 'eq', value: clientId },
        { field: 'project_id', operator: 'eq', value: id }
      ]);
      const communications = commsData
        .map(data => Communication.fromSheetRow(data))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Calculate project statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.isCompleted()).length;
      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      res.json({
        project: project.toSheetRow(),
        tasks: tasks.map(t => t.toSheetRow()),
        communications: communications.map(c => c.toSheetRow()),
        stats: {
          totalTasks,
          completedTasks,
          progress: Math.round(progress),
          isOverdue: project.isOverdue(),
          remainingDays: project.getRemainingDays()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Client portal project details error:', error);
      res.status(500).json({
        error: 'Failed to fetch project details',
        code: 'FETCH_PROJECT_DETAILS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Add communication from client portal
 * POST /api/client-portal/communications
 */
router.post('/communications',
  authenticateClientPortal,
  sanitizeInput,
  async (req: ClientPortalRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.client!.id;

      // Create communication from client
      const communication = new Communication({
        ...req.body,
        client_id: clientId,
        direction: 'inbound', // Client communications are always inbound
        contact_person: req.client!.name
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
        message: 'Message sent successfully',
        communication: communication.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Client portal communication error:', error);
      res.status(500).json({
        error: 'Failed to send message',
        code: 'SEND_MESSAGE_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;