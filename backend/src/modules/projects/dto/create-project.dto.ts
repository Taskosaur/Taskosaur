import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsObject,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, ProjectPriority, ProjectVisibility } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'E-commerce Platform Redesign',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'project-slug',
    example: 'e-commerce-platform-redesign',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    description: 'Project color theme (hex code)',
    example: '#3498db',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({
    description: 'URL to project avatar/icon',
    example: 'https://example.com/projects/ecom-icon.png',
  })
  @IsString()
  @IsOptional()
  avatar: string;

  @ApiProperty({
    description: 'Project description and objectives',
    example:
      'Complete redesign of the e-commerce platform to improve user experience, increase conversion rates, and modernize the technology stack.',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Current project status',
    enum: ProjectStatus,
    example: ProjectStatus.PLANNING,
    required: false,
    default: ProjectStatus.PLANNING,
  })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiProperty({
    description: 'Project priority level',
    enum: ProjectPriority,
    example: ProjectPriority.MEDIUM,
    required: false,
    default: ProjectPriority.MEDIUM,
  })
  @IsEnum(ProjectPriority)
  @IsOptional()
  priority?: ProjectPriority;

  @ApiProperty({
    description: 'Project start date',
    example: '2024-02-01T00:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Project end date',
    example: '2024-06-30T23:59:59.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Project configuration settings',
    example: {
      methodology: 'agile',
      defaultTaskType: 'STORY',
      enableTimeTracking: true,
      allowSubtasks: true,
      workflowId: 'default',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'ID of the workspace this project belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false,
  })
  @IsString()
  workspaceId: string;

  @ApiProperty({
    description:
      'ID of the workflow to use for this project (if not provided, organization default will be used)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  workflowId?: string;

  @ApiProperty({
    description: 'Project visibility level',
    enum: ProjectVisibility,
    example: ProjectVisibility.PRIVATE,
    required: false,
    default: ProjectVisibility.PRIVATE,
  })
  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;
}
