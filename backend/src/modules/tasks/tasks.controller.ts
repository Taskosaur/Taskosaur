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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { NotificationPriority, NotificationType, TaskPriority, Role } from '@prisma/client';
import { AutoNotify } from 'src/common/decorator/auto-notify.decorator';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';
import { TasksByStatusParams } from './dto/task-by-status.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Scope } from 'src/common/decorator/scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

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

  @Post('bulk-delete')
  @ApiOperation({
    summary: 'Bulk delete tasks',
    description:
      'Delete multiple tasks at once. Only task creators, project managers/owners, or superadmins can delete tasks.',
  })
  @ApiBody({ type: BulkDeleteTasksDto })
  @ApiResponse({
    status: 200,
    description: 'Tasks deleted successfully',
    schema: {
      example: {
        deletedCount: 5,
        failedTasks: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            reason: 'Insufficient permissions to delete this task',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            reason: 'Task not found',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async bulkDeleteTasks(@Body() bulkDeleteTasksDto: BulkDeleteTasksDto, @Req() req: Request) {
    const user = getAuthUser(req);

    return this.tasksService.bulkDeleteTasks({
      taskIds: bulkDeleteTasksDto.taskIds,
      projectId: bulkDeleteTasksDto.projectId,
      all: bulkDeleteTasksDto.all,
      userId: user.id,
    });
  }

  @Post('create-task-attachment')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
      fileFilter: (req, file, callback) => {
        // Allow common file types
        const allowedMimes = [
          // Images
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',

          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',

          // Text & Data
          'text/plain',
          'text/csv',
          'text/markdown',
          'application/json',
          'application/xml',
          'text/html',
          'text/css',
          'text/javascript',

          // Archives
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',

          // Videos
          'video/mp4',
          'video/webm',
          'video/ogg',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo', // .avi
          'video/x-matroska', // .mkv
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException(`File type ${file.mimetype} is not allowed`), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new task',
    description:
      'Creates a new task with optional file attachments. Supports up to 10 files with a maximum size of 10MB each.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          example: 'Implement user authentication system',
          description: 'Task title/summary',
        },
        description: {
          type: 'string',
          example:
            'Create a JWT-based authentication system with login, register, and refresh token functionality.',
          description: 'Detailed task description',
        },
        type: {
          type: 'string',
          enum: ['TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK'],
          example: 'STORY',
          description: 'Type of task',
        },
        priority: {
          type: 'string',
          enum: ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'],
          example: 'HIGH',
          description: 'Task priority level',
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T09:00:00.000Z',
          description: 'Task start date',
        },
        dueDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-30T17:00:00.000Z',
          description: 'Task due date',
        },
        storyPoints: {
          type: 'number',
          example: 8,
          description: 'Story points for agile estimation',
        },
        originalEstimate: {
          type: 'number',
          example: 480,
          description: 'Original time estimate in minutes',
        },
        remainingEstimate: {
          type: 'number',
          example: 240,
          description: 'Remaining time estimate in minutes',
        },
        customFields: {
          type: 'object',
          example: {
            severity: 'critical',
            environment: 'production',
          },
          description: 'Custom fields specific to the task',
        },
        projectId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174001',
          description: 'ID of the project this task belongs to',
        },
        assigneeIds: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uuid',
          },
          example: ['123e4567-e89b-12d3-a456-426614174002', '223e4567-e89b-12d3-a456-426614174003'],
          description: 'IDs of users assigned to this task',
        },
        reporterIds: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uuid',
          },
          example: ['323e4567-e89b-12d3-a456-426614174004'],
          description: 'IDs of users who reported this task',
        },
        statusId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174004',
          description: 'ID of the current task status',
        },
        sprintId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174005',
          description: 'ID of the sprint this task is assigned to',
        },
        parentTaskId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174006',
          description: 'ID of the parent task (for subtasks)',
        },
        completedAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-08-20T10:00:00Z',
          description: 'Date when task was completed',
        },
        allowEmailReplies: {
          type: 'boolean',
          example: true,
          description: 'Whether to allow email replies for this task',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Task attachments (max 10 files, 10MB each)',
        },
      },
      required: ['title', 'projectId', 'statusId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Implement user authentication system',
        slug: 'PROJECT-1',
        taskNumber: 1,
        type: 'STORY',
        priority: 'HIGH',
        description: 'Create JWT-based authentication...',
        startDate: '2024-01-15T09:00:00.000Z',
        dueDate: '2024-01-30T17:00:00.000Z',
        storyPoints: 8,
        originalEstimate: 480,
        remainingEstimate: 240,
        completedAt: null,
        allowEmailReplies: true,
        customFields: {
          severity: 'critical',
        },
        createdBy: '123e4567-e89b-12d3-a456-426614174100',
        createdAt: '2024-01-10T10:00:00.000Z',
        updatedAt: '2024-01-10T10:00:00.000Z',
        project: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'My Project',
        },
        status: {
          id: '123e4567-e89b-12d3-a456-426614174004',
          name: 'To Do',
          color: '#0052CC',
          category: 'TODO',
        },
        assignees: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            avatar: null,
          },
        ],
        reporters: [],
        sprint: {
          id: '123e4567-e89b-12d3-a456-426614174005',
          name: 'Sprint 1',
          status: 'ACTIVE',
        },
        attachments: [
          {
            id: '223e4567-e89b-12d3-a456-426614174000',
            fileName: 'document.pdf',
            fileSize: 1024000,
            mimeType: 'application/pdf',
            url: '/uploads/tasks/123e4567-e89b-12d3-a456-426614174000/document.pdf',
            createdAt: '2024-01-10T10:00:00.000Z',
          },
        ],
        _count: {
          childTasks: 0,
          comments: 0,
          attachments: 1,
          watchers: 0,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or file type not allowed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions to create task',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @LogActivity({
    type: 'TASK_CREATED',
    entityType: 'Task',
    description: 'Created new task',
    includeNewValue: true,
  })
  async creatcreateWithAttachmentse(
    @Body() createTaskDto: CreateTaskDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);

    // Validate file type and count
    if (!Array.isArray(files)) {
      throw new BadRequestException('Files must be an array of uploaded file objects');
    }
    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed');
    }
    return this.tasksService.createWithAttachments(createTaskDto, user.id, files);
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
    @Query('assigneeIds') assigneeIds?: string,
    @Query('reporterIds') reporterIds?: string,
    @Query('priorities') priorities?: string,
    @Query('statuses') statuses?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    const priorityArray = priorities ? priorities.split(',').filter(Boolean) : undefined;
    const statusArray = statuses ? statuses.split(',').filter(Boolean) : undefined;

    let projectIdArray: string[] | undefined = undefined;
    if (projectId) {
      projectIdArray = projectId.split(',').filter(Boolean);
    }

    let workspaceIdArray: string[] | undefined = undefined;
    if (workspaceId) {
      workspaceIdArray = workspaceId.split(',').filter(Boolean);
    }
    let assigneeIdsArray: string[] | undefined = undefined;
    if (assigneeIds) {
      assigneeIdsArray = assigneeIds.split(',').filter(Boolean);
    }
    let reporterIdsArray: string[] | undefined = undefined;
    if (reporterIds) {
      reporterIdsArray = reporterIds.split(',').filter(Boolean);
    }

    return this.tasksService.findAll(
      organizationId,
      projectIdArray,
      sprintId,
      workspaceIdArray,
      parentTaskId,
      priorityArray,
      statusArray,
      assigneeIdsArray,
      reporterIdsArray,
      user.id as string,
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

    const priorityArray = priorities ? priorities.split(',').filter(Boolean) : undefined;
    const statusArray = statuses ? statuses.split(',').filter(Boolean) : undefined;
    const projectIdArray = projectId ? projectId.split(',').filter(Boolean) : undefined;
    const workspaceIdArray = workspaceId ? workspaceId.split(',').filter(Boolean) : undefined;

    return this.tasksService.getTasks(
      organizationId,
      projectIdArray,
      sprintId,
      workspaceIdArray,
      parentTaskId,
      priorityArray,
      statusArray,
      user.id as string,
      search,
    );
  }

  @Get('by-status')
  @ApiOperation({ summary: 'Get tasks grouped by status with pagination' })
  @Scope('PROJECT', 'slug')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  async getTasksByStatus(@Query() query: TasksByStatusParams, @Req() req: Request) {
    const user = getAuthUser(req);
    const tasks = await this.tasksService.getTasksGroupedByStatus(query, user.id);

    // Calculate totals across all statuses
    const totalTasks = tasks.reduce((sum, status) => sum + status.pagination.total, 0);
    const loadedTasks = tasks.reduce((sum, status) => sum + status.tasks.length, 0);

    return {
      data: tasks,
      meta: {
        totalTasks: totalTasks,
        loadedTasks: loadedTasks,
        totalStatuses: tasks.length,
        fetchedAt: new Date().toISOString(),
      },
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

  @Patch(':id/assignees')
  @LogActivity({
    type: 'TASK_ASSIGNED',
    entityType: 'Task',
    description: 'Updated task assignees',
    includeOldValue: true,
    includeNewValue: true,
  })
  updateAssignees(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assigneeIds') assigneeIds: string[],
    @Req() req: Request,
  ) {
    const user = getAuthUser(req);
    return this.tasksService.update(id, { assigneeIds }, user.id);
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
    return this.tasksService.update(id, { assigneeIds: [] }, user.id);
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
