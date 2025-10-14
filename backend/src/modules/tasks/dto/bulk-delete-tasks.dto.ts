// src/modules/tasks/dto/bulk-delete-tasks.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class BulkDeleteTasksDto {
  @ApiProperty({
    description: 'Array of task IDs to delete',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one task ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each task ID must be a valid UUID' })
  taskIds: string[];
}
