import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTimeEntryDto {
  @ApiProperty({
    description: 'Description of the work performed',
    example: 'Implemented JWT authentication middleware and tested login functionality',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Time spent in minutes',
    example: 120,
    minimum: 1,
    maximum: 1440, // 24 hours max
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  timeSpent: number;

  @ApiProperty({
    description: 'Start time of the work session',
    example: '2024-01-15T09:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({
    description: 'End time of the work session',
    example: '2024-01-15T11:00:00.000Z',
    format: 'date-time',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({
    description: 'Date when the work was performed',
    example: '2024-01-15T00:00:00.000Z',
    format: 'date-time',
    required: false,
    default: 'Current date',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({
    description: 'ID of the task this time entry is for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({
    description: 'ID of the user who logged this time',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
