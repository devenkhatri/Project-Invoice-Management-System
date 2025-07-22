import { SHEET_CONFIGURATIONS } from '../initializeSheets';

describe('Sheet Configurations', () => {
  test('should have all required sheets defined', () => {
    const expectedSheets = ['Projects', 'Tasks', 'Clients', 'Invoices', 'Time_Entries', 'Expenses'];
    const actualSheets = SHEET_CONFIGURATIONS.map(config => config.name);
    
    expect(actualSheets).toEqual(expect.arrayContaining(expectedSheets));
    expect(actualSheets).toHaveLength(expectedSheets.length);
  });

  test('should have proper headers for Projects sheet', () => {
    const projectsConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Projects');
    expect(projectsConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'name', 'client_id', 'status', 'start_date', 'end_date', 
      'budget', 'description', 'created_at', 'updated_at'
    ];
    
    expect(projectsConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have proper headers for Tasks sheet', () => {
    const tasksConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Tasks');
    expect(tasksConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'project_id', 'title', 'description', 'status', 'priority', 
      'due_date', 'estimated_hours', 'actual_hours', 'created_at'
    ];
    
    expect(tasksConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have proper headers for Clients sheet', () => {
    const clientsConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Clients');
    expect(clientsConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'name', 'email', 'phone', 'address', 'gstin', 'payment_terms', 'created_at'
    ];
    
    expect(clientsConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have proper headers for Invoices sheet', () => {
    const invoicesConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Invoices');
    expect(invoicesConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'invoice_number', 'client_id', 'project_id', 'amount', 'tax_amount', 
      'total_amount', 'status', 'due_date', 'created_at'
    ];
    
    expect(invoicesConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have proper headers for Time_Entries sheet', () => {
    const timeEntriesConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Time_Entries');
    expect(timeEntriesConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'task_id', 'project_id', 'hours', 'description', 'date', 'created_at'
    ];
    
    expect(timeEntriesConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have proper headers for Expenses sheet', () => {
    const expensesConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Expenses');
    expect(expensesConfig).toBeDefined();
    
    const expectedHeaders = [
      'id', 'project_id', 'category', 'amount', 'description', 'date', 'receipt_url'
    ];
    
    expect(expensesConfig?.headers).toEqual(expectedHeaders);
  });

  test('should have sample data for all sheets', () => {
    SHEET_CONFIGURATIONS.forEach(config => {
      expect(config.sampleData).toBeDefined();
      expect(Array.isArray(config.sampleData)).toBe(true);
      expect(config.sampleData.length).toBeGreaterThan(0);
    });
  });

  test('sample data should have valid structure', () => {
    const projectsConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Projects');
    const sampleProject = projectsConfig?.sampleData[0] as any;
    
    expect(sampleProject).toHaveProperty('name');
    expect(sampleProject).toHaveProperty('client_id');
    expect(sampleProject).toHaveProperty('status');
    expect(sampleProject).toHaveProperty('budget');
    expect(typeof sampleProject?.budget).toBe('number');
  });

  test('invoice sample data should have proper GST calculations', () => {
    const invoicesConfig = SHEET_CONFIGURATIONS.find(config => config.name === 'Invoices');
    const sampleInvoice = invoicesConfig?.sampleData[0] as any;
    
    expect(sampleInvoice).toHaveProperty('amount');
    expect(sampleInvoice).toHaveProperty('tax_amount');
    expect(sampleInvoice).toHaveProperty('total_amount');
    
    // Verify GST calculation (18% GST)
    const expectedTax = sampleInvoice?.amount * 0.18;
    const expectedTotal = sampleInvoice?.amount + expectedTax;
    
    expect(sampleInvoice?.tax_amount).toBe(expectedTax);
    expect(sampleInvoice?.total_amount).toBe(expectedTotal);
  });
});