import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';

// Generic API hook
export function useApi<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = [],
  options: {
    immediate?: boolean;
    showLoading?: boolean;
    showError?: boolean;
  } = {}
) {
  const { immediate = true, showLoading = false, showError = true } = options;
  const { addNotification, setLoading } = useApp();
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLocalLoading(true);
      setError(null);
      
      if (showLoading) {
        setLoading(true);
      }

      const result = await apiCall();
      setData(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      
      if (showError) {
        addNotification({
          type: 'error',
          message: errorMessage,
        });
      }
      
      throw err;
    } finally {
      setLocalLoading(false);
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [apiCall, showLoading, showError, addNotification, setLoading]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return {
    data,
    loading,
    error,
    execute,
    refetch: execute,
  };
}

// Hook for mutations (POST, PUT, DELETE)
export function useMutation<T, P = any>(
  mutationFn: (params: P) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
    showLoading?: boolean;
    showSuccess?: boolean;
    showError?: boolean;
    successMessage?: string;
  } = {}
) {
  const {
    onSuccess,
    onError,
    showLoading = true,
    showSuccess = false,
    showError = true,
    successMessage = 'Operation completed successfully',
  } = options;
  
  const { addNotification, setLoading } = useApp();
  const [loading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (params: P) => {
    try {
      setLocalLoading(true);
      setError(null);
      
      if (showLoading) {
        setLoading(true);
      }

      const result = await mutationFn(params);
      
      if (showSuccess) {
        addNotification({
          type: 'success',
          message: successMessage,
        });
      }
      
      onSuccess?.(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      
      if (showError) {
        addNotification({
          type: 'error',
          message: errorMessage,
        });
      }
      
      onError?.(err);
      throw err;
    } finally {
      setLocalLoading(false);
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [mutationFn, onSuccess, onError, showLoading, showSuccess, showError, successMessage, addNotification, setLoading]);

  return {
    mutate,
    loading,
    error,
  };
}

// Hook for paginated data
export function usePaginatedApi<T>(
  apiCall: (page: number, limit: number, filters?: any) => Promise<{ data: T[]; total: number; page: number; limit: number }>,
  initialFilters: any = {},
  options: {
    initialPage?: number;
    initialLimit?: number;
    showLoading?: boolean;
  } = {}
) {
  const { initialPage = 1, initialLimit = 10, showLoading = false } = options;
  const { addNotification, setLoading } = useApp();
  
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (newPage?: number, newLimit?: number, newFilters?: any) => {
    try {
      setLocalLoading(true);
      setError(null);
      
      if (showLoading) {
        setLoading(true);
      }

      const currentPage = newPage ?? page;
      const currentLimit = newLimit ?? limit;
      const currentFilters = newFilters ?? filters;

      const result = await apiCall(currentPage, currentLimit, currentFilters);
      
      setData(result.data);
      setTotal(result.total);
      setPage(result.page);
      setLimit(result.limit);
      
      if (newFilters !== undefined) {
        setFilters(newFilters);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLocalLoading(false);
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [page, limit, filters, apiCall, showLoading, addNotification, setLoading]);

  useEffect(() => {
    fetchData();
  }, []);

  const changePage = (newPage: number) => {
    fetchData(newPage);
  };

  const changeLimit = (newLimit: number) => {
    fetchData(1, newLimit);
  };

  const changeFilters = (newFilters: any) => {
    fetchData(1, limit, newFilters);
  };

  const refresh = () => {
    fetchData();
  };

  return {
    data,
    total,
    page,
    limit,
    filters,
    loading,
    error,
    changePage,
    changeLimit,
    changeFilters,
    refresh,
  };
}

// Hook for local storage state
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// Hook for debounced values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}