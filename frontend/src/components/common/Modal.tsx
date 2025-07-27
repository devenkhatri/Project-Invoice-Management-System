import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  fullScreen?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  fullScreen = false,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick' && disableBackdropClick) return;
    if (reason === 'escapeKeyDown' && disableEscapeKeyDown) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={Transition}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen || isMobile}
      keepMounted={false}
      aria-labelledby="modal-title"
    >
      {title && (
        <DialogTitle id="modal-title">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
      )}
      
      <DialogContent dividers>
        {children}
      </DialogContent>
      
      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

// Confirmation Dialog Component
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getColor = () => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'primary';
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} color="inherit">
            {cancelText}
          </Button>
          <Button onClick={handleConfirm} color={getColor()} variant="contained">
            {confirmText}
          </Button>
        </>
      }
    >
      <Typography>{message}</Typography>
    </Modal>
  );
};

export default Modal;