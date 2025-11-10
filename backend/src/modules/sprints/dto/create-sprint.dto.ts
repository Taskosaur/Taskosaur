import { IsString, IsOptional, IsNotEmpty, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';

export class CreateSprintDto {
  @ApiProperty({
    description: 'Sprint name',
    example: 'Sprint 1 - Authentication & User Management',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Sprint goal and objectives',
    example:
      'Complete user authentication system, implement JWT tokens, and create user management dashboard with role-based permissions.',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  goal?: string;

  @ApiProperty({
    description: 'Current sprint status',
    enum: SprintStatus,
    example: SprintStatus.PLANNING,
    required: false,
    default: SprintStatus.PLANNING,
  })
  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;

  @ApiProperty({
    description: 'Sprint start date',
    example: '2024-02-01T09:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Sprint end date',
    example: '2024-02-14T17:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'ID of the project this sprint belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;
}
