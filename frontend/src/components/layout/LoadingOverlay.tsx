import React from 'react';
import {
  Backdrop,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import { useApp } from '../../contexts/AppContext';

const LoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage } = useApp();

  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
      open={isLoading}
    >
      <CircularProgress color="inherit" size={60} />
      {loadingMessage && (
        <Box textAlign="center">
          <Typography variant="h6" gutterBottom>
            {loadingMessage}
          </Typography>
          <Typography variant="body2" color="inherit" opacity={0.8}>
            Please wait...
          </Typography>
        </Box>
      )}
    </Backdrop>
  );
};

export default LoadingOverlay;