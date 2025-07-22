import { z } from 'zod';
import { BaseModel, ValidationResult, ValidationError } from './types';

// Communication types
export enum CommunicationType {
  EMAIL = 'email',
  PHONE = 'phone',
  MEETING = 'meeting',
  CHAT = 'chat',
  NOTE = 'note'
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound'
}

// TypeScript interface for Communication
export interface ICommunication extends BaseModel {
  client_id: string;
  project_id?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject: string;
  content: string;
  contact_person?: string;
  follow_up_required: boolean;
  follow_up_date?: Date;
  attachments?: string[];
}

// Zod schema for validation
export const CommunicationSchema = z.object({
  id: z.string().min(1).optional(),
  client_id: z.string().min(1, 'Client ID is required'),
  project_id: z.string().optional(),
  type: z.nativeEnum(CommunicationType),
  direction: z.nativeEnum(CommunicationDirection),
  subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  contact_person: z.string().max(255, 'Contact person name too long').optional(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.date().optional(),
  attachments: z.array(z.string()).optional().default([]),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// Communication model class with business logic
export class Communication implements ICommunication {
  id: string;
  client_id: string;
  project_id?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject: string;
  content: string;
  contact_person?: string;
  follow_up_required: boolean;
  follow_up_date?: Date;
  attachments: string[];
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<ICommunication>) {
    this.id = data.id || this.generateId();
    this.client_id = data.client_id || '';
    this.project_id = data.project_id;
    this.type = data.type || CommunicationType.NOTE;
    this.direction = data.direction || CommunicationDirection.OUTBOUND;
    this.subject = data.subject || '';
    this.content = data.content || '';
    this.contact_person = data.contact_person;
    this.follow_up_required = data.follow_up_required || false;
    this.follow_up_date = data.follow_up_date;
    this.attachments = data.attachments || [];
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'comm_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      CommunicationSchema.parse(this);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        return { isValid: false, errors };
      }
      return { 
        isValid: false, 
        errors: [{ field: 'general', message: 'Validation failed', code: 'unknown' }] 
      };
    }
  }

  // Business logic methods
  isFollowUpDue(): boolean {
    if (!this.follow_up_required || !this.follow_up_date) {
      return false;
    }
    return this.follow_up_date <= new Date();
  }

  isFollowUpOverdue(): boolean {
    if (!this.follow_up_required || !this.follow_up_date) {
      return false;
    }
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - this.follow_up_date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > 0;
  }

  getDaysUntilFollowUp(): number {
    if (!this.follow_up_required || !this.follow_up_date) {
      return 0;
    }
    const now = new Date();
    const daysDiff = Math.floor((this.follow_up_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  }

  hasAttachments(): boolean {
    return this.attachments.length > 0;
  }

  addAttachment(url: string): void {
    if (!this.attachments.includes(url)) {
      this.attachments.push(url);
      this.updated_at = new Date();
    }
  }

  removeAttachment(url: string): void {
    const index = this.attachments.indexOf(url);
    if (index > -1) {
      this.attachments.splice(index, 1);
      this.updated_at = new Date();
    }
  }

  markFollowUpComplete(): void {
    this.follow_up_required = false;
    this.follow_up_date = undefined;
    this.updated_at = new Date();
  }

  setFollowUp(date: Date): void {
    this.follow_up_required = true;
    this.follow_up_date = date;
    this.updated_at = new Date();
  }

  getTypeIcon(): string {
    switch (this.type) {
      case CommunicationType.EMAIL:
        return '📧';
      case CommunicationType.PHONE:
        return '📞';
      case CommunicationType.MEETING:
        return '🤝';
      case CommunicationType.CHAT:
        return '💬';
      case CommunicationType.NOTE:
        return '📝';
      default:
        return '📄';
    }
  }

  getDirectionIcon(): string {
    return this.direction === CommunicationDirection.INBOUND ? '⬇️' : '⬆️';
  }

  getSummary(): string {
    const maxLength = 100;
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength) + '...';
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      client_id: this.client_id,
      project_id: this.project_id || '',
      type: this.type,
      direction: this.direction,
      subject: this.subject,
      content: this.content,
      contact_person: this.contact_person || '',
      follow_up_required: this.follow_up_required,
      follow_up_date: this.follow_up_date ? this.follow_up_date.toISOString() : '',
      attachments: this.attachments.join(','),
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Communication {
    return new Communication({
      id: row.id,
      client_id: row.client_id,
      project_id: row.project_id || undefined,
      type: row.type as CommunicationType,
      direction: row.direction as CommunicationDirection,
      subject: row.subject,
      content: row.content,
      contact_person: row.contact_person || undefined,
      follow_up_required: row.follow_up_required === 'true' || row.follow_up_required === true,
      follow_up_date: row.follow_up_date ? new Date(row.follow_up_date) : undefined,
      attachments: row.attachments ? row.attachments.split(',').filter((a: string) => a.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }
}