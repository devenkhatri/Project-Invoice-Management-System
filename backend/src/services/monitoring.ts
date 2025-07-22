import { ErrorMonitor, ErrorSeverity, ErrorLogEntry } from '../utils/errorMonitoring';
import os from 'os';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import axios from 'axios';
import config from '../config';

/**
 * System metrics interface
 */
export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAvg: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  uptime: number;
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  timestamp: string;
  apiEndpoint?: string;
  operation?: string;
  duration: number;
  status?: number;
  userAgent?: string;
}

/**
 * Monitoring service for system health and performance
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private errorMonitor: ErrorMonitor;
  private metricsDir: string;
  private metricsFile: string;
  private performanceFile: string;
  private alertCount: Map<string, number> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertThrottleTime = 3600000; // 1 hour in milliseconds
  
  private constructor() {
    this.errorMonitor = ErrorMonitor.getInstance();
    this.metricsDir = path.join(process.cwd(), 'logs', 'metrics');
    this.metricsFile = path.join(this.metricsDir, `system-metrics-${new Date().toISOString().split('T')[0]}.json`);
    this.performanceFile = path.join(this.metricsDir, `performance-metrics-${new Date().toISOString().split('T')[0]}.json`);
    
    // Create metrics directory if it doesn't exist
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
    
    // Register error handler
    this.errorMonitor.onError(this.handleError.bind(this));
    
    // Start metrics collection
    if (process.env.NODE_ENV === 'production') {
      this.startMetricsCollection();
    }
  }
  
  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }
  
  /**
   * Record performance metrics for an operation
   */
  public recordPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date().toISOString()
    };
    
    // Check for slow operations
    const thresholds = {
      api: 1000, // 1 second
      sheets: 2000, // 2 seconds
      database: 500 // 0.5 seconds
    };
    
    let thresholdKey = 'api';
    if (metrics.operation?.includes('sheets') || metrics.operation?.includes('google')) {
      thresholdKey = 'sheets';
    } else if (metrics.operation?.includes('db') || metrics.operation?.includes('database')) {
      thresholdKey = 'database';
    }
    
    // Log slow operations
    if (metrics.duration > thresholds[thresholdKey as keyof typeof thresholds]) {
      this.errorMonitor.logError(
        `Slow operation: ${metrics.operation || metrics.apiEndpoint} took ${metrics.duration}ms`,
        ErrorSeverity.LOW,
        { metrics: fullMetrics }
      );
    }
    
    // Write to performance log file
    this.writePerformanceMetrics(fullMetrics);
  }
  
  /**
   * Get system health status
   */
  public getSystemHealth(): { status: string; metrics: SystemMetrics } {
    const metrics = this.collectSystemMetrics();
    
    // Determine system health based on metrics
    let status = 'healthy';
    
    if (metrics.memory.usedPercent > 90 || metrics.disk.usedPercent > 90) {
      status = 'warning';
    }
    
    if (metrics.memory.usedPercent > 95 || metrics.disk.usedPercent > 95) {
      status = 'critical';
    }
    
    return { status, metrics };
  }
  
  /**
   * Get performance statistics
   */
  public async getPerformanceStats(
    timeframe: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{ averages: Record<string, number>; slowest: PerformanceMetrics[] }> {
    try {
      // Read performance metrics from file
      const metrics = await this.readPerformanceMetrics();
      
      // Filter by timeframe
      const now = new Date();
      const timeframeMs = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000
      };
      
      const filteredMetrics = metrics.filter(m => {
        const timestamp = new Date(m.timestamp);
        return now.getTime() - timestamp.getTime() <= timeframeMs[timeframe];
      });
      
      // Group by operation or endpoint
      const grouped: Record<string, PerformanceMetrics[]> = {};
      
      filteredMetrics.forEach(metric => {
        const key = metric.operation || metric.apiEndpoint || 'unknown';
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(metric);
      });
      
      // Calculate averages
      const averages: Record<string, number> = {};
      
      Object.entries(grouped).forEach(([key, metrics]) => {
        const total = metrics.reduce((sum, m) => sum + m.duration, 0);
        averages[key] = total / metrics.length;
      });
      
      // Get slowest operations
      const slowest = [...filteredMetrics]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);
      
      return { averages, slowest };
    } catch (error) {
      console.error('Error getting performance stats:', error);
      return { averages: {}, slowest: [] };
    }
  }
  
  /**
   * Start collecting system metrics at regular intervals
   */
  private startMetricsCollection(): void {
    // Collect metrics every 5 minutes
    setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.writeSystemMetrics(metrics);
      
      // Check for resource issues
      this.checkResourceUsage(metrics);
    }, 5 * 60 * 1000);
  }
  
  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const totalCpuTime = cpus.reduce((total, cpu) => {
      return total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    }, 0);
    
    const idleCpuTime = cpus.reduce((total, cpu) => total + cpu.times.idle, 0);
    const cpuUsage = 100 - (idleCpuTime / totalCpuTime) * 100;
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Get disk usage (simplified, would need a library for accurate info)
    let diskTotal = 0;
    let diskFree = 0;
    let diskUsed = 0;
    
    try {
      // This is a simplified approach - in a real implementation, you'd use a library
      // like 'diskusage' or 'node-disk-info' to get accurate disk information
      const stats = fs.statfsSync('/');
      diskTotal = stats.blocks * stats.bsize;
      diskFree = stats.bfree * stats.bsize;
      diskUsed = diskTotal - diskFree;
    } catch (error) {
      console.error('Error getting disk usage:', error);
    }
    
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: cpuUsage,
        loadAvg: os.loadavg()
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usedPercent: (usedMemory / totalMemory) * 100
      },
      disk: {
        total: diskTotal,
        free: diskFree,
        used: diskUsed,
        usedPercent: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
      },
      uptime: os.uptime(),
      processMemory: process.memoryUsage()
    };
  }
  
  /**
   * Write system metrics to file
   */
  private writeSystemMetrics(metrics: SystemMetrics): void {
    try {
      let allMetrics: SystemMetrics[] = [];
      
      // Read existing metrics if file exists
      if (fs.existsSync(this.metricsFile)) {
        const fileContent = fs.readFileSync(this.metricsFile, 'utf8');
        allMetrics = JSON.parse(fileContent);
      }
      
      // Add new metrics
      allMetrics.push(metrics);
      
      // Keep only the last 288 entries (24 hours at 5-minute intervals)
      if (allMetrics.length > 288) {
        allMetrics = allMetrics.slice(-288);
      }
      
      // Write back to file
      fs.writeFileSync(this.metricsFile, JSON.stringify(allMetrics, null, 2));
    } catch (error) {
      console.error('Failed to write system metrics:', error);
    }
  }
  
  /**
   * Write performance metrics to file
   */
  private writePerformanceMetrics(metrics: PerformanceMetrics): void {
    try {
      let allMetrics: PerformanceMetrics[] = [];
      
      // Read existing metrics if file exists
      if (fs.existsSync(this.performanceFile)) {
        const fileContent = fs.readFileSync(this.performanceFile, 'utf8');
        allMetrics = JSON.parse(fileContent);
      }
      
      // Add new metrics
      allMetrics.push(metrics);
      
      // Keep only the last 1000 entries
      if (allMetrics.length > 1000) {
        allMetrics = allMetrics.slice(-1000);
      }
      
      // Write back to file
      fs.writeFileSync(this.performanceFile, JSON.stringify(allMetrics, null, 2));
    } catch (error) {
      console.error('Failed to write performance metrics:', error);
    }
  }
  
  /**
   * Read performance metrics from file
   */
  private async readPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    try {
      if (!fs.existsSync(this.performanceFile)) {
        return [];
      }
      
      const fileContent = fs.readFileSync(this.performanceFile, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error('Failed to read performance metrics:', error);
      return [];
    }
  }
  
  /**
   * Check resource usage and alert if necessary
   */
  private checkResourceUsage(metrics: SystemMetrics): void {
    // Check memory usage
    if (metrics.memory.usedPercent > 90) {
      this.errorMonitor.logError(
        `High memory usage: ${metrics.memory.usedPercent.toFixed(2)}%`,
        ErrorSeverity.HIGH,
        { metrics }
      );
    }
    
    // Check disk usage
    if (metrics.disk.usedPercent > 90) {
      this.errorMonitor.logError(
        `High disk usage: ${metrics.disk.usedPercent.toFixed(2)}%`,
        ErrorSeverity.HIGH,
        { metrics }
      );
    }
    
    // Check process memory
    const heapUsedMB = metrics.processMemory.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      this.errorMonitor.logError(
        `High heap usage: ${heapUsedMB.toFixed(2)} MB`,
        ErrorSeverity.MEDIUM,
        { metrics }
      );
    }
  }
  
  /**
   * Handle error events from ErrorMonitor
   */
  private handleError(error: ErrorLogEntry): void {
    // Only send alerts for high and critical errors
    if (error.severity !== ErrorSeverity.HIGH && error.severity !== ErrorSeverity.CRITICAL) {
      return;
    }
    
    // Create error key for tracking
    const errorKey = `${error.severity}-${error.message}`;
    
    // Increment alert count
    const currentCount = this.alertCount.get(errorKey) || 0;
    this.alertCount.set(errorKey, currentCount + 1);
    
    // Check if we should send an alert
    const alertThreshold = error.severity === ErrorSeverity.CRITICAL ? 1 : 5;
    
    if (this.alertCount.get(errorKey) >= alertThreshold) {
      // Check if we've sent an alert recently
      const lastAlert = this.lastAlertTime.get(errorKey) || 0;
      const now = Date.now();
      
      if (now - lastAlert > this.alertThrottleTime) {
        // Send alert
        this.sendAlert(error);
        
        // Reset counter and update last alert time
        this.alertCount.set(errorKey, 0);
        this.lastAlertTime.set(errorKey, now);
      }
    }
  }
  
  /**
   * Send alert for critical errors
   */
  private async sendAlert(error: ErrorLogEntry): Promise<void> {
    try {
      // Send email alert
      await this.sendEmailAlert(error);
      
      // Send Slack alert if configured
      const slackWebhook = process.env.SLACK_WEBHOOK;
      if (slackWebhook) {
        await this.sendSlackAlert(error, slackWebhook);
      }
    } catch (alertError) {
      console.error('Failed to send alert:', alertError);
    }
  }
  
  /**
   * Send email alert
   */
  private async sendEmailAlert(error: ErrorLogEntry): Promise<void> {
    const { email } = config;
    
    if (!email.host || !email.user || !email.password) {
      console.error('Email configuration missing, cannot send alert');
      return;
    }
    
    const transporter = nodemailer.createTransport({
      host: email.host,
      port: email.port,
      secure: email.secure,
      auth: {
        user: email.user,
        pass: email.password
      }
    });
    
    const mailOptions = {
      from: email.from,
      to: process.env.ALERT_EMAIL || 'admin@example.com',
      subject: `[${error.severity.toUpperCase()}] Error Alert: ${error.message}`,
      text: `
Error Details:
--------------
Severity: ${error.severity}
Timestamp: ${error.timestamp}
Message: ${error.message}
${error.stack ? `\nStack Trace:\n${error.stack}` : ''}
${error.context ? `\nContext:\n${JSON.stringify(error.context, null, 2)}` : ''}
${error.requestInfo ? `\nRequest Info:\n${JSON.stringify(error.requestInfo, null, 2)}` : ''}
      `,
      html: `
<h2>Error Alert</h2>
<p><strong>Severity:</strong> ${error.severity}</p>
<p><strong>Timestamp:</strong> ${error.timestamp}</p>
<p><strong>Message:</strong> ${error.message}</p>
${error.stack ? `<h3>Stack Trace:</h3><pre>${error.stack}</pre>` : ''}
${error.context ? `<h3>Context:</h3><pre>${JSON.stringify(error.context, null, 2)}</pre>` : ''}
${error.requestInfo ? `<h3>Request Info:</h3><pre>${JSON.stringify(error.requestInfo, null, 2)}</pre>` : ''}
      `
    };
    
    await transporter.sendMail(mailOptions);
  }
  
  /**
   * Send Slack alert
   */
  private async sendSlackAlert(error: ErrorLogEntry, webhookUrl: string): Promise<void> {
    const color = error.severity === ErrorSeverity.CRITICAL ? '#FF0000' : '#FFA500';
    
    const payload = {
      attachments: [
        {
          color,
          title: `[${error.severity.toUpperCase()}] Error Alert`,
          text: error.message,
          fields: [
            {
              title: 'Severity',
              value: error.severity,
              short: true
            },
            {
              title: 'Timestamp',
              value: error.timestamp,
              short: true
            }
          ],
          footer: 'Project Invoice Management System'
        }
      ]
    };
    
    await axios.post(webhookUrl, payload);
  }
}

// Export singleton instance
export const monitoringService = MonitoringService.getInstance();

// Export middleware for performance monitoring
export function performanceMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Add response listener
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      monitoringService.recordPerformance({
        apiEndpoint: `${req.method} ${req.originalUrl}`,
        duration,
        status: res.statusCode,
        userAgent: req.headers['user-agent']
      });
    });
    
    next();
  };
}