import request from 'supertest';
import express from 'express';
import fileRoutes from '../files';
import FileService from '../../services/file.service';
import { auth } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/file.service');
jest.mock('../../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/files', fileRoutes);

describe('File Routes', () => {
  let mockFileService: jest.Mocked<FileService>;
  let mockAuth: jest.MockedFunction<typeof auth>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockFile = {
    id: 'file-123',
    name: 'test.pdf',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    driveFileId: 'drive-file-123',
    projectId: 'project-123',
    tags: ['test', 'document'],
    category: 'document',
    isPublic: false,
    sharedWith: [],
    description: 'Test file',
    version: 1,
    uploadedBy: 'user-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadCount: 0,
    previewUrl: 'https://drive.google.com/file/d/drive-file-123/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFileService = new FileService() as jest.Mocked<FileService>;
    (FileService as jest.MockedClass<typeof FileService>).mockImplementation(() => mockFileService);
    
    mockAuth = auth as jest.MockedFunction<typeof auth>;
    mockAuth.mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });
  });

  describe('POST /upload', () => {
    it('should upload file successfully', async () => {
      mockFileService.uploadFile.mockResolvedValue(mockFile as any);

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .field('projectId', 'project-123')
        .field('description', 'Test file')
        .field('tags', JSON.stringify(['test', 'document']))
        .field('category', 'document');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockFile);
      expect(mockFileService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.any(Object),
          projectId: 'project-123',
          description: 'Test file',
          tags: ['test', 'document'],
          category: 'document'
        }),
        mockUser.id
      );
    });

    it('should return 400 if no file provided', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .field('projectId', 'project-123');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file provided');
    });

    it('should handle upload errors', async () => {
      mockFileService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test file content'), 'test.pdf');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to upload file');
    });
  });

  describe('POST /upload-multiple', () => {
    it('should upload multiple files successfully', async () => {
      const mockFiles = [mockFile, { ...mockFile, id: 'file-456', name: 'test2.pdf' }];
      mockFileService.uploadMultipleFiles.mockResolvedValue(mockFiles as any);

      const response = await request(app)
        .post('/api/files/upload-multiple')
        .attach('files', Buffer.from('test file 1'), 'test1.pdf')
        .attach('files', Buffer.from('test file 2'), 'test2.pdf')
        .field('projectId', 'project-123');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockFiles);
      expect(mockFileService.uploadMultipleFiles).toHaveBeenCalled();
    });

    it('should return 400 if no files provided', async () => {
      const response = await request(app)
        .post('/api/files/upload-multiple')
        .field('projectId', 'project-123');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No files provided');
    });
  });

  describe('GET /search', () => {
    it('should search files successfully', async () => {
      const mockSearchResult = {
        files: [mockFile],
        total: 1
      };
      mockFileService.searchFiles.mockResolvedValue(mockSearchResult as any);

      const response = await request(app)
        .get('/api/files/search')
        .query({
          query: 'test',
          projectId: 'project-123',
          limit: '10',
          offset: '0'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSearchResult);
      expect(mockFileService.searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          projectId: 'project-123',
          limit: 10,
          offset: 0
        }),
        mockUser.id
      );
    });

    it('should handle search errors', async () => {
      mockFileService.searchFiles.mockRejectedValue(new Error('Search failed'));

      const response = await request(app)
        .get('/api/files/search');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search files');
    });
  });

  describe('GET /:id', () => {
    it('should get file metadata successfully', async () => {
      mockFileService.getFile.mockResolvedValue(mockFile as any);

      const response = await request(app)
        .get('/api/files/file-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFile);
      expect(mockFileService.getFile).toHaveBeenCalledWith('file-123', mockUser.id);
    });

    it('should return 404 if file not found', async () => {
      mockFileService.getFile.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/files/file-123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should return 403 for access denied', async () => {
      mockFileService.getFile.mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .get('/api/files/file-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/files/invalid-id');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /:id/download', () => {
    it('should download file successfully', async () => {
      const mockDownloadResult = {
        buffer: Buffer.from('file content'),
        filename: 'test.pdf',
        mimeType: 'application/pdf'
      };
      mockFileService.downloadFile.mockResolvedValue(mockDownloadResult as any);

      const response = await request(app)
        .get('/api/files/file-123/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="test.pdf"');
      expect(mockFileService.downloadFile).toHaveBeenCalledWith('file-123', mockUser.id);
    });

    it('should return 404 if file not found', async () => {
      mockFileService.downloadFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get('/api/files/file-123/download');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });
  });

  describe('POST /download-multiple', () => {
    it('should download multiple files as ZIP', async () => {
      const mockZipBuffer = Buffer.from('zip content');
      mockFileService.downloadMultipleFiles.mockResolvedValue(mockZipBuffer);

      const response = await request(app)
        .post('/api/files/download-multiple')
        .send({ fileIds: ['file-123', 'file-456'] });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toBe('attachment; filename="files.zip"');
      expect(mockFileService.downloadMultipleFiles).toHaveBeenCalledWith(['file-123', 'file-456'], mockUser.id);
    });

    it('should return 400 for invalid request', async () => {
      const response = await request(app)
        .post('/api/files/download-multiple')
        .send({ fileIds: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /share', () => {
    it('should share files successfully', async () => {
      mockFileService.shareFiles.mockResolvedValue(undefined);

      const shareRequest = {
        fileIds: ['file-123'],
        clientIds: ['client-123'],
        permissions: 'view',
        expiresAt: '2024-12-31T23:59:59Z'
      };

      const response = await request(app)
        .post('/api/files/share')
        .send(shareRequest);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Files shared successfully');
      expect(mockFileService.shareFiles).toHaveBeenCalledWith(shareRequest, mockUser.id);
    });

    it('should return 400 for invalid request', async () => {
      const response = await request(app)
        .post('/api/files/share')
        .send({ fileIds: [], permissions: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete file successfully', async () => {
      mockFileService.deleteFile.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/files/file-123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File deleted successfully');
      expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-123', mockUser.id);
    });

    it('should return 404 if file not found', async () => {
      mockFileService.deleteFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .delete('/api/files/file-123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should return 403 for access denied', async () => {
      mockFileService.deleteFile.mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .delete('/api/files/file-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('POST /:id/comments', () => {
    it('should add comment successfully', async () => {
      const mockComment = {
        id: 'comment-123',
        fileId: 'file-123',
        userId: mockUser.id,
        userName: mockUser.name,
        comment: 'Test comment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockFileService.addComment.mockResolvedValue(mockComment as any);

      const response = await request(app)
        .post('/api/files/file-123/comments')
        .send({ comment: 'Test comment' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockComment);
      expect(mockFileService.addComment).toHaveBeenCalledWith(
        'file-123',
        mockUser.id,
        mockUser.name,
        'Test comment'
      );
    });

    it('should return 400 for empty comment', async () => {
      const response = await request(app)
        .post('/api/files/file-123/comments')
        .send({ comment: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /:id/comments', () => {
    it('should get file comments successfully', async () => {
      const mockComments = [
        {
          id: 'comment-123',
          fileId: 'file-123',
          userId: mockUser.id,
          userName: mockUser.name,
          comment: 'Test comment',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockFileService.getFileComments.mockResolvedValue(mockComments as any);

      const response = await request(app)
        .get('/api/files/file-123/comments');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockComments);
      expect(mockFileService.getFileComments).toHaveBeenCalledWith('file-123');
    });
  });

  describe('POST /:id/versions', () => {
    it('should upload new version successfully', async () => {
      const updatedFile = { ...mockFile, version: 2 };
      mockFileService.createNewVersion.mockResolvedValue(updatedFile as any);

      const response = await request(app)
        .post('/api/files/file-123/versions')
        .attach('file', Buffer.from('updated content'), 'test-v2.pdf')
        .field('changeDescription', 'Updated content');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedFile);
      expect(mockFileService.createNewVersion).toHaveBeenCalledWith(
        'file-123',
        expect.any(Object),
        mockUser.id,
        'Updated content'
      );
    });

    it('should return 400 if no file provided', async () => {
      const response = await request(app)
        .post('/api/files/file-123/versions')
        .field('changeDescription', 'Updated content');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file provided');
    });
  });

  describe('GET /:id/versions', () => {
    it('should get file versions successfully', async () => {
      const mockVersions = [
        {
          id: 'version-123',
          fileId: 'file-123',
          version: 2,
          driveFileId: 'drive-file-456',
          size: 2048,
          uploadedBy: mockUser.id,
          createdAt: new Date().toISOString(),
          changeDescription: 'Updated content'
        },
        {
          id: 'version-124',
          fileId: 'file-123',
          version: 1,
          driveFileId: 'drive-file-123',
          size: 1024,
          uploadedBy: mockUser.id,
          createdAt: new Date().toISOString(),
          changeDescription: 'Initial upload'
        }
      ];
      mockFileService.getFileVersions.mockResolvedValue(mockVersions as any);

      const response = await request(app)
        .get('/api/files/file-123/versions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockVersions);
      expect(mockFileService.getFileVersions).toHaveBeenCalledWith('file-123');
    });
  });
});