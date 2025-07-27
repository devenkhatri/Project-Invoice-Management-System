import { v4 as uuidv4 } from 'uuid';

export interface FileMetadata {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  driveFileId: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  
  // Association fields
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  
  // Organization fields
  folderId?: string;
  tags: string[];
  category: string;
  
  // Access control
  isPublic: boolean;
  sharedWith: string[];
  expiresAt?: Date;
  
  // Metadata
  description?: string;
  version: number;
  parentFileId?: string; // For version control
  
  // Audit fields
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  downloadCount: number;
}

export interface FileUploadRequest {
  file: Express.Multer.File;
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  folderId?: string;
  tags?: string[];
  category?: string;
  description?: string;
  isPublic?: boolean;
  expiresAt?: Date;
}

export interface FileSearchQuery {
  query?: string;
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  folderId?: string;
  tags?: string[];
  category?: string;
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
  dateFrom?: Date;
  dateTo?: Date;
  uploadedBy?: string;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'downloadCount';
  sortOrder?: 'asc' | 'desc';
}

export interface FileShareRequest {
  fileIds: string[];
  clientIds?: string[];
  expiresAt?: Date;
  permissions: 'view' | 'download' | 'comment';
  message?: string;
}

export interface FileComment {
  id: string;
  fileId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  driveFileId: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
  changeDescription?: string;
}

export class File {
  constructor(
    public id: string = uuidv4(),
    public name: string,
    public originalName: string,
    public mimeType: string,
    public size: number,
    public driveFileId: string,
    public projectId?: string,
    public clientId?: string,
    public invoiceId?: string,
    public taskId?: string,
    public folderId?: string,
    public tags: string[] = [],
    public category: string = 'general',
    public isPublic: boolean = false,
    public sharedWith: string[] = [],
    public expiresAt?: Date,
    public description?: string,
    public version: number = 1,
    public parentFileId?: string,
    public uploadedBy: string = '',
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public lastAccessedAt?: Date,
    public downloadCount: number = 0,
    public thumbnailUrl?: string,
    public previewUrl?: string,
    public downloadUrl?: string
  ) {}

  static fromSheetRow(row: any[]): File {
    return new File(
      row[0] || uuidv4(),
      row[1] || '',
      row[2] || '',
      row[3] || '',
      parseInt(row[4]) || 0,
      row[5] || '',
      row[6] || undefined,
      row[7] || undefined,
      row[8] || undefined,
      row[9] || undefined,
      row[10] || undefined,
      row[11] ? row[11].split(',').filter(Boolean) : [],
      row[12] || 'general',
      row[13] === 'TRUE',
      row[14] ? row[14].split(',').filter(Boolean) : [],
      row[15] ? new Date(row[15]) : undefined,
      row[16] || undefined,
      parseInt(row[17]) || 1,
      row[18] || undefined,
      row[19] || '',
      new Date(row[20] || Date.now()),
      new Date(row[21] || Date.now()),
      row[22] ? new Date(row[22]) : undefined,
      parseInt(row[23]) || 0,
      row[24] || undefined,
      row[25] || undefined,
      row[26] || undefined
    );
  }

  toSheetRow(): any[] {
    return [
      this.id,
      this.name,
      this.originalName,
      this.mimeType,
      this.size,
      this.driveFileId,
      this.projectId || '',
      this.clientId || '',
      this.invoiceId || '',
      this.taskId || '',
      this.folderId || '',
      this.tags.join(','),
      this.category,
      this.isPublic ? 'TRUE' : 'FALSE',
      this.sharedWith.join(','),
      this.expiresAt ? this.expiresAt.toISOString() : '',
      this.description || '',
      this.version,
      this.parentFileId || '',
      this.uploadedBy,
      this.createdAt.toISOString(),
      this.updatedAt.toISOString(),
      this.lastAccessedAt ? this.lastAccessedAt.toISOString() : '',
      this.downloadCount,
      this.thumbnailUrl || '',
      this.previewUrl || '',
      this.downloadUrl || ''
    ];
  }

  updateAccess(): void {
    this.lastAccessedAt = new Date();
    this.downloadCount += 1;
    this.updatedAt = new Date();
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  canAccess(userId: string): boolean {
    if (this.isExpired()) return false;
    if (this.isPublic) return true;
    if (this.uploadedBy === userId) return true;
    return this.sharedWith.includes(userId);
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  shareWith(userIds: string[], expiresAt?: Date): void {
    userIds.forEach(userId => {
      if (!this.sharedWith.includes(userId)) {
        this.sharedWith.push(userId);
      }
    });
    if (expiresAt) {
      this.expiresAt = expiresAt;
    }
    this.updatedAt = new Date();
  }

  revokeAccess(userId: string): void {
    const index = this.sharedWith.indexOf(userId);
    if (index > -1) {
      this.sharedWith.splice(index, 1);
      this.updatedAt = new Date();
    }
  }
}

export default File;