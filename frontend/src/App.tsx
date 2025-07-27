import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Typography } from '@mui/material';

// Context Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';

// Components
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

// PWA utilities
import { register as registerSW } from './utils/serviceWorker';
import { offlineStorage } from './utils/offlineStorage';

// Create Material-UI theme with mobile optimizations
const createAppTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Mobile-optimized typography
    h1: {
      fontSize: '2rem',
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
      },
    },
    h2: {
      fontSize: '1.75rem',
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.5rem',
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.25rem',
      '@media (max-width:600px)': {
        fontSize: '1.125rem',
      },
    },
    body1: {
      fontSize: '1rem',
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 44, // Touch-friendly minimum height
          '@media (max-width:600px)': {
            minHeight: 48, // Larger on mobile
            fontSize: '0.875rem',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            padding: 12, // Larger touch target
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            '@media (max-width:600px)': {
              fontSize: '16px', // Prevent zoom on iOS
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            margin: '8px 0',
            borderRadius: 8,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          '@media (max-width:600px)': {
            margin: 16,
            width: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 32px)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            padding: '8px 4px',
            fontSize: '0.75rem',
          },
        },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

// Placeholder components for routing
const Dashboard = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Dashboard
    </Typography>
    <Typography variant="body1">
      Welcome to Project Invoice Management System
    </Typography>
  </Container>
);

const Projects = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Projects
    </Typography>
    <Typography variant="body1">
      Project management interface coming soon...
    </Typography>
  </Container>
);

const Tasks = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Tasks
    </Typography>
    <Typography variant="body1">
      Task management interface coming soon...
    </Typography>
  </Container>
);

const TimeTracking = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Time Tracking
    </Typography>
    <Typography variant="body1">
      Time tracking interface coming soon...
    </Typography>
  </Container>
);

const Invoices = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Invoices
    </Typography>
    <Typography variant="body1">
      Invoice management interface coming soon...
    </Typography>
  </Container>
);

const Payments = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Payments
    </Typography>
    <Typography variant="body1">
      Payment management interface coming soon...
    </Typography>
  </Container>
);

const Clients = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Clients
    </Typography>
    <Typography variant="body1">
      Client management interface coming soon...
    </Typography>
  </Container>
);

const Expenses = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Expenses
    </Typography>
    <Typography variant="body1">
      Expense management interface coming soon...
    </Typography>
  </Container>
);

const FinancialReports = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Financial Reports
    </Typography>
    <Typography variant="body1">
      Financial reports interface coming soon...
    </Typography>
  </Container>
);

const ProjectReports = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Project Reports
    </Typography>
    <Typography variant="body1">
      Project reports interface coming soon...
    </Typography>
  </Container>
);

const Settings = () => (
  <Container maxWidth="lg">
    <Typography variant="h4" component="h1" gutterBottom>
      Settings
    </Typography>
    <Typography variant="body1">
      Settings interface coming soon...
    </Typography>
  </Container>
);

// Main App Component
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useApp();

  if (isLoading) {
    return null; // Loading is handled by ProtectedRoute
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/time-tracking" element={<TimeTracking />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports/financial" element={<FinancialReports />} />
        <Route path="/reports/projects" element={<ProjectReports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
};

function App() {
  useEffect(() => {
    // Register service worker for PWA functionality
    registerSW({
      onSuccess: (registration) => {
        console.log('SW registered: ', registration);
      },
      onUpdate: (registration) => {
        console.log('SW updated: ', registration);
        // You could show a notification to the user here
      },
    });

    // Initialize offline storage
    offlineStorage.isOnline().then(online => {
      if (online) {
        // Sync any pending offline data
        // This would be implemented with your API client
        console.log('Online - ready to sync');
      }
    });
  }, []);

  return (
    <AppProvider>
      <AuthProvider>
        <AppThemeProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <CssBaseline />
            <Router>
              <AppContent />
            </Router>
          </LocalizationProvider>
        </AppThemeProvider>
      </AuthProvider>
    </AppProvider>
  );
}

// Theme Provider Component
const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useApp();
  const muiTheme = createAppTheme(theme);

  return (
    <ThemeProvider theme={muiTheme}>
      {children}
    </ThemeProvider>
  );
};

export default App;