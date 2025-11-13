import { IsNotEmpty, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DependencyType } from '@prisma/client';

export class CreateTaskDependencyDto {
  @ApiProperty({
    description: 'Type of dependency relationship',
    enum: DependencyType,
    example: DependencyType.BLOCKS,
    default: DependencyType.BLOCKS,
  })
  @IsEnum(DependencyType)
  @IsOptional()
  type?: DependencyType;

  @ApiProperty({
    description: 'ID of the task that depends on another task',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  dependentTaskId: string;

  @ApiProperty({
    description: 'ID of the task that blocks the dependent task',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  blockingTaskId: string;

  @ApiProperty({
    description: 'ID of the user creating this dependency',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  createdBy: string;
}

export class BulkCreateDependenciesDto {
  @ApiProperty({
    description: 'Array of task dependencies to create',
    type: [CreateTaskDependencyDto],
    example: [
      {
        type: DependencyType.BLOCKS,
        dependentTaskId: '123e4567-e89b-12d3-a456-426614174000',
        blockingTaskId: '123e4567-e89b-12d3-a456-426614174001',
        createdBy: '123e4567-e89b-12d3-a456-426614174002',
      },
    ],
  })
  @IsNotEmpty()
  dependencies: CreateTaskDependencyDto[];
}
