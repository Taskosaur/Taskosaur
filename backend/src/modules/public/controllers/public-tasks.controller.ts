import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  PublicTasksService,
  PublicTaskFilters,
} from '../services/public-tasks.service';
import { PublicTaskDto, PublicTaskPaginationDto } from '../dto/public-task.dto';
import {
  PublicRateLimitGuard,
} from '../guards/public-rate-limit.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Public Tasks')
@Controller('public/project-tasks')
@UseGuards(PublicRateLimitGuard)
@Public()
export class PublicTasksController {
  constructor(private readonly publicTasksService: PublicTasksService) {}

  @Get(':workspaceSlug/projects/:projectSlug/tasks')
  @ApiOperation({
    summary: 'Get public project tasks',
    description: 'Get all public tasks for a specific project',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiQuery({
    name: 'limit',
    description: 'Number of tasks to return',
    required: false,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of tasks to skip',
    required: false,
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by status name',
    required: false,
  })
  @ApiQuery({
    name: 'priority',
    description: 'Filter by priority',
    required: false,
  })
  @ApiQuery({
    name: 'type',
    description: 'Filter by task type',
    required: false,
  })
  @ApiQuery({
    name: 'parentTaskId',
    required: false,
    description: 'Filter by parent task ID',
  })
  @ApiResponse({ type: PublicTaskPaginationDto })
  async getTasks(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('type') type?: string,
  ): Promise<PublicTaskPaginationDto> {
    const filters: PublicTaskFilters = {
      parentTaskId,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      status,
      priority,
      type,
    };

    return this.publicTasksService.getPublicTasks(
      workspaceSlug,
      projectSlug,
      filters,
    );
  }

  @Get(':workspaceSlug/projects/:projectSlug/taskskanban')
  @ApiOperation({
    summary: 'Get public project tasks in kanban format',
    description: 'Get all public tasks organized by status columns',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiResponse({ description: 'Kanban board data with columns and tasks' })
  async getTasksKanban(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
  ): Promise<any> {
    return this.publicTasksService.getPublicTasksKanban(
      workspaceSlug,
      projectSlug,
    );
  }

  @Get(':taskId')
  @ApiOperation({
    summary: 'Get public task details',
    description: 'Get detailed information about a specific public task',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ type: PublicTaskDto })
  async getTask(@Param('taskId') taskId: string): Promise<any> {
    return this.publicTasksService.getPublicTask(taskId);
  }
  @Get('activities/:taskId')
  @ApiOperation({
    summary: 'Get public task activities',
    description: 'Get all activities related to a specific public task',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  async getTaskActivities(
    @Param('taskId') taskId: string,
    @Query('limit') limit: string = '50',
    @Query('page') page: string = '1',
  ) {
    const limitNum = parseInt(limit, 10) || 50;
    const pageNum = parseInt(page, 10) || 1;
    return this.publicTasksService.getTaskActivities(taskId, pageNum, limitNum);
  }

  @Get('comments/:taskId')
  @ApiOperation({
    summary: 'Get public task comments',
    description: 'Get all comments related to a specific public task',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ type: PublicTaskDto })
  async getTaskComments(@Param('taskId') taskId: string) {
    return this.publicTasksService.getPublicTaskComments(taskId);
  }

  @Get('attachments/:taskId')
  @ApiOperation({
    summary: 'Get public task attachments',
    description: 'Get all attachments related to a specific public task',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ type: PublicTaskDto })
  async getTaskAttachments(@Param('taskId') taskId: string) {
    return this.publicTasksService.getPublicTaskAttachment(taskId);
  }
}
