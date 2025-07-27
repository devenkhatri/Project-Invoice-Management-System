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
  expiresAt?: string;
  
  // Metadata
  description?: string;
  version: number;
  parentFileId?: string;
  
  // Audit fields
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  downloadCount: number;
}

export interface FileUploadRequest {
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  folderId?: string;
  tags?: string[];
  category?: string;
  description?: string;
  isPublic?: boolean;
  expiresAt?: string;
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
  dateFrom?: string;
  dateTo?: string;
  uploadedBy?: string;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'downloadCount';
  sortOrder?: 'asc' | 'desc';
}

export interface FileSearchResult {
  files: FileMetadata[];
  total: number;
}

export interface FileShareRequest {
  fileIds: string[];
  clientIds?: string[];
  expiresAt?: string;
  permissions: 'view' | 'download' | 'comment';
  message?: string;
}

export interface FileComment {
  id: string;
  fileId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  driveFileId: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  changeDescription?: string;
}

export interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export const FILE_CATEGORIES = [
  'general',
  'document',
  'image',
  'spreadsheet',
  'archive',
  'text'
] as const;

export type FileCategory = typeof FILE_CATEGORIES[number];

export const MIME_TYPE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'text/plain': '📝',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/zip': '🗜️',
  'application/x-zip-compressed': '🗜️',
  'default': '📎'
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (mimeType: string): string => {
  return MIME_TYPE_ICONS[mimeType] || MIME_TYPE_ICONS.default;
};

export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

export const isPdfFile = (mimeType: string): boolean => {
  return mimeType === 'application/pdf';
};

export const canPreview = (mimeType: string): boolean => {
  return isImageFile(mimeType) || isPdfFile(mimeType) || mimeType.startsWith('text/');
};