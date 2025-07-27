import React from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Slide,
  SlideProps,
} from '@mui/material';
import { useApp } from '../../contexts/AppContext';

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useApp();

  const handleClose = (id: string) => {
    removeNotification(id);
  };

  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.autoHide !== false ? 6000 : null}
          onClose={() => handleClose(notification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            mb: index * 7, // Stack notifications
          }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default NotificationSystem;