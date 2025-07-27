import { Request, Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node'
import winston from 'winston'
import { promisify } from 'util'
import { performance } from 'perf_hooks'

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'project-invoice-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app: undefined }),
  ]
})

// Performance monitoring middleware
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now()
  
  res.on('finish', () => {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      })
    }
    
    // Log all requests
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      contentLength: res.get('Content-Length'),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    })
  })
  
  next()
}

// Error tracking middleware
export const errorTracking = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error details
  logger.error('Application error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
    headers: req.headers,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  })
  
  // Send to Sentry
  Sentry.captureException(err, {
    tags: {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode
    },
    extra: {
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers
    }
  })
  
  next(err)
}

// User action logging middleware
export const userActionLogging = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || 'anonymous'
    
    logger.info('User action', {
      action,
      userId,
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    })
    
    next()
  }
}

// Google Sheets API monitoring
export const sheetsApiMonitoring = (operation: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now()
    
    try {
      await next()
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      logger.info('Google Sheets API operation', {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        success: true,
        method: req.method,
        url: req.url
      })
      
      // Alert on slow Sheets operations
      if (duration > 5000) {
        logger.warn('Slow Google Sheets operation', {
          operation,
          duration: `${duration.toFixed(2)}ms`,
          method: req.method,
          url: req.url
        })
        
        Sentry.captureMessage('Slow Google Sheets operation', {
          level: 'warning',
          tags: { operation, duration: duration.toString() }
        })
      }
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      logger.error('Google Sheets API error', {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        error: (error as Error).message,
        stack: (error as Error).stack,
        success: false
      })
      
      Sentry.captureException(error, {
        tags: { operation, sheetsApi: true }
      })
      
      throw error
    }
  }
}

// Health check monitoring
export const healthCheck = (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
  
  logger.info('Health check requested', healthData)
  res.json(healthData)
}

// System metrics collection
export const collectMetrics = () => {
  setInterval(() => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoopDelay: performance.now()
    }
    
    logger.info('System metrics', metrics)
    
    // Alert on high memory usage
    if (metrics.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
      logger.warn('High memory usage detected', {
        heapUsed: `${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)}MB`
      })
      
      Sentry.captureMessage('High memory usage', {
        level: 'warning',
        extra: metrics
      })
    }
  }, 60000) // Collect metrics every minute
}

// Audit trail logging
export const auditTrail = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id || 'anonymous'
  const originalSend = res.send
  
  res.send = function(data) {
    // Log successful operations that modify data
    if (res.statusCode >= 200 && res.statusCode < 300 && 
        ['POST', 'PUT', 'DELETE'].includes(req.method)) {
      
      logger.info('Audit trail', {
        userId,
        action: `${req.method} ${req.url}`,
        resource: req.params.id || 'new',
        changes: req.body,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      })
    }
    
    return originalSend.call(this, data)
  }
  
  next()
}

export { logger }