import { createTheme, Theme, ThemeOptions } from '@mui/material/styles';
import { BreakpointsOptions } from '@mui/material/styles/createBreakpoints';

// Enhanced breakpoints for better mobile support
const breakpoints: BreakpointsOptions = {
  values: {
    xs: 0,      // Phone
    sm: 600,    // Tablet portrait
    md: 900,    // Tablet landscape / Small desktop
    lg: 1200,   // Desktop
    xl: 1536,   // Large desktop
  },
};

// Mobile-first responsive typography
const createResponsiveTypography = () => ({
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: {
    fontSize: '2.5rem',
    fontWeight: 300,
    lineHeight: 1.2,
    '@media (max-width:600px)': {
      fontSize: '2rem',
      fontWeight: 400,
    },
    '@media (max-width:480px)': {
      fontSize: '1.75rem',
    },
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 300,
    lineHeight: 1.3,
    '@media (max-width:600px)': {
      fontSize: '1.75rem',
      fontWeight: 400,
    },
    '@media (max-width:480px)': {
      fontSize: '1.5rem',
    },
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 400,
    lineHeight: 1.4,
    '@media (max-width:600px)': {
      fontSize: '1.5rem',
    },
    '@media (max-width:480px)': {
      fontSize: '1.25rem',
    },
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 400,
    lineHeight: 1.4,
    '@media (max-width:600px)': {
      fontSize: '1.25rem',
    },
    '@media (max-width:480px)': {
      fontSize: '1.125rem',
    },
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 400,
    lineHeight: 1.5,
    '@media (max-width:600px)': {
      fontSize: '1.125rem',
    },
    '@media (max-width:480px)': {
      fontSize: '1rem',
    },
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 500,
    lineHeight: 1.5,
    '@media (max-width:600px)': {
      fontSize: '1rem',
    },
    '@media (max-width:480px)': {
      fontSize: '0.875rem',
    },
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
    '@media (max-width:600px)': {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    '@media (max-width:600px)': {
      fontSize: '0.8125rem',
    },
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    textTransform: 'none' as const,
    '@media (max-width:600px)': {
      fontSize: '0.8125rem',
    },
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    '@media (max-width:600px)': {
      fontSize: '0.6875rem',
    },
  },
});

// Mobile-optimized component overrides
const createMobileComponents = (theme: Theme) => ({
  MuiButton: {
    styleOverrides: {
      root: {
        minHeight: 44, // Touch-friendly minimum height
        borderRadius: 8,
        padding: '8px 16px',
        '@media (max-width:600px)': {
          minHeight: 48, // Larger on mobile for better touch targets
          fontSize: '0.875rem',
          padding: '12px 20px',
        },
        '@media (max-width:480px)': {
          minHeight: 52,
          padding: '14px 24px',
        },
      },
      small: {
        minHeight: 36,
        padding: '6px 12px',
        '@media (max-width:600px)': {
          minHeight: 40,
          padding: '8px 16px',
        },
      },
      large: {
        minHeight: 52,
        padding: '12px 24px',
        '@media (max-width:600px)': {
          minHeight: 56,
          padding: '16px 32px',
        },
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        padding: 8,
        '@media (max-width:600px)': {
          padding: 12, // Larger touch target
        },
        '@media (max-width:480px)': {
          padding: 16,
        },
      },
      sizeSmall: {
        padding: 4,
        '@media (max-width:600px)': {
          padding: 8,
        },
      },
      sizeLarge: {
        padding: 12,
        '@media (max-width:600px)': {
          padding: 16,
        },
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiInputBase-root': {
          minHeight: 44,
          '@media (max-width:600px)': {
            minHeight: 48,
            fontSize: '16px', // Prevent zoom on iOS
          },
        },
        '& .MuiInputLabel-root': {
          '@media (max-width:600px)': {
            fontSize: '16px',
          },
        },
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
          '@media (max-width:600px)': {
            borderRadius: 12,
          },
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        '@media (max-width:600px)': {
          margin: '8px 0',
          borderRadius: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        },
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: 16,
        '@media (max-width:600px)': {
          padding: 12,
        },
        '&:last-child': {
          paddingBottom: 16,
          '@media (max-width:600px)': {
            paddingBottom: 12,
          },
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12,
        '@media (max-width:600px)': {
          margin: 16,
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100% - 32px)',
          borderRadius: 16,
        },
        '@media (max-width:480px)': {
          margin: 8,
          width: 'calc(100% - 16px)',
          maxHeight: 'calc(100% - 16px)',
        },
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        padding: '20px 24px 16px',
        '@media (max-width:600px)': {
          padding: '16px 20px 12px',
          fontSize: '1.25rem',
        },
      },
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: {
        padding: '0 24px',
        '@media (max-width:600px)': {
          padding: '0 20px',
        },
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: '16px 24px 20px',
        '@media (max-width:600px)': {
          padding: '12px 20px 16px',
          flexDirection: 'column-reverse' as const,
          gap: 8,
          '& > :not(:first-of-type)': {
            marginLeft: 0,
          },
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        padding: '12px 16px',
        '@media (max-width:600px)': {
          padding: '8px 4px',
          fontSize: '0.75rem',
        },
      },
      head: {
        fontWeight: 600,
        '@media (max-width:600px)': {
          fontSize: '0.75rem',
          fontWeight: 700,
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        height: 28,
        borderRadius: 14,
        '@media (max-width:600px)': {
          height: 24,
          borderRadius: 12,
          fontSize: '0.75rem',
        },
      },
      sizeSmall: {
        height: 24,
        '@media (max-width:600px)': {
          height: 20,
          fontSize: '0.6875rem',
        },
      },
    },
  },
  MuiFab: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          width: 48,
          height: 48,
        },
      },
      small: {
        '@media (max-width:600px)': {
          width: 40,
          height: 40,
        },
      },
      large: {
        '@media (max-width:600px)': {
          width: 56,
          height: 56,
        },
      },
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: {
        height: 64,
        '@media (max-width:600px)': {
          height: 72,
        },
      },
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: {
        minWidth: 'auto',
        padding: '6px 12px 8px',
        '@media (max-width:600px)': {
          padding: '8px 12px 10px',
        },
        '&.Mui-selected': {
          paddingTop: 6,
          '@media (max-width:600px)': {
            paddingTop: 8,
          },
        },
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          '& .MuiToolbar-root': {
            minHeight: 56,
            paddingLeft: 16,
            paddingRight: 16,
          },
        },
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        '@media (max-width:600px)': {
          width: '85%',
          maxWidth: 320,
        },
      },
    },
  },
  MuiList: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          padding: '8px 0',
        },
      },
    },
  },
  MuiListItem: {
    styleOverrides: {
      root: {
        minHeight: 48,
        '@media (max-width:600px)': {
          minHeight: 52,
          paddingLeft: 16,
          paddingRight: 16,
        },
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        minHeight: 48,
        borderRadius: 8,
        margin: '2px 8px',
        '@media (max-width:600px)': {
          minHeight: 52,
          borderRadius: 12,
          margin: '4px 12px',
        },
      },
    },
  },
  MuiSnackbar: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          left: 16,
          right: 16,
          bottom: 88, // Above bottom navigation
        },
      },
    },
  },
});

