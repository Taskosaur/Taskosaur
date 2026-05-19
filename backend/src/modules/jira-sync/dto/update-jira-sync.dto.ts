import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateJiraSyncDto {
  @ApiPropertyOptional({ description: 'Enable or disable automatic sync', example: true })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Sync interval in minutes', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  @Type(() => Number)
  syncInterval?: number;

  @ApiPropertyOptional({
    description: 'Map Jira status IDs to Taskosaur status IDs',
    example: { '10001': 'status-uuid-here' },
  })
  @IsOptional()
  statusMappings?: Record<string, string>;
}
