#!/usr/bin/env node

/**
 * Production Maintenance Script
 * 
 * This script provides automated maintenance tasks for the production environment:
 * - Scheduled backups
 * - Log rotation
 * - Performance monitoring
 * - Health checks
 */

import { backupData, listBackups } from './backupRestore';
import { validateSheetStructure, getSheetStatistics } from './sheetConfig';
import { MonitoringService } from '../services/monitoring';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const LOGS_DIR = path.join(process.cwd(), 'logs');
const METRICS_DIR = path.join(LOGS_DIR, 'metrics');
const MAX_BACKUP_AGE_DAYS = {
  daily: 7,    // Keep daily backups for 7 days
  weekly: 30,  // Keep weekly backups for 30 days
  monthly: 365 // Keep monthly backups for 1 year
};
const MAX_LOG_AGE_DAYS = 30; // Keep logs for 30 days

/**
 * Create a backup with appropriate retention tag
 */
async function createBackup(): Promise<void> {
  try {
    const date = new Date();
    const isMonthlyBackup = date.getDate() === 1;
    const isWeeklyBackup = date.getDay() === 0; // Sunday
    
    let retentionTag = 'daily';
    if (isMonthlyBackup) {
      retentionTag = 'monthly';
    } else if (isWeeklyBackup) {
      retentionTag = 'weekly';
    }
    
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `sheets-backup-${retentionTag}-${timestamp}.json`);
    
    console.log(`Creating ${retentionTag} backup...`);
    await backupData(backupPath);
    
    console.log('Backup created successfully');
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupBackups(): Promise<void> {
  try {
    console.log('Cleaning up old backups...');
    
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('No backup directory found');
      return;
    }
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json') && file.includes('sheets-backup'));
    
    const now = new Date();
    
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAgeDays = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      let maxAgeDays = MAX_BACKUP_AGE_DAYS.daily;
      
      if (file.includes('-monthly-')) {
        maxAgeDays = MAX_BACKUP_AGE_DAYS.monthly;
      } else if (file.includes('-weekly-')) {
        maxAgeDays = MAX_BACKUP_AGE_DAYS.weekly;
      }
      
      if (fileAgeDays > maxAgeDays) {
        console.log(`Deleting old backup: ${file} (${fileAgeDays.toFixed(1)} days old)`);
        fs.unlinkSync(filePath);
      }
    }
    
    console.log('Backup cleanup completed');
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
}

/**
 * Rotate log files
 */
async function rotateLogs(): Promise<void> {
  try {
    console.log('Rotating logs...');
    
    if (!fs.existsSync(LOGS_DIR)) {
      console.log('No logs directory found');
      return;
    }
    
    const now = new Date();
    const maxAgeMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    // Process error logs
    const errorLogs = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('error-log-') && file.endsWith('.json'));
    
    for (const file of errorLogs) {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now.getTime() - stats.mtime.getTime() > maxAgeMs) {
        console.log(`Deleting old log: ${file}`);
        fs.unlinkSync(filePath);
      }
    }
    
    // Process metrics logs
    if (fs.existsSync(METRICS_DIR)) {
      const metricsLogs = fs.readdirSync(METRICS_DIR)
        .filter(file => file.endsWith('.json'));
      
      for (const file of metricsLogs) {
        const filePath = path.join(METRICS_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (now.getTime() - stats.mtime.getTime() > maxAgeMs) {
          console.log(`Deleting old metrics log: ${file}`);
          fs.unlinkSync(filePath);
        }
      }
    }
    
    console.log('Log rotation completed');
  } catch (error) {
    console.error('Log rotation failed:', error);
  }
}

/**
 * Perform system health check
 */
async function performHealthCheck(): Promise<void> {
  try {
    console.log('Performing health check...');
    
    // Check Google Sheets connection
    console.log('Checking Google Sheets connection...');
    await validateSheetStructure();
    
    // Get sheet statistics
    console.log('Getting sheet statistics...');
    await getSheetStatistics();
    
    // Check system resources
    console.log('Checking system resources...');
    const monitoringService = new MonitoringService();
    const health = monitoringService.getSystemHealth();
    
    console.log(`System status: ${health.status}`);
    console.log(`Memory usage: ${health.metrics.memory.usedPercent.toFixed(2)}%`);
    console.log(`Disk usage: ${health.metrics.disk.usedPercent.toFixed(2)}%`);
    console.log(`System uptime: ${(health.metrics.uptime / 60 / 60).toFixed(2)} hours`);
    
    // Check API health
    try {
      const { stdout } = await execAsync('curl -s http://localhost:3001/health');
      console.log(`API health check: ${stdout}`);
    } catch (error) {
      console.error('API health check failed:', error);
    }
    
    console.log('Health check completed');
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'backup':
        await createBackup();
        break;

      case 'cleanup-backups':
        await cleanupBackups();
        break;

      case 'rotate-logs':
        await rotateLogs();
        break;

      case 'health-check':
        await performHealthCheck();
        break;

      case 'list-backups':
        listBackups();
        break;

      case 'daily-maintenance':
        // Run all maintenance tasks
        await createBackup();
        await cleanupBackups();
        await rotateLogs();
        await performHealthCheck();
        break;

      default:
        console.log('🔧 Production Maintenance Utility');
        console.log('================================');
        console.log('');
        console.log('Commands:');
        console.log('  backup              - Create a backup with appropriate retention tag');
        console.log('  cleanup-backups     - Clean up old backups based on retention policy');
        console.log('  rotate-logs         - Rotate and clean up old log files');
        console.log('  health-check        - Perform system health check');
        console.log('  list-backups        - List available backups');
        console.log('  daily-maintenance   - Run all maintenance tasks');
        console.log('');
        console.log('Examples:');
        console.log('  npm run maintenance backup');
        console.log('  npm run maintenance daily-maintenance');
        break;
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { createBackup, cleanupBackups, rotateLogs, performHealthCheck };