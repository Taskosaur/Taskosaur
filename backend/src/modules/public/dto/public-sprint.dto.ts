import { ApiProperty } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';
import { PublicTaskDto } from './public-task.dto';

export class PublicSprintDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ enum: SprintStatus })
  status: SprintStatus;

  @ApiProperty({ required: false })
  startDate?: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [PublicTaskDto], required: false })
  tasks?: PublicTaskDto[];

  @ApiProperty({ description: 'Sprint progress percentage' })
  progress: number;

  @ApiProperty({ description: 'Indicates this is public view data' })
  isPublicView: boolean;
}

export class PublicSprintStatsDto {
  @ApiProperty()
  totalTasks: number;

  @ApiProperty()
  completedTasks: number;

  @ApiProperty()
  progress: number;
}
