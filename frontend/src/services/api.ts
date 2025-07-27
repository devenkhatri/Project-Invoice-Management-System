import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management utilities
export const tokenManager = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = tokenManager.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh and error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = tokenManager.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token } = response.data;
          tokenManager.setToken(token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        tokenManager.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Retry logic for network errors
const retryRequest = async (
  config: AxiosRequestConfig,
  retries = 3,
  delay = 1000
): Promise<AxiosResponse> => {
  try {
    return await apiClient(config);
  } catch (error) {
    if (retries > 0 && axios.isAxiosError(error) && !error.response) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryRequest(config, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Generic API service class
export class ApiService {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async get<T>(id?: string, params?: Record<string, any>): Promise<T> {
    const url = id ? `${this.endpoint}/${id}` : this.endpoint;
    const response = await retryRequest({ method: 'GET', url, params });
    return response.data;
  }

  async post<T>(data: any, id?: string): Promise<T> {
    const url = id ? `${this.endpoint}/${id}` : this.endpoint;
    const response = await retryRequest({ method: 'POST', url, data });
    return response.data;
  }

  async put<T>(id: string, data: any): Promise<T> {
    const response = await retryRequest({
      method: 'PUT',
      url: `${this.endpoint}/${id}`,
      data,
    });
    return response.data;
  }

  async delete<T>(id: string): Promise<T> {
    const response = await retryRequest({
      method: 'DELETE',
      url: `${this.endpoint}/${id}`,
    });
    return response.data;
  }
}

// Authentication service
export class AuthService extends ApiService {
  constructor() {
    super('/auth');
  }

  async login(email: string, password: string) {
    const response = await this.post({ email, password }, 'login');
    const { token, refreshToken, user } = response as any;
    
    tokenManager.setToken(token);
    tokenManager.setRefreshToken(refreshToken);
    
    return { token, refreshToken, user };
  }

  async logout() {
    try {
      await this.post({}, 'logout');
    } finally {
      tokenManager.clearTokens();
    }
  }

  async refreshToken() {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await this.post({ refreshToken }, 'refresh');
    const { token } = response as any;
    
    tokenManager.setToken(token);
    return token;
  }

  async getProfile() {
    return this.get('profile');
  }
}

// Project service
export class ProjectService extends ApiService {
  constructor() {
    super('/projects');
  }

  async getTasks(projectId: string) {
    return this.get(`${projectId}/tasks`);
  }

  async createTask(projectId: string, taskData: any) {
    return this.post(taskData, `${projectId}/tasks`);
  }
}

// Client service
export class ClientService extends ApiService {
  constructor() {
    super('/clients');
  }

  async getProjects(clientId: string) {
    return this.get(`${clientId}/projects`);
  }

  async onboard(onboardingData: any) {
    return this.post(onboardingData, 'onboard');
  }

  async getActivities(clientId: string, params?: Record<string, any>) {
    return this.get(`${clientId}/activities`, params);
  }

  async updatePortalAccess(clientId: string, data: { enabled: boolean; password?: string }) {
    return this.put(`${clientId}/portal-access`, data);
  }
}

// Client Portal service
export class ClientPortalService extends ApiService {
  constructor() {
    super('/client-portal');
  }

  async login(email: string, password: string) {
    const response = await this.post({ email, password }, 'login');
    const { tokens, client } = response as any;
    
    tokenManager.setToken(tokens.accessToken);
    tokenManager.setRefreshToken(tokens.refreshToken);
    
    return { tokens, client };
  }

  async logout() {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      await this.post({ refreshToken }, 'logout');
    } finally {
      tokenManager.clearTokens();
    }
  }

  async getDashboard() {
    return this.get('dashboard');
  }

  async getProject(projectId: string) {
    return this.get(`projects/${projectId}`);
  }

  async sendMessage(messageData: { subject: string; message: string; project_id?: string }) {
    return this.post(messageData, 'messages');
  }

  async getInvoices(params?: Record<string, any>) {
    return this.get('invoices', params);
  }

  async getInvoice(invoiceId: string) {
    return this.get(`invoices/${invoiceId}`);
  }

  async getCommunications(params?: Record<string, any>) {
    return this.get('communications', params);
  }

  async markCommunicationRead(communicationId: string) {
    return this.put(`communications/${communicationId}/read`, {});
  }
}

// Invoice service
export class InvoiceService extends ApiService {
  constructor() {
    super('/invoices');
  }

  async sendInvoice(invoiceId: string) {
    return this.post({}, `${invoiceId}/send`);
  }

  async recordPayment(invoiceId: string, paymentData: any) {
    return this.post(paymentData, `${invoiceId}/payment`);
  }

  async generatePdf(invoiceId: string) {
    const response = await apiClient.get(`${this.endpoint}/${invoiceId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  }
}

// Task service
export class TaskService extends ApiService {
  constructor() {
    super('/tasks');
  }
}

// Time entry service
export class TimeEntryService extends ApiService {
  constructor() {
    super('/time-entries');
  }
}

// Expense service
export class ExpenseService extends ApiService {
  constructor() {
    super('/expenses');
  }
}

// Report service
export class ReportService extends ApiService {
  constructor() {
    super('/reports');
  }

  async getFinancialReport(params?: Record<string, any>) {
    return this.get('financial', params);
  }

  async getProjectReport(params?: Record<string, any>) {
    return this.get('projects', params);
  }

  async getDashboardData() {
    return this.get('dashboard');
  }
}

// File service
export class FileService extends ApiService {
  constructor() {
    super('/files');
  }

  async uploadFile(file: File, metadata: any) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata fields
    Object.keys(metadata).forEach(key => {
      if (metadata[key] !== undefined && metadata[key] !== null) {
        if (Array.isArray(metadata[key])) {
          formData.append(key, JSON.stringify(metadata[key]));
        } else {
          formData.append(key, metadata[key]);
        }
      }
    });

    const response = await apiClient.post(`${this.endpoint}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadMultipleFiles(files: File[], metadata: any) {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Add metadata fields
    Object.keys(metadata).forEach(key => {
      if (metadata[key] !== undefined && metadata[key] !== null) {
        if (Array.isArray(metadata[key])) {
          formData.append(key, JSON.stringify(metadata[key]));
        } else {
          formData.append(key, metadata[key]);
        }
      }
    });

    const response = await apiClient.post(`${this.endpoint}/upload-multiple`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async searchFiles(query: any) {
    return this.get('search', query);
  }

  async downloadFile(fileId: string) {
    const response = await apiClient.get(`${this.endpoint}/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadMultipleFiles(fileIds: string[]) {
    const response = await apiClient.post(`${this.endpoint}/download-multiple`, 
      { fileIds },
      { responseType: 'blob' }
    );
    return response.data;
  }

  async shareFiles(shareRequest: any) {
    return this.post(shareRequest, 'share');
  }

  async addComment(fileId: string, comment: string) {
    return this.post({ comment }, `${fileId}/comments`);
  }

  async getComments(fileId: string) {
    return this.get(`${fileId}/comments`);
  }

  async uploadNewVersion(fileId: string, file: File, changeDescription?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (changeDescription) {
      formData.append('changeDescription', changeDescription);
    }

    const response = await apiClient.post(`${this.endpoint}/${fileId}/versions`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getVersions(fileId: string) {
    return this.get(`${fileId}/versions`);
  }
}

// Service instances
export const authService = new AuthService();
export const projectService = new ProjectService();
export const clientService = new ClientService();
export const clientPortalService = new ClientPortalService();
export const invoiceService = new InvoiceService();
export const taskService = new TaskService();
export const timeEntryService = new TimeEntryService();
export const expenseService = new ExpenseService();
export const reportService = new ReportService();
export const fileService = new FileService();

export default apiClient;