export interface Project {
  id: string;
  name: string;
  client_id: string;
  client_name?: string;
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
  start_date: string;
  end_date: string;
  budget: number;
  description: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  assignee?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  hours: number;
  description: string;
  date: string;
  billable: boolean;
  created_at: string;
}

export interface ProjectFilter {
  status?: string[];
  client?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalHours: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: Task['status'];
  tasks: Task[];
  color?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
  estimatedDuration: number;
  category: string;
}