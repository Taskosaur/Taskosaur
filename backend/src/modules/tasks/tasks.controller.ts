import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { getAuthUser } from 'src/common/request.utils';
import { Request } from 'express';
import {
  NotificationPriority,
  NotificationType,
  TaskPriority,
  Role,
} from '@prisma/client';
import { AutoNotify } from 'src/common/decorator/auto-notify.decorator';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';
import {
  GetTasksByStatusQueryDto,
  GetTasksByStatusResponseDto,
  TasksByStatusParams,
} from './dto/task-by-status.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Scope } from 'src/common/decorator/scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Scope('PROJECT', 'projectId')
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  @LogActivity({
    type: 'TASK_CREATED',
    entityType: 'Task',
    description: 'Create a new task',
    includeOldValue: false,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_ASSIGNED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'New Task Created',
    message: 'A new task has been created and assigned to you',
  })
  create(@Req() req: Request, @Body() createTaskDto: CreateTaskDto) {
    const user = getAuthUser(req);
    return this.tasksService.create(createTaskDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks with filters' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID (required)',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter by project ID',
  })
  @ApiQuery({
    name: 'sprintId',
    required: false,
    description: 'Filter by sprint ID',
  })
  @ApiQuery({
    name: 'workspaceId',
    required: false,
    description: 'Filter by workspace ID',
  })
  @ApiQuery({
    name: 'parentTaskId',
    required: false,
    description: 'Filter by parent task ID',
  })
  @ApiQuery({
    name: 'priorities',
    required: false,
    description: 'Filter by priorities (comma-separated)',
    example: 'HIGH,MEDIUM',
  })
  @ApiQuery({
    name: 'statuses',
    required: false,
    description: 'Filter by status IDs (comma-separated)',
    example: 'status-1,status-2',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter by search query',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size / limit (default: 20)',
    example: 20,
  })
  @Scope('ORGANIZATION', 'organizationId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findAll(
    @CurrentUser() user: any,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('projectId') projectId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('priorities') priorities?: string,
    @Query('statuses') statuses?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    const priorityArray = priorities
      ? priorities.split(',').filter(Boolean)
      : undefined;
    const statusArray = statuses
      ? statuses.split(',').filter(Boolean)
      : undefined;

    let projectIdArray: string[] | undefined = undefined;
    if (projectId) {
      projectIdArray = projectId.split(',').filter(Boolean);
    }

    let workspaceIdArray: string[] | undefined = undefined;
    if (workspaceId) {
      workspaceIdArray = workspaceId.split(',').filter(Boolean);
    }

    return this.tasksService.findAll(
      organizationId,
      projectIdArray,
      sprintId,
      workspaceIdArray,
      parentTaskId,
      priorityArray,
      statusArray,
      user.id,
      search,
      Number(page),
      Number(limit),
    );
  }

  @Get('all-tasks')
  @ApiOperation({ summary: 'Get all tasks with filters (no pagination)' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID (required)',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter by project ID',
  })
  @ApiQuery({
    name: 'sprintId',
    required: false,
    description: 'Filter by sprint ID',
  })
  @ApiQuery({
    name: 'workspaceId',
    required: false,
    description: 'Filter by workspace ID',
  })
  @ApiQuery({
    name: 'parentTaskId',
    required: false,
    description: 'Filter by parent task ID',
  })
  @ApiQuery({
    name: 'priorities',
    required: false,
    description: 'Filter by priorities (comma-separated)',
    example: 'HIGH,MEDIUM',
  })
  @ApiQuery({
    name: 'statuses',
    required: false,
    description: 'Filter by status IDs (comma-separated)',
    example: 'status-1,status-2',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter by search query',
  })
  @Scope('ORGANIZATION', 'organizationId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getTasks(
    @CurrentUser() user: any,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('projectId') projectId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('priorities') priorities?: string,
    @Query('statuses') statuses?: string,
    @Query('search') search?: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    const priorityArray = priorities
      ? priorities.split(',').filter(Boolean)
      : undefined;
    const statusArray = statuses
      ? statuses.split(',').filter(Boolean)
      : undefined;
    const projectIdArray = projectId
      ? projectId.split(',').filter(Boolean)
      : undefined;
    const workspaceIdArray = workspaceId
      ? workspaceId.split(',').filter(Boolean)
      : undefined;

    return this.tasksService.getTasks(
      organizationId,
      projectIdArray,
      sprintId,
      workspaceIdArray,
      parentTaskId,
      priorityArray,
      statusArray,
      user.id,
      search,
    );
  }

  @Get('by-status')
  @ApiOperation({ summary: 'Get tasks grouped by status' })
  @ApiResponse({ status: 200, type: GetTasksByStatusResponseDto })
  @Scope('PROJECT', 'slug')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  async getTasksByStatus(
    @Query() query: TasksByStatusParams,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    const tasks = await this.tasksService.getTasksGroupedByStatus(
      query,
      user.id,
    );

    return {
      data: tasks,
      totalTasks: tasks.reduce((sum, status) => sum + status._count, 0),
      totalStatuses: tasks.length,
      fetchedAt: new Date().toISOString(),
    };
  }

  @Get('today')
  @ApiOperation({
    summary: "Get today's tasks filtered by assignee/reporter and organization",
  })
  @Scope('ORGANIZATION', 'organizationId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getTodaysTasks(
    @Query('organizationId') organizationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: Request,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      throw new BadRequestException(
        `Invalid organization ID format: ${organizationId}. Expected UUID.`,
      );
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100);

    const user = getAuthUser(req);

    return this.tasksService.findTodaysTasks(
      organizationId,
      {
        assigneeId: user.id,
        reporterId: user.id,
        userId: user.id,
      },
      validatedPage,
      validatedLimit,
      user.id,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.tasksService.findOne(id, user.id);
  }

  @Get('key/:key')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findByKey(@Param('key') key: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.tasksService.findByKey(key, user.id);
  }

  @Get('organization/:orgId')
  @Scope('ORGANIZATION', 'orgId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getTasksByOrganization(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: Request,
    @Query('priority') priority?: TaskPriority,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const user = getAuthUser(req);
    const assigneeId = user.id;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100);

    return this.tasksService.findByOrganization(
      orgId,
      assigneeId,
      priority,
      search,
      validatedPage,
      validatedLimit,
      user.id,
    );
  }

  @Patch(':id')
  @LogActivity({
    type: 'TASK_UPDATED',
    entityType: 'Task',
    description: 'Updated task details',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_STATUS_CHANGED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'Task Updated',
    message: 'A task you are involved in has been updated',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, updateTaskDto, user.id);
  }

  @Patch(':id/status')
  @LogActivity({
    type: 'TASK_STATUS_CHANGED',
    entityType: 'Task',
    description: 'Changed task status',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_STATUS_CHANGED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'Task Status Updated',
    message: 'Task status has been changed',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('statusId', ParseUUIDPipe) statusId: string,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { statusId }, user.id);
  }

  @Patch(':id/assignee')
  @LogActivity({
    type: 'TASK_ASSIGNED',
    entityType: 'Task',
    description: 'Changed task assignee',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_ASSIGNED,
    entityType: 'Task',
    priority: NotificationPriority.HIGH,
    title: 'Task Assigned',
    message: 'You have been assigned to a new task',
  })
  updateAssignee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assigneeId', ParseUUIDPipe) assigneeId: string,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { assigneeId }, user.id);
  }

  @Patch(':id/unassign')
  @LogActivity({
    type: 'TASK_ASSIGNED',
    entityType: 'Task',
    description: 'Unassigned task',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_ASSIGNED,
    entityType: 'Task',
    priority: NotificationPriority.LOW,
    title: 'Task Unassigned',
    message: 'You have been unassigned from a task',
  })
  unassignTask(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { assigneeId: undefined }, user.id);
  }

  @Delete(':id')
  @LogActivity({
    type: 'TASK_DELETED',
    entityType: 'Task',
    description: 'Deleted a task',
    includeOldValue: true,
  })
  @AutoNotify({
    type: NotificationType.SYSTEM,
    entityType: 'Task',
    priority: NotificationPriority.LOW,
    title: 'Task Deleted',
    message: 'A task you were involved in has been deleted',
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.tasksService.remove(id, user.id);
  }

  @Post(':id/comments')
  @LogActivity({
    type: 'TASK_COMMENTED',
    entityType: 'Task',
    description: 'Added comment to task',
    includeOldValue: false,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_COMMENTED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'New Comment',
    message: 'Someone commented on a task you are involved in',
  })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comment') comment: string,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.addComment(id, comment, user.id);
  }

  @Patch(':id/priority')
  @LogActivity({
    type: 'TASK_UPDATED',
    entityType: 'Task',
    description: 'Changed task priority',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_STATUS_CHANGED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'Task Priority Updated',
    message: 'Task priority has been changed',
  })
  updatePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('priority') priority: TaskPriority,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { priority }, user.id);
  }

  @Patch(':id/due-date')
  @LogActivity({
    type: 'TASK_UPDATED',
    entityType: 'Task',
    description: 'Changed task due date',
    includeOldValue: true,
    includeNewValue: true,
  })
  @AutoNotify({
    type: NotificationType.TASK_STATUS_CHANGED,
    entityType: 'Task',
    priority: NotificationPriority.MEDIUM,
    title: 'Task Due Date Updated',
    message: 'Task due date has been changed',
  })
  updateDueDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('dueDate') dueDate: string,
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { dueDate }, user.id);
  }
}
