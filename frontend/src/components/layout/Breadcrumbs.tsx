import React from 'react';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  Box,
} from '@mui/material';
import { NavigateNext, Home } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

const routeMap: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  clients: 'Clients',
  invoices: 'Invoices',
  tasks: 'Tasks',
  'time-tracking': 'Time Tracking',
  payments: 'Payments',
  expenses: 'Expenses',
  reports: 'Reports',
  financial: 'Financial Reports',
  settings: 'Settings',
};

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with home/dashboard
    breadcrumbs.push({
      label: 'Dashboard',
      path: '/dashboard',
      icon: <Home sx={{ mr: 0.5, fontSize: 16 }} />,
    });

    // Build breadcrumbs from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip dashboard since it's already added
      if (segment === 'dashboard') return;

      const label = routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      
      // Don't add path for the last segment (current page)
      const isLast = index === pathSegments.length - 1;
      
      breadcrumbs.push({
        label,
        path: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  const handleBreadcrumbClick = (path: string) => {
    navigate(path);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <MuiBreadcrumbs
        separator={<NavigateNext fontSize="small" />}
        aria-label="breadcrumb"
      >
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          if (isLast || !breadcrumb.path) {
            return (
              <Typography
                key={breadcrumb.label}
                color="text.primary"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {breadcrumb.icon}
                {breadcrumb.label}
              </Typography>
            );
          }

          return (
            <Link
              key={breadcrumb.label}
              color="inherit"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleBreadcrumbClick(breadcrumb.path!);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              {breadcrumb.icon}
              {breadcrumb.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;