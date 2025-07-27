import { SheetsService } from './sheets.service';
import DriveService from './drive.service';
import File, { FileMetadata, FileUploadRequest, FileSearchQuery, FileShareRequest, FileComment, FileVersion } from '../models/File';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import path from 'path';

export class FileService {
  private sheetsService: SheetsService;
  private driveService: DriveService;
  private readonly SHEET_NAME = 'Files';
  private readonly COMMENTS_SHEET = 'File_Comments';
  private readonly VERSIONS_SHEET = 'File_Versions';

  constructor() {
    this.sheetsService = new SheetsService(
      process.env.GOOGLE_SHEETS_ID || '',
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : {}
    );
    this.driveService = new DriveService();
  }

  async initializeSheets(): Promise<void> {
    try {
      // The sheets are already configured in SheetsService constructor
      // Just initialize the Drive folder structure
      await this.driveService.initializeFolderStructure();
    } catch (error) {
      console.error('Error initializing file sheets:', error);
      throw error;
    }
  }

  async uploadFile(uploadRequest: FileUploadRequest, userId: string): Promise<File> {
    try {
      const { file } = uploadRequest;
      
      // Validate file
      this.validateFile(file);

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueName = `${uuidv4()}${fileExtension}`;

      // Determine folder based on association
      let folderId = uploadRequest.folderId;
      if (!folderId) {
        if (uploadRequest.projectId) {
          folderId = await this.getOrCreateProjectFolder(uploadRequest.projectId);
        } else if (uploadRequest.clientId) {
          folderId = await this.getOrCreateClientFolder(uploadRequest.clientId);
        } else if (uploadRequest.invoiceId) {
          folderId = await this.getOrCreateInvoiceFolder(uploadRequest.invoiceId);
        }
      }

      // Upload to Google Drive
      const driveResult = await this.driveService.uploadFile(file.buffer, {
        name: uniqueName,
        mimeType: file.mimetype,
        parents: folderId ? [folderId] : undefined,
        description: uploadRequest.description
      });

      // Generate thumbnail if it's an image
      let thumbnailUrl;
      if (file.mimetype.startsWith('image/')) {
        thumbnailUrl = this.driveService.getThumbnailUrl(driveResult.fileId);
      }

      // Create file metadata
      const fileMetadata = new File(
        uuidv4(),
        file.originalname,
        file.originalname,
        file.mimetype,
        file.size,
        driveResult.fileId,
        uploadRequest.projectId,
        uploadRequest.clientId,
        uploadRequest.invoiceId,
        uploadRequest.taskId,
        folderId,
        uploadRequest.tags || [],
        uploadRequest.category || this.categorizeFile(file.mimetype),
        uploadRequest.isPublic || false,
        [],
        uploadRequest.expiresAt,
        uploadRequest.description,
        1,
        undefined,
        userId,
        new Date(),
        new Date(),
        undefined,
        0,
        thumbnailUrl,
        this.driveService.getPreviewUrl(driveResult.fileId),
        this.driveService.getDownloadUrl(driveResult.fileId)
      );

      // Save to sheets
      await this.sheetsService.create(this.SHEET_NAME, fileMetadata);

      // Create initial version record
      await this.createVersionRecord(fileMetadata.id, 1, driveResult.fileId, file.size, userId, 'Initial upload');

      return fileMetadata;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(files: FileUploadRequest[], userId: string): Promise<File[]> {
    const results: File[] = [];
    
    for (const fileRequest of files) {
      try {
        const result = await this.uploadFile(fileRequest, userId);
        results.push(result);
      } catch (error) {
        console.error(`Error uploading file ${fileRequest.file.originalname}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  async getFile(fileId: string, userId: string): Promise<File | null> {
    try {
      const files = await this.sheetsService.read(this.SHEET_NAME, fileId);
      
      if (!files || files.length === 0) {
        return null;
      }

      const fileData = files[0] as any;
      const file = new File(
        fileData.id,
        fileData.name,
        fileData.originalName,
        fileData.mimeType,
        fileData.size,
        fileData.driveFileId,
        fileData.projectId,
        fileData.clientId,
        fileData.invoiceId,
        fileData.taskId,
        fileData.folderId,
        fileData.tags || [],
        fileData.category,
        fileData.isPublic,
        fileData.sharedWith || [],
        fileData.expiresAt ? new Date(fileData.expiresAt) : undefined,
        fileData.description,
        fileData.version,
        fileData.parentFileId,
        fileData.uploadedBy,
        new Date(fileData.createdAt),
        new Date(fileData.updatedAt),
        fileData.lastAccessedAt ? new Date(fileData.lastAccessedAt) : undefined,
        fileData.downloadCount,
        fileData.thumbnailUrl,
        fileData.previewUrl,
        fileData.downloadUrl
      );
      
      // Check access permissions
      if (!file.canAccess(userId)) {
        throw new Error('Access denied');
      }

      return file;
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  async searchFiles(query: FileSearchQuery, userId: string): Promise<{ files: File[]; total: number }> {
    try {
      const allFilesData = await this.sheetsService.read(this.SHEET_NAME);
      let files = (allFilesData as any[]).map(fileData => new File(
        fileData.id,
        fileData.name,
        fileData.originalName,
        fileData.mimeType,
        fileData.size,
        fileData.driveFileId,
        fileData.projectId,
        fileData.clientId,
        fileData.invoiceId,
        fileData.taskId,
        fileData.folderId,
        fileData.tags || [],
        fileData.category,
        fileData.isPublic,
        fileData.sharedWith || [],
        fileData.expiresAt ? new Date(fileData.expiresAt) : undefined,
        fileData.description,
        fileData.version,
        fileData.parentFileId,
        fileData.uploadedBy,
        new Date(fileData.createdAt),
        new Date(fileData.updatedAt),
        fileData.lastAccessedAt ? new Date(fileData.lastAccessedAt) : undefined,
        fileData.downloadCount,
        fileData.thumbnailUrl,
        fileData.previewUrl,
        fileData.downloadUrl
      ));

      // Filter by access permissions
      files = files.filter(file => file.canAccess(userId));

      // Apply filters
      if (query.query) {
        const searchTerm = query.query.toLowerCase();
        files = files.filter(file => 
          file.name.toLowerCase().includes(searchTerm) ||
          file.description?.toLowerCase().includes(searchTerm) ||
          file.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      if (query.projectId) {
        files = files.filter(file => file.projectId === query.projectId);
      }

      if (query.clientId) {
        files = files.filter(file => file.clientId === query.clientId);
      }

      if (query.invoiceId) {
        files = files.filter(file => file.invoiceId === query.invoiceId);
      }

      if (query.taskId) {
        files = files.filter(file => file.taskId === query.taskId);
      }

      if (query.category) {
        files = files.filter(file => file.category === query.category);
      }

      if (query.tags && query.tags.length > 0) {
        files = files.filter(file => 
          query.tags!.some(tag => file.tags.includes(tag))
        );
      }

      if (query.mimeType) {
        files = files.filter(file => file.mimeType.includes(query.mimeType!));
      }

      if (query.minSize) {
        files = files.filter(file => file.size >= query.minSize!);
      }

      if (query.maxSize) {
        files = files.filter(file => file.size <= query.maxSize!);
      }

      if (query.dateFrom) {
        files = files.filter(file => file.createdAt >= query.dateFrom!);
      }

      if (query.dateTo) {
        files = files.filter(file => file.createdAt <= query.dateTo!);
      }

      if (query.uploadedBy) {
        files = files.filter(file => file.uploadedBy === query.uploadedBy);
      }

      if (query.isPublic !== undefined) {
        files = files.filter(file => file.isPublic === query.isPublic);
      }

      const total = files.length;

      // Apply sorting
      if (query.sortBy) {
        files.sort((a, b) => {
          let aValue: any = a[query.sortBy as keyof File];
          let bValue: any = b[query.sortBy as keyof File];

          if (aValue instanceof Date) aValue = aValue.getTime();
          if (bValue instanceof Date) bValue = bValue.getTime();

          if (query.sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
          }
          return aValue > bValue ? 1 : -1;
        });
      }

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 50;
      files = files.slice(offset, offset + limit);

      return { files, total };
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string, userId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    try {
      const file = await this.getFile(fileId, userId);
      if (!file) {
        throw new Error('File not found');
      }

      // Update access tracking
      file.updateAccess();
      await this.updateFile(file);

      // Download from Google Drive
      const buffer = await this.driveService.downloadFile(file.driveFileId);

      return {
        buffer,
        filename: file.name,
        mimeType: file.mimeType
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async downloadMultipleFiles(fileIds: string[], userId: string): Promise<Buffer> {
    try {
      const files: { name: string; buffer: Buffer }[] = [];

      for (const fileId of fileIds) {
        try {
          const downloadResult = await this.downloadFile(fileId, userId);
          files.push({
            name: downloadResult.filename,
            buffer: downloadResult.buffer
          });
        } catch (error) {
          console.error(`Error downloading file ${fileId}:`, error);
          // Continue with other files
        }
      }

      // Create ZIP archive
      return await this.driveService.createZipArchive(files);
    } catch (error) {
      console.error('Error downloading multiple files:', error);
      throw error;
    }
  }

  async shareFiles(shareRequest: FileShareRequest, userId: string): Promise<void> {
    try {
      for (const fileId of shareRequest.fileIds) {
        const file = await this.getFile(fileId, userId);
        if (!file) continue;

        // Update file sharing settings
        if (shareRequest.clientIds) {
          file.shareWith(shareRequest.clientIds, shareRequest.expiresAt);
          await this.updateFile(file);

          // Share on Google Drive if needed
          for (const clientId of shareRequest.clientIds) {
            // Get client email from client service
            // await this.driveService.shareFile(file.driveFileId, clientEmail, 'reader');
          }
        }
      }
    } catch (error) {
      console.error('Error sharing files:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const file = await this.getFile(fileId, userId);
      if (!file) {
        throw new Error('File not found');
      }

      if (file.uploadedBy !== userId) {
        throw new Error('Access denied');
      }

      // Delete from Google Drive
      await this.driveService.deleteFile(file.driveFileId);

      // Delete from sheets
      await this.sheetsService.delete(this.SHEET_NAME, fileId);

      // Delete related comments and versions
      await this.deleteFileComments(fileId);
      await this.deleteFileVersions(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async addComment(fileId: string, userId: string, userName: string, comment: string): Promise<FileComment> {
    try {
      const fileComment: FileComment = {
        id: uuidv4(),
        fileId,
        userId,
        userName,
        comment,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const row = [
        fileComment.id,
        fileComment.fileId,
        fileComment.userId,
        fileComment.userName,
        fileComment.comment,
        fileComment.createdAt.toISOString(),
        fileComment.updatedAt.toISOString()
      ];

      await this.sheetsService.create(this.COMMENTS_SHEET, fileComment);
      return fileComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  async getFileComments(fileId: string): Promise<FileComment[]> {
    try {
      const allComments = await this.sheetsService.read(this.COMMENTS_SHEET);
      return (allComments as FileComment[]).filter(comment => comment.fileId === fileId);
    } catch (error) {
      console.error('Error getting file comments:', error);
      throw error;
    }
  }

  async createNewVersion(fileId: string, file: Express.Multer.File, userId: string, changeDescription?: string): Promise<File> {
    try {
      const existingFile = await this.getFile(fileId, userId);
      if (!existingFile) {
        throw new Error('File not found');
      }

      if (existingFile.uploadedBy !== userId) {
        throw new Error('Access denied');
      }

      // Upload new version to Drive
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      const driveResult = await this.driveService.uploadFile(file.buffer, {
        name: uniqueName,
        mimeType: file.mimetype,
        parents: existingFile.folderId ? [existingFile.folderId] : undefined
      });

      // Update file metadata
      const newVersion = existingFile.version + 1;
      existingFile.version = newVersion;
      existingFile.driveFileId = driveResult.fileId;
      existingFile.size = file.size;
      existingFile.updatedAt = new Date();
      existingFile.previewUrl = this.driveService.getPreviewUrl(driveResult.fileId);
      existingFile.downloadUrl = this.driveService.getDownloadUrl(driveResult.fileId);

      await this.updateFile(existingFile);

      // Create version record
      await this.createVersionRecord(fileId, newVersion, driveResult.fileId, file.size, userId, changeDescription);

      return existingFile;
    } catch (error) {
      console.error('Error creating new version:', error);
      throw error;
    }
  }

  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    try {
      const allVersions = await this.sheetsService.read(this.VERSIONS_SHEET);
      return (allVersions as FileVersion[])
        .filter(version => version.fileId === fileId)
        .sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Error getting file versions:', error);
      throw error;
    }
  }

  private async updateFile(file: File): Promise<void> {
    await this.sheetsService.update(this.SHEET_NAME, file.id, file);
  }

  private async createVersionRecord(fileId: string, version: number, driveFileId: string, size: number, userId: string, changeDescription?: string): Promise<void> {
    const versionRecord = [
      uuidv4(),
      fileId,
      version,
      driveFileId,
      size,
      userId,
      new Date().toISOString(),
      changeDescription || ''
    ];

    const versionObj = {
      id: uuidv4(),
      fileId,
      version,
      driveFileId,
      size,
      uploadedBy: userId,
      createdAt: new Date(),
      changeDescription: changeDescription || ''
    };

    await this.sheetsService.create(this.VERSIONS_SHEET, versionObj);
  }

  private async deleteFileComments(fileId: string): Promise<void> {
    const allComments = await this.sheetsService.read(this.COMMENTS_SHEET);
    const commentIds = (allComments as FileComment[])
      .filter(comment => comment.fileId === fileId)
      .map(comment => comment.id);
    
    for (const commentId of commentIds) {
      await this.sheetsService.delete(this.COMMENTS_SHEET, commentId);
    }
  }

  private async deleteFileVersions(fileId: string): Promise<void> {
    const allVersions = await this.sheetsService.read(this.VERSIONS_SHEET);
    const versionIds = (allVersions as FileVersion[])
      .filter(version => version.fileId === fileId)
      .map(version => version.id);
    
    for (const versionId of versionIds) {
      await this.sheetsService.delete(this.VERSIONS_SHEET, versionId);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'image/', 'application/pdf', 'text/', 'application/msword',
      'application/vnd.openxmlformats-officedocument', 'application/vnd.ms-excel',
      'application/zip', 'application/x-zip-compressed'
    ];

    if (file.size > maxSize) {
      throw new Error('File size exceeds maximum limit of 100MB');
    }

    if (!allowedTypes.some(type => file.mimetype.startsWith(type))) {
      throw new Error('File type not allowed');
    }
  }

  private categorizeFile(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
    if (mimeType.startsWith('text/')) return 'text';
    return 'general';
  }

  private async getOrCreateProjectFolder(projectId: string): Promise<string> {
    // This would integrate with project service to get project name
    const folderName = `Project_${projectId}`;
    return await this.driveService.createFolderIfNotExists(folderName);
  }

  private async getOrCreateClientFolder(clientId: string): Promise<string> {
    // This would integrate with client service to get client name
    const folderName = `Client_${clientId}`;
    return await this.driveService.createFolderIfNotExists(folderName);
  }

  private async getOrCreateInvoiceFolder(invoiceId: string): Promise<string> {
    // This would integrate with invoice service to get invoice number
    const folderName = `Invoice_${invoiceId}`;
    return await this.driveService.createFolderIfNotExists(folderName);
  }
}

export default FileService;