import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicCalendarService } from '../services/public-calendar.service';
import { PublicRateLimitGuard } from '../guards/public-rate-limit.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Public Calendar')
@Controller('public/workspaces/:workspaceSlug/projects/:projectSlug/calendar')
@UseGuards(PublicRateLimitGuard)
@Public()
export class PublicCalendarController {
  constructor(private readonly publicCalendarService: PublicCalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Get public project calendar events',
    description: 'Get calendar events (tasks and sprints) for a public project',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for events (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for events (YYYY-MM-DD)',
    required: false,
  })
  @ApiResponse({ description: 'Array of calendar events' })
  async getCalendarEvents(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any[]> {
    return this.publicCalendarService.getPublicCalendarEvents(
      workspaceSlug,
      projectSlug,
      startDate,
      endDate,
    );
  }
}
