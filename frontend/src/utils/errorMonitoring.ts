import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

// Initialize Sentry for frontend error tracking
export const initializeErrorMonitoring = () => {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
    ],
    tracesSampleRate: 1.0,
    beforeSend(event, hint) {
      // Filter out non-critical errors
      if (event.exception) {
        const error = hint.originalException
        if (error instanceof Error) {
          // Don't send network errors that are likely user connectivity issues
          if (error.message.includes('Network Error') || 
              error.message.includes('fetch')) {
            return null
          }
          
          // Don't send cancelled requests
          if (error.message.includes('cancelled') || 
              error.message.includes('aborted')) {
            return null
          }
        }
      }
      
      return event
    }
  })
}

// Custom error boundary component
export const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>
  },
  {
    fallback: ({ error, resetError }) => (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>{error?.message}</p>
        <button onClick={resetError}>Try again</button>
      </div>
    ),
    beforeCapture: (scope, error, errorInfo) => {
      scope.setTag('errorBoundary', true)
      scope.setContext('errorInfo', errorInfo)
    }
  }
)

// Performance monitoring
export const trackPerformance = (name: string, fn: () => Promise<any>) => {
  return Sentry.startTransaction({ name }, async (transaction) => {
    try {
      const result = await fn()
      transaction.setStatus('ok')
      return result
    } catch (error) {
      transaction.setStatus('internal_error')
      Sentry.captureException(error)
      throw error
    } finally {
      transaction.finish()
    }
  })
}

// User action tracking
export const trackUserAction = (action: string, data?: any) => {
  Sentry.addBreadcrumb({
    message: action,
    category: 'user-action',
    data,
    level: 'info'
  })
}

// API error tracking
export const trackApiError = (error: any, endpoint: string, method: string) => {
  Sentry.captureException(error, {
    tags: {
      api: true,
      endpoint,
      method
    },
    extra: {
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    }
  })
}

// Custom hook for error reporting
export const useErrorReporting = () => {
  const reportError = (error: Error, context?: any) => {
    Sentry.captureException(error, {
      extra: context
    })
  }
  
  const reportMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    Sentry.captureMessage(message, level)
  }
  
  return { reportError, reportMessage }
}

// Web Vitals monitoring
export const trackWebVitals = () => {
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS((metric) => {
      Sentry.addBreadcrumb({
        message: 'Web Vital: CLS',
        data: metric,
        level: 'info'
      })
    })
    
    getFID((metric) => {
      Sentry.addBreadcrumb({
        message: 'Web Vital: FID',
        data: metric,
        level: 'info'
      })
    })
    
    getFCP((metric) => {
      Sentry.addBreadcrumb({
        message: 'Web Vital: FCP',
        data: metric,
        level: 'info'
      })
    })
    
    getLCP((metric) => {
      Sentry.addBreadcrumb({
        message: 'Web Vital: LCP',
        data: metric,
        level: 'info'
      })
    })
    
    getTTFB((metric) => {
      Sentry.addBreadcrumb({
        message: 'Web Vital: TTFB',
        data: metric,
        level: 'info'
      })
    })
  })
}

// Local error logging for development
export const logError = (error: Error, context?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 Error Details')
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
    if (context) {
      console.error('Context:', context)
    }
    console.groupEnd()
  }
}

// Network error handling
export const handleNetworkError = (error: any) => {
  if (error.code === 'NETWORK_ERROR') {
    // Handle offline scenario
    if (!navigator.onLine) {
      return {
        message: 'You appear to be offline. Please check your connection.',
        type: 'offline'
      }
    }
    
    return {
      message: 'Network error occurred. Please try again.',
      type: 'network'
    }
  }
  
  if (error.response?.status >= 500) {
    return {
      message: 'Server error occurred. Please try again later.',
      type: 'server'
    }
  }
  
  if (error.response?.status === 401) {
    return {
      message: 'Your session has expired. Please log in again.',
      type: 'auth'
    }
  }
  
  return {
    message: error.message || 'An unexpected error occurred.',
    type: 'unknown'
  }
}