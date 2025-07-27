import FileService from '../file.service';
import { SheetsService } from '../sheets.service';
import DriveService from '../drive.service';
import File, { FileUploadRequest, FileSearchQuery } from '../../models/File';

// Mock dependencies
jest.mock('../sheets.service');
jest.mock('../drive.service');

describe('FileService', () => {
  let fileService: FileService;
  let mockSheetsService: jest.Mocked<SheetsService>;
  let mockDriveService: jest.Mocked<DriveService>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test file content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any
  };

  const mockUserId = 'user-123';
  const mockFileId = 'file-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSheetsService = {
      create: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      query: jest.fn(),
      initializeSheet: jest.fn()
    } as any;
    
    mockDriveService = {
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
      deleteFile: jest.fn(),
      getPreviewUrl: jest.fn(),
      getDownloadUrl: jest.fn(),
      getThumbnailUrl: jest.fn(),
      createZipArchive: jest.fn(),
      initializeFolderStructure: jest.fn(),
      createFolderIfNotExists: jest.fn()
    } as any;
    
    fileService = new FileService();
    (fileService as any).sheetsService = mockSheetsService;
    (fileService as any).driveService = mockDriveService;
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const uploadRequest: FileUploadRequest = {
        file: mockFile,
        projectId: 'project-123',
        description: 'Test file',
        tags: ['test', 'document'],
        category: 'document'
      };

      mockDriveService.uploadFile.mockResolvedValue({
        fileId: 'drive-file-123',
        webViewLink: 'https://drive.google.com/file/d/drive-file-123/view',
        thumbnailLink: 'https://drive.google.com/thumbnail?id=drive-file-123'
      });

      mockDriveService.getPreviewUrl.mockReturnValue('https://drive.google.com/file/d/drive-file-123/preview');
      mockDriveService.getDownloadUrl.mockReturnValue('https://drive.google.com/uc?export=download&id=drive-file-123');
      mockDriveService.createFolderIfNotExists.mockResolvedValue('folder-123');
      mockSheetsService.create.mockResolvedValue('file-123');

      const result = await fileService.uploadFile(uploadRequest, mockUserId);

      expect(result).toBeDefined();
      expect(result.name).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.size).toBe(1024);
      expect(result.projectId).toBe('project-123');
      expect(result.tags).toEqual(['test', 'document']);
      expect(result.uploadedBy).toBe(mockUserId);

      expect(mockDriveService.uploadFile).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.objectContaining({
          name: expect.stringMatching(/\.pdf$/),
          mimeType: 'application/pdf',
          description: 'Test file'
        })
      );

      expect(mockSheetsService.create).toHaveBeenCalledWith(
        'Files',
        expect.any(Object)
      );
    });

    it('should reject files that are too large', async () => {
      const largeFile = {
        ...mockFile,
        size: 200 * 1024 * 1024 // 200MB
      };

      const uploadRequest: FileUploadRequest = {
        file: largeFile
      };

      await expect(fileService.uploadFile(uploadRequest, mockUserId))
        .rejects.toThrow('File size exceeds maximum limit of 100MB');
    });

    it('should reject disallowed file types', async () => {
      const executableFile = {
        ...mockFile,
        mimetype: 'application/x-executable'
      };

      const uploadRequest: FileUploadRequest = {
        file: executableFile
      };

      await expect(fileService.uploadFile(uploadRequest, mockUserId))
        .rejects.toThrow('File type not allowed');
    });
  });

  describe('getFile', () => {
    it('should return file if user has access', async () => {
      const mockFileData = {
        id: mockFileId,
        name: 'test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        driveFileId: 'drive-file-123',
        projectId: 'project-123',
        clientId: '',
        invoiceId: '',
        taskId: '',
        folderId: '',
        tags: ['test', 'document'],
        category: 'document',
        isPublic: false,
        sharedWith: [],
        expiresAt: undefined,
        description: 'Test file',
        version: 1,
        parentFileId: undefined,
        uploadedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: undefined,
        downloadCount: 0,
        thumbnailUrl: '',
        previewUrl: 'https://drive.google.com/file/d/drive-file-123/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123'
      };

      mockSheetsService.read.mockResolvedValue([mockFileData]);

      const result = await fileService.getFile(mockFileId, mockUserId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockFileId);
      expect(result!.name).toBe('test.pdf');
      expect(result!.uploadedBy).toBe(mockUserId);
    });

    it('should return null if file not found', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const result = await fileService.getFile(mockFileId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('searchFiles', () => {
    it('should return filtered files', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          name: 'document1.pdf',
          originalName: 'document1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          driveFileId: 'drive-file-1',
          projectId: 'project-123',
          clientId: '',
          invoiceId: '',
          taskId: '',
          folderId: '',
          tags: ['document', 'important'],
          category: 'document',
          isPublic: false,
          sharedWith: [],
          expiresAt: undefined,
          description: 'Important document',
          version: 1,
          parentFileId: undefined,
          uploadedBy: mockUserId,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessedAt: undefined,
          downloadCount: 5,
          thumbnailUrl: '',
          previewUrl: 'https://drive.google.com/file/d/drive-file-1/preview',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-1'
        }
      ];

      mockSheetsService.read.mockResolvedValue(mockFiles);

      const query: FileSearchQuery = {
        projectId: 'project-123'
      };

      const result = await fileService.searchFiles(query, mockUserId);

      expect(result.files).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.files[0].projectId).toBe('project-123');
    });
  });

  describe('downloadFile', () => {
    it('should download file and update access tracking', async () => {
      const mockFileData = {
        id: mockFileId,
        name: 'test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        driveFileId: 'drive-file-123',
        projectId: 'project-123',
        clientId: '',
        invoiceId: '',
        taskId: '',
        folderId: '',
        tags: ['test', 'document'],
        category: 'document',
        isPublic: false,
        sharedWith: [],
        expiresAt: undefined,
        description: 'Test file',
        version: 1,
        parentFileId: undefined,
        uploadedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: undefined,
        downloadCount: 0,
        thumbnailUrl: '',
        previewUrl: 'https://drive.google.com/file/d/drive-file-123/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123'
      };

      mockSheetsService.read.mockResolvedValue([mockFileData]);
      mockSheetsService.update.mockResolvedValue(true);
      mockDriveService.downloadFile.mockResolvedValue(Buffer.from('file content'));

      const result = await fileService.downloadFile(mockFileId, mockUserId);

      expect(result.buffer).toEqual(Buffer.from('file content'));
      expect(result.filename).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');

      expect(mockDriveService.downloadFile).toHaveBeenCalledWith('drive-file-123');
      expect(mockSheetsService.update).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete file from Drive and Sheets', async () => {
      const mockFileData = {
        id: mockFileId,
        name: 'test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        driveFileId: 'drive-file-123',
        projectId: 'project-123',
        clientId: '',
        invoiceId: '',
        taskId: '',
        folderId: '',
        tags: ['test', 'document'],
        category: 'document',
        isPublic: false,
        sharedWith: [],
        expiresAt: undefined,
        description: 'Test file',
        version: 1,
        parentFileId: undefined,
        uploadedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: undefined,
        downloadCount: 0,
        thumbnailUrl: '',
        previewUrl: 'https://drive.google.com/file/d/drive-file-123/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123'
      };

      mockSheetsService.read.mockResolvedValue([mockFileData]);
      mockSheetsService.delete.mockResolvedValue(true);
      mockDriveService.deleteFile.mockResolvedValue(undefined);

      await fileService.deleteFile(mockFileId, mockUserId);

      expect(mockDriveService.deleteFile).toHaveBeenCalledWith('drive-file-123');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Files', mockFileId);
    });

    it('should throw access denied for non-owner', async () => {
      const mockFileData = {
        id: mockFileId,
        name: 'test.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        driveFileId: 'drive-file-123',
        projectId: 'project-123',
        clientId: '',
        invoiceId: '',
        taskId: '',
        folderId: '',
        tags: ['test', 'document'],
        category: 'document',
        isPublic: false,
        sharedWith: [],
        expiresAt: undefined,
        description: 'Test file',
        version: 1,
        parentFileId: undefined,
        uploadedBy: 'other-user-123', // Different user
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: undefined,
        downloadCount: 0,
        thumbnailUrl: '',
        previewUrl: 'https://drive.google.com/file/d/drive-file-123/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-123'
      };

      mockSheetsService.read.mockResolvedValue([mockFileData]);

      await expect(fileService.deleteFile(mockFileId, mockUserId))
        .rejects.toThrow('Access denied');
    });
  });

  describe('addComment', () => {
    it('should add comment to file', async () => {
      mockSheetsService.create.mockResolvedValue('comment-123');

      const result = await fileService.addComment(
        mockFileId,
        mockUserId,
        'John Doe',
        'This is a test comment'
      );

      expect(result).toBeDefined();
      expect(result.fileId).toBe(mockFileId);
      expect(result.userId).toBe(mockUserId);
      expect(result.userName).toBe('John Doe');
      expect(result.comment).toBe('This is a test comment');

      expect(mockSheetsService.create).toHaveBeenCalledWith(
        'File_Comments',
        expect.any(Object)
      );
    });
  });
});