import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'The name of the workflow',
    example: 'Software Development Workflow',
    minLength: 1,
    maxLength: 100,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Optional description of the workflow',
    example:
      'Standard workflow for software development projects with stages from planning to deployment',
    maxLength: 500,
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether this workflow should be set as the default workflow for the organization',
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({
    description: 'The unique identifier of the organization this workflow belongs to',
    example: 'c9e4f5d6-3456-7890-1bcd-ef0123456789',
    format: 'uuid',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
