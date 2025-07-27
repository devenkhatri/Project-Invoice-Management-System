import React from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useApp } from '../../contexts/AppContext';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';
import NotificationSystem from './NotificationSystem';
import LoadingOverlay from './LoadingOverlay';
import MobileNavigation from './MobileNavigation';
import { PWAInstallPrompt, NotificationPermission } from '../common/MobileFeatures';

const DRAWER_WIDTH = 240;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { sidebarOpen, setSidebar } = useApp();

  const handleDrawerToggle = () => {
    setSidebar(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 0}px)` },
          ml: { md: sidebarOpen ? `${DRAWER_WIDTH}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Header onMenuClick={handleDrawerToggle} />
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: sidebarOpen ? DRAWER_WIDTH : 0 }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={sidebarOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          <Sidebar onItemClick={() => isMobile && setSidebar(false)} />
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="persistent"
          open={sidebarOpen}
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          <Sidebar />
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 0}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          pb: isMobile ? 8 : 0, // Add padding for mobile navigation
        }}
      >
        <Toolbar />
        
        {/* Breadcrumbs - hide on mobile */}
        {!isMobile && (
          <Box sx={{ px: 3, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Breadcrumbs />
          </Box>
        )}

        {/* Page content */}
        <Box sx={{ p: isMobile ? 2 : 3 }}>
          {children}
        </Box>
      </Box>

      {/* Mobile Navigation */}
      <MobileNavigation />

      {/* Global components */}
      <NotificationSystem />
      <LoadingOverlay />
      <PWAInstallPrompt />
      <NotificationPermission />
    </Box>
  );
};

export default MainLayout;