import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, IsUUID, IsOptional, IsBoolean, IsString } from 'class-validator';

export class BulkDeleteTasksDto {
  @ApiPropertyOptional({
    description: 'Array of task IDs to delete',
    example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one task ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each task ID must be a valid UUID' })
  taskIds?: string[];

  @ApiPropertyOptional({ description: 'Project ID', example: 'project-123' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Delete all tasks under the given filters',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