// Create mobile-optimized theme
export const createMobileTheme = (mode: 'light' | 'dark' = 'light'): Theme => {
  const baseTheme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff5983',
        dark: '#9a0036',
      },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
      text: {
        primary: mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'rgba(255, 255, 255, 0.87)',
        secondary: mode === 'light' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
      },
    },
    breakpoints,
    typography: createResponsiveTypography(),
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
  });

  return createTheme(baseTheme, {
    components: createMobileComponents(baseTheme),
  });
};

// Responsive utilities
export const useResponsiveValue = <T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
}) => {
  const theme = createMobileTheme();
  
  // This would typically use useMediaQuery, but for utility purposes
  // we'll return a function that can be used with theme breakpoints
  return (currentBreakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): T | undefined => {
    const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    
    // Find the closest defined value at or below current breakpoint
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i] as keyof typeof values;
      if (values[bp] !== undefined) {
        return values[bp];
      }
    }
    
    return undefined;
  };
};

// Touch-friendly spacing utilities
export const touchSpacing = {
  minTouchTarget: 44, // Minimum touch target size
  mobileTouchTarget: 48, // Recommended mobile touch target
  padding: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  margin: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
};

// Mobile-specific CSS-in-JS utilities
export const mobileStyles = {
  // Prevent text selection on touch
  noSelect: {
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    MozUserSelect: 'none' as const,
    msUserSelect: 'none' as const,
  },
  
  // Touch-friendly scrolling
  touchScroll: {
    WebkitOverflowScrolling: 'touch' as const,
    overflowScrolling: 'touch' as const,
  },
  
  // Prevent zoom on input focus (iOS)
  preventZoom: {
    fontSize: '16px !important',
  },
  
  // Safe area insets for devices with notches
  safeArea: {
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
  
  // Full height with safe areas
  fullHeightSafe: {
    height: '100vh',
    height: '100dvh', // Dynamic viewport height
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
};

export default createMobileTheme;