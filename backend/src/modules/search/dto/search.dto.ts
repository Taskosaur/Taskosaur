import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskType, TaskPriority } from '@prisma/client';

export enum SearchEntityType {
  ALL = 'all',
  TASKS = 'tasks',
  PROJECTS = 'projects',
  USERS = 'users',
  COMMENTS = 'comments',
  ATTACHMENTS = 'attachments',
  SPRINTS = 'sprints',
}

export enum SortBy {
  RELEVANCE = 'relevance',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  PRIORITY = 'priority',
  DUE_DATE = 'dueDate',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GlobalSearchDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'authentication bug fix',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Type of entities to search',
    enum: SearchEntityType,
    example: SearchEntityType.ALL,
    required: false,
    default: SearchEntityType.ALL,
  })
  @IsEnum(SearchEntityType)
  @IsOptional()
  entityType?: SearchEntityType;

  @ApiProperty({
    description: 'Organization ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    description: 'Workspace ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    description: 'Project ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Sort results by field',
    enum: SortBy,
    example: SortBy.RELEVANCE,
    required: false,
    default: SortBy.RELEVANCE,
  })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    required: false,
    default: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;
}

export class AdvancedSearchDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'authentication',
    required: false,
  })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({
    description: 'Task types to include',
    enum: TaskType,
    isArray: true,
    example: [TaskType.BUG, TaskType.STORY],
    required: false,
  })
  @IsArray()
  @IsEnum(TaskType, { each: true })
  @IsOptional()
  taskTypes?: TaskType[];

  @ApiProperty({
    description: 'Task priorities to include',
    enum: TaskPriority,
    isArray: true,
    example: [TaskPriority.HIGH, TaskPriority.HIGHEST],
    required: false,
  })
  @IsArray()
  @IsEnum(TaskPriority, { each: true })
  @IsOptional()
  priorities?: TaskPriority[];

  @ApiProperty({
    description: 'Assignee user IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  @ApiProperty({
    description: 'Reporter user IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174001'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reporterIds?: string[];

  @ApiProperty({
    description: 'Task status IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174002'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  statusIds?: string[];

  @ApiProperty({
    description: 'Label IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174003'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labelIds?: string[];

  @ApiProperty({
    description: 'Sprint IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174004'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sprintIds?: string[];

  @ApiProperty({
    description: 'Due date range start',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dueDateFrom?: string;

  @ApiProperty({
    description: 'Due date range end',
    example: '2024-12-31T23:59:59.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dueDateTo?: string;

  @ApiProperty({
    description: 'Created date range start',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiProperty({
    description: 'Created date range end',
    example: '2024-12-31T23:59:59.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @ApiProperty({
    description: 'Organization ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    description: 'Workspace ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    description: 'Project ID to limit search scope',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Sort results by field',
    enum: SortBy,
    example: SortBy.UPDATED_AT,
    required: false,
    default: SortBy.UPDATED_AT,
  })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    required: false,
    default: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;
}
