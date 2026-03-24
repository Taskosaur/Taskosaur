import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskType, TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';

export class BulkTaskItem {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class BulkCreateTasksDto {
  @ApiProperty({ description: 'Project ID to create tasks in' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Status ID for all created tasks' })
  @IsUUID()
  @IsNotEmpty()
  statusId: string;

  @ApiProperty({ description: 'Sprint ID for all created tasks', required: false })
  @IsUUID()
  @IsOptional()
  sprintId?: string;

  @ApiProperty({ description: 'Array of tasks to create', type: [BulkTaskItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTaskItem)
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  tasks: BulkTaskItem[];
}
