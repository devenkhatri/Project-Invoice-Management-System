import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { performanceOptimizer } from '../utils/performanceOptimization';
import { offlineStorage } from '../utils/offlineStorage';

// Types
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'dashboard' | 'project' | 'invoice' | 'client' | 'time';
  message: string;
  autoHide?: boolean;
  read?: boolean;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  networkType: string;
  pendingSyncCount: number;
}

interface AppState {
  notifications: Notification[];
  isLoading: boolean;
  loadingMessage?: string;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  isMobile: boolean;
  pwa: PWAState;
}

type AppAction =
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_MOBILE'; payload: boolean }
  | { type: 'SET_PWA_INSTALLABLE'; payload: boolean }
  | { type: 'SET_PWA_INSTALLED'; payload: boolean }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'SET_NETWORK_TYPE'; payload: string }
  | { type: 'SET_PENDING_SYNC_COUNT'; payload: number };

interface AppContextType extends AppState {
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationRead: (id: string) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setMobile: (isMobile: boolean) => void;
  setPWAInstallable: (installable: boolean) => void;
  setPWAInstalled: (installed: boolean) => void;
  setOnlineStatus: (online: boolean) => void;
  setNetworkType: (type: string) => void;
  setPendingSyncCount: (count: number) => void;
}

// Initial state
const initialState: AppState = {
  notifications: [],
  isLoading: false,
  sidebarOpen: true,
  theme: 'light',
  isMobile: false,
  pwa: {
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    networkType: 'unknown',
    pendingSyncCount: 0,
  },
};

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      const newNotification: Notification = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        read: false,
      };
      return {
        ...state,
        notifications: [...state.notifications, newNotification],
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
      };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message,
      };
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen,
      };
    case 'SET_SIDEBAR':
      return {
        ...state,
        sidebarOpen: action.payload,
      };
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
      };
    case 'SET_MOBILE':
      return {
        ...state,
        isMobile: action.payload,
      };
    case 'SET_PWA_INSTALLABLE':
      return {
        ...state,
        pwa: { ...state.pwa, isInstallable: action.payload },
      };
    case 'SET_PWA_INSTALLED':
      return {
        ...state,
        pwa: { ...state.pwa, isInstalled: action.payload },
      };
    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        pwa: { ...state.pwa, isOnline: action.payload },
      };
    case 'SET_NETWORK_TYPE':
      return {
        ...state,
        pwa: { ...state.pwa, networkType: action.payload },
      };
    case 'SET_PENDING_SYNC_COUNT':
      return {
        ...state,
        pwa: { ...state.pwa, pendingSyncCount: action.payload },
      };
    default:
      return state;
  }
};

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Update mobile state when breakpoint changes
  useEffect(() => {
    dispatch({ type: 'SET_MOBILE', payload: isMobile });
  }, [isMobile]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor network type
  useEffect(() => {
    const unsubscribe = performanceOptimizer.onNetworkChange((info) => {
      dispatch({ type: 'SET_NETWORK_TYPE', payload: info.effectiveType });
    });

    return unsubscribe;
  }, []);

  // Monitor pending sync count
  useEffect(() => {
    const updateSyncCount = async () => {
      const count = await offlineStorage.getPendingSyncCount();
      dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: count });
    };

    updateSyncCount();
    const interval = setInterval(updateSyncCount, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // PWA installation events
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      dispatch({ type: 'SET_PWA_INSTALLABLE', payload: true });
    };

    const handleAppInstalled = () => {
      dispatch({ type: 'SET_PWA_INSTALLED', payload: true });
      dispatch({ type: 'SET_PWA_INSTALLABLE', payload: false });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    
    // Auto-remove notification after 5 seconds if autoHide is true (default)
    if (notification.autoHide !== false) {
      setTimeout(() => {
        // Find the notification by checking the most recent one with matching properties
        const notifications = state.notifications;
        const recentNotification = notifications[notifications.length - 1];
        if (recentNotification) {
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: recentNotification.id });
        }
      }, 5000);
    }
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  const clearNotifications = () => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  };

  const markNotificationRead = (id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  };

  const setLoading = (isLoading: boolean, message?: string) => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading, message } });
  };

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  const setSidebar = (open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR', payload: open });
  };

  const setTheme = (theme: 'light' | 'dark') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const setMobile = (isMobile: boolean) => {
    dispatch({ type: 'SET_MOBILE', payload: isMobile });
  };

  const setPWAInstallable = (installable: boolean) => {
    dispatch({ type: 'SET_PWA_INSTALLABLE', payload: installable });
  };

  const setPWAInstalled = (installed: boolean) => {
    dispatch({ type: 'SET_PWA_INSTALLED', payload: installed });
  };

  const setOnlineStatus = (online: boolean) => {
    dispatch({ type: 'SET_ONLINE_STATUS', payload: online });
  };

  const setNetworkType = (type: string) => {
    dispatch({ type: 'SET_NETWORK_TYPE', payload: type });
  };

  const setPendingSyncCount = (count: number) => {
    dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: count });
  };

  const value: AppContextType = {
    ...state,
    addNotification,
    removeNotification,
    clearNotifications,
    markNotificationRead,
    setLoading,
    toggleSidebar,
    setSidebar,
    setTheme,
    setMobile,
    setPWAInstallable,
    setPWAInstalled,
    setOnlineStatus,
    setNetworkType,
    setPendingSyncCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Hook to use app context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};