import { TimeEntry } from '../TimeEntry';

describe('TimeEntry Model', () => {
  const validTimeEntryData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    task_id: '550e8400-e29b-41d4-a716-446655440001',
    project_id: '550e8400-e29b-41d4-a716-446655440002',
    hours: 8,
    description: 'Working on feature implementation',
    date: '2024-01-15',
    start_time: '09:00',
    end_time: '17:00',
    is_billable: true,
    hourly_rate: 1500,
    user_id: '550e8400-e29b-41d4-a716-446655440003'
  };

  describe('Constructor', () => {
    it('should create a time entry with valid data', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      expect(timeEntry.hours).toBe(8);
      expect(timeEntry.description).toBe('Working on feature implementation');
      expect(timeEntry.is_billable).toBe(true);
      expect(timeEntry.created_at).toBeDefined();
      expect(timeEntry.updated_at).toBeDefined();
    });

    it('should calculate total amount for billable entry', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      expect(timeEntry.total_amount).toBe(12000); // 8 * 1500
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        new TimeEntry({ ...validTimeEntryData, hours: -1 });
      }).toThrow('Invalid time entry data');
    });

    it('should throw error with invalid time range', () => {
      expect(() => {
        new TimeEntry({
          ...validTimeEntryData,
          start_time: '17:00',
          end_time: '09:00'
        });
      }).toThrow('Invalid time entry data');
    });
  });

  describe('Business Logic Methods', () => {
    let timeEntry: TimeEntry;

    beforeEach(() => {
      timeEntry = new TimeEntry(validTimeEntryData);
    });

    describe('calculateTotalAmount', () => {
      it('should calculate total amount with hourly rate', () => {
        expect(timeEntry.calculateTotalAmount()).toBe(12000);
      });

      it('should use default hourly rate when entry rate not provided', () => {
        timeEntry.hourly_rate = undefined;
        expect(timeEntry.calculateTotalAmount(2000)).toBe(16000);
      });

      it('should return 0 for non-billable entry', () => {
        timeEntry.is_billable = false;
        expect(timeEntry.calculateTotalAmount()).toBe(0);
      });

      it('should return 0 when no rates provided', () => {
        timeEntry.hourly_rate = undefined;
        expect(timeEntry.calculateTotalAmount()).toBe(0);
      });
    });

    describe('updateTotalAmount', () => {
      it('should update total amount and timestamp', async () => {
        const originalUpdatedAt = timeEntry.updated_at;
        timeEntry.hours = 10;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        timeEntry.updateTotalAmount();
        
        expect(timeEntry.total_amount).toBe(15000);
        expect(timeEntry.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('Time Calculation Methods', () => {
      it('should calculate hours from time range', () => {
        timeEntry.start_time = '09:00';
        timeEntry.end_time = '17:30';
        
        const calculatedHours = timeEntry.calculateHoursFromTimeRange();
        expect(calculatedHours).toBe(8.5);
      });

      it('should return current hours if no time range', () => {
        timeEntry.start_time = undefined;
        timeEntry.end_time = undefined;
        
        const calculatedHours = timeEntry.calculateHoursFromTimeRange();
        expect(calculatedHours).toBe(8);
      });

      it('should update hours from time range', () => {
        timeEntry.start_time = '10:00';
        timeEntry.end_time = '16:00';
        
        timeEntry.updateHoursFromTimeRange();
        
        expect(timeEntry.hours).toBe(6);
        expect(timeEntry.total_amount).toBe(9000); // 6 * 1500
      });

      it('should set time range and update hours', () => {
        timeEntry.setTimeRange('08:30', '17:30');
        
        expect(timeEntry.start_time).toBe('08:30');
        expect(timeEntry.end_time).toBe('17:30');
        expect(timeEntry.hours).toBe(9);
      });
    });

    describe('Validation Methods', () => {
      it('should validate time range', () => {
        expect(timeEntry.isValidTimeRange()).toBe(true);
      });

      it('should return true for missing time range', () => {
        timeEntry.start_time = undefined;
        timeEntry.end_time = undefined;
        expect(timeEntry.isValidTimeRange()).toBe(true);
      });

      it('should return false for invalid time range', () => {
        timeEntry.start_time = '17:00';
        timeEntry.end_time = '09:00';
        expect(timeEntry.isValidTimeRange()).toBe(false);
      });

      it('should check if entry is today', () => {
        const today = new Date().toISOString().split('T')[0];
        timeEntry.date = today;
        expect(timeEntry.isToday()).toBe(true);
        
        timeEntry.date = '2020-01-01';
        expect(timeEntry.isToday()).toBe(false);
      });

      it('should check if entry is this week', () => {
        const today = new Date();
        const thisWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));
        timeEntry.date = thisWeek.toISOString().split('T')[0];
        expect(timeEntry.isThisWeek()).toBe(true);
      });

      it('should check if entry is this month', () => {
        const today = new Date();
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 15);
        timeEntry.date = thisMonth.toISOString().split('T')[0];
        expect(timeEntry.isThisMonth()).toBe(true);
      });
    });

    describe('Billing Methods', () => {
      it('should mark as billed', () => {
        const invoiceId = 'invoice_123';
        timeEntry.markAsBilled(invoiceId);
        
        expect(timeEntry.invoice_id).toBe(invoiceId);
        expect(timeEntry.isBilled()).toBe(true);
      });

      it('should check if billed', () => {
        expect(timeEntry.isBilled()).toBe(false);
        
        timeEntry.invoice_id = 'invoice_123';
        expect(timeEntry.isBilled()).toBe(true);
      });

      it('should toggle billable status', () => {
        expect(timeEntry.is_billable).toBe(true);
        
        timeEntry.toggleBillable();
        expect(timeEntry.is_billable).toBe(false);
        expect(timeEntry.total_amount).toBe(0);
        
        timeEntry.toggleBillable();
        expect(timeEntry.is_billable).toBe(true);
        expect(timeEntry.total_amount).toBe(12000);
      });

      it('should update hourly rate', () => {
        timeEntry.updateHourlyRate(2000);
        
        expect(timeEntry.hourly_rate).toBe(2000);
        expect(timeEntry.total_amount).toBe(16000);
      });
    });

    describe('Formatting Methods', () => {
      it('should format duration correctly', () => {
        timeEntry.hours = 8.5;
        expect(timeEntry.getFormattedDuration()).toBe('8h 30m');
        
        timeEntry.hours = 8;
        expect(timeEntry.getFormattedDuration()).toBe('8h');
        
        timeEntry.hours = 0.5;
        expect(timeEntry.getFormattedDuration()).toBe('30m');
      });

      it('should format time range', () => {
        expect(timeEntry.getFormattedTimeRange()).toBe('09:00 - 17:00');
        
        timeEntry.start_time = undefined;
        timeEntry.end_time = undefined;
        expect(timeEntry.getFormattedTimeRange()).toBe('');
      });

      it('should format date', () => {
        const formattedDate = timeEntry.getFormattedDate();
        expect(formattedDate).toBeDefined();
        expect(typeof formattedDate).toBe('string');
      });
    });
  });

  describe('Static Summary Methods', () => {
    const sampleEntries = [
      new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440010', hours: 8, is_billable: true, total_amount: 12000 }),
      new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440011', hours: 6, is_billable: true, total_amount: 9000 }),
      new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440012', hours: 4, is_billable: false, total_amount: 0 })
    ];

    it('should calculate total hours', () => {
      const totalHours = TimeEntry.calculateTotalHours(sampleEntries);
      expect(totalHours).toBe(18);
    });

    it('should calculate total billable hours', () => {
      const billableHours = TimeEntry.calculateTotalBillableHours(sampleEntries);
      expect(billableHours).toBe(14);
    });

    it('should calculate total amount', () => {
      const totalAmount = TimeEntry.calculateTotalAmount(sampleEntries);
      expect(totalAmount).toBe(21000);
    });

    it('should group by date', () => {
      const grouped = TimeEntry.groupByDate(sampleEntries);
      expect(grouped['2024-01-15T00:00:00.000Z']).toBeDefined();
      expect(grouped['2024-01-15T00:00:00.000Z']).toHaveLength(3);
    });

    it('should group by project', () => {
      const entries = [
        new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440010', project_id: '550e8400-e29b-41d4-a716-446655440020' }),
        new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440011', project_id: '550e8400-e29b-41d4-a716-446655440020' }),
        new TimeEntry({ ...validTimeEntryData, id: '550e8400-e29b-41d4-a716-446655440012', project_id: '550e8400-e29b-41d4-a716-446655440021' })
      ];
      
      const grouped = TimeEntry.groupByProject(entries);
      expect(grouped['550e8400-e29b-41d4-a716-446655440020']).toHaveLength(2);
      expect(grouped['550e8400-e29b-41d4-a716-446655440021']).toHaveLength(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const timeEntry = new TimeEntry(validTimeEntryData);
      const json = timeEntry.toJSON();
      
      expect(json.hours).toBe(8);
      expect(json.description).toBe('Working on feature implementation');
      expect(json.is_billable).toBe(true);
      expect(json.total_amount).toBe(12000);
    });

    it('should deserialize from JSON correctly', () => {
      const timeEntry = TimeEntry.fromJSON(validTimeEntryData);
      
      expect(timeEntry).toBeInstanceOf(TimeEntry);
      expect(timeEntry.hours).toBe(8);
      expect(timeEntry.description).toBe('Working on feature implementation');
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = TimeEntry.validate(validTimeEntryData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = TimeEntry.validate({ ...validTimeEntryData, hours: -1 });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});