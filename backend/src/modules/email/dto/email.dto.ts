import { IsEmail, IsString, IsOptional, IsEnum, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EmailTemplate {
  TASK_ASSIGNED = 'task-assigned',
  TASK_STATUS_CHANGED = 'task-status-changed',
  DUE_DATE_REMINDER = 'due-date-reminder',
  TASK_OVERDUE = 'task-overdue',
  COMMENT_ADDED = 'comment-added',
  WEEKLY_SUMMARY = 'weekly-summary',
  SPRINT_STARTED = 'sprint-started',
  SPRINT_COMPLETED = 'sprint-completed',
  PASSWORD_RESET = 'password-reset',
  PASSWORD_RESET_CONFIRMATION = 'password-reset-confirmation',
  SEND_INVITATION = 'send-invitation',
  INVITATION_ACCEPTED = 'invitation-accepted',
  INVITATION_DECLINED = 'invitation-declined',
  INVITATION_EXPIRED = 'invitation-expired',
  DIRECT_ADD_NOTIFICATION = 'direct_add_notification',
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email template to use', enum: EmailTemplate })
  @IsEnum(EmailTemplate)
  template: EmailTemplate;

  @ApiProperty({ description: 'Template data', type: Object })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    description: 'Email priority',
    enum: EmailPriority,
    required: false,
  })
  @IsEnum(EmailPriority)
  @IsOptional()
  priority?: EmailPriority = EmailPriority.NORMAL;

  @ApiProperty({ description: 'Delay in milliseconds', required: false })
  @IsOptional()
  delay?: number;
}

export class BulkEmailDto {
  @ApiProperty({ description: 'Recipient email addresses', type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email template to use', enum: EmailTemplate })
  @IsEnum(EmailTemplate)
  template: EmailTemplate;

  @ApiProperty({ description: 'Template data', type: Object })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    description: 'Email priority',
    enum: EmailPriority,
    required: false,
  })
  @IsEnum(EmailPriority)
  @IsOptional()
  priority?: EmailPriority = EmailPriority.NORMAL;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
  userId?: string;
  organizationId?: string;
  priority: EmailPriority;
}
