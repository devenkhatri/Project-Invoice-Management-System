import { 
  Project, 
  Task, 
  Client, 
  Invoice, 
  TimeEntry, 
  Expense,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  InvoiceStatus,
  PaymentStatus,
  ExpenseCategory,
  InvoiceLineItem,
  TaxBreakdown
} from '../types';
import { generateId, generateInvoiceNumber } from './validation';

// Mock data generators
export class MockDataGenerator {
  private static readonly SAMPLE_NAMES = [
    'Acme Corporation', 'TechStart Solutions', 'Digital Innovations', 'Creative Agency',
    'Global Enterprises', 'Smart Systems', 'Future Tech', 'Dynamic Solutions'
  ];

  private static readonly SAMPLE_FIRST_NAMES = [
    'Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Suresh', 'Kavya',
    'Arjun', 'Meera', 'Rohit', 'Divya', 'Kiran', 'Pooja', 'Arun', 'Nisha'
  ];

  private static readonly SAMPLE_LAST_NAMES = [
    'Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Agarwal', 'Jain', 'Shah',
    'Reddy', 'Nair', 'Iyer', 'Rao', 'Verma', 'Mehta', 'Joshi', 'Desai'
  ];

  private static readonly SAMPLE_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'
  ];

  private static readonly SAMPLE_STATES = [
    'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'West Bengal'
  ];

  private static readonly SAMPLE_DOMAINS = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'business.in'
  ];

  private static readonly SAMPLE_TASK_TITLES = [
    'Design UI mockups', 'Implement authentication', 'Setup database', 'Write unit tests',
    'Create API endpoints', 'Deploy to production', 'Code review', 'Bug fixes',
    'Performance optimization', 'Documentation update', 'Security audit', 'Integration testing'
  ];

  private static readonly SAMPLE_DESCRIPTIONS = [
    'Initial project setup and requirements gathering',
    'Development of core functionality',
    'Testing and quality assurance',
    'Client feedback incorporation',
    'Final deployment and handover'
  ];

  private static getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private static getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static getRandomFloat(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  private static getRandomDate(daysFromNow: number = 0, rangeDays: number = 30): string {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + daysFromNow);
    const randomDays = Math.floor(Math.random() * rangeDays) - (rangeDays / 2);
    baseDate.setDate(baseDate.getDate() + randomDays);
    return baseDate.toISOString().split('T')[0];
  }

  private static generateGSTIN(): string {
    const stateCode = String(this.getRandomNumber(1, 37)).padStart(2, '0');
    const panLike = Array(5).fill(0).map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('') +
                   String(this.getRandomNumber(1000, 9999)) +
                   String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const checkDigit = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const defaultFlag = 'Z';
    const additionalCode = String.fromCharCode(48 + Math.floor(Math.random() * 10));
    
    return `${stateCode}${panLike}${checkDigit}${defaultFlag}${additionalCode}`;
  }

  // Client generators
  static generateClient(overrides: Partial<Client> = {}): Client {
    const firstName = this.getRandomElement(this.SAMPLE_FIRST_NAMES);
    const lastName = this.getRandomElement(this.SAMPLE_LAST_NAMES);
    const companyName = this.getRandomElement(this.SAMPLE_NAMES);
    const city = this.getRandomElement(this.SAMPLE_CITIES);
    const state = this.getRandomElement(this.SAMPLE_STATES);
    const domain = this.getRandomElement(this.SAMPLE_DOMAINS);

    return {
      id: generateId('client'),
      name: companyName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      phone: `+91${this.getRandomNumber(7000000000, 9999999999)}`,
      address: `${this.getRandomNumber(1, 999)} ${this.getRandomElement(['MG Road', 'Park Street', 'Main Street', 'Commercial Complex'])}`,
      city,
      state,
      country: 'India',
      postal_code: String(this.getRandomNumber(100000, 999999)),
      gstin: Math.random() > 0.3 ? this.generateGSTIN() : undefined,
      pan: `${Array(5).fill(0).map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')}${this.getRandomNumber(1000, 9999)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      payment_terms: this.getRandomElement(['Net 15', 'Net 30', 'Net 45', 'Due on Receipt']),
      default_currency: 'INR',
      contact_person: `${firstName} ${lastName}`,
      website: `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      is_active: Math.random() > 0.1,
      created_at: this.getRandomDate(-90, 90),
      updated_at: this.getRandomDate(-30, 30),
      ...overrides
    };
  }

  static generateClients(count: number): Client[] {
    return Array(count).fill(0).map(() => this.generateClient());
  }

  // Project generators
  static generateProject(clientId?: string, overrides: Partial<Project> = {}): Project {
    const startDate = this.getRandomDate(-60, 30);
    const endDate = this.getRandomDate(30, 60);
    const budget = this.getRandomFloat(50000, 500000);

    return {
      id: generateId('project'),
      name: `${this.getRandomElement(['Website', 'Mobile App', 'E-commerce', 'Dashboard', 'API'])} ${this.getRandomElement(['Development', 'Redesign', 'Integration', 'Optimization'])}`,
      client_id: clientId || generateId('client'),
      status: this.getRandomElement(Object.values(ProjectStatus)),
      start_date: startDate,
      end_date: endDate,
      budget,
      actual_cost: Math.random() > 0.5 ? this.getRandomFloat(budget * 0.7, budget * 1.2) : undefined,
      description: this.getRandomElement(this.SAMPLE_DESCRIPTIONS),
      progress_percentage: this.getRandomNumber(0, 100),
      is_billable: Math.random() > 0.2,
      hourly_rate: this.getRandomFloat(1000, 5000),
      currency: 'INR',
      tags: Math.random() > 0.5 ? [
        this.getRandomElement(['web', 'mobile', 'api', 'design', 'backend']),
        this.getRandomElement(['urgent', 'maintenance', 'new-feature', 'bug-fix'])
      ] : undefined,
      created_at: this.getRandomDate(-90, 30),
      updated_at: this.getRandomDate(-30, 0),
      ...overrides
    };
  }

  static generateProjects(count: number, clientIds?: string[]): Project[] {
    return Array(count).fill(0).map((_, index) => {
      const clientId = clientIds ? this.getRandomElement(clientIds) : undefined;
      return this.generateProject(clientId);
    });
  }

  // Task generators
  static generateTask(projectId?: string, overrides: Partial<Task> = {}): Task {
    const estimatedHours = this.getRandomFloat(1, 40);
    const actualHours = Math.random() > 0.3 ? this.getRandomFloat(0, estimatedHours * 1.5) : 0;

    return {
      id: generateId('task'),
      project_id: projectId || generateId('project'),
      title: this.getRandomElement(this.SAMPLE_TASK_TITLES),
      description: `Detailed implementation of ${this.getRandomElement(this.SAMPLE_TASK_TITLES).toLowerCase()}`,
      status: this.getRandomElement(Object.values(TaskStatus)),
      priority: this.getRandomElement(Object.values(TaskPriority)),
      due_date: this.getRandomDate(0, 30),
      estimated_hours: estimatedHours,
      actual_hours: actualHours,
      is_billable: Math.random() > 0.3,
      hourly_rate: Math.random() > 0.5 ? this.getRandomFloat(1000, 5000) : undefined,
      assignee: Math.random() > 0.5 ? `${this.getRandomElement(this.SAMPLE_FIRST_NAMES)} ${this.getRandomElement(this.SAMPLE_LAST_NAMES)}` : undefined,
      tags: Math.random() > 0.6 ? [
        this.getRandomElement(['frontend', 'backend', 'testing', 'design', 'review'])
      ] : undefined,
      created_at: this.getRandomDate(-60, 0),
      updated_at: this.getRandomDate(-30, 0),
      ...overrides
    };
  }

  static generateTasks(count: number, projectIds?: string[]): Task[] {
    return Array(count).fill(0).map(() => {
      const projectId = projectIds ? this.getRandomElement(projectIds) : undefined;
      return this.generateTask(projectId);
    });
  }

  // Time entry generators
  static generateTimeEntry(taskId?: string, projectId?: string, overrides: Partial<TimeEntry> = {}): TimeEntry {
    const hours = this.getRandomFloat(0.5, 8);
    const hourlyRate = this.getRandomFloat(1000, 5000);

    return {
      id: generateId('time'),
      task_id: taskId || generateId('task'),
      project_id: projectId || generateId('project'),
      hours,
      description: `Work on ${this.getRandomElement(this.SAMPLE_TASK_TITLES).toLowerCase()}`,
      date: this.getRandomDate(-30, 0),
      start_time: Math.random() > 0.5 ? `${this.getRandomNumber(9, 17)}:${this.getRandomNumber(0, 59).toString().padStart(2, '0')}` : undefined,
      end_time: Math.random() > 0.5 ? `${this.getRandomNumber(10, 18)}:${this.getRandomNumber(0, 59).toString().padStart(2, '0')}` : undefined,
      is_billable: Math.random() > 0.2,
      hourly_rate: Math.random() > 0.3 ? hourlyRate : undefined,
      total_amount: Math.random() > 0.2 ? hours * hourlyRate : undefined,
      user_id: Math.random() > 0.5 ? generateId('user') : undefined,
      created_at: this.getRandomDate(-30, 0),
      updated_at: this.getRandomDate(-15, 0),
      ...overrides
    };
  }

  static generateTimeEntries(count: number, taskIds?: string[], projectIds?: string[]): TimeEntry[] {
    return Array(count).fill(0).map(() => {
      const taskId = taskIds ? this.getRandomElement(taskIds) : undefined;
      const projectId = projectIds ? this.getRandomElement(projectIds) : undefined;
      return this.generateTimeEntry(taskId, projectId);
    });
  }

  // Expense generators
  static generateExpense(projectId?: string, overrides: Partial<Expense> = {}): Expense {
    const amount = this.getRandomFloat(500, 50000);
    const taxRate = Math.random() > 0.5 ? 18 : 0;

    return {
      id: generateId('expense'),
      project_id: projectId || generateId('project'),
      category: this.getRandomElement(Object.values(ExpenseCategory)),
      amount,
      currency: 'INR',
      description: `${this.getRandomElement(['Purchase of', 'Payment for', 'Expense on'])} ${this.getRandomElement(['software license', 'equipment', 'travel', 'office supplies', 'professional services'])}`,
      date: this.getRandomDate(-60, 0),
      receipt_url: Math.random() > 0.4 ? `https://receipts.example.com/${generateId('receipt')}.pdf` : undefined,
      vendor: Math.random() > 0.3 ? this.getRandomElement(this.SAMPLE_NAMES) : undefined,
      is_billable: Math.random() > 0.6,
      tax_amount: taxRate > 0 ? (amount * taxRate) / 100 : undefined,
      tax_rate: taxRate > 0 ? taxRate : undefined,
      reimbursable: Math.random() > 0.7,
      approval_status: this.getRandomElement(['pending', 'approved', 'rejected']),
      approved_by: Math.random() > 0.5 ? `${this.getRandomElement(this.SAMPLE_FIRST_NAMES)} ${this.getRandomElement(this.SAMPLE_LAST_NAMES)}` : undefined,
      approved_at: Math.random() > 0.5 ? this.getRandomDate(-30, 0) : undefined,
      created_at: this.getRandomDate(-60, 0),
      updated_at: this.getRandomDate(-30, 0),
      ...overrides
    };
  }

  static generateExpenses(count: number, projectIds?: string[]): Expense[] {
    return Array(count).fill(0).map(() => {
      const projectId = projectIds ? this.getRandomElement(projectIds) : undefined;
      return this.generateExpense(projectId);
    });
  }

  // Invoice generators
  static generateInvoiceLineItems(count: number = 3): InvoiceLineItem[] {
    const services = [
      'Web Development', 'Mobile App Development', 'UI/UX Design', 'API Development',
      'Database Design', 'Testing & QA', 'Project Management', 'Consultation'
    ];

    return Array(count).fill(0).map(() => {
      const quantity = this.getRandomFloat(1, 100);
      const unitPrice = this.getRandomFloat(500, 5000);
      const totalPrice = quantity * unitPrice;
      const taxRate = 18;
      const taxAmount = (totalPrice * taxRate) / 100;

      return {
        id: generateId('line'),
        description: this.getRandomElement(services),
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        hsn_sac_code: Math.random() > 0.5 ? '998314' : undefined
      };
    });
  }

  static generateTaxBreakdown(subtotal: number, isInterState: boolean = false): TaxBreakdown {
    if (isInterState) {
      const igstAmount = (subtotal * 18) / 100;
      return {
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 18,
        igst_amount: igstAmount,
        total_tax_amount: igstAmount
      };
    } else {
      const cgstAmount = (subtotal * 9) / 100;
      const sgstAmount = (subtotal * 9) / 100;
      return {
        cgst_rate: 9,
        cgst_amount: cgstAmount,
        sgst_rate: 9,
        sgst_amount: sgstAmount,
        igst_rate: 0,
        igst_amount: 0,
        total_tax_amount: cgstAmount + sgstAmount
      };
    }
  }

  static generateInvoice(clientId?: string, projectId?: string, overrides: Partial<Invoice> = {}): Invoice {
    const lineItems = this.generateInvoiceLineItems(this.getRandomNumber(1, 5));
    const subtotal = lineItems.reduce((sum, item) => sum + item.total_price, 0);
    const taxBreakdown = this.generateTaxBreakdown(subtotal, Math.random() > 0.5);
    const totalAmount = subtotal + taxBreakdown.total_tax_amount;
    const issueDate = this.getRandomDate(-30, 0);
    const dueDate = this.getRandomDate(15, 45);

    return {
      id: generateId('invoice'),
      invoice_number: generateInvoiceNumber(),
      client_id: clientId || generateId('client'),
      project_id: projectId || (Math.random() > 0.3 ? generateId('project') : undefined),
      line_items: lineItems,
      subtotal,
      tax_breakdown: taxBreakdown,
      total_amount: totalAmount,
      currency: 'INR',
      status: this.getRandomElement(Object.values(InvoiceStatus)),
      issue_date: issueDate,
      due_date: dueDate,
      payment_terms: this.getRandomElement(['Net 15', 'Net 30', 'Net 45']),
      notes: Math.random() > 0.5 ? 'Thank you for your business!' : undefined,
      terms_conditions: 'Payment is due within the specified terms. Late payments may incur additional charges.',
      is_recurring: Math.random() > 0.8,
      recurring_frequency: Math.random() > 0.8 ? this.getRandomElement(['monthly', 'quarterly']) : undefined,
      payment_status: this.getRandomElement(Object.values(PaymentStatus)),
      paid_amount: Math.random() > 0.3 ? this.getRandomFloat(0, totalAmount) : 0,
      payment_date: Math.random() > 0.4 ? this.getRandomDate(-15, 15) : undefined,
      payment_method: Math.random() > 0.4 ? this.getRandomElement(['Bank Transfer', 'UPI', 'Credit Card', 'Cash']) : undefined,
      discount_percentage: Math.random() > 0.8 ? this.getRandomFloat(5, 15) : undefined,
      created_at: this.getRandomDate(-60, 0),
      updated_at: this.getRandomDate(-30, 0),
      ...overrides
    };
  }

  static generateInvoices(count: number, clientIds?: string[], projectIds?: string[]): Invoice[] {
    return Array(count).fill(0).map(() => {
      const clientId = clientIds ? this.getRandomElement(clientIds) : undefined;
      const projectId = projectIds ? this.getRandomElement(projectIds) : undefined;
      return this.generateInvoice(clientId, projectId);
    });
  }

  // Complete dataset generator
  static generateCompleteDataset(options: {
    clients?: number;
    projects?: number;
    tasks?: number;
    timeEntries?: number;
    expenses?: number;
    invoices?: number;
  } = {}) {
    const {
      clients = 10,
      projects = 15,
      tasks = 50,
      timeEntries = 100,
      expenses = 30,
      invoices = 20
    } = options;

    // Generate clients first
    const generatedClients = this.generateClients(clients);
    const clientIds = generatedClients.map(c => c.id);

    // Generate projects
    const generatedProjects = this.generateProjects(projects, clientIds);
    const projectIds = generatedProjects.map(p => p.id);

    // Generate tasks
    const generatedTasks = this.generateTasks(tasks, projectIds);
    const taskIds = generatedTasks.map(t => t.id);

    // Generate time entries
    const generatedTimeEntries = this.generateTimeEntries(timeEntries, taskIds, projectIds);

    // Generate expenses
    const generatedExpenses = this.generateExpenses(expenses, projectIds);

    // Generate invoices
    const generatedInvoices = this.generateInvoices(invoices, clientIds, projectIds);

    return {
      clients: generatedClients,
      projects: generatedProjects,
      tasks: generatedTasks,
      timeEntries: generatedTimeEntries,
      expenses: generatedExpenses,
      invoices: generatedInvoices
    };
  }
}