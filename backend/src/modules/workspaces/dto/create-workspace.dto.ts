import { IsString, IsOptional, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'The name of the workspace',
    example: 'Product Development',
    minLength: 1,
    maxLength: 100,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The unique slug identifier for the workspace (used in URLs)',
    example: 'product-development',
    pattern: '^[a-z0-9-]+$',
    minLength: 1,
    maxLength: 50,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({
    description: 'Optional description of the workspace',
    example: 'Workspace for managing product development projects and tasks',
    maxLength: 500,
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Optional avatar URL for the workspace',
    example: 'https://example.com/avatars/workspace-avatar.png',
    format: 'uri',
    maxLength: 500,
    required: false,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'Optional color theme for the workspace in hexadecimal format',
    example: '#3B82F6',
    format: 'hex-color',
    pattern: '^#[0-9A-Fa-f]{6}$',
    required: false,
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    description: 'Optional settings configuration for the workspace',
    example: {
      notifications: {
        email: true,
        slack: false,
      },
      defaultTaskAssignee: 'project-manager',
      timeTracking: true,
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'The unique identifier of the organization this workspace belongs to',
    example: 'b8d3f4e5-2345-6789-0abc-def123456789',
    format: 'uuid',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
