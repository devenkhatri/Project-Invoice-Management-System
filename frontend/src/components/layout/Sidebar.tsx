import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Collapse,
} from '@mui/material';
import {
  Dashboard,
  Work,
  People,
  Receipt,
  AccessTime,
  AttachMoney,
  Assessment,
  Settings,
  ExpandLess,
  ExpandMore,
  Task,
  Payment,
  TrendingUp,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Dashboard />,
    path: '/dashboard',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: <Work />,
    children: [
      {
        id: 'projects-list',
        label: 'All Projects',
        icon: <Work />,
        path: '/projects',
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: <Task />,
        path: '/tasks',
      },
      {
        id: 'time-tracking',
        label: 'Time Tracking',
        icon: <AccessTime />,
        path: '/time-tracking',
      },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: <People />,
    path: '/clients',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: <Receipt />,
    children: [
      {
        id: 'invoices-list',
        label: 'All Invoices',
        icon: <Receipt />,
        path: '/invoices',
      },
      {
        id: 'payments',
        label: 'Payments',
        icon: <Payment />,
        path: '/payments',
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: <AttachMoney />,
    path: '/expenses',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <Assessment />,
    children: [
      {
        id: 'financial-reports',
        label: 'Financial Reports',
        icon: <TrendingUp />,
        path: '/reports/financial',
      },
      {
        id: 'project-reports',
        label: 'Project Reports',
        icon: <Assessment />,
        path: '/reports/projects',
      },
    ],
  },
];

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openItems, setOpenItems] = useState<string[]>(['projects', 'invoices', 'reports']);

  const handleItemClick = (item: MenuItem) => {
    if (item.path) {
      navigate(item.path);
      onItemClick?.();
    } else if (item.children) {
      toggleItem(item.id);
    }
  };

  const toggleItem = (itemId: string) => {
    setOpenItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openItems.includes(item.id);
    const active = item.path ? isActive(item.path) : false;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleItemClick(item)}
            selected={active}
            sx={{
              pl: 2 + level * 2,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: active ? 'inherit' : 'text.secondary',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: level > 0 ? '0.875rem' : '1rem',
                fontWeight: active ? 600 : 400,
              }}
            />
            {hasChildren && (
              isOpen ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" component="div" fontWeight="bold">
          PIM
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Project Invoice Management
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List>
          {menuItems.map(item => renderMenuItem(item))}
        </List>
      </Box>

      <Divider />

      {/* Settings */}
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigate('/settings')}>
            <ListItemIcon>
              <Settings />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};

export default Sidebar;