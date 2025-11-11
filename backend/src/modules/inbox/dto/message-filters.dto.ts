import { IsEnum, IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';
import { MessageStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class MessageFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by message status',
    enum: MessageStatus,
  })
  @IsEnum(MessageStatus)
  @IsOptional()
  status?: MessageStatus;

  @ApiPropertyOptional({ description: 'Include spam messages' })
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  includeSpam?: boolean;

  @ApiPropertyOptional({ description: 'Filter by sender email' })
  @IsString()
  @IsOptional()
  fromEmail?: string;

  @ApiPropertyOptional({ description: 'Filter messages after this date' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter messages before this date' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Search in subject and content' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Show converted messages only' })
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  convertedOnly?: boolean;
}
