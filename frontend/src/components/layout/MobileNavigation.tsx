import React, { useState, useEffect } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
  useMediaQuery,
  Badge,
  Box,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Slide,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Work as ProjectsIcon,
  Receipt as InvoicesIcon,
  People as ClientsIcon,
  Timer as TimeIcon,
  Add as AddIcon,
  Close as CloseIcon,
  PlayArrow as StartIcon,
  Description as NewProjectIcon,
  PersonAdd as NewClientIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useHapticFeedback } from '../common/MobileFeatures';
import { mobileStyles } from '../../utils/mobileTheme';

interface MobileNavigationProps {
  onQuickAction?: (action: string) => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onQuickAction }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications } = useApp();
  const { lightTap, mediumTap } = useHapticFeedback();
  
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-hide navigation on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  if (!isMobile) {
    return null;
  }

  const getCurrentValue = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 0;
    if (path.startsWith('/projects')) return 1;
    if (path.startsWith('/invoices')) return 2;
    if (path.startsWith('/clients')) return 3;
    if (path.startsWith('/time-tracking')) return 4;
    return 0;
  };

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    lightTap(); // Haptic feedback
    
    const routes = [
      '/dashboard',
      '/projects',
      '/invoices',
      '/clients',
      '/time-tracking',
    ];
    navigate(routes[newValue]);
  };

  const getNotificationCount = (type: string) => {
    return notifications?.filter(n => n.type === type && !n.read).length || 0;
  };

  const quickActions = [
    {
      icon: <NewProjectIcon />,
      name: 'New Project',
      action: 'new-project',
    },
    {
      icon: <InvoicesIcon />,
      name: 'New Invoice',
      action: 'new-invoice',
    },
    {
      icon: <StartIcon />,
      name: 'Start Timer',
      action: 'start-timer',
    },
    {
      icon: <NewClientIcon />,
      name: 'Add Client',
      action: 'new-client',
    },
  ];

  const handleQuickAction = (action: string) => {
    mediumTap(); // Stronger haptic feedback for actions
    setSpeedDialOpen(false);
    
    if (onQuickAction) {
      onQuickAction(action);
    } else {
      // Default actions
      switch (action) {
        case 'new-project':
          navigate('/projects?action=new');
          break;
        case 'new-invoice':
          navigate('/invoices?action=new');
          break;
        case 'start-timer':
          navigate('/time-tracking?action=start');
          break;
        case 'new-client':
          navigate('/clients?action=new');
          break;
      }
    }
  };

  return (
    <>
      <Slide direction="up" in={isVisible} mountOnEnter unmountOnExit>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            borderTop: 1,
            borderColor: 'divider',
            ...mobileStyles.safeArea,
          }}
          elevation={8}
        >
          <BottomNavigation
            value={getCurrentValue()}
            onChange={handleChange}
            showLabels
            sx={{
              height: 72,
              paddingBottom: 'env(safe-area-inset-bottom)',
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '8px 12px 10px',
                '&.Mui-selected': {
                  paddingTop: 8,
                },
              },
            }}
          >
            <BottomNavigationAction
              label="Dashboard"
              icon={
                <Badge badgeContent={getNotificationCount('dashboard')} color="error">
                  <DashboardIcon />
                </Badge>
              }
            />
            <BottomNavigationAction
              label="Projects"
              icon={
                <Badge badgeContent={getNotificationCount('project')} color="error">
                  <ProjectsIcon />
                </Badge>
              }
            />
            <BottomNavigationAction
              label="Invoices"
              icon={
                <Badge badgeContent={getNotificationCount('invoice')} color="error">
                  <InvoicesIcon />
                </Badge>
              }
            />
            <BottomNavigationAction
              label="Clients"
              icon={
                <Badge badgeContent={getNotificationCount('client')} color="error">
                  <ClientsIcon />
                </Badge>
              }
            />
            <BottomNavigationAction
              label="Time"
              icon={
                <Badge badgeContent={getNotificationCount('time')} color="error">
                  <TimeIcon />
                </Badge>
              }
            />
          </BottomNavigation>
        </Paper>
      </Slide>

      {/* Quick Actions Speed Dial */}
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{
          position: 'fixed',
          bottom: 88, // Above bottom navigation
          right: 16,
          zIndex: theme.zIndex.speedDial,
          '& .MuiSpeedDial-fab': {
            width: 56,
            height: 56,
          },
        }}
        icon={<SpeedDialIcon icon={<AddIcon />} openIcon={<CloseIcon />} />}
        open={speedDialOpen}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        direction="up"
      >
        {quickActions.map((action) => (
          <SpeedDialAction
            key={action.action}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleQuickAction(action.action)}
            sx={{
              '& .MuiSpeedDialAction-fab': {
                width: 48,
                height: 48,
              },
            }}
          />
        ))}
      </SpeedDial>
    </>
  );
};

export default MobileNavigation;