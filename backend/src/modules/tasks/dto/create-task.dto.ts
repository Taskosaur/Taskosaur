import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsInt,
  IsUUID,
  IsObject,
  IsArray,
  ArrayUnique,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskType, TaskPriority } from '@prisma/client';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { RecurrenceConfigDto } from './recurrence-config.dto';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Task title/summary',
    example: 'Implement user authentication system',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed task description',
    example:
      'Create a JWT-based authentication system with login, register, and refresh token functionality. Include password hashing and proper error handling.',
    required: false,
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of task',
    enum: TaskType,
    example: TaskType.STORY,
    required: false,
    default: TaskType.TASK,
  })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({
    description: 'Task priority level',
    enum: TaskPriority,
    example: TaskPriority.HIGH,
    required: false,
    default: TaskPriority.MEDIUM,
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({
    description: 'Task start date',
    example: '2024-01-15T09:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Task due date',
    example: '2024-01-30T17:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({
    description: 'Story points for agile estimation',
    example: 8,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsInt()
  @IsOptional()
  storyPoints?: number;

  @ApiProperty({
    description: 'Original time estimate in minutes',
    example: 480,
    minimum: 1,
    required: false,
  })
  @IsInt()
  @IsOptional()
  originalEstimate?: number;

  @ApiProperty({
    description: 'Remaining time estimate in minutes',
    example: 240,
    minimum: 0,
    required: false,
  })
  @IsInt()
  @IsOptional()
  remainingEstimate?: number;

  @ApiProperty({
    description: 'Custom fields specific to the task',
    example: {
      severity: 'critical',
      environment: 'production',
      browser: 'Chrome',
      component: 'authentication',
    },
    required: false,
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    }
    return (value ?? {}) as Record<string, unknown>;
  })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @ApiProperty({
    description: 'ID of the project this task belongs to',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'IDs of users assigned to this task',
    example: ['123e4567-e89b-12d3-a456-426614174002', '223e4567-e89b-12d3-a456-426614174003'],
    type: [String],
    format: 'uuid',
    required: false,
  })
  @Transform(({ value }): string[] => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value.map(String) : [];
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @IsOptional()
  assigneeIds?: string[];

  @ApiProperty({
    description: 'IDs of users who reported/created this task',
    example: ['323e4567-e89b-12d3-a456-426614174004', '423e4567-e89b-12d3-a456-426614174005'],
    type: [String],
    format: 'uuid',
    required: false,
  })
  @Transform(({ value }): string[] => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value.map(String) : [];
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @IsOptional()
  reporterIds?: string[];

  @ApiProperty({
    description: 'ID of the current task status',
    example: '123e4567-e89b-12d3-a456-426614174004',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  statusId: string;

  @ApiProperty({
    description: 'ID of the sprint this task is assigned to',
    example: '123e4567-e89b-12d3-a456-426614174005',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  sprintId?: string;

  @ApiProperty({
    description: 'ID of the parent task (for subtasks)',
    example: '123e4567-e89b-12d3-a456-426614174006',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  parentTaskId?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Date when task was completed',
    example: '2025-08-20T10:00:00Z',
    required: false,
  })
  completedAt?: string | null;

  @ApiProperty({
    description: 'Whether to allow email replies for this task',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowEmailReplies?: boolean;

  @ApiProperty({
    description: 'Whether this task is recurring',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Recurrence configuration for recurring tasks',
    type: RecurrenceConfigDto,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return plainToInstance(RecurrenceConfigDto, parsed, {
          enableImplicitConversion: true,
          exposeDefaultValues: true,
        });
      } catch {
        return undefined;
      }
    }

    if (value && typeof value === 'object') {
      return plainToInstance(RecurrenceConfigDto, value, {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
      });
    }

    return undefined;
  })
  @Type(() => RecurrenceConfigDto)
  @ValidateNested()
  @IsOptional()
  recurrenceConfig?: RecurrenceConfigDto;
}
