import React, { useState } from 'react';
import {
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Notifications,
  Settings,
  Logout,
  DarkMode,
  LightMode,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme, notifications } = useApp();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const unreadNotifications = notifications.filter(n => n.type === 'info').length;

  return (
    <Toolbar>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={onMenuClick}
        sx={{ mr: 2 }}
      >
        <MenuIcon />
      </IconButton>

      <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
        Project Invoice Management
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Theme toggle */}
        <Tooltip title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          <IconButton color="inherit" onClick={toggleTheme}>
            {theme === 'light' ? <DarkMode /> : <LightMode />}
          </IconButton>
        </Tooltip>

        {/* Notifications */}
        <Tooltip title="Notifications">
          <IconButton color="inherit">
            <Badge badgeContent={unreadNotifications} color="error">
              <Notifications />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton color="inherit">
            <Settings />
          </IconButton>
        </Tooltip>

        {/* Profile menu */}
        <Tooltip title="Account">
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.charAt(0).toUpperCase() || <AccountCircle />}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Box>

      {/* Profile menu */}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem disabled>
          <Box>
            <Typography variant="subtitle2">{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleProfileMenuClose}>
          <AccountCircle sx={{ mr: 1 }} />
          Profile
        </MenuItem>
        <MenuItem onClick={handleProfileMenuClose}>
          <Settings sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Toolbar>
  );
};

export default Header;