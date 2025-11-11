import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, ProjectPriority } from '@prisma/client';

export class PublicWorkspaceDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;
}

export class PublicProjectStatsDto {
  @ApiProperty()
  taskCount: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  hasActiveSprints: boolean;
}

export class PublicProjectDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  color?: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty({ enum: ProjectStatus, required: false })
  status?: ProjectStatus;

  @ApiProperty({ enum: ProjectPriority, required: false })
  priority?: ProjectPriority;

  @ApiProperty()
  visibility: string;

  @ApiProperty({ required: false })
  startDate?: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  workspace: any;

  @ApiProperty({ required: false })
  organization?: any;

  @ApiProperty({ required: false })
  stats?: PublicProjectStatsDto;

  @ApiProperty({ description: 'Indicates this is public view data' })
  isPublicView: boolean;
}
