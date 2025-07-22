import { Communication, CommunicationType, CommunicationDirection } from '../Communication';

describe('Communication Model', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create a communication with default values', () => {
      const comm = new Communication({
        client_id: 'client-1',
        subject: 'Test Subject',
        content: 'Test content'
      });

      expect(comm.id).toBeDefined();
      expect(comm.client_id).toBe('client-1');
      expect(comm.subject).toBe('Test Subject');
      expect(comm.content).toBe('Test content');
      expect(comm.type).toBe(CommunicationType.NOTE);
      expect(comm.direction).toBe(CommunicationDirection.OUTBOUND);
      expect(comm.follow_up_required).toBe(false);
      expect(comm.attachments).toEqual([]);
      expect(comm.created_at).toBeInstanceOf(Date);
      expect(comm.updated_at).toBeInstanceOf(Date);
    });

    it('should create a communication with all properties', () => {
      const followUpDate = new Date('2024-02-01');
      const comm = new Communication({
        id: 'comm-1',
        client_id: 'client-1',
        project_id: 'project-1',
        type: CommunicationType.EMAIL,
        direction: CommunicationDirection.INBOUND,
        subject: 'Project Update',
        content: 'Here is the latest update on the project',
        contact_person: 'John Doe',
        follow_up_required: true,
        follow_up_date: followUpDate,
        attachments: ['file1.pdf', 'file2.doc']
      });

      expect(comm.id).toBe('comm-1');
      expect(comm.client_id).toBe('client-1');
      expect(comm.project_id).toBe('project-1');
      expect(comm.type).toBe(CommunicationType.EMAIL);
      expect(comm.direction).toBe(CommunicationDirection.INBOUND);
      expect(comm.subject).toBe('Project Update');
      expect(comm.content).toBe('Here is the latest update on the project');
      expect(comm.contact_person).toBe('John Doe');
      expect(comm.follow_up_required).toBe(true);
      expect(comm.follow_up_date).toEqual(followUpDate);
      expect(comm.attachments).toEqual(['file1.pdf', 'file2.doc']);
    });
  });

  describe('Validation', () => {
    it('should validate a valid communication', () => {
      const comm = new Communication({
        client_id: 'client-1',
        subject: 'Test Subject',
        content: 'Test content',
        type: CommunicationType.EMAIL,
        direction: CommunicationDirection.OUTBOUND
      });

      const validation = comm.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const comm = new Communication({});

      const validation = comm.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      const errorFields = validation.errors.map(e => e.field);
      expect(errorFields).toContain('client_id');
      expect(errorFields).toContain('subject');
      expect(errorFields).toContain('content');
    });

    it('should fail validation for invalid communication type', () => {
      const comm = new Communication({
        client_id: 'client-1',
        subject: 'Test Subject',
        content: 'Test content',
        type: 'invalid-type' as CommunicationType
      });

      const validation = comm.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.field === 'type')).toBe(true);
    });

    it('should fail validation for content that is too long', () => {
      const longContent = 'a'.repeat(5001);
      const comm = new Communication({
        client_id: 'client-1',
        subject: 'Test Subject',
        content: longContent
      });

      const validation = comm.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.field === 'content')).toBe(true);
    });
  });

  describe('Business Logic Methods', () => {
    describe('Follow-up Management', () => {
      it('should correctly identify when follow-up is due', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          follow_up_required: true,
          follow_up_date: pastDate
        });

        expect(comm.isFollowUpDue()).toBe(true);
        expect(comm.isFollowUpOverdue()).toBe(true);
      });

      it('should correctly identify when follow-up is not due', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          follow_up_required: true,
          follow_up_date: futureDate
        });

        expect(comm.isFollowUpDue()).toBe(false);
        expect(comm.isFollowUpOverdue()).toBe(false);
      });

      it('should return false for follow-up when not required', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          follow_up_required: false
        });

        expect(comm.isFollowUpDue()).toBe(false);
        expect(comm.isFollowUpOverdue()).toBe(false);
      });

      it('should calculate days until follow-up correctly', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 5);

        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          follow_up_required: true,
          follow_up_date: futureDate
        });

        expect(comm.getDaysUntilFollowUp()).toBe(5);
      });

      it('should mark follow-up as complete', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          follow_up_required: true,
          follow_up_date: new Date()
        });

        comm.markFollowUpComplete();

        expect(comm.follow_up_required).toBe(false);
        expect(comm.follow_up_date).toBeUndefined();
      });

      it('should set follow-up date', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test'
        });

        const followUpDate = new Date('2024-02-01');
        comm.setFollowUp(followUpDate);

        expect(comm.follow_up_required).toBe(true);
        expect(comm.follow_up_date).toEqual(followUpDate);
      });
    });

    describe('Attachment Management', () => {
      it('should add attachments', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test'
        });

        comm.addAttachment('file1.pdf');
        comm.addAttachment('file2.doc');

        expect(comm.attachments).toEqual(['file1.pdf', 'file2.doc']);
        expect(comm.hasAttachments()).toBe(true);
      });

      it('should not add duplicate attachments', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test'
        });

        comm.addAttachment('file1.pdf');
        comm.addAttachment('file1.pdf');

        expect(comm.attachments).toEqual(['file1.pdf']);
      });

      it('should remove attachments', () => {
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          attachments: ['file1.pdf', 'file2.doc']
        });

        comm.removeAttachment('file1.pdf');

        expect(comm.attachments).toEqual(['file2.doc']);
      });
    });

    describe('Display Methods', () => {
      it('should return correct type icons', () => {
        const emailComm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          type: CommunicationType.EMAIL
        });

        const phoneComm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          type: CommunicationType.PHONE
        });

        expect(emailComm.getTypeIcon()).toBe('📧');
        expect(phoneComm.getTypeIcon()).toBe('📞');
      });

      it('should return correct direction icons', () => {
        const inboundComm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          direction: CommunicationDirection.INBOUND
        });

        const outboundComm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: 'Test',
          direction: CommunicationDirection.OUTBOUND
        });

        expect(inboundComm.getDirectionIcon()).toBe('⬇️');
        expect(outboundComm.getDirectionIcon()).toBe('⬆️');
      });

      it('should return summary for long content', () => {
        const longContent = 'a'.repeat(150);
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: longContent
        });

        const summary = comm.getSummary();
        expect(summary.length).toBe(103); // 100 chars + '...'
        expect(summary.endsWith('...')).toBe(true);
      });

      it('should return full content for short content', () => {
        const shortContent = 'Short content';
        const comm = new Communication({
          client_id: 'client-1',
          subject: 'Test',
          content: shortContent
        });

        const summary = comm.getSummary();
        expect(summary).toBe(shortContent);
      });
    });
  });

  describe('Sheet Conversion', () => {
    it('should convert to sheet row correctly', () => {
      const followUpDate = new Date('2024-02-01');
      const comm = new Communication({
        id: 'comm-1',
        client_id: 'client-1',
        project_id: 'project-1',
        type: CommunicationType.EMAIL,
        direction: CommunicationDirection.INBOUND,
        subject: 'Test Subject',
        content: 'Test content',
        contact_person: 'John Doe',
        follow_up_required: true,
        follow_up_date: followUpDate,
        attachments: ['file1.pdf', 'file2.doc']
      });

      const row = comm.toSheetRow();

      expect(row.id).toBe('comm-1');
      expect(row.client_id).toBe('client-1');
      expect(row.project_id).toBe('project-1');
      expect(row.type).toBe('email');
      expect(row.direction).toBe('inbound');
      expect(row.subject).toBe('Test Subject');
      expect(row.content).toBe('Test content');
      expect(row.contact_person).toBe('John Doe');
      expect(row.follow_up_required).toBe(true);
      expect(row.follow_up_date).toBe(followUpDate.toISOString());
      expect(row.attachments).toBe('file1.pdf,file2.doc');
    });

    it('should create from sheet row correctly', () => {
      const row = {
        id: 'comm-1',
        client_id: 'client-1',
        project_id: 'project-1',
        type: 'email',
        direction: 'inbound',
        subject: 'Test Subject',
        content: 'Test content',
        contact_person: 'John Doe',
        follow_up_required: true,
        follow_up_date: '2024-02-01T00:00:00.000Z',
        attachments: 'file1.pdf,file2.doc',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const comm = Communication.fromSheetRow(row);

      expect(comm.id).toBe('comm-1');
      expect(comm.client_id).toBe('client-1');
      expect(comm.project_id).toBe('project-1');
      expect(comm.type).toBe(CommunicationType.EMAIL);
      expect(comm.direction).toBe(CommunicationDirection.INBOUND);
      expect(comm.subject).toBe('Test Subject');
      expect(comm.content).toBe('Test content');
      expect(comm.contact_person).toBe('John Doe');
      expect(comm.follow_up_required).toBe(true);
      expect(comm.follow_up_date).toEqual(new Date('2024-02-01T00:00:00.000Z'));
      expect(comm.attachments).toEqual(['file1.pdf', 'file2.doc']);
    });

    it('should handle empty attachments in sheet row', () => {
      const row = {
        id: 'comm-1',
        client_id: 'client-1',
        type: 'note',
        direction: 'outbound',
        subject: 'Test',
        content: 'Test',
        attachments: '',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const comm = Communication.fromSheetRow(row);
      expect(comm.attachments).toEqual([]);
    });
  });
});