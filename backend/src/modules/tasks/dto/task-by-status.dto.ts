// task-by-status.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCategory, TaskPriority } from '@prisma/client';

// Enums
export enum TasksByStatusType {
  PROJECT = 'project',
  WORKSPACE = 'workspace',
}

export class GetTasksByStatusQueryDto {
  @ApiProperty({
    description: 'Type of container (project or workspace)',
    enum: TasksByStatusType,
    example: TasksByStatusType.PROJECT,
  })
  @IsEnum(TasksByStatusType)
  type: TasksByStatusType;

  @ApiProperty({
    description: 'ID of the project or workspace',
    example: 'slug name',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Filter tasks by assignee user ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Include subtasks in the results',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): any => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeSubtasks?: boolean;

  @ApiPropertyOptional({
    description: 'Filter tasks by sprint ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
}

// Nested DTOs for task response
export class TaskAssigneeDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class TaskReporterDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  lastName: string;
}

export class TaskItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174003' })
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'Implement user authentication' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Create JWT-based authentication system' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskPriority, example: TaskPriority.HIGH })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiProperty({ example: 42 })
  @IsNumber()
  taskNumber: number;

  @ApiPropertyOptional({ type: TaskAssigneeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskAssigneeDto)
  assignee?: TaskAssigneeDto;

  @ApiProperty({ type: TaskReporterDto })
  @ValidateNested()
  @Type(() => TaskReporterDto)
  reporter: TaskReporterDto;

  @ApiPropertyOptional({
    example: '2024-12-31T23:59:59.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  createdAt: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  updatedAt: string;
}

// Main response DTO - matches the return type of your function
export class TasksByStatusDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174004',
    description: 'Status ID',
  })
  @IsString()
  @IsUUID()
  statusId: string;

  @ApiProperty({
    example: 'To Do',
    description: 'Status name',
  })
  @IsString()
  statusName: string;

  @ApiProperty({
    example: '#6366f1',
    description: 'Status color (hex code)',
  })
  @IsString()
  statusColor: string;

  @ApiProperty({
    enum: StatusCategory,
    example: StatusCategory.TODO,
    description: 'Status category',
  })
  @IsEnum(StatusCategory)
  statusCategory: StatusCategory;

  @ApiProperty({
    type: [TaskItemDto],
    description: 'List of tasks in this status',
  })
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  tasks: TaskItemDto[];

  @ApiProperty({
    example: 5,
    description: 'Number of tasks in this status',
  })
  @IsNumber()
  _count: number;
}

// Interface for service layer return type (matches your function exactly)
export interface TasksByStatus {
  statusId: string;
  statusName: string;
  statusColor: string;
  statusCategory: StatusCategory;
  tasks: {
    id: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    taskNumber: number;
    assignees?:
      | {
          id: string;
          firstName: string;
          lastName: string;
          avatar?: string;
        }[]
      | undefined;
    reporters?:
      | {
          id: string;
          firstName: string;
          lastName: string;
          avatar?: string;
        }[]
      | undefined;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
export class StatusPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
export class TasksByStatusParams {
  @ApiProperty({
    description: 'Project slug',
    example: 'my-awesome-project',
    required: true,
  })
  @IsString()
  slug: string;
  @ApiPropertyOptional({
    description: 'Filter by specific sprint ID',
    example: 'sprint-123',
    type: String,
  })
  @IsOptional()
  @IsString()
  sprintId?: string;

  @ApiPropertyOptional({
    description: 'Include subtasks in the results',
    example: false,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }): any => value === 'true' || value === true)
  @IsBoolean()
  includeSubtasks?: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter by specific status ID. If not provided, returns all statuses',
    example: 'clx123abc',
    type: String,
  })
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (works with statusId or applies to all statuses)',
    example: 1,
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of tasks per page',
    example: 25,
    default: 25,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
// Response wrapper (if you want to add metadata)
export class GetTasksByStatusResponseDto {
  @ApiProperty({
    type: [TasksByStatusDto],
    description: 'Tasks grouped by status',
  })
  @ValidateNested({ each: true })
  @Type(() => TasksByStatusDto)
  data: TasksByStatusDto[];

  @ApiProperty({
    example: 16,
    description: 'Total number of tasks across all statuses',
  })
  @IsNumber()
  totalTasks: number;

  @ApiProperty({
    example: 4,
    description: 'Number of different statuses',
  })
  @IsNumber()
  totalStatuses: number;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp when data was fetched',
  })
  @IsOptional()
  @IsDateString()
  fetchedAt?: string;
}
