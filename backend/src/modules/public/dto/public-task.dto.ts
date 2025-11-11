import { ApiProperty } from '@nestjs/swagger';
import { TaskType, TaskPriority } from '@prisma/client';

export class PublicTaskStatusDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  category: string;
}

export class PublicTaskLabelDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  color: string;
}

export class PublicTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ enum: TaskType })
  type: TaskType;

  @ApiProperty({ enum: TaskPriority })
  priority: TaskPriority;

  @ApiProperty({ required: false })
  dueDate?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  status: PublicTaskStatusDto;

  @ApiProperty({ type: [PublicTaskLabelDto], required: false })
  labels?: PublicTaskLabelDto[];

  @ApiProperty({ type: [PublicTaskDto], required: false })
  subtasks?: PublicTaskDto[];

  @ApiProperty({ description: 'Indicates this is public view data' })
  isPublicView: boolean;
}

export class PublicTaskPaginationDto {
  @ApiProperty({ type: [PublicTaskDto] })
  data: PublicTaskDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
