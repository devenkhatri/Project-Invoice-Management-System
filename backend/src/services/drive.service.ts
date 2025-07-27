import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import sharp from 'sharp';
import archiver from 'archiver';
import { FileMetadata } from '../models/File';

export interface DriveUploadOptions {
  name: string;
  mimeType: string;
  parents?: string[];
  description?: string;
}

export interface DriveSearchOptions {
  query?: string;
  parents?: string[];
  mimeType?: string;
  pageSize?: number;
  pageToken?: string;
}

export class DriveService {
  private drive: drive_v3.Drive;
  private rootFolderId: string;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '';
  }

  async initializeFolderStructure(): Promise<void> {
    try {
      // Create main project folders if they don't exist
      const folders = [
        'Projects',
        'Clients', 
        'Invoices',
        'Templates',
        'Shared',
        'Archive'
      ];

      for (const folderName of folders) {
        await this.createFolderIfNotExists(folderName, this.rootFolderId);
      }
    } catch (error) {
      console.error('Error initializing folder structure:', error);
      throw error;
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    options: DriveUploadOptions
  ): Promise<{ fileId: string; webViewLink: string; thumbnailLink?: string }> {
    try {
      const media = {
        mimeType: options.mimeType,
        body: Readable.from(fileBuffer)
      };

      const fileMetadata: drive_v3.Schema$File = {
        name: options.name,
        parents: options.parents || [this.rootFolderId],
        description: options.description
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink,thumbnailLink'
      });

      // Make file accessible with link
      await this.drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return {
        fileId: response.data.id!,
        webViewLink: response.data.webViewLink!,
        thumbnailLink: response.data.thumbnailLink || undefined
      };
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error('Error downloading file from Drive:', error);
      throw error;
    }
  }

  async getFileMetadata(fileId: string): Promise<drive_v3.Schema$File> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,thumbnailLink,parents'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: fileId
      });
    } catch (error) {
      console.error('Error deleting file from Drive:', error);
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    try {
      const fileMetadata: drive_v3.Schema$File = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [this.rootFolderId]
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      return response.data.id!;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async createFolderIfNotExists(name: string, parentId?: string): Promise<string> {
    try {
      // Search for existing folder
      const searchQuery = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId || this.rootFolderId}' in parents and trashed=false`;
      
      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'files(id,name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      // Create folder if it doesn't exist
      return await this.createFolder(name, parentId);
    } catch (error) {
      console.error('Error creating folder if not exists:', error);
      throw error;
    }
  }

  async searchFiles(options: DriveSearchOptions): Promise<drive_v3.Schema$File[]> {
    try {
      let query = 'trashed=false';
      
      if (options.query) {
        query += ` and fullText contains '${options.query}'`;
      }
      
      if (options.parents && options.parents.length > 0) {
        const parentQuery = options.parents.map(p => `'${p}' in parents`).join(' or ');
        query += ` and (${parentQuery})`;
      }
      
      if (options.mimeType) {
        query += ` and mimeType='${options.mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize: options.pageSize || 100,
        pageToken: options.pageToken,
        fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,thumbnailLink,parents)'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async generateThumbnail(fileBuffer: Buffer, mimeType: string): Promise<Buffer | null> {
    try {
      if (!mimeType.startsWith('image/')) {
        return null;
      }

      const thumbnail = await sharp(fileBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }

  async createZipArchive(files: { name: string; buffer: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      files.forEach(file => {
        archive.append(file.buffer, { name: file.name });
      });

      archive.finalize();
    });
  }

  async shareFile(fileId: string, email: string, role: 'reader' | 'writer' | 'commenter' = 'reader'): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: role,
          type: 'user',
          emailAddress: email
        },
        sendNotificationEmail: true
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      throw error;
    }
  }

  async revokeFileAccess(fileId: string, permissionId: string): Promise<void> {
    try {
      await this.drive.permissions.delete({
        fileId: fileId,
        permissionId: permissionId
      });
    } catch (error) {
      console.error('Error revoking file access:', error);
      throw error;
    }
  }

  async getFilePermissions(fileId: string): Promise<drive_v3.Schema$Permission[]> {
    try {
      const response = await this.drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id,type,role,emailAddress)'
      });

      return response.data.permissions || [];
    } catch (error) {
      console.error('Error getting file permissions:', error);
      throw error;
    }
  }

  async copyFile(fileId: string, name: string, parentId?: string): Promise<string> {
    try {
      const response = await this.drive.files.copy({
        fileId: fileId,
        requestBody: {
          name: name,
          parents: parentId ? [parentId] : undefined
        },
        fields: 'id'
      });

      return response.data.id!;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  }

  async moveFile(fileId: string, newParentId: string): Promise<void> {
    try {
      // Get current parents
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents'
      });

      const previousParents = file.data.parents?.join(',');

      // Move file
      await this.drive.files.update({
        fileId: fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id,parents'
      });
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  getPreviewUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  getThumbnailUrl(fileId: string): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200-h200`;
  }
}

export default DriveService;