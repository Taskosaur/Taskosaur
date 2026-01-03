import {
  IsEnum,
  IsOptional,
  IsInt,
  IsArray,
  IsDateString,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RecurrenceType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum RecurrenceEndType {
  NEVER = 'NEVER',
  ON_DATE = 'ON_DATE',
  AFTER_OCCURRENCES = 'AFTER_OCCURRENCES',
}

export class RecurrenceConfigDto {
  @ApiProperty({
    enum: RecurrenceType,
    example: RecurrenceType.WEEKLY,
    description: 'Type of recurrence pattern',
  })
  @IsEnum(RecurrenceType)
  recurrenceType: RecurrenceType;

  @ApiProperty({
    example: 1,
    description: 'Interval between occurrences (e.g., every 2 weeks)',
    default: 1,
  })
  @IsInt()
  @Min(1)
  interval: number;

  @ApiProperty({
    example: [1, 3, 5],
    description: 'Days of week for WEEKLY recurrence (0=Sunday, 6=Saturday)',
    required: false,
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  daysOfWeek?: number[];

  @ApiProperty({
    example: 15,
    description: 'Day of month for MONTHLY/QUARTERLY/YEARLY recurrence (1-31)',
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  dayOfMonth?: number;

  @ApiProperty({
    example: 3,
    description: 'Month of year for YEARLY recurrence (1-12)',
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  monthOfYear?: number;

  @ApiProperty({
    enum: RecurrenceEndType,
    example: RecurrenceEndType.NEVER,
    description: 'When the recurrence should end',
  })
  @IsEnum(RecurrenceEndType)
  endType: RecurrenceEndType;

  @ApiProperty({
    example: '2025-12-31T00:00:00Z',
    description: 'Date when recurrence ends (required if endType is ON_DATE)',
    required: false,
  })
  @IsDateString()
  @ValidateIf((o) => o.endType === RecurrenceEndType.ON_DATE)
  endDate?: string;

  @ApiProperty({
    example: 10,
    description: 'Number of occurrences (required if endType is AFTER_OCCURRENCES)',
    required: false,
  })
  @IsInt()
  @Min(1)
  @ValidateIf((o) => o.endType === RecurrenceEndType.AFTER_OCCURRENCES)
  occurrenceCount?: number;
}
