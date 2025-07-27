import { Project, Task, Client, Invoice, TimeEntry, Expense, InvoiceLineItem, TaxBreakdown } from '../types';
export declare class MockDataGenerator {
    private static readonly SAMPLE_NAMES;
    private static readonly SAMPLE_FIRST_NAMES;
    private static readonly SAMPLE_LAST_NAMES;
    private static readonly SAMPLE_CITIES;
    private static readonly SAMPLE_STATES;
    private static readonly SAMPLE_DOMAINS;
    private static readonly SAMPLE_TASK_TITLES;
    private static readonly SAMPLE_DESCRIPTIONS;
    private static getRandomElement;
    private static getRandomNumber;
    private static getRandomFloat;
    private static getRandomDate;
    private static generateGSTIN;
    static generateClient(overrides?: Partial<Client>): Client;
    static generateClients(count: number): Client[];
    static generateProject(clientId?: string, overrides?: Partial<Project>): Project;
    static generateProjects(count: number, clientIds?: string[]): Project[];
    static generateTask(projectId?: string, overrides?: Partial<Task>): Task;
    static generateTasks(count: number, projectIds?: string[]): Task[];
    static generateTimeEntry(taskId?: string, projectId?: string, overrides?: Partial<TimeEntry>): TimeEntry;
    static generateTimeEntries(count: number, taskIds?: string[], projectIds?: string[]): TimeEntry[];
    static generateExpense(projectId?: string, overrides?: Partial<Expense>): Expense;
    static generateExpenses(count: number, projectIds?: string[]): Expense[];
    static generateInvoiceLineItems(count?: number): InvoiceLineItem[];
    static generateTaxBreakdown(subtotal: number, isInterState?: boolean): TaxBreakdown;
    static generateInvoice(clientId?: string, projectId?: string, overrides?: Partial<Invoice>): Invoice;
    static generateInvoices(count: number, clientIds?: string[], projectIds?: string[]): Invoice[];
    static generateCompleteDataset(options?: {
        clients?: number;
        projects?: number;
        tasks?: number;
        timeEntries?: number;
        expenses?: number;
        invoices?: number;
    }): {
        clients: Client[];
        projects: Project[];
        tasks: Task[];
        timeEntries: TimeEntry[];
        expenses: Expense[];
        invoices: Invoice[];
    };
}
//# sourceMappingURL=mockData.d.ts.map