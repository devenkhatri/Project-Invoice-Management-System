import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import FileService from '../services/file.service';
import { FileUploadRequest, FileSearchQuery, FileShareRequest } from '../models/File';
import { body, query, param } from 'express-validator';

const router = express.Router();
const fileService = new FileService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/', 'application/pdf', 'text/', 'application/msword',
      'application/vnd.openxmlformats-officedocument', 'application/vnd.ms-excel',
      'application/zip', 'application/x-zip-compressed'
    ];

    if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// Validation schemas
const uploadValidation = [
  body('projectId').optional().isUUID(),
  body('clientId').optional().isUUID(),
  body('invoiceId').optional().isUUID(),
  body('taskId').optional().isUUID(),
  body('folderId').optional().isString(),
  body('tags').optional().isArray(),
  body('category').optional().isString(),
  body('description').optional().isString(),
  body('isPublic').optional().isBoolean(),
  body('expiresAt').optional().isISO8601()
];

const searchValidation = [
  query('query').optional().isString(),
  query('projectId').optional().isUUID(),
  query('clientId').optional().isUUID(),
  query('invoiceId').optional().isUUID(),
  query('taskId').optional().isUUID(),
  query('folderId').optional().isString(),
  query('category').optional().isString(),
  query('mimeType').optional().isString(),
  query('minSize').optional().isInt({ min: 0 }),
  query('maxSize').optional().isInt({ min: 0 }),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('uploadedBy').optional().isString(),
  query('isPublic').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['name', 'size', 'createdAt', 'updatedAt', 'downloadCount']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

const shareValidation = [
  body('fileIds').isArray().notEmpty(),
  body('fileIds.*').isUUID(),
  body('clientIds').optional().isArray(),
  body('clientIds.*').optional().isUUID(),
  body('expiresAt').optional().isISO8601(),
  body('permissions').isIn(['view', 'download', 'comment']),
  body('message').optional().isString()
];

const commentValidation = [
  body('comment').isString().notEmpty().isLength({ min: 1, max: 1000 })
];

// Routes

/**
 * @route POST /api/files/upload
 * @desc Upload single file
 * @access Private
 */
router.post('/upload', 
  authenticateToken, 
  upload.single('file'), 
  uploadValidation,
  validateRequest,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const uploadRequest: FileUploadRequest = {
        file: req.file,
        projectId: req.body.projectId,
        clientId: req.body.clientId,
        invoiceId: req.body.invoiceId,
        taskId: req.body.taskId,
        folderId: req.body.folderId,
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        category: req.body.category,
        description: req.body.description,
        isPublic: req.body.isPublic === 'true',
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
      };

      const fileMetadata = await fileService.uploadFile(uploadRequest, req.user.id);
      res.status(201).json(fileMetadata);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

/**
 * @route POST /api/files/upload-multiple
 * @desc Upload multiple files
 * @access Private
 */
router.post('/upload-multiple',
  authenticateToken,
  upload.array('files', 10),
  uploadValidation,
  validateRequest,
  async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const uploadRequests: FileUploadRequest[] = req.files.map(file => ({
        file,
        projectId: req.body.projectId,
        clientId: req.body.clientId,
        invoiceId: req.body.invoiceId,
        taskId: req.body.taskId,
        folderId: req.body.folderId,
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        category: req.body.category,
        description: req.body.description,
        isPublic: req.body.isPublic === 'true',
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
      }));

      const results = await fileService.uploadMultipleFiles(uploadRequests, req.user.id);
      res.status(201).json(results);
    } catch (error) {
      console.error('Multiple upload error:', error);
      res.status(500).json({ error: 'Failed to upload files' });
    }
  }
);

/**
 * @route GET /api/files/search
 * @desc Search files
 * @access Private
 */
