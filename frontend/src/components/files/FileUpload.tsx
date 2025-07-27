import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Close,
  AttachFile,
  Image,
  Description,
  Archive
} from '@mui/icons-material';
import { FileUploadRequest, FileUploadProgress, FILE_CATEGORIES, formatFileSize, getFileIcon } from '../../types/file';

interface FileUploadProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[], metadata: FileUploadRequest) => Promise<void>;
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
}

interface FileWithMetadata {
  file: File;
  id: string;
  preview?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  open,
  onClose,
  onUpload,
  projectId,
  clientId,
  invoiceId,
  taskId,
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  allowedTypes = [
    'image/*',
    'application/pdf',
    'text/*',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.*',
    'application/vnd.ms-excel',
    'application/zip'
  ]
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileWithMetadata[]>([]);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
    }

    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type || file.type.includes(type);
    });

    if (!isAllowed) {
      return `File type "${file.type}" is not allowed.`;
    }

    return null;
  };

  const handleFiles = useCallback((files: FileList) => {
    const newFiles: FileWithMetadata[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        return;
      }

      if (selectedFiles.length + newFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      const fileWithMetadata: FileWithMetadata = {
        file,
        id: `${Date.now()}-${Math.random()}`,
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          fileWithMetadata.preview = e.target?.result as string;
          setSelectedFiles(prev => 
            prev.map(f => f.id === fileWithMetadata.id ? fileWithMetadata : f)
          );
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(fileWithMetadata);
    });

    if (errors.length > 0) {
      setError(errors.join(' '));
    } else {
      setError(null);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [selectedFiles.length, maxFiles, maxFileSize, allowedTypes]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const metadata: FileUploadRequest = {
        projectId,
        clientId,
        invoiceId,
        taskId,
        description: description.trim() || undefined,
        category,
        tags: tags.length > 0 ? tags : undefined,
        isPublic,
        expiresAt: expiresAt || undefined
      };

      const files = selectedFiles.map(f => f.file);
      await onUpload(files, metadata);

      // Reset form
      setSelectedFiles([]);
      setDescription('');
      setCategory('general');
      setTags([]);
      setIsPublic(false);
      setExpiresAt('');
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upload Files
        <IconButton
          onClick={handleClose}
          disabled={isUploading}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Drag and Drop Area */}
        <Paper
          sx={{
            border: 2,
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            borderStyle: 'dashed',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: dragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            mb: 3,
            transition: 'all 0.2s ease'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag and drop files here, or click to select
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maximum {maxFiles} files, up to {formatFileSize(maxFileSize)} each
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </Paper>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Selected Files ({selectedFiles.length})
            </Typography>
            <List>
              {selectedFiles.map((fileWithMetadata) => (
                <ListItem key={fileWithMetadata.id} divider>
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                    {fileWithMetadata.preview ? (
                      <img
                        src={fileWithMetadata.preview}
                        alt={fileWithMetadata.file.name}
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <Box sx={{ fontSize: 24 }}>
                        {getFileIcon(fileWithMetadata.file.type)}
                      </Box>
                    )}
                  </Box>
                  <ListItemText
                    primary={fileWithMetadata.file.name}
                    secondary={`${formatFileSize(fileWithMetadata.file.size)} • ${fileWithMetadata.file.type}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => removeFile(fileWithMetadata.id)}
                      disabled={isUploading}
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              Uploading files...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Metadata Form */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            disabled={isUploading}
            sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}
          />

          <FormControl disabled={isUploading}>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              label="Category"
            >
              {FILE_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <TextField
              label="Add Tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              disabled={isUploading}
              size="small"
              sx={{ mb: 1 }}
            />
            <Button onClick={addTag} disabled={!tagInput.trim() || isUploading}>
              Add Tag
            </Button>
            <Box sx={{ mt: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => removeTag(tag)}
                  disabled={isUploading}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isUploading}
              />
            }
            label="Make files public"
          />

          <TextField
            label="Expires At"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isUploading}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={selectedFiles.length === 0 || isUploading}
          startIcon={<CloudUpload />}
        >
          Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUpload;