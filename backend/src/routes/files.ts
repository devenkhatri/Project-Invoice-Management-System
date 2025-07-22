import express from 'express';
import multer, { FileFilterCallback } from 'multer';
import { body, query, param, validationResult } from 'express-validator';
import { FileUploadRequest, FileSearchRequest } from '../services/fileManagement';
import { createFileManagementService } from '../services/fileManagement';

// Extend Express Request interface to include file
interface MulterRequest extends express.Request {
  file?: Express.Multer.File;
}

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req: express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Allow common file types
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed',
      'video/mp4', 'video/mpeg', 'video/quicktime',
      'audio/mpeg', 'audio/wav'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// Initialize file management service
const fileService = createFileManagementService();

if (!fileService) {
  console.error('❌ Failed to initialize file management service');
}

// Middleware to check if file service is available
const checkFileService = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!fileService) {
    return res.status(503).json({
      error: 'File management service is not available'
    });
  }
  next();
};

/**
 * @route POST /api/files/upload
 * @desc Upload a file
 * @access Private
 */
router.post('/upload',
  checkFileService,
  upload.single('file'),
  [
    body('name').optional().isString().trim(),
    body('projectId').optional().isUUID(),
    body('clientId').optional().isUUID(),
    body('description').optional().isString().trim(),
    body('tags').optional().isString(),
    body('shareWithClient').optional().isBoolean()
  ],
  async (req: MulterRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      // Get user ID from auth middleware (assuming it's set)
      const uploadedBy = (req as any).user?.id || 'unknown';

      const uploadRequest: FileUploadRequest = {
        name: req.body.name || req.file.originalname,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        projectId: req.body.projectId,
        clientId: req.body.clientId,
        uploadedBy,
        description: req.body.description,
        tags: req.body.tags ? req.body.tags.split(',').map((tag: string) => tag.trim()) : undefined,
        shareWithClient: req.body.shareWithClient === 'true'
      };

      const fileRecord = await fileService!.uploadFile(uploadRequest);

      res.status(201).json({
        message: 'File uploaded successfully',
        file: fileRecord
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files
 * @desc Search files with filters
 * @access Private
 */
router.get('/',
  checkFileService,
  [
    query('projectId').optional().isUUID(),
    query('clientId').optional().isUUID(),
    query('query').optional().isString().trim(),
    query('mimeType').optional().isString(),
    query('tags').optional().isString(),
    query('uploadedBy').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('sortBy').optional().isIn(['name', 'size', 'created_at', 'updated_at']),
    query('sortDirection').optional().isIn(['asc', 'desc']),
    query('fullTextSearch').optional().isBoolean(),
    query('isSharedWithClient').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const searchRequest: FileSearchRequest = {
        projectId: req.query.projectId as string,
        clientId: req.query.clientId as string,
        query: req.query.query as string,
        mimeType: req.query.mimeType as string,
        tags: req.query.tags ? (req.query.tags as string).split(',').map(tag => tag.trim()) : undefined,
        uploadedBy: req.query.uploadedBy as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        sortBy: req.query.sortBy as 'name' | 'size' | 'created_at' | 'updated_at',
        sortDirection: req.query.sortDirection as 'asc' | 'desc',
        fullTextSearch: req.query.fullTextSearch === 'true',
        isSharedWithClient: req.query.isSharedWithClient === 'true' ? true : 
                           req.query.isSharedWithClient === 'false' ? false : undefined
      };
      
      // Add date range if both start and end dates are provided
      if (req.query.startDate && req.query.endDate) {
        searchRequest.dateRange = {
          start: req.query.startDate as string,
          end: req.query.endDate as string
        };
      }

      const files = await fileService!.searchFiles(searchRequest);

      res.json({
        files,
        count: files.length
      });
    } catch (error) {
      console.error('Error searching files:', error);
      res.status(500).json({
        error: 'Failed to search files',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/:id
 * @desc Get file by ID
 * @access Private
 */
router.get('/:id',
  checkFileService,
  [param('id').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const file = await fileService!.getFile(req.params.id);

      if (!file) {
        return res.status(404).json({
          error: 'File not found'
        });
      }

      res.json({ file });
    } catch (error) {
      console.error('Error getting file:', error);
      res.status(500).json({
        error: 'Failed to get file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/:id/download
 * @desc Download file
 * @access Private
 */
router.get('/:id/download',
  checkFileService,
  [param('id').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { buffer, metadata } = await fileService!.downloadFile(req.params.id);

      res.set({
        'Content-Type': metadata.mime_type,
        'Content-Disposition': `attachment; filename="${metadata.original_name}"`,
        'Content-Length': metadata.size
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route PUT /api/files/:id
 * @desc Update file metadata
 * @access Private
 */
router.put('/:id',
  checkFileService,
  [
    param('id').isUUID(),
    body('name').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('tags').optional().isString(),
    body('shareWithClient').optional().isBoolean()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const updates: any = {};

      if (req.body.name) updates.name = req.body.name;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;
      if (req.body.shareWithClient !== undefined) updates.is_shared_with_client = req.body.shareWithClient;

      const updatedFile = await fileService!.updateFileMetadata(req.params.id, updates);

      res.json({
        message: 'File updated successfully',
        file: updatedFile
      });
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({
        error: 'Failed to update file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route DELETE /api/files/:id
 * @desc Delete file
 * @access Private
 */
router.delete('/:id',
  checkFileService,
  [param('id').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      await fileService!.deleteFile(req.params.id);

      res.json({
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/files/:id/share
 * @desc Share file with client
 * @access Private
 */
router.post('/:id/share',
  checkFileService,
  [param('id').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      await fileService!.shareFileWithClient(req.params.id);

      res.json({
        message: 'File shared with client successfully'
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      res.status(500).json({
        error: 'Failed to share file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/projects/:projectId
 * @desc Get files by project
 * @access Private
 */
router.get('/projects/:projectId',
  checkFileService,
  [param('projectId').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const files = await fileService!.getFilesByProject(req.params.projectId);

      res.json({
        files,
        count: files.length
      });
    } catch (error) {
      console.error('Error getting project files:', error);
      res.status(500).json({
        error: 'Failed to get project files',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/clients/:clientId
 * @desc Get files by client
 * @access Private
 */
router.get('/clients/:clientId',
  checkFileService,
  [param('clientId').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const files = await fileService!.getFilesByClient(req.params.clientId);

      res.json({
        files,
        count: files.length
      });
    } catch (error) {
      console.error('Error getting client files:', error);
      res.status(500).json({
        error: 'Failed to get client files',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/stats
 * @desc Get file statistics
 * @access Private
 */
router.get('/stats',
  checkFileService,
  async (req: express.Request, res: express.Response) => {
    try {
      const stats = await fileService!.getFileStatistics();

      res.json({ stats });
    } catch (error) {
      console.error('Error getting file statistics:', error);
      res.status(500).json({
        error: 'Failed to get file statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/files/:id/associate
 * @desc Associate a file with a project or client
 * @access Private
 */
router.post('/:id/associate',
  checkFileService,
  [
    param('id').isUUID(),
    body('type').isIn(['project', 'client']),
    body('id').isUUID(),
    body('subfolder').optional().isString().trim()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const fileRecord = await fileService!.associateFile(
        req.params.id,
        req.body.type,
        req.body.id,
        req.body.subfolder
      );

      res.json({
        message: `File associated with ${req.body.type} successfully`,
        file: fileRecord
      });
    } catch (error) {
      console.error(`Error associating file:`, error);
      res.status(500).json({
        error: `Failed to associate file`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/:id/thumbnail
 * @desc Get file thumbnail
 * @access Private
 */
router.get('/:id/thumbnail',
  checkFileService,
  [param('id').isUUID()],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const thumbnailUrl = await fileService!.getFileThumbnail(req.params.id);

      if (!thumbnailUrl) {
        return res.status(404).json({
          error: 'Thumbnail not available for this file'
        });
      }

      res.json({ thumbnailUrl });
    } catch (error) {
      console.error(`Error getting thumbnail:`, error);
      res.status(500).json({
        error: `Failed to get thumbnail`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/files/batch/tags
 * @desc Batch update file tags
 * @access Private
 */
router.post('/batch/tags',
  checkFileService,
  [
    body('fileIds').isArray().notEmpty(),
    body('fileIds.*').isUUID(),
    body('tags').isArray().notEmpty(),
    body('tags.*').isString().trim()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const updatedCount = await fileService!.batchUpdateTags(
        req.body.fileIds,
        req.body.tags
      );

      res.json({
        message: `Updated tags for ${updatedCount} files`,
        updatedCount
      });
    } catch (error) {
      console.error(`Error batch updating tags:`, error);
      res.status(500).json({
        error: `Failed to update tags`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/files/batch/share
 * @desc Batch share files with client
 * @access Private
 */
router.post('/batch/share',
  checkFileService,
  [
    body('fileIds').isArray().notEmpty(),
    body('fileIds.*').isUUID()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const sharedCount = await fileService!.batchShareWithClient(req.body.fileIds);

      res.json({
        message: `Shared ${sharedCount} files with client`,
        sharedCount
      });
    } catch (error) {
      console.error(`Error batch sharing files:`, error);
      res.status(500).json({
        error: `Failed to share files`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/files/folder
 * @desc Get files by folder path
 * @access Private
 */
router.get('/folder',
  checkFileService,
  [
    query('type').isIn(['project', 'client']),
    query('id').isUUID(),
    query('path').optional().isString()
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const type = req.query.type as 'project' | 'client';
      const id = req.query.id as string;
      const path = req.query.path ? (req.query.path as string).split('/').filter(Boolean) : [];

      const files = await fileService!.getFilesByFolderPath(type, id, path);

      res.json({
        files,
        count: files.length
      });
    } catch (error) {
      console.error(`Error getting files by folder path:`, error);
      res.status(500).json({
        error: `Failed to get files by folder path`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;