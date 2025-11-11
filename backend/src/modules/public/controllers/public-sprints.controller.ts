import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PublicSprintsService } from '../services/public-sprints.service';
import { PublicSprintDto } from '../dto/public-sprint.dto';
import { PublicRateLimitGuard } from '../guards/public-rate-limit.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Public Sprints')
@Controller('public/workspaces/:workspaceSlug/projects/:projectSlug/sprints')
@UseGuards(PublicRateLimitGuard)
@Public()
export class PublicSprintsController {
  constructor(private readonly publicSprintsService: PublicSprintsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get public project sprints',
    description: 'Get all public sprints for a specific project',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiResponse({ type: [PublicSprintDto] })
  async getSprints(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
  ): Promise<PublicSprintDto[]> {
    return this.publicSprintsService.getPublicSprints(
      workspaceSlug,
      projectSlug,
    );
  }

  @Get(':sprintId')
  @ApiOperation({
    summary: 'Get public sprint details',
    description: 'Get detailed information about a specific public sprint',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ type: PublicSprintDto })
  async getSprint(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Param('sprintId') sprintId: string,
  ): Promise<PublicSprintDto> {
    return this.publicSprintsService.getPublicSprint(
      workspaceSlug,
      projectSlug,
      sprintId,
    );
  }

  @Get(':sprintId/tasks')
  @ApiOperation({
    summary: 'Get public sprint tasks',
    description: 'Get all tasks in a specific public sprint',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ description: 'Array of sprint tasks' })
  async getSprintTasks(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Param('sprintId') sprintId: string,
  ): Promise<any[]> {
    return this.publicSprintsService.getPublicSprintTasks(
      workspaceSlug,
      projectSlug,
      sprintId,
    );
  }
}
