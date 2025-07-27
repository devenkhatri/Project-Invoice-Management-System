import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Drawer,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Collapse,
  IconButton,
  Paper,
  SwipeableDrawer,
  Backdrop,
} from '@mui/material';
import {
  Add as AddIcon,
  Work as ProjectIcon,
  Receipt as InvoiceIcon,
  Timer as TimerIcon,
  People as ClientIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useScreenOrientation, TouchGestureHandler } from '../common/MobileFeatures';
import { mobileStyles } from '../../utils/mobileTheme';

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  quickActions?: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }>;
  enableSwipeGestures?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({
  children,
  sidebar,
  bottomNavigation,
  quickActions = [],
  enableSwipeGestures = true,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const orientation = useScreenOrientation();
  
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);

  // Auto-collapse sidebar in landscape mode on tablets
  useEffect(() => {
    if (isTablet && orientation === 'landscape') {
      setCollapsedSidebar(true);
    } else {
      setCollapsedSidebar(false);
    }
  }, [isTablet, orientation]);

  // Handle swipe gestures
  const handleSwipeLeft = useCallback(() => {
    if (!enableSwipeGestures || !isSwipeEnabled) return;
    
    if (onSwipeLeft) {
      onSwipeLeft();
    } else if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [enableSwipeGestures, isSwipeEnabled, onSwipeLeft, isMobile, sidebarOpen]);

  const handleSwipeRight = useCallback(() => {
    if (!enableSwipeGestures || !isSwipeEnabled) return;
    
    if (onSwipeRight) {
      onSwipeRight();
    } else if (isMobile && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [enableSwipeGestures, isSwipeEnabled, onSwipeRight, isMobile, sidebarOpen]);

  const sidebarWidth = collapsedSidebar ? 64 : 240;

  const defaultQuickActions = [
    {
      icon: <ProjectIcon />,
      label: 'New Project',
      onClick: () => console.log('New Project'),
    },
    {
      icon: <InvoiceIcon />,
      label: 'New Invoice',
      onClick: () => console.log('New Invoice'),
    },
    {
      icon: <TimerIcon />,
      label: 'Start Timer',
      onClick: () => console.log('Start Timer'),
    },
    {
      icon: <ClientIcon />,
      label: 'Add Client',
      onClick: () => console.log('Add Client'),
    },
  ];

  const actions = quickActions.length > 0 ? quickActions : defaultQuickActions;

  const renderSidebar = () => {
    if (!sidebar) return null;

    const sidebarContent = (
      <Box
        sx={{
          width: sidebarWidth,
          height: '100%',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflow: 'hidden',
          ...mobileStyles.safeArea,
        }}
      >
        {/* Collapse toggle for tablet */}
        {isTablet && (
          <Box sx={{ p: 1, textAlign: 'right' }}>
            <IconButton
              onClick={() => setCollapsedSidebar(!collapsedSidebar)}
              size="small"
            >
              {collapsedSidebar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
        )}
        {sidebar}
      </Box>
    );

    if (isMobile) {
      return (
        <SwipeableDrawer
          variant="temporary"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
          disableSwipeToOpen={!enableSwipeGestures}
          swipeAreaWidth={20}
          sx={{
            '& .MuiDrawer-paper': {
              width: '85%',
              maxWidth: 320,
              boxSizing: 'border-box',
              ...mobileStyles.touchScroll,
            },
          }}
        >
          {sidebarContent}
        </SwipeableDrawer>
      );
    }

    return (
      <Drawer
        variant="persistent"
        open={sidebarOpen}
        sx={{
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            boxSizing: 'border-box',
            position: 'relative',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  };

  const renderQuickActions = () => {
    if (isMobile) {
      return (
        <SpeedDial
          ariaLabel="Quick Actions"
          sx={{
            position: 'fixed',
            bottom: bottomNavigation ? 80 : 16,
            right: 16,
            zIndex: theme.zIndex.speedDial,
          }}
          icon={<SpeedDialIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
        >
          {actions.map((action, index) => (
            <SpeedDialAction
              key={index}
              icon={action.icon}
              tooltipTitle={action.label}
              onClick={() => {
                action.onClick();
                setSpeedDialOpen(false);
              }}
            />
          ))}
        </SpeedDial>
      );
    }

    return (
      <Paper
        sx={{
          position: 'fixed',
          top: '50%',
          right: 16,
          transform: 'translateY(-50%)',
          zIndex: theme.zIndex.fab,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1,
        }}
      >
        {actions.map((action, index) => (
          <Fab
            key={index}
            size="small"
            color="primary"
            onClick={action.onClick}
            title={action.label}
          >
            {action.icon}
          </Fab>
        ))}
      </Paper>
    );
  };

  const mainContent = (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        width: {
          xs: '100%',
          md: sidebarOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
        },
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        overflow: 'auto',
        pb: isMobile && bottomNavigation ? 10 : 0,
        position: 'relative',
        ...mobileStyles.touchScroll,
        ...mobileStyles.fullHeightSafe,
      }}
    >
      {/* Content with responsive padding */}
      <Box
        sx={{
          p: {
            xs: 1,
            sm: 2,
            md: 3,
          },
          minHeight: '100%',
          paddingBottom: isMobile && bottomNavigation ? 'calc(72px + env(safe-area-inset-bottom))' : undefined,
        }}
      >
        {children}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', ...mobileStyles.fullHeightSafe }}>
      {/* Sidebar */}
      {renderSidebar()}

      {/* Main content with gesture support */}
      {enableSwipeGestures && isMobile ? (
        <TouchGestureHandler
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          threshold={50}
        >
          {mainContent}
        </TouchGestureHandler>
      ) : (
        mainContent
      )}

      {/* Bottom Navigation */}
      {isMobile && bottomNavigation && bottomNavigation}

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Backdrop for mobile sidebar */}
      <Backdrop
        open={isMobile && sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        sx={{
          zIndex: theme.zIndex.drawer - 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      />
    </Box>
  );
};

export default AdaptiveLayout;