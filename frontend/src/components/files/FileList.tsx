import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Pagination,
  Alert,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Fab
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Download,
  Share,
  Delete,
  Edit,
  Visibility,
  Comment,
  History,
  Add,
  CloudDownload,
  Archive
} from '@mui/icons-material';
import { FileMetadata, FileSearchQuery, FileSearchResult, formatFileSize, getFileIcon, canPreview, FILE_CATEGORIES } from '../../types/file';

interface FileListProps {
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  taskId?: string;
  onFileSelect?: (file: FileMetadata) => void;
  onFileUpload?: () => void;
  onFileDownload?: (fileId: string) => void;
  onFileShare?: (fileIds: string[]) => void;
  onFileDelete?: (fileId: string) => void;
  onFilePreview?: (file: FileMetadata) => void;
  selectable?: boolean;
  showUploadButton?: boolean;
}

const FileList: React.FC<FileListProps> = ({
  projectId,
  clientId,
  invoiceId,
  taskId,
  onFileSelect,
  onFileUpload,
  onFileDownload,
  onFileShare,
  onFileDelete,
  onFilePreview,
  selectable = false,
  showUploadButton = true
}) => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Partial<FileSearchQuery>>({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 20
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const searchParams: FileSearchQuery = {
        ...filters,
        query: searchQuery || undefined,
        projectId,
        clientId,
        invoiceId,
        taskId,
        offset: (page - 1) * (filters.limit || 20)
      };

      const response = await fetch('/api/files/search?' + new URLSearchParams(
        Object.entries(searchParams).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            acc[key] = Array.isArray(value) ? value.join(',') : String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load files');
      }

      const result: FileSearchResult = await response.json();
      setFiles(result.files);
      setTotalFiles(result.total);
      setTotalPages(Math.ceil(result.total / (filters.limit || 20)));
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, page, projectId, clientId, invoiceId, taskId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleFilterChange = (newFilters: Partial<FileSearchQuery>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
    setFilterOpen(false);
  };

  const handleFileMenuOpen = (event: React.MouseEvent<HTMLElement>, file: FileMetadata) => {
    setAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleFileMenuClose = () => {
    setAnchorEl(null);
    setSelectedFile(null);
  };

  const handleFileAction = (action: string) => {
    if (!selectedFile) return;

    switch (action) {
      case 'download':
        onFileDownload?.(selectedFile.id);
        break;
      case 'preview':
        onFilePreview?.(selectedFile);
        break;
      case 'share':
        onFileShare?.([selectedFile.id]);
        break;
      case 'delete':
        onFileDelete?.(selectedFile.id);
        break;
      case 'select':
        onFileSelect?.(selectedFile);
        break;
    }

    handleFileMenuClose();
  };

  const handleFileSelection = (fileId: string, selected: boolean) => {
    if (selected) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'download':
        // Handle bulk download
        break;
      case 'share':
        onFileShare?.(selectedFiles);
        break;
      case 'delete':
        // Handle bulk delete
        break;
    }
    setSelectedFiles([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ flexGrow: 1 }}
        />
        
        <Button
          startIcon={<FilterList />}
          onClick={() => setFilterOpen(true)}
          variant="outlined"
        >
          Filter
        </Button>

        {selectedFiles.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<CloudDownload />}
              onClick={() => handleBulkAction('download')}
              size="small"
            >
              Download ({selectedFiles.length})
            </Button>
            <Button
              startIcon={<Share />}
              onClick={() => handleBulkAction('share')}
              size="small"
            >
              Share
            </Button>
            <Button
              startIcon={<Delete />}
              onClick={() => handleBulkAction('delete')}
              color="error"
              size="small"
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Files Grid */}
      {loading ? (
        <Typography>Loading files...</Typography>
      ) : files.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No files found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try adjusting your search criteria' : 'Upload your first file to get started'}
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {files.map((file) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    cursor: onFileSelect ? 'pointer' : 'default',
                    '&:hover': {
                      boxShadow: 2
                    }
                  }}
                  onClick={() => onFileSelect?.(file)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      {selectable && (
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onChange={(e) => handleFileSelection(file.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.light' }}>
                        {file.thumbnailUrl ? (
                          <img 
                            src={file.thumbnailUrl} 
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ fontSize: 20 }}>
                            {getFileIcon(file.mimeType)}
                          </Box>
                        )}
                      </Avatar>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography 
                          variant="subtitle2" 
                          noWrap 
                          title={file.name}
                          sx={{ fontWeight: 600 }}
                        >
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                      </Box>

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileMenuOpen(e, file);
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>

                    {file.description && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ mb: 1 }}
                        noWrap
                        title={file.description}
                      >
                        {file.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {file.tags.slice(0, 2).map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                      {file.tags.length > 2 && (
                        <Chip label={`+${file.tags.length - 2}`} size="small" />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(file.updatedAt)}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {file.downloadCount > 0 && (
                          <Tooltip title={`Downloaded ${file.downloadCount} times`}>
                            <Chip 
                              label={file.downloadCount} 
                              size="small" 
                              icon={<Download />}
                            />
                          </Tooltip>
                        )}
                        
                        {file.version > 1 && (
                          <Tooltip title={`Version ${file.version}`}>
                            <Chip 
                              label={`v${file.version}`} 
                              size="small" 
                              icon={<History />}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* File Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleFileMenuClose}
      >
        {canPreview(selectedFile?.mimeType || '') && (
          <MenuItem onClick={() => handleFileAction('preview')}>
            <Visibility sx={{ mr: 1 }} />
            Preview
          </MenuItem>
        )}
        
        <MenuItem onClick={() => handleFileAction('download')}>
          <Download sx={{ mr: 1 }} />
          Download
        </MenuItem>
        
        <MenuItem onClick={() => handleFileAction('share')}>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItem>
        
        <MenuItem onClick={() => handleFileAction('select')}>
          <Edit sx={{ mr: 1 }} />
          Edit Details
        </MenuItem>
        
        <MenuItem onClick={() => handleFileAction('delete')} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Files</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <FormControl>
              <InputLabel>Category</InputLabel>
              <Select
                value={filters.category || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {FILE_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={filters.sortBy || 'updatedAt'}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                label="Sort By"
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="size">Size</MenuItem>
                <MenuItem value="createdAt">Created Date</MenuItem>
                <MenuItem value="updatedAt">Modified Date</MenuItem>
                <MenuItem value="downloadCount">Download Count</MenuItem>
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>Sort Order</InputLabel>
              <Select
                value={filters.sortOrder || 'desc'}
                onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))}
                label="Sort Order"
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="File Type"
              value={filters.mimeType || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, mimeType: e.target.value || undefined }))}
              placeholder="e.g., image/, application/pdf"
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Min Size (bytes)"
                type="number"
                value={filters.minSize || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minSize: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
              <TextField
                label="Max Size (bytes)"
                type="number"
                value={filters.maxSize || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, maxSize: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              setFilters({
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                limit: 20
              });
              setFilterOpen(false);
            }}
          >
            Clear
          </Button>
          <Button onClick={() => setFilterOpen(false)} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload FAB */}
      {showUploadButton && onFileUpload && (
        <Fab
          color="primary"
          onClick={onFileUpload}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16
          }}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
};

export default FileList;