import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error log entry interface
export interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  requestInfo?: {
    method: string;
    url: string;
    params: Record<string, any>;
    query: Record<string, any>;
    body?: Record<string, any>;
    headers?: Record<string, any>;
  };
}

// Error monitoring service
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private logDir: string;
  private logFile: string;
  private errorCallbacks: Array<(error: ErrorLogEntry) => void> = [];
  
  private constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `error-log-${new Date().toISOString().split('T')[0]}.json`);
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  public static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }
  
  // Log an error
  public logError(
    error: Error | string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>,
    userId?: string,
    requestInfo?: ErrorLogEntry['requestInfo']
  ): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;
    
    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      message: errorMessage,
      stack: errorStack,
      context,
      userId,
      requestInfo
    };
    
    // Write to log file
    this.writeToLogFile(logEntry);
    
    // Execute registered callbacks
    this.notifyCallbacks(logEntry);
    
    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${severity.toUpperCase()}] ${errorMessage}`);
      if (errorStack) {
        console.error(errorStack);
      }
    }
    
    // Alert for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.sendCriticalErrorAlert(logEntry);
    }
  }
  
  // Register a callback for error notifications
  public onError(callback: (error: ErrorLogEntry) => void): void {
    this.errorCallbacks.push(callback);
  }
  
  // Express middleware for error handling
  public errorHandler() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      // Determine error severity based on status code
      let severity = ErrorSeverity.MEDIUM;
      const statusCode = (err as any).statusCode || 500;
      
      if (statusCode >= 500) {
        severity = ErrorSeverity.HIGH;
      }
      
      // Log the error
      this.logError(
        err,
        severity,
        { statusCode },
        (req as any).user?.id,
        {
          method: req.method,
          url: req.url,
          params: req.params,
          query: req.query,
          body: req.method !== 'GET' ? req.body : undefined,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'accept': req.headers['accept']
          }
        }
      );
      
      // Send response to client
      res.status(statusCode).json({
        error: {
          message: process.env.NODE_ENV === 'production' 
            ? 'An error occurred while processing your request.' 
            : err.message,
          code: (err as any).code || 'INTERNAL_ERROR'
        }
      });
    };
  }
  
  // Request logging middleware
  public requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      // Add response time header
      res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}`);
        
        // Log slow requests (over 1 second)
        if (duration > 1000) {
          this.logError(
            `Slow request: ${req.method} ${req.url} took ${duration}ms`,
            ErrorSeverity.LOW,
            { duration },
            (req as any).user?.id,
            {
              method: req.method,
              url: req.url,
              params: req.params,
              query: req.query
            }
          );
        }
      });
      
      next();
    };
  }
  
  // Private methods
  private writeToLogFile(logEntry: ErrorLogEntry): void {
    try {
      let logs: ErrorLogEntry[] = [];
      
      // Read existing logs if file exists
      if (fs.existsSync(this.logFile)) {
        const fileContent = fs.readFileSync(this.logFile, 'utf8');
        logs = JSON.parse(fileContent);
      }
      
      // Add new log entry
      logs.push(logEntry);
      
      // Write back to file
      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to write to error log file:', error);
    }
  }
  
  private notifyCallbacks(logEntry: ErrorLogEntry): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(logEntry);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }
  
  private sendCriticalErrorAlert(logEntry: ErrorLogEntry): void {
    // In a real implementation, this would send an email, SMS, or notification
    // to the system administrator or DevOps team
    console.error('CRITICAL ERROR ALERT:', logEntry);
    
    // Example: Send email alert (implementation would depend on email service)
    // emailService.sendAlert({
    //   subject: `CRITICAL ERROR: ${logEntry.message}`,
    //   body: JSON.stringify(logEntry, null, 2)
    // });
  }
}