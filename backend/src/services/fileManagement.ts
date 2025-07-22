import { GoogleDriveService, FileMetadata, FileUploadOptions } from './googleDrive';
import { GoogleSheetsService } from './googleSheets';
import { v4 as uuidv4 } from 'uuid';

export interface FileRecord {
  id: string;
  name: string;
  original_name: string;
  drive_file_id: string;
  mime_type: string;
  size: string;
  project_id?: string;
  client_id?: string;
  uploaded_by: string;
  description?: string;
  tags?: string;
  is_shared_with_client: boolean;
  web_view_link: string;
  web_content_link: string;
  created_at: string;
  updated_at: string;
}

export interface FileUploadRequest {
  name: string;
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  projectId?: string;
  clientId?: string;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  shareWithClient?: boolean;
}

export interface FileSearchRequest {
  projectId?: string;
  clientId?: string;
  query?: string;
  mimeType?: string;
  tags?: string[];
  uploadedBy?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
  fullTextSearch?: boolean;
  isSharedWithClient?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export class FileManagementService {
  private driveService: GoogleDriveService;
  private sheetsService: GoogleSheetsService;
  private projectFolderId?: string;
  private clientFolderId?: string;

  constructor(driveService: GoogleDriveService, sheetsService: GoogleSheetsService) {
    this.driveService = driveService;
    this.sheetsService = sheetsService;
  }

  /**
   * Initialize file management system
   */
  async initialize(): Promise<boolean> {
    try {
      // Create main project folders
      this.projectFolderId = await this.driveService.createFolder('Project Files');
      this.clientFolderId = await this.driveService.createFolder('Client Files');

      // Create Files sheet if it doesn't exist
      await this.sheetsService.createSheet('Files', [
        'id', 'name', 'original_name', 'drive_file_id', 'mime_type', 'size',
        'project_id', 'client_id', 'uploaded_by', 'description', 'tags',
        'is_shared_with_client', 'web_view_link', 'web_content_link',
        'created_at', 'updated_at'
      ]);

      console.log('✅ File management system initialized');
      return true;
    } catch (error) {
      console.error('❌ Error initializing file management system:', error);
      return false;
    }
  }

  /**
   * Upload a file and create database record
   */
  async uploadFile(request: FileUploadRequest): Promise<FileRecord> {
    try {
      // Determine parent folder
      let parentFolderId = this.projectFolderId;
      let folderName = '';

      if (request.projectId) {
        // Create or get project-specific folder
        folderName = `Project_${request.projectId}`;
        const existingFolders = await this.driveService.searchFiles({
          query: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.projectFolderId!]
        });

        if (existingFolders.length > 0) {
          parentFolderId = existingFolders[0].id;
        } else {
          parentFolderId = await this.driveService.createFolder(folderName, this.projectFolderId);
        }
      } else if (request.clientId) {
        // Create or get client-specific folder
        folderName = `Client_${request.clientId}`;
        const existingFolders = await this.driveService.searchFiles({
          query: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.clientFolderId!]
        });

        if (existingFolders.length > 0) {
          parentFolderId = existingFolders[0].id;
        } else {
          parentFolderId = await this.driveService.createFolder(folderName, this.clientFolderId);
        }
      }

      // Upload file to Google Drive
      const uploadOptions: FileUploadOptions = {
        name: request.name,
        mimeType: request.mimeType,
        parents: [parentFolderId!],
        description: request.description
      };

      const driveFile = await this.driveService.uploadFile(request.buffer, uploadOptions);

      // Set permissions if sharing with client
      if (request.shareWithClient) {
        await this.driveService.setFilePermissions(driveFile.id, 'reader', 'anyone');
      }

      // Create database record
      const fileRecord: FileRecord = {
        id: uuidv4(),
        name: request.name,
        original_name: request.originalName,
        drive_file_id: driveFile.id,
        mime_type: request.mimeType,
        size: driveFile.size,
        project_id: request.projectId || '',
        client_id: request.clientId || '',
        uploaded_by: request.uploadedBy,
        description: request.description || '',
        tags: request.tags?.join(',') || '',
        is_shared_with_client: request.shareWithClient || false,
        web_view_link: driveFile.webViewLink,
        web_content_link: driveFile.webContentLink,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.sheetsService.create('Files', fileRecord);

      console.log(`✅ File uploaded successfully: ${request.name}`);
      return fileRecord;
    } catch (error) {
      console.error(`❌ Error uploading file ${request.name}:`, error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<FileRecord | null> {
    try {
      const files = await this.sheetsService.read('Files', fileId);
      return files.length > 0 ? files[0] as FileRecord : null;
    } catch (error) {
      console.error(`❌ Error getting file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Search files with filters
   */
  async searchFiles(request: FileSearchRequest): Promise<FileRecord[]> {
    try {
      const filters: any = {};

      if (request.projectId) {
        filters.project_id = request.projectId;
      }

      if (request.clientId) {
        filters.client_id = request.clientId;
      }

      if (request.uploadedBy) {
        filters.uploaded_by = request.uploadedBy;
      }

      if (request.mimeType) {
        filters.mime_type = request.mimeType;
      }
      
      if (request.isSharedWithClient !== undefined) {
        filters.is_shared_with_client = request.isSharedWithClient;
      }

      let files = await this.sheetsService.query('Files', filters) as FileRecord[];

      // Apply text search if provided
      if (request.query) {
        const query = request.query.toLowerCase();
        
        if (request.fullTextSearch) {
          // More comprehensive search across all text fields
          files = files.filter(file => 
            file.name.toLowerCase().includes(query) ||
            file.original_name.toLowerCase().includes(query) ||
            (file.description && file.description.toLowerCase().includes(query)) ||
            (file.tags && file.tags.toLowerCase().includes(query)) ||
            (file.uploaded_by && file.uploaded_by.toLowerCase().includes(query))
          );
        } else {
          // Standard name-based search
          files = files.filter(file => 
            file.name.toLowerCase().includes(query) ||
            file.original_name.toLowerCase().includes(query)
          );
        }
      }

      // Apply tag filter if provided
      if (request.tags && request.tags.length > 0) {
        files = files.filter(file => {
          if (!file.tags) return false;
          const fileTags = file.tags.split(',').map(tag => tag.trim().toLowerCase());
          return request.tags!.some(tag => fileTags.includes(tag.toLowerCase()));
        });
      }
      
      // Apply date range filter if provided
      if (request.dateRange) {
        const startDate = new Date(request.dateRange.start).getTime();
        const endDate = new Date(request.dateRange.end).getTime();
        
        files = files.filter(file => {
          const fileDate = new Date(file.created_at).getTime();
          return fileDate >= startDate && fileDate <= endDate;
        });
      }
      
      // Apply sorting
      if (request.sortBy) {
        const direction = request.sortDirection === 'desc' ? -1 : 1;
        
        files.sort((a, b) => {
          let valueA, valueB;
          
          switch (request.sortBy) {
            case 'name':
              valueA = a.name.toLowerCase();
              valueB = b.name.toLowerCase();
              break;
            case 'size':
              valueA = parseInt(a.size);
              valueB = parseInt(b.size);
              break;
            case 'created_at':
              valueA = new Date(a.created_at).getTime();
              valueB = new Date(b.created_at).getTime();
              break;
            case 'updated_at':
              valueA = new Date(a.updated_at).getTime();
              valueB = new Date(b.updated_at).getTime();
              break;
            default:
              valueA = a.name.toLowerCase();
              valueB = b.name.toLowerCase();
          }
          
          if (valueA < valueB) return -1 * direction;
          if (valueA > valueB) return 1 * direction;
          return 0;
        });
      }

      // Apply pagination
      const offset = request.offset || 0;
      const limit = request.limit || 50;
      
      return files.slice(offset, offset + limit);
    } catch (error) {
      console.error('❌ Error searching files:', error);
      throw error;
    }
  }

  /**
   * Get files by project
   */
  async getFilesByProject(projectId: string): Promise<FileRecord[]> {
    return this.searchFiles({ projectId });
  }

  /**
   * Get files by client
   */
  async getFilesByClient(clientId: string): Promise<FileRecord[]> {
    return this.searchFiles({ clientId });
  }

  /**
   * Download file
   */
  async downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileRecord }> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      const buffer = await this.driveService.downloadFile(fileRecord.drive_file_id);
      
      return { buffer, metadata: fileRecord };
    } catch (error) {
      console.error(`❌ Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      // Delete from Google Drive
      await this.driveService.deleteFile(fileRecord.drive_file_id);

      // Delete from database
      await this.sheetsService.delete('Files', fileId);

      console.log(`✅ File deleted successfully: ${fileRecord.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(fileId: string, updates: Partial<FileRecord>): Promise<FileRecord> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      // Update Google Drive metadata if name or description changed
      if (updates.name || updates.description) {
        const driveUpdates: any = {};
        if (updates.name) driveUpdates.name = updates.name;
        if (updates.description) driveUpdates.description = updates.description;
        
        await this.driveService.updateFileMetadata(fileRecord.drive_file_id, driveUpdates);
      }

      // Update sharing permissions if changed
      if (updates.is_shared_with_client !== undefined && updates.is_shared_with_client !== fileRecord.is_shared_with_client) {
        if (updates.is_shared_with_client) {
          await this.driveService.setFilePermissions(fileRecord.drive_file_id, 'reader', 'anyone');
        }
        // Note: We can't easily remove permissions, so we just update the flag
      }

      // Update database record
      const updatedData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      await this.sheetsService.update('Files', fileId, updatedData);

      // Return updated record
      const updatedRecord = await this.getFile(fileId);
      return updatedRecord!;
    } catch (error) {
      console.error(`❌ Error updating file metadata ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Share file with client
   */
  async shareFileWithClient(fileId: string): Promise<boolean> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }

      // Set Google Drive permissions
      await this.driveService.setFilePermissions(fileRecord.drive_file_id, 'reader', 'anyone');

      // Update database record
      await this.updateFileMetadata(fileId, { is_shared_with_client: true });

      console.log(`✅ File shared with client: ${fileRecord.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sharing file ${fileId} with client:`, error);
      throw error;
    }
  }

  /**
   * Get file statistics
   */
  async getFileStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    filesByProject: Record<string, number>;
    sharedFiles: number;
  }> {
    try {
      const allFiles = await this.sheetsService.read('Files') as FileRecord[];
      
      const stats = {
        totalFiles: allFiles.length,
        totalSize: allFiles.reduce((sum, file) => sum + parseInt(file.size || '0'), 0),
        filesByType: {} as Record<string, number>,
        filesByProject: {} as Record<string, number>,
        sharedFiles: allFiles.filter(file => file.is_shared_with_client).length
      };

      // Count by mime type
      allFiles.forEach(file => {
        const type = file.mime_type || 'unknown';
        stats.filesByType[type] = (stats.filesByType[type] || 0) + 1;
      });

      // Count by project
      allFiles.forEach(file => {
        if (file.project_id) {
          stats.filesByProject[file.project_id] = (stats.filesByProject[file.project_id] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('❌ Error getting file statistics:', error);
      throw error;
    }
  }
  
  /**
   * Create a folder structure for a project or client
   */
  async createFolderStructure(type: 'project' | 'client', id: string, name: string): Promise<string> {
    try {
      const parentFolderId = type === 'project' ? this.projectFolderId : this.clientFolderId;
      
      if (!parentFolderId) {
        throw new Error(`Parent folder for ${type} not initialized`);
      }
      
      // Create main folder for project/client if it doesn't exist
      const folderName = `${type === 'project' ? 'Project' : 'Client'}_${id}_${name}`;
      
      const existingFolders = await this.driveService.searchFiles({
        query: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      });
      
      if (existingFolders.length > 0) {
        return existingFolders[0].id;
      }
      
      // Create main folder
      const mainFolderId = await this.driveService.createFolder(folderName, parentFolderId);
      
      // Create subfolders based on type
      if (type === 'project') {
        // Create standard project subfolders
        await this.driveService.createFolder('Documents', mainFolderId);
        await this.driveService.createFolder('Deliverables', mainFolderId);
        await this.driveService.createFolder('Contracts', mainFolderId);
        await this.driveService.createFolder('Communications', mainFolderId);
      } else {
        // Create standard client subfolders
        await this.driveService.createFolder('Invoices', mainFolderId);
        await this.driveService.createFolder('Contracts', mainFolderId);
        await this.driveService.createFolder('Communications', mainFolderId);
      }
      
      return mainFolderId;
    } catch (error) {
      console.error(`❌ Error creating folder structure for ${type} ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Associate a file with a project or client
   */
  async associateFile(fileId: string, type: 'project' | 'client', id: string, subfolder?: string): Promise<FileRecord> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }
      
      // Get project/client details to determine folder name
      let entityName = '';
      if (type === 'project') {
        const projects = await this.sheetsService.read('Projects', id);
        if (projects.length === 0) {
          throw new Error(`Project with ID ${id} not found`);
        }
        entityName = projects[0].name;
      } else {
        const clients = await this.sheetsService.read('Clients', id);
        if (clients.length === 0) {
          throw new Error(`Client with ID ${id} not found`);
        }
        entityName = clients[0].name;
      }
      
      // Get or create the main folder
      const mainFolderId = await this.createFolderStructure(type, id, entityName);
      
      // Determine target folder
      let targetFolderId = mainFolderId;
      if (subfolder) {
        // Look for the subfolder
        const subfolders = await this.driveService.searchFiles({
          query: subfolder,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mainFolderId]
        });
        
        if (subfolders.length > 0) {
          targetFolderId = subfolders[0].id;
        } else {
          // Create the subfolder if it doesn't exist
          targetFolderId = await this.driveService.createFolder(subfolder, mainFolderId);
        }
      }
      
      // Move the file to the target folder
      await this.driveService.moveFile(fileRecord.drive_file_id, targetFolderId);
      
      // Update the file record
      const updates: Partial<FileRecord> = {};
      if (type === 'project') {
        updates.project_id = id;
      } else {
        updates.client_id = id;
      }
      
      return await this.updateFileMetadata(fileId, updates);
    } catch (error) {
      console.error(`❌ Error associating file ${fileId} with ${type} ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get files by folder path
   */
  async getFilesByFolderPath(type: 'project' | 'client', id: string, folderPath: string[]): Promise<FileRecord[]> {
    try {
      // First get the base folder ID
      const parentFolderId = type === 'project' ? this.projectFolderId : this.clientFolderId;
      
      if (!parentFolderId) {
        throw new Error(`Parent folder for ${type} not initialized`);
      }
      
      // Get entity name
      let entityName = '';
      if (type === 'project') {
        const projects = await this.sheetsService.read('Projects', id);
        if (projects.length === 0) {
          throw new Error(`Project with ID ${id} not found`);
        }
        entityName = projects[0].name;
      } else {
        const clients = await this.sheetsService.read('Clients', id);
        if (clients.length === 0) {
          throw new Error(`Client with ID ${id} not found`);
        }
        entityName = clients[0].name;
      }
      
      // Build the folder path
      const folderName = `${type === 'project' ? 'Project' : 'Client'}_${id}_${entityName}`;
      const fullPath = [folderName, ...folderPath];
      
      // Navigate to the target folder
      let currentFolderId = parentFolderId;
      for (const folder of fullPath) {
        const folders = await this.driveService.searchFiles({
          query: folder,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentFolderId]
        });
        
        if (folders.length === 0) {
          throw new Error(`Folder ${folder} not found in path`);
        }
        
        currentFolderId = folders[0].id;
      }
      
      // Get files in the target folder
      const driveFiles = await this.driveService.getFilesByParent(currentFolderId);
      
      // Map to file records
      const fileRecords: FileRecord[] = [];
      for (const driveFile of driveFiles) {
        // Skip folders
        if (driveFile.mimeType === 'application/vnd.google-apps.folder') {
          continue;
        }
        
        // Find the corresponding file record
        const files = await this.sheetsService.query('Files', { drive_file_id: driveFile.id }) as FileRecord[];
        
        if (files.length > 0) {
          fileRecords.push(files[0]);
        }
      }
      
      return fileRecords;
    } catch (error) {
      console.error(`❌ Error getting files by folder path:`, error);
      throw error;
    }
  }
  
  /**
   * Generate a thumbnail URL for a file
   */
  async getFileThumbnail(fileId: string): Promise<string | null> {
    try {
      const fileRecord = await this.getFile(fileId);
      if (!fileRecord) {
        throw new Error(`File with ID ${fileId} not found`);
      }
      
      return await this.driveService.getThumbnailUrl(fileRecord.drive_file_id);
    } catch (error) {
      console.error(`❌ Error getting thumbnail for file ${fileId}:`, error);
      return null;
    }
  }
  
  /**
   * Batch update file tags
   */
  async batchUpdateTags(fileIds: string[], tags: string[]): Promise<number> {
    try {
      let updatedCount = 0;
      
      for (const fileId of fileIds) {
        try {
          await this.updateFileMetadata(fileId, { tags: tags.join(',') });
          updatedCount++;
        } catch (error) {
          console.error(`Failed to update tags for file ${fileId}:`, error);
          // Continue with other files
        }
      }
      
      return updatedCount;
    } catch (error) {
      console.error('❌ Error batch updating file tags:', error);
      throw error;
    }
  }
  
  /**
   * Batch share files with client
   */
  async batchShareWithClient(fileIds: string[]): Promise<number> {
    try {
      let sharedCount = 0;
      
      for (const fileId of fileIds) {
        try {
          await this.shareFileWithClient(fileId);
          sharedCount++;
        } catch (error) {
          console.error(`Failed to share file ${fileId} with client:`, error);
          // Continue with other files
        }
      }
      
      return sharedCount;
    } catch (error) {
      console.error('❌ Error batch sharing files with client:', error);
      throw error;
    }
  }
}

// Factory function to create FileManagementService instance
export function createFileManagementService(): FileManagementService | null {
  const driveService = require('./googleDrive').createGoogleDriveService();
  const sheetsService = require('./googleSheets').createGoogleSheetsService();

  if (!driveService || !sheetsService) {
    console.error('❌ Failed to create file management service dependencies');
    return null;
  }

  return new FileManagementService(driveService, sheetsService);
}