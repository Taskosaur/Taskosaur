import { IsString, IsOptional, IsNotEmpty, IsUrl, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DefaultWorkspaceDto {
  @ApiProperty({
    description: 'Workspace name',
    example: 'Main Workspace',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class DefaultProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'First Project',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Organization description',
    example: 'Leading technology company focused on innovative solutions for modern businesses.',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'URL to organization avatar/logo',
    example: 'https://example.com/logos/acme-corp.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'Organization website URL',
    example: 'https://www.acme-corp.com',
    format: 'url',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiProperty({
    description: 'Organization configuration settings',
    example: {
      theme: 'light',
      timezone: 'UTC',
      workingHours: { start: '09:00', end: '17:00' },
      features: { timeTracking: true, sprints: true },
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'ID of the user who owns this organization',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({
    description: 'Default workspace configuration',
    required: false,
    type: DefaultWorkspaceDto,
  })
  @IsOptional()
  defaultWorkspace?: DefaultWorkspaceDto;

  @ApiProperty({
    description: 'Default project configuration',
    required: false,
    type: DefaultProjectDto,
  })
  @IsOptional()
  defaultProject?: DefaultProjectDto;
}
