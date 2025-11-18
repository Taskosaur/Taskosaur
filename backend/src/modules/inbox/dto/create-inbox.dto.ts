import { IsString, IsBoolean, IsEnum, IsOptional, IsUUID, IsEmail } from 'class-validator';
import { TaskType, TaskPriority } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInboxDto {
  @ApiProperty({ description: 'Name of the inbox' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the inbox' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Email address for this inbox' })
  @IsEmail()
  @IsOptional()
  emailAddress?: string;

  @ApiPropertyOptional({ description: 'Email signature to append to replies' })
  @IsString()
  @IsOptional()
  emailSignature?: string;

  @ApiPropertyOptional({ description: 'Enable auto-reply to incoming emails' })
  @IsBoolean()
  @IsOptional()
  autoReplyEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Auto-reply template' })
  @IsString()
  @IsOptional()
  autoReplyTemplate?: string;

  @ApiPropertyOptional({ description: 'Sync interval in minutes' })
  @IsString()
  syncInterval?: string;

  @ApiPropertyOptional({
    description: 'Automatically create tasks from emails',
  })
  @IsBoolean()
  @IsOptional()
  autoCreateTask?: boolean;

  @ApiPropertyOptional({
    description: 'Default task type for created tasks',
    enum: TaskType,
  })
  @IsEnum(TaskType)
  @IsOptional()
  defaultTaskType?: TaskType;

  @ApiPropertyOptional({
    description: 'Default priority for created tasks',
    enum: TaskPriority,
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  defaultPriority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Default status ID for created tasks' })
  @IsUUID()
  defaultStatusId: string;

  @ApiPropertyOptional({ description: 'Default assignee ID for created tasks' })
  @IsUUID()
  @IsOptional()
  defaultAssigneeId?: string;

  @ApiPropertyOptional({ description: 'Reject unauthorized certificates for IMAP' })
  @IsBoolean()
  @IsOptional()
  imapTlsRejectUnauth?: boolean;

  @ApiPropertyOptional({ description: 'Minimum TLS version for IMAP' })
  @IsString()
  @IsOptional()
  imapTlsMinVersion?: string;

  @ApiPropertyOptional({ description: 'SNI hostname for IMAP TLS validation' })
  @IsString()
  @IsOptional()
  imapServername?: string;

  @ApiPropertyOptional({ description: 'Reject unauthorized certificates for SMTP' })
  @IsBoolean()
  @IsOptional()
  smtpTlsRejectUnauth?: boolean;

  @ApiPropertyOptional({ description: 'Minimum TLS version for SMTP' })
  @IsString()
  @IsOptional()
  smtpTlsMinVersion?: string;

  @ApiPropertyOptional({ description: 'SNI hostname for SMTP TLS validation' })
  @IsString()
  @IsOptional()
  smtpServername?: string;

  @ApiPropertyOptional({ description: 'Force STARTTLS upgrade' })
  @IsBoolean()
  @IsOptional()
  smtpRequireTls?: boolean;
}

export class UpdateInboxDto extends CreateInboxDto {}
