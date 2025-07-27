import Dexie, { Table } from 'dexie';

// Define interfaces for offline data
export interface OfflineProject {
  id: string;
  name: string;
  client_id: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: number;
  description: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface OfflineTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  created_at: string;
  synced: boolean;
}

export interface OfflineTimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  hours: number;
  description: string;
  date: string;
  created_at: string;
  synced: boolean;
}

export interface OfflineInvoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  due_date: string;
  created_at: string;
  synced: boolean;
}

export interface OfflineClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  payment_terms: string;
  created_at: string;
  synced: boolean;
}

export interface PendingSync {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

// Database class
class OfflineDatabase extends Dexie {
  projects!: Table<OfflineProject>;
  tasks!: Table<OfflineTask>;
  timeEntries!: Table<OfflineTimeEntry>;
  invoices!: Table<OfflineInvoice>;
  clients!: Table<OfflineClient>;
  pendingSync!: Table<PendingSync>;

  constructor() {
    super('ProjectInvoiceDB');
    
    this.version(1).stores({
      projects: 'id, name, client_id, status, start_date, end_date, synced',
      tasks: 'id, project_id, title, status, priority, due_date, synced',
      timeEntries: 'id, task_id, project_id, date, synced',
      invoices: 'id, invoice_number, client_id, project_id, status, due_date, synced',
      clients: 'id, name, email, synced',
      pendingSync: '++id, type, table, timestamp, retries'
    });
  }
}

export const db = new OfflineDatabase();

// Offline storage manager
export class OfflineStorageManager {
  private syncInProgress = false;

  // Generic CRUD operations
  async create<T>(table: string, data: T & { synced: boolean }): Promise<string> {
    const id = await (db as any)[table].add({ ...data, synced: false });
    
    // Add to pending sync queue
    await this.addToPendingSync('CREATE', table, data);
    
    return id;
  }

  async read<T>(table: string, id?: string): Promise<T[]> {
    if (id) {
      const item = await (db as any)[table].get(id);
      return item ? [item] : [];
    }
    return await (db as any)[table].toArray();
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<boolean> {
    const updated = await (db as any)[table].update(id, { ...data, synced: false });
    
    if (updated) {
      await this.addToPendingSync('UPDATE', table, { id, ...data });
    }
    
    return updated > 0;
  }

  async delete(table: string, id: string): Promise<boolean> {
    const deleted = await (db as any)[table].delete(id);
    
    if (deleted) {
      await this.addToPendingSync('DELETE', table, { id });
    }
    
    return deleted > 0;
  }

  // Sync management
  private async addToPendingSync(type: 'CREATE' | 'UPDATE' | 'DELETE', table: string, data: any): Promise<void> {
    await db.pendingSync.add({
      type,
      table,
      data,
      timestamp: Date.now(),
      retries: 0
    });
  }

  async syncWithServer(apiClient: any): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      const pendingItems = await db.pendingSync.orderBy('timestamp').toArray();
      
      for (const item of pendingItems) {
        try {
          await this.syncItem(item, apiClient);
          await db.pendingSync.delete(item.id!);
        } catch (error) {
          console.error('Sync failed for item:', item, error);
          
          // Increment retry count
          await db.pendingSync.update(item.id!, { 
            retries: item.retries + 1 
          });
          
          // Remove items that have failed too many times
          if (item.retries >= 3) {
            await db.pendingSync.delete(item.id!);
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: PendingSync, apiClient: any): Promise<void> {
    const { type, table, data } = item;
    
    switch (type) {
      case 'CREATE':
        await apiClient.post(`/api/${table}`, data);
        break;
      case 'UPDATE':
        await apiClient.put(`/api/${table}/${data.id}`, data);
        break;
      case 'DELETE':
        await apiClient.delete(`/api/${table}/${data.id}`);
        break;
    }
  }

  // Cache management
  async cacheServerData<T>(table: string, data: T[]): Promise<void> {
    await (db as any)[table].clear();
    await (db as any)[table].bulkAdd(
      data.map(item => ({ ...item, synced: true }))
    );
  }

  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  async getPendingSyncCount(): Promise<number> {
    return await db.pendingSync.count();
  }

  // Specific data operations
  async getProjectsWithTasks(): Promise<(OfflineProject & { tasks: OfflineTask[] })[]> {
    const projects = await db.projects.toArray();
    const tasks = await db.tasks.toArray();
    
    return projects.map(project => ({
      ...project,
      tasks: tasks.filter(task => task.project_id === project.id)
    }));
  }

  async getTimeEntriesForProject(projectId: string): Promise<OfflineTimeEntry[]> {
    return await db.timeEntries.where('project_id').equals(projectId).toArray();
  }

  async getInvoicesForClient(clientId: string): Promise<OfflineInvoice[]> {
    return await db.invoices.where('client_id').equals(clientId).toArray();
  }

  // Search functionality
  async searchProjects(query: string): Promise<OfflineProject[]> {
    return await db.projects
      .filter(project => 
        project.name.toLowerCase().includes(query.toLowerCase()) ||
        project.description.toLowerCase().includes(query.toLowerCase())
      )
      .toArray();
  }

  async searchTasks(query: string): Promise<OfflineTask[]> {
    return await db.tasks
      .filter(task => 
        task.title.toLowerCase().includes(query.toLowerCase()) ||
        task.description.toLowerCase().includes(query.toLowerCase())
      )
      .toArray();
  }

  // Analytics for offline data
  async getProjectStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    onHold: number;
  }> {
    const projects = await db.projects.toArray();
    
    return {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      onHold: projects.filter(p => p.status === 'on-hold').length,
    };
  }

  async getInvoiceStats(): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
  }> {
    const invoices = await db.invoices.toArray();
    
    return {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'paid').length,
      pending: invoices.filter(i => i.status === 'sent').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.total_amount, 0),
    };
  }
}

export const offlineStorage = new OfflineStorageManager();