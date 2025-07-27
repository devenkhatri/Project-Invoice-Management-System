import { SheetsService } from './sheets.service';
import { WebhookService } from './webhook.service';

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  localValue: any;
  remoteValue: any;
  timestamp: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merge';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SyncOperation {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: string;
  source: 'local' | 'remote';
  status: 'pending' | 'completed' | 'failed' | 'conflict';
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  lastSync: string;
  totalOperations: number;
  pendingOperations: number;
  failedOperations: number;
  conflictOperations: number;
  syncInProgress: boolean;
}

export class SyncService {
  private sheetsService: SheetsService;
  private webhookService: WebhookService;
  private syncInProgress: boolean = false;
  private conflictResolutionStrategies: Map<string, (local: any, remote: any) => any> = new Map();

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    this.sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
    this.webhookService = new WebhookService();
    this.initializeConflictResolutionStrategies();
  }

  private initializeConflictResolutionStrategies(): void {
    // Last-write-wins strategy
    this.conflictResolutionStrategies.set('last_write_wins', (local: any, remote: any) => {
      const localTime = new Date(local.updated_at || local.created_at).getTime();
      const remoteTime = new Date(remote.updated_at || remote.created_at).getTime();
      return remoteTime > localTime ? remote : local;
    });

    // Merge strategy for non-conflicting fields
    this.conflictResolutionStrategies.set('merge', (local: any, remote: any) => {
      const merged = { ...local };
      for (const [key, value] of Object.entries(remote)) {
        if (key !== 'id' && key !== 'created_at') {
          if (local[key] !== value) {
            // For arrays, merge unique values
            if (Array.isArray(local[key]) && Array.isArray(value)) {
              merged[key] = [...new Set([...local[key], ...value])];
            } else {
              // Use remote value for other conflicts
              merged[key] = value;
            }
          }
        }
      }
      merged.updated_at = new Date().toISOString();
      return merged;
    });

    // Manual resolution strategy
    this.conflictResolutionStrategies.set('manual', (local: any, remote: any) => {
      throw new Error('Manual resolution required');
    });
  }

  async startSync(): Promise<void> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      await this.processPendingOperations();
      await this.detectAndResolveConflicts();
      await this.updateSyncStatus();
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'status' | 'retryCount' | 'maxRetries'>): Promise<string> {
    const syncOperation: SyncOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3
    };

    const operationId = await this.sheetsService.create('Sync_Operations', syncOperation);
    
    // Trigger immediate sync if not in progress
    if (!this.syncInProgress) {
      setImmediate(() => this.startSync().catch(console.error));
    }

    return operationId;
  }

  private async processPendingOperations(): Promise<void> {
    const pendingOperations = await this.sheetsService.query('Sync_Operations', {
      status: 'pending'
    });

    for (const operation of pendingOperations) {
      try {
        await this.executeSyncOperation(operation);
      } catch (error) {
        console.error(`Failed to execute sync operation ${operation.id}:`, error);
        await this.handleOperationFailure(operation, error.message);
      }
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    const sheetName = this.getSheetName(operation.entityType);

    switch (operation.operation) {
      case 'create':
        await this.handleCreateOperation(operation, sheetName);
        break;
      case 'update':
        await this.handleUpdateOperation(operation, sheetName);
        break;
      case 'delete':
        await this.handleDeleteOperation(operation, sheetName);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.operation}`);
    }

    // Mark operation as completed
    await this.sheetsService.update('Sync_Operations', operation.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });

    // Trigger webhook
    await this.webhookService.triggerWebhook(`sync.${operation.operation}`, {
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: operation.operation
    });
  }

  private async handleCreateOperation(operation: SyncOperation, sheetName: string): Promise<void> {
    // Check if entity already exists
    const existing = await this.sheetsService.query(sheetName, { id: operation.entityId });
    
    if (existing.length > 0) {
      // Entity exists, convert to update operation
      await this.handleUpdateConflict(operation, existing[0]);
    } else {
      // Create new entity
      await this.sheetsService.create(sheetName, {
        ...operation.data,
        id: operation.entityId,
        synced_at: new Date().toISOString()
      });
    }
  }

  private async handleUpdateOperation(operation: SyncOperation, sheetName: string): Promise<void> {
    const existing = await this.sheetsService.query(sheetName, { id: operation.entityId });
    
    if (existing.length === 0) {
      // Entity doesn't exist, convert to create operation
      await this.sheetsService.create(sheetName, {
        ...operation.data,
        id: operation.entityId,
        synced_at: new Date().toISOString()
      });
    } else {
      // Check for conflicts
      const conflicts = this.detectFieldConflicts(existing[0], operation.data);
      
      if (conflicts.length > 0) {
        await this.handleUpdateConflict(operation, existing[0]);
      } else {
        // No conflicts, proceed with update
        await this.sheetsService.update(sheetName, operation.entityId, {
          ...operation.data,
          synced_at: new Date().toISOString()
        });
      }
    }
  }

  private async handleDeleteOperation(operation: SyncOperation, sheetName: string): Promise<void> {
    const existing = await this.sheetsService.query(sheetName, { id: operation.entityId });
    
    if (existing.length > 0) {
      // Soft delete to maintain audit trail
      await this.sheetsService.update(sheetName, operation.entityId, {
        deleted: true,
        deleted_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      });
    }
    // If entity doesn't exist, consider operation successful
  }

  private async handleUpdateConflict(operation: SyncOperation, existingData: any): Promise<void> {
    const conflicts = this.detectFieldConflicts(existingData, operation.data);
    
    if (conflicts.length === 0) {
      // No actual conflicts, proceed with update
      await this.sheetsService.update(this.getSheetName(operation.entityType), operation.entityId, {
        ...operation.data,
        synced_at: new Date().toISOString()
      });
      return;
    }

    // Try automatic conflict resolution
    const strategy = this.getConflictResolutionStrategy(operation.entityType);
    
    try {
      const resolved = this.conflictResolutionStrategies.get(strategy)?.(existingData, operation.data);
      
      if (resolved) {
        await this.sheetsService.update(this.getSheetName(operation.entityType), operation.entityId, {
          ...resolved,
          synced_at: new Date().toISOString()
        });

        // Log successful automatic resolution
        for (const conflict of conflicts) {
          await this.sheetsService.create('Sync_Conflicts', {
            ...conflict,
            resolved: true,
            resolution: strategy,
            resolvedAt: new Date().toISOString(),
            resolvedBy: 'system'
          });
        }
      }
    } catch (error) {
      // Automatic resolution failed, mark operation as conflict
      await this.sheetsService.update('Sync_Operations', operation.id, {
        status: 'conflict',
        error: error.message
      });

      // Create conflict records for manual resolution
      for (const conflict of conflicts) {
        await this.sheetsService.create('Sync_Conflicts', conflict);
      }
    }
  }

  private detectFieldConflicts(local: any, remote: any): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    const excludeFields = ['id', 'created_at', 'synced_at'];

    for (const [field, remoteValue] of Object.entries(remote)) {
      if (excludeFields.includes(field)) continue;

      const localValue = local[field];
      
      if (localValue !== remoteValue && localValue !== undefined) {
        conflicts.push({
          id: this.generateId(),
          entityType: local.entity_type || 'unknown',
          entityId: local.id,
          field,
          localValue,
          remoteValue,
          timestamp: new Date().toISOString(),
          resolved: false
        });
      }
    }

    return conflicts;
  }

  private async detectAndResolveConflicts(): Promise<void> {
    const unresolvedConflicts = await this.sheetsService.query('Sync_Conflicts', {
      resolved: false
    });

    for (const conflict of unresolvedConflicts) {
      try {
        // Skip automatic resolution for now - requires manual intervention
        console.log(`Conflict ${conflict.id} requires manual resolution`);
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', resolvedBy?: string): Promise<void> {
    const conflicts = await this.sheetsService.query('Sync_Conflicts', { id: conflictId });
    
    if (!conflicts.length) {
      throw new Error('Conflict not found');
    }

    const conflict = conflicts[0];
    let resolvedValue: any;

    switch (resolution) {
      case 'local':
        resolvedValue = conflict.localValue;
        break;
      case 'remote':
        resolvedValue = conflict.remoteValue;
        break;
      case 'merge':
        resolvedValue = this.mergeValues(conflict.localValue, conflict.remoteValue);
        break;
      default:
        throw new Error(`Unknown resolution type: ${resolution}`);
    }

    // Update the entity with resolved value
    const sheetName = this.getSheetName(conflict.entityType);
    await this.sheetsService.update(sheetName, conflict.entityId, {
      [conflict.field]: resolvedValue,
      synced_at: new Date().toISOString()
    });

    // Mark conflict as resolved
    await this.sheetsService.update('Sync_Conflicts', conflictId, {
      resolved: true,
      resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy: resolvedBy || 'system'
    });
  }

  private mergeValues(localValue: any, remoteValue: any): any {
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return [...new Set([...localValue, ...remoteValue])];
    }
    
    if (typeof localValue === 'object' && typeof remoteValue === 'object') {
      return { ...localValue, ...remoteValue };
    }
    
    // For primitive values, prefer remote
    return remoteValue;
  }

  private async handleOperationFailure(operation: SyncOperation, error: string): Promise<void> {
    operation.retryCount++;
    
    if (operation.retryCount >= operation.maxRetries) {
      // Max retries reached, mark as failed
      await this.sheetsService.update('Sync_Operations', operation.id, {
        status: 'failed',
        error,
        failed_at: new Date().toISOString()
      });
    } else {
      // Schedule retry
      const retryDelay = Math.pow(2, operation.retryCount) * 1000; // Exponential backoff
      
      await this.sheetsService.update('Sync_Operations', operation.id, {
        retryCount: operation.retryCount,
        next_retry: new Date(Date.now() + retryDelay).toISOString(),
        last_error: error
      });
    }
  }

  private async updateSyncStatus(): Promise<void> {
    const operations = await this.sheetsService.read('Sync_Operations');
    
    const status: SyncStatus = {
      lastSync: new Date().toISOString(),
      totalOperations: operations.length,
      pendingOperations: operations.filter(op => op.status === 'pending').length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
      conflictOperations: operations.filter(op => op.status === 'conflict').length,
      syncInProgress: this.syncInProgress
    };

    await this.sheetsService.create('Sync_Status', status);
  }

  private getSheetName(entityType: string): string {
    const mapping: Record<string, string> = {
      'project': 'Projects',
      'task': 'Tasks',
      'client': 'Clients',
      'invoice': 'Invoices',
      'payment': 'Payments',
      'time_entry': 'Time_Entries',
      'expense': 'Expenses'
    };

    return mapping[entityType] || entityType;
  }

  private getConflictResolutionStrategy(entityType: string): string {
    const strategies: Record<string, string> = {
      'invoice': 'last_write_wins',
      'project': 'merge',
      'client': 'merge',
      'task': 'last_write_wins',
      'payment': 'last_write_wins',
      'time_entry': 'last_write_wins',
      'expense': 'last_write_wins'
    };

    return strategies[entityType] || 'last_write_wins';
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const statusRecords = await this.sheetsService.read('Sync_Status');
    
    if (statusRecords.length === 0) {
      return {
        lastSync: 'never',
        totalOperations: 0,
        pendingOperations: 0,
        failedOperations: 0,
        conflictOperations: 0,
        syncInProgress: this.syncInProgress
      };
    }

    // Get the latest status
    const latestStatus = statusRecords.sort((a, b) => 
      new Date(b.lastSync).getTime() - new Date(a.lastSync).getTime()
    )[0];

    return {
      ...latestStatus,
      syncInProgress: this.syncInProgress
    };
  }

  async getConflicts(resolved?: boolean): Promise<SyncConflict[]> {
    const query = resolved !== undefined ? { resolved } : {};
    return await this.sheetsService.query('Sync_Conflicts', query);
  }

  async getSyncOperations(status?: string): Promise<SyncOperation[]> {
    const query = status ? { status } : {};
    return await this.sheetsService.query('Sync_Operations', query);
  }

  async retryFailedOperations(): Promise<void> {
    const failedOperations = await this.sheetsService.query('Sync_Operations', {
      status: 'failed'
    });

    for (const operation of failedOperations) {
      // Reset operation for retry
      await this.sheetsService.update('Sync_Operations', operation.id, {
        status: 'pending',
        retryCount: 0,
        error: null,
        next_retry: null
      });
    }

    // Start sync to process retried operations
    if (!this.syncInProgress) {
      await this.startSync();
    }
  }

  async clearSyncHistory(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Clear old completed operations
    const oldOperations = await this.sheetsService.query('Sync_Operations', {
      status: 'completed',
      completed_at: { lessThan: cutoffDate.toISOString() }
    });

    for (const operation of oldOperations) {
      await this.sheetsService.delete('Sync_Operations', operation.id);
    }

    // Clear old resolved conflicts
    const oldConflicts = await this.sheetsService.query('Sync_Conflicts', {
      resolved: true,
      resolvedAt: { lessThan: cutoffDate.toISOString() }
    });

    for (const conflict of oldConflicts) {
      await this.sheetsService.delete('Sync_Conflicts', conflict.id);
    }
  }
}