import { TimeEntry } from '../TimeEntry';

describe('TimeEntry Model', () => {
  const validTimeEntryData = {
    task_id: '123e4567-e89b-12d3-a456-426614174000',
    project_id: '123e4567-e89b-12d3-a456-426614174001',
    hours: 4.5,
    description: 'Working on feature implementation',
    date: new Date('2024-01-15')
  };

  describe('Constructor', () => {
    it('should create a time entry with valid data', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      
      expect(timeEntry.task_id).toBe(validTimeEntryData.task_id);
      expect(timeEntry.project_id).toBe(validTimeEntryData.project_id);
      expect(timeEntry.hours).toBe(validTimeEntryData.hours);
      expect(timeEntry.description).toBe(validTimeEntryData.description);
      expect(timeEntry.id).toBeDefined();
      expect(timeEntry.id).toMatch(/^time_/);
    });

    it('should set default values correctly', () => {
      const timeEntry = new TimeEntry({
        task_id: validTimeEntryData.task_id,
        project_id: validTimeEntryData.project_id
      });
      
      expect(timeEntry.hours).toBe(0);
      expect(timeEntry.description).toBe('');
      expect(timeEntry.date).toBeInstanceOf(Date);
    });
  });

  describe('Validation', () => {
    it('should validate a valid time entry', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      const result = timeEntry.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty task_id', () => {
      const timeEntry = new TimeEntry({ ...validTimeEntryData, task_id: '' });
      const result = timeEntry.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'task_id',
          message: 'Task ID is required'
        })
      );
    });

    it('should fail validation for empty project_id', () => {
      const timeEntry = new TimeEntry({ ...validTimeEntryData, project_id: '' });
      const result = timeEntry.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'project_id',
          message: 'Project ID is required'
        })
      );
    });

    it('should fail validation for hours less than 0.1', () => {
      const timeEntry = new TimeEntry({ ...validTimeEntryData, hours: 0.05 });
      const result = timeEntry.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'hours',
          message: 'Hours must be at least 0.1'
        })
      );
    });

    it('should fail validation for hours greater than 24', () => {
      const timeEntry = new TimeEntry({ ...validTimeEntryData, hours: 25 });
      const result = timeEntry.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'hours',
          message: 'Hours cannot exceed 24 per day'
        })
      );
    });
  });

  describe('Business Logic Methods', () => {
    let timeEntry: TimeEntry;

    beforeEach(() => {
      timeEntry = new TimeEntry(validTimeEntryData);
    });

    it('should correctly identify if entry is today', () => {
      const today = new Date();
      timeEntry.date = today;
      expect(timeEntry.isToday()).toBe(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      timeEntry.date = yesterday;
      expect(timeEntry.isToday()).toBe(false);
    });

    it('should correctly identify if entry is this week', () => {
      const today = new Date();
      timeEntry.date = today;
      expect(timeEntry.isThisWeek()).toBe(true);
    });

    it('should correctly identify if entry is this month', () => {
      const today = new Date();
      timeEntry.date = today;
      expect(timeEntry.isThisMonth()).toBe(true);

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      timeEntry.date = lastMonth;
      expect(timeEntry.isThisMonth()).toBe(false);
    });

    it('should format hours correctly', () => {
      timeEntry.hours = 4.5;
      expect(timeEntry.getFormattedHours()).toBe('4h 30m');

      timeEntry.hours = 3;
      expect(timeEntry.getFormattedHours()).toBe('3h');

      timeEntry.hours = 0.25;
      expect(timeEntry.getFormattedHours()).toBe('0h 15m');
    });

    it('should update hours correctly', () => {
      timeEntry.updateHours(6.5);
      expect(timeEntry.hours).toBe(6.5);
    });

    it('should throw error for invalid hours when updating', () => {
      expect(() => timeEntry.updateHours(0.05)).toThrow('Hours must be at least 0.1');
      expect(() => timeEntry.updateHours(25)).toThrow('Hours cannot exceed 24 per day');
    });

    it('should update description correctly', () => {
      const newDescription = 'Updated description';
      timeEntry.updateDescription(newDescription);
      expect(timeEntry.description).toBe(newDescription);
    });

    it('should update date correctly', () => {
      const newDate = new Date('2024-02-15');
      timeEntry.updateDate(newDate);
      expect(timeEntry.date).toEqual(newDate);
    });

    it('should calculate billable amount correctly', () => {
      timeEntry.hours = 4.5;
      const hourlyRate = 100;
      expect(timeEntry.calculateBillableAmount(hourlyRate)).toBe(450);
    });

    it('should check if entry is within date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      timeEntry.date = new Date('2024-01-15');
      
      expect(timeEntry.isWithinDateRange(startDate, endDate)).toBe(true);

      timeEntry.date = new Date('2024-02-15');
      expect(timeEntry.isWithinDateRange(startDate, endDate)).toBe(false);
    });
  });

  describe('Static Methods', () => {
    const entries = [
      new TimeEntry({ ...validTimeEntryData, hours: 4 }),
      new TimeEntry({ ...validTimeEntryData, hours: 3.5 }),
      new TimeEntry({ ...validTimeEntryData, hours: 2.5 })
    ];

    it('should calculate total hours correctly', () => {
      const total = TimeEntry.calculateTotalHours(entries);
      expect(total).toBe(10);
    });

    it('should group entries by date correctly', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      
      entries[0].date = date1;
      entries[1].date = date1;
      entries[2].date = date2;
      
      const grouped = TimeEntry.groupByDate(entries);
      
      expect(grouped.size).toBe(2);
      expect(grouped.get(date1.toDateString())).toHaveLength(2);
      expect(grouped.get(date2.toDateString())).toHaveLength(1);
    });

    it('should filter entries by date range correctly', () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');
      
      entries[0].date = new Date('2024-01-15');
      entries[1].date = new Date('2024-01-25'); // Outside range
      entries[2].date = new Date('2024-01-12');
      
      const filtered = TimeEntry.filterByDateRange(entries, startDate, endDate);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      const row = timeEntry.toSheetRow();
      
      expect(row.task_id).toBe(timeEntry.task_id);
      expect(row.project_id).toBe(timeEntry.project_id);
      expect(row.hours).toBe(timeEntry.hours);
      expect(row.description).toBe(timeEntry.description);
      expect(typeof row.date).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        task_id: '123e4567-e89b-12d3-a456-426614174001',
        project_id: '123e4567-e89b-12d3-a456-426614174002',
        hours: '6.5',
        description: 'Sheet time entry',
        date: '2024-01-15T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const timeEntry = TimeEntry.fromSheetRow(sheetRow);
      
      expect(timeEntry.id).toBe(sheetRow.id);
      expect(timeEntry.task_id).toBe(sheetRow.task_id);
      expect(timeEntry.hours).toBe(6.5);
      expect(timeEntry.date).toBeInstanceOf(Date);
    });
  });
});