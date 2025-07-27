import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  Avatar,
  Paper,
  Tab,
  Tabs,
  Alert
} from '@mui/material';
import {
  Close,
  Download,
  Share,
  Edit,
  Comment as CommentIcon,
  History,
  Visibility,
  CloudDownload
} from '@mui/icons-material';
import { FileMetadata, FileComment, FileVersion, formatFileSize, getFileIcon, isImageFile, isPdfFile } from '../../types/file';

interface FilePreviewProps {
  file: FileMetadata | null;
  open: boolean;
  onClose: () => void;
  onDownload?: (fileId: string) => void;
  onShare?: (fileId: string) => void;
  onEdit?: (file: FileMetadata) => void;
  onAddComment?: (fileId: string, comment: string) => Promise<void>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ height: '100%' }}>
    {value === index && children}
  </div>
);

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  open,
  onClose,
  onDownload,
  onShare,
  onEdit,
  onAddComment
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file && open) {
      loadComments();
      loadVersions();
    }
  }, [file, open]);

  const loadComments = async () => {
    if (!file) return;

    try {
      const response = await fetch(`/api/files/${file.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const commentsData = await response.json();
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadVersions = async () => {
    if (!file) return;

    try {
      const response = await fetch(`/api/files/${file.id}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const versionsData = await response.json();
        setVersions(versionsData);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const handleAddComment = async () => {
    if (!file || !newComment.trim()) return;

    setLoading(true);
    try {
      await onAddComment?.(file.id, newComment.trim());
      setNewComment('');
      await loadComments();
    } catch (error) {
      setError('Failed to add comment');
    } finally {
      setLoading(false);
    }
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

  const renderPreview = () => {
    if (!file) return null;

    if (isImageFile(file.mimeType)) {
      return (
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <img
            src={file.previewUrl || file.downloadUrl}
            alt={file.name}
            style={{
              maxWidth: '100%',
              maxHeight: '400px',
              objectFit: 'contain',
              borderRadius: 8
            }}
          />
        </Box>
      );
    }

    if (isPdfFile(file.mimeType)) {
      return (
        <Box sx={{ height: 400, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <iframe
            src={file.previewUrl}
            width="100%"
            height="100%"
            style={{ border: 'none', borderRadius: 4 }}
            title={file.name}
          />
        </Box>
      );
    }

    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Box sx={{ fontSize: 64, mb: 2 }}>
          {getFileIcon(file.mimeType)}
        </Box>
        <Typography variant="h6" gutterBottom>
          {file.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Preview not available for this file type
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CloudDownload />}
          onClick={() => onDownload?.(file.id)}
          sx={{ mt: 2 }}
        >
          Download to View
        </Button>
      </Box>
    );
  };

  if (!file) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ fontSize: 24 }}>
              {getFileIcon(file.mimeType)}
            </Box>
            <Box>
              <Typography variant="h6" component="div">
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(file.size)} • {formatDate(file.updatedAt)}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Preview" icon={<Visibility />} />
          <Tab label={`Comments (${comments.length})`} icon={<CommentIcon />} />
          <Tab label={`Versions (${versions.length})`} icon={<History />} />
          <Tab label="Details" icon={<Edit />} />
        </Tabs>

        <Box sx={{ height: 500, overflow: 'auto' }}>
          <TabPanel value={tabValue} index={0}>
            {renderPreview()}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2 }}>
              {/* Add Comment */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={loading}
                />
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || loading}
                    variant="contained"
                    size="small"
                  >
                    Add Comment
                  </Button>
                </Box>
              </Paper>

              {/* Comments List */}
              {comments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No comments yet. Be the first to comment!
                </Typography>
              ) : (
                <List>
                  {comments.map((comment) => (
                    <ListItem key={comment.id} alignItems="flex-start">
                      <Avatar sx={{ mr: 2 }}>
                        {comment.userName.charAt(0).toUpperCase()}
                      </Avatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">
                              {comment.userName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(comment.createdAt)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {comment.comment}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2 }}>
              {versions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No version history available
                </Typography>
              ) : (
                <List>
                  {versions.map((version) => (
                    <ListItem key={version.id}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={`Version ${version.version}`} size="small" />
                            <Typography variant="body2">
                              {formatFileSize(version.size)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(version.createdAt)} by {version.uploadedBy}
                            </Typography>
                            {version.changeDescription && (
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {version.changeDescription}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                File Details
              </Typography>
              
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    File Name
                  </Typography>
                  <Typography variant="body1">{file.name}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    File Type
                  </Typography>
                  <Typography variant="body1">{file.mimeType}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Size
                  </Typography>
                  <Typography variant="body1">{formatFileSize(file.size)}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Category
                  </Typography>
                  <Typography variant="body1">
                    {file.category.charAt(0).toUpperCase() + file.category.slice(1)}
                  </Typography>
                </Box>

                {file.description && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">{file.description}</Typography>
                  </Box>
                )}

                {file.tags.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {file.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}

                <Divider />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{formatDate(file.createdAt)}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body1">{formatDate(file.updatedAt)}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Downloads
                  </Typography>
                  <Typography variant="body1">{file.downloadCount}</Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Version
                  </Typography>
                  <Typography variant="body1">{file.version}</Typography>
                </Box>

                {file.expiresAt && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Expires
                    </Typography>
                    <Typography variant="body1">{formatDate(file.expiresAt)}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onDownload?.(file.id)} startIcon={<Download />}>
          Download
        </Button>
        <Button onClick={() => onShare?.(file.id)} startIcon={<Share />}>
          Share
        </Button>
        <Button onClick={() => onEdit?.(file)} startIcon={<Edit />}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilePreview;