import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export interface DriveConfig {
  serviceAccountEmail: string;
  privateKey: string;
}

export interface FileUploadOptions {
  name: string;
  mimeType: string;
  parents?: string[];
  description?: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
  parents?: string[];
  description?: string;
}

/**
 * Options for searching files in Google Drive
 * @property query - Search query string
 * @property mimeType - Filter by MIME type (can be comma-separated for multiple types)
 * @property parents - Filter by parent folder IDs
 * @property pageSize - Maximum number of results to return
 * @property orderBy - Sort order (e.g., 'modifiedTime desc')
 * @property fields - Fields to include in the response (Google Drive API fields format)
 * @property fullTextSearch - Whether to search in file content and metadata (not just filename)
 */
export interface FileSearchOptions {
  query?: string;
  mimeType?: string;
  parents?: string[];
  pageSize?: number;
  orderBy?: string;
  fields?: string;
  fullTextSearch?: boolean;
}

export class GoogleDriveService {
  private drive: any;
  private auth: JWT;

  constructor(config: DriveConfig) {
    // Initialize JWT authentication
    this.auth = new JWT({
      email: config.serviceAccountEmail,
      key: config.privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Test the connection to Google Drive
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.drive.about.get({
        fields: 'user'
      });
      console.log(`✅ Connected to Google Drive as: ${response.data.user.emailAddress}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Google Drive:', error);
      return false;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name: string, parentId?: string): Promise<string> {
    try {
      const fileMetadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      console.log(`✅ Created folder: ${name} with ID: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error(`❌ Error creating folder ${name}:`, error);
      throw error;
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: FileUploadOptions
  ): Promise<FileMetadata> {
    try {
      const media = {
        mimeType: options.mimeType,
        body: Readable.from(fileBuffer)
      };

      const fileMetadata: any = {
        name: options.name,
        description: options.description
      };

      if (options.parents) {
        fileMetadata.parents = options.parents;
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description'
      });

      console.log(`✅ Uploaded file: ${options.name} with ID: ${response.data.id}`);
      return response.data as FileMetadata;
    } catch (error) {
      console.error(`❌ Error uploading file ${options.name}:`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description'
      });

      return response.data as FileMetadata;
    } catch (error) {
      console.error(`❌ Error getting file metadata for ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.data.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        response.data.on('error', (error: any) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error(`❌ Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({
        fileId
      });

      console.log(`✅ Deleted file with ID: ${fileId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Search files in Google Drive
   * @param options - Search options including query, mime type, and other filters
   * @returns Array of file metadata objects matching the search criteria
   */
  async searchFiles(options: FileSearchOptions = {}): Promise<FileMetadata[]> {
    try {
      const queryParts: string[] = [];

      if (options.query) {
        if (options.fullTextSearch) {
          // Full text search across name, description, and content
          queryParts.push(`fullText contains '${options.query}'`);
        } else {
          queryParts.push(`name contains '${options.query}'`);
        }
      }

      if (options.mimeType) {
        if (options.mimeType.includes(',')) {
          // Support for multiple mime types
          const mimeTypes = options.mimeType.split(',').map(type => `mimeType='${type.trim()}'`);
          queryParts.push(`(${mimeTypes.join(' or ')})`);
        } else {
          queryParts.push(`mimeType='${options.mimeType}'`);
        }
      }

      if (options.parents && options.parents.length > 0) {
        const parentQueries = options.parents.map(parent => `'${parent}' in parents`);
        queryParts.push(`(${parentQueries.join(' or ')})`);
      }

      // Add trashed=false to exclude deleted files
      queryParts.push('trashed=false');

      const q = queryParts.length > 0 ? queryParts.join(' and ') : undefined;

      const fields = options.fields || 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description)';

      const response = await this.drive.files.list({
        q,
        pageSize: options.pageSize || 100,
        orderBy: options.orderBy || 'modifiedTime desc',
        fields
      });

      return response.data.files as FileMetadata[];
    } catch (error) {
      console.error('❌ Error searching files:', error);
      throw error;
    }
  }

  /**
   * Set file permissions (make file shareable)
   */
  async setFilePermissions(fileId: string, role: 'reader' | 'writer' = 'reader', type: 'user' | 'anyone' = 'anyone'): Promise<boolean> {
    try {
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role,
          type
        }
      });

      console.log(`✅ Set permissions for file ${fileId}: ${role} access for ${type}`);
      return true;
    } catch (error) {
      console.error(`❌ Error setting permissions for file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(fileId: string, metadata: Partial<FileUploadOptions>): Promise<FileMetadata> {
    try {
      const response = await this.drive.files.update({
        fileId,
        requestBody: metadata,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description'
      });

      console.log(`✅ Updated metadata for file ${fileId}`);
      return response.data as FileMetadata;
    } catch (error) {
      console.error(`❌ Error updating file metadata for ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Move file to a different folder
   */
  async moveFile(fileId: string, newParentId: string): Promise<boolean> {
    try {
      // Get current parents
      const file = await this.getFileMetadata(fileId);
      const previousParents = file.parents?.join(',') || '';

      await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents'
      });

      console.log(`✅ Moved file ${fileId} to folder ${newParentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error moving file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Get files by parent folder
   */
  async getFilesByParent(parentId: string): Promise<FileMetadata[]> {
    return this.searchFiles({ parents: [parentId] });
  }

  /**
   * Create a folder structure (creates nested folders if they don't exist)
   * @param folderPath Array of folder names representing the path
   * @param rootFolderId Optional root folder ID to start from
   * @returns ID of the deepest folder created
   */
  async createFolderPath(folderPath: string[], rootFolderId?: string): Promise<string> {
    let currentParentId = rootFolderId;
    
    for (const folderName of folderPath) {
      // Check if folder exists
      const searchOptions: FileSearchOptions = {
        query: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      if (currentParentId) {
        searchOptions.parents = [currentParentId];
      }
      
      const existingFolders = await this.searchFiles(searchOptions);
      
      if (existingFolders.length > 0) {
        // Folder exists, use it as parent for next iteration
        currentParentId = existingFolders[0].id;
      } else {
        // Create new folder
        currentParentId = await this.createFolder(folderName, currentParentId);
      }
    }
    
    return currentParentId!;
  }

  /**
   * Copy a file to another folder
   */
  async copyFile(fileId: string, destinationFolderId: string, newName?: string): Promise<FileMetadata> {
    try {
      const requestBody: any = {
        parents: [destinationFolderId]
      };
      
      if (newName) {
        requestBody.name = newName;
      }
      
      const response = await this.drive.files.copy({
        fileId,
        requestBody,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description'
      });
      
      console.log(`✅ Copied file ${fileId} to folder ${destinationFolderId}`);
      return response.data as FileMetadata;
    } catch (error) {
      console.error(`❌ Error copying file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a thumbnail URL for a file (if supported)
   */
  async getThumbnailUrl(fileId: string): Promise<string | null> {
    try {
      const file = await this.getFileMetadata(fileId);
      
      // Check if file type supports thumbnails
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'application/pdf'];
      
      if (!supportedTypes.some(type => file.mimeType.includes(type))) {
        return null;
      }
      
      // For images and PDFs, we can use the thumbnailLink
      const response = await this.drive.files.get({
        fileId,
        fields: 'thumbnailLink'
      });
      
      return response.data.thumbnailLink || null;
    } catch (error) {
      console.error(`❌ Error getting thumbnail for file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Create a shareable link for a file
   */
  async createShareableLink(fileId: string, type: 'view' | 'download' = 'view'): Promise<string> {
    try {
      // First ensure the file has proper permissions
      await this.setFilePermissions(fileId, 'reader', 'anyone');
      
      // Get the file with web links
      const file = await this.getFileMetadata(fileId);
      
      return type === 'view' ? file.webViewLink : file.webContentLink;
    } catch (error) {
      console.error(`❌ Error creating shareable link for file ${fileId}:`, error);
      throw error;
    }
  }
}

// Factory function to create GoogleDriveService instance
export function createGoogleDriveService(): GoogleDriveService | null {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    console.error('❌ Missing Google Drive configuration. Please check environment variables.');
    return null;
  }

  return new GoogleDriveService({
    serviceAccountEmail,
    privateKey
  });
}