router.get('/search',
  authenticateToken,
  searchValidation,
  validateRequest,
  async (req, res) => {
    try {
      const searchQuery: FileSearchQuery = {
        query: req.query.query as string,
        projectId: req.query.projectId as string,
        clientId: req.query.clientId as string,
        invoiceId: req.query.invoiceId as string,
        taskId: req.query.taskId as string,
        folderId: req.query.folderId as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        category: req.query.category as string,
        mimeType: req.query.mimeType as string,
        minSize: req.query.minSize ? parseInt(req.query.minSize as string) : undefined,
        maxSize: req.query.maxSize ? parseInt(req.query.maxSize as string) : undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        uploadedBy: req.query.uploadedBy as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await fileService.searchFiles(searchQuery, req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to search files' });
    }
  }
);

/**
 * @route GET /api/files/:id
 * @desc Get file metadata
 * @access Private
 */
router.get('/:id',
  authenticateToken,
  param('id').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const file = await fileService.getFile(req.params.id, req.user.id);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      res.json(file);
    } catch (error) {
      console.error('Get file error:', error);
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(500).json({ error: 'Failed to get file' });
    }
  }
);

/**
 * @route GET /api/files/:id/download
 * @desc Download file
 * @access Private
 */
router.get('/:id/download',
  authenticateToken,
  param('id').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const result = await fileService.downloadFile(req.params.id, req.user.id);
      
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (error) {
      console.error('Download error:', error);
      if (error.message === 'File not found') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
);

/**
 * @route POST /api/files/download-multiple
 * @desc Download multiple files as ZIP
 * @access Private
 */
router.post('/download-multiple',
  authenticateToken,
  body('fileIds').isArray().notEmpty(),
  body('fileIds.*').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const zipBuffer = await fileService.downloadMultipleFiles(req.body.fileIds, req.user.id);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');
      res.send(zipBuffer);
    } catch (error) {
      console.error('Multiple download error:', error);
      res.status(500).json({ error: 'Failed to download files' });
    }
  }
);

/**
 * @route POST /api/files/share
 * @desc Share files with clients
 * @access Private
 */
router.post('/share',
  authenticateToken,
  shareValidation,
  validateRequest,
  async (req, res) => {
    try {
      const shareRequest: FileShareRequest = req.body;
      await fileService.shareFiles(shareRequest, req.user.id);
      res.json({ message: 'Files shared successfully' });
    } catch (error) {
      console.error('Share error:', error);
      res.status(500).json({ error: 'Failed to share files' });
    }
  }
);

/**
 * @route DELETE /api/files/:id
 * @desc Delete file
 * @access Private
 */
router.delete('/:id',
  authenticateToken,
  param('id').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      await fileService.deleteFile(req.params.id, req.user.id);
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Delete error:', error);
      if (error.message === 'File not found') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

/**
 * @route POST /api/files/:id/comments
 * @desc Add comment to file
 * @access Private
 */
router.post('/:id/comments',
  authenticateToken,
  param('id').isUUID(),
  commentValidation,
  validateRequest,
  async (req, res) => {
    try {
      const comment = await fileService.addComment(
        req.params.id,
        req.user.id,
        req.user.name || req.user.email,
        req.body.comment
      );
      res.status(201).json(comment);
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }
);

/**
 * @route GET /api/files/:id/comments
 * @desc Get file comments
 * @access Private
 */
router.get('/:id/comments',
  authenticateToken,
  param('id').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const comments = await fileService.getFileComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  }
);

/**
 * @route POST /api/files/:id/versions
 * @desc Upload new version of file
 * @access Private
 */
router.post('/:id/versions',
  authenticateToken,
  upload.single('file'),
  param('id').isUUID(),
  body('changeDescription').optional().isString(),
  validateRequest,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const updatedFile = await fileService.createNewVersion(
        req.params.id,
        req.file,
        req.user.id,
        req.body.changeDescription
      );

      res.json(updatedFile);
    } catch (error) {
      console.error('Version upload error:', error);
      if (error.message === 'File not found') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(500).json({ error: 'Failed to upload new version' });
    }
  }
);

/**
 * @route GET /api/files/:id/versions
 * @desc Get file versions
 * @access Private
 */
router.get('/:id/versions',
  authenticateToken,
  param('id').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const versions = await fileService.getFileVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error('Get versions error:', error);
      res.status(500).json({ error: 'Failed to get file versions' });
    }
  }
);

export default router;