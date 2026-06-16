import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Task, TaskPriority, TaskType, Prisma, ViewType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkCreateTasksDto } from './dto/bulk-create-tasks.dto';
import { TasksByStatus, TasksByStatusParams } from './dto/task-by-status.dto';
import { GetGroupedTasksDto, GroupByField } from './dto/get-grouped-tasks.dto';
import { AccessControlService } from 'src/common/access-control.utils';

import { StorageService } from '../storage/storage.service';
import { sanitizeHtml, sanitizeText, sanitizeObject } from 'src/common/utils/sanitizer.util';
import { RecurrenceService } from './recurrence.service';
import { TaskRanksService } from '../task-ranks/task-ranks.service';
import { ReorderDto } from '../task-ranks/dto/reorder.dto';
import { RecurrenceConfigDto } from './dto/recurrence-config.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
    private storageService: StorageService,
    private recurrenceService: RecurrenceService,
    private taskRanksService: TaskRanksService,
  ) {}

  /**
   * Flattens explicit m2m assignees/reporters from { user: { id, email, ... } }
   * to { id, email, ... } for API backward compatibility.
   */

  private flattenTaskRelations<T>(task: T): T {
    const result = { ...(task as Record<string, unknown>) };
    if (result.assignees && Array.isArray(result.assignees)) {
      result.assignees = (result.assignees as Array<{ user?: unknown }>).map((a) => a.user ?? a);
    }
    if (result.reporters && Array.isArray(result.reporters)) {
      result.reporters = (result.reporters as Array<{ user?: unknown }>).map((r) => r.user ?? r);
    }
    if (result.childTasks && Array.isArray(result.childTasks)) {
      result.childTasks = (result.childTasks as unknown[]).map((child) =>
        this.flattenTaskRelations(child),
      );
    }
    return result as T;
  }

  private flattenTasksList<T>(tasks: T[]): T[] {
    return tasks.map((task) => this.flattenTaskRelations(task));
  }

  // Helper to get enum values safely
  private getTaskType(value?: string): TaskType {
    if (!value) return TaskType.TASK;
    // Map string values to enum explicitly
    const typeMap: Record<string, TaskType> = {
      TASK: TaskType.TASK,
      STORY: TaskType.STORY,
      BUG: TaskType.BUG,
      EPIC: TaskType.EPIC,
      SUBTASK: TaskType.SUBTASK,
    };
    return typeMap[value] || TaskType.TASK;
  }

  private getTaskPriority(value?: string): TaskPriority {
    if (!value) return TaskPriority.MEDIUM;
    // Map string values to enum explicitly
    const priorityMap: Record<string, TaskPriority> = {
      LOWEST: TaskPriority.LOWEST,
      LOW: TaskPriority.LOW,
      MEDIUM: TaskPriority.MEDIUM,
      HIGH: TaskPriority.HIGH,
      HIGHEST: TaskPriority.HIGHEST,
    };
    return priorityMap[value] || TaskPriority.MEDIUM;
  }

  /**
   * Generates a unique task number by locking the project row to prevent race conditions.
   * This MUST be called within an interactive transaction.
   */
  public async getNextTaskNumber(
    tx: Prisma.TransactionClient,
    projectId: string,
  ): Promise<{ taskNumber: number; taskSlug: string }> {
    // 1. Lock the project row for this creation request
    const projects = await tx.$queryRaw<{ slug: string; task_prefix: string | null }[]>`
      SELECT slug, task_prefix FROM projects WHERE id = ${projectId}::uuid FOR UPDATE
    `;

    if (!projects || projects.length === 0) {
      throw new NotFoundException('Project not found');
    }

    const taskPrefix = projects[0].task_prefix || projects[0].slug;

    // 2. Safely find the last task number now that we hold the lock
    const lastTask = await tx.task.findFirst({
      where: { projectId },
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    });

    const taskNumber = lastTask ? lastTask.taskNumber + 1 : 1;

    return {
      taskNumber,
      taskSlug: `${taskPrefix}-${taskNumber}`,
    };
  }

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
      select: {
        slug: true,
        id: true,
        workspaceId: true,
        workspace: {
          select: {
            organizationId: true,
            organization: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if user can create tasks in this project
    const projectAccess = await this.accessControl.getProjectAccess(
      createTaskDto.projectId,
      userId,
    );

    if (!projectAccess.canChange) {
      throw new ForbiddenException('Insufficient permissions to create task in this project');
    }

    // Validate that startDate is before dueDate
    if (createTaskDto.startDate && createTaskDto.dueDate) {
      if (new Date(createTaskDto.startDate) > new Date(createTaskDto.dueDate)) {
        throw new BadRequestException('Start date must be before the due date');
      }
    }

    let sprintId = createTaskDto.sprintId;

    if (!sprintId) {
      const sprintResult = await this.prisma.sprint.findFirst({
        where: { projectId: project.id, isDefault: true },
      });
      sprintId = sprintResult?.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const { taskNumber, taskSlug } = await this.getNextTaskNumber(tx, createTaskDto.projectId);
      const { assigneeIds, reporterIds, description, isRecurring, recurrenceConfig, ...taskData } =
        createTaskDto;

      // Build task create data - filter out undefined values
      const taskCreateData: any = {
        description: description ? sanitizeHtml(description) : undefined,
        createdBy: userId,
        taskNumber,
        slug: taskSlug,
        sprintId: sprintId,
        isRecurring: isRecurring || false,
      };

      // Add optional fields only if they have values
      if (taskData.title) taskCreateData.title = sanitizeText(taskData.title);
      if (taskData.type) taskCreateData.type = taskData.type;
      if (taskData.priority) taskCreateData.priority = taskData.priority;
      if (taskData.projectId) taskCreateData.projectId = taskData.projectId;
      if (taskData.statusId) taskCreateData.statusId = taskData.statusId;
      if (taskData.startDate) taskCreateData.startDate = taskData.startDate;
      if (taskData.dueDate) taskCreateData.dueDate = taskData.dueDate;
      if (taskData.storyPoints !== undefined) taskCreateData.storyPoints = taskData.storyPoints;
      if (taskData.originalEstimate !== undefined)
        taskCreateData.originalEstimate = taskData.originalEstimate;
      if (taskData.remainingEstimate !== undefined)
        taskCreateData.remainingEstimate = taskData.remainingEstimate;
      if (taskData.customFields)
        taskCreateData.customFields = sanitizeObject(taskData.customFields);
      if (taskData.parentTaskId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          taskData.parentTaskId,
        );
        if (!isUuid) {
          const parentTask = await tx.task.findFirst({
            where: { slug: taskData.parentTaskId },
            select: { id: true },
          });
          if (!parentTask) {
            throw new NotFoundException(`Parent task with slug ${taskData.parentTaskId} not found`);
          }
          taskCreateData.parentTaskId = parentTask.id;
        } else {
          taskCreateData.parentTaskId = taskData.parentTaskId;
        }
      }
      if (taskData.completedAt !== undefined) taskCreateData.completedAt = taskData.completedAt;
      if (taskData.allowEmailReplies !== undefined)
        taskCreateData.allowEmailReplies = taskData.allowEmailReplies;

      // Only add assignees if there are any
      if (assigneeIds?.length) {
        taskCreateData.assignees = {
          create: assigneeIds.map((id) => ({ userId: id })),
        };
      }

      // Only add reporters if there are any
      if (reporterIds?.length) {
        taskCreateData.reporters = {
          create: reporterIds.map((id) => ({ userId: id })),
        };
      }

      // Create the task
      const task = await tx.task.create({
        data: taskCreateData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  organization: {
                    select: { id: true, name: true, slug: true },
                  },
                },
              },
            },
          },
          assignees: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          reporters: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          status: {
            select: { id: true, name: true, color: true, category: true },
          },
          sprint: {
            select: { id: true, name: true, status: true },
          },
          parentTask: {
            select: { id: true, title: true, slug: true, type: true },
          },
          _count: {
            select: {
              childTasks: true,
              comments: true,
              attachments: true,
              watchers: true,
            },
          },
        },
      });

      await this.taskRanksService.seedForTask(
        task.id,
        task.projectId,
        task.project.workspace.id,
        task.project.workspace.organization.id,
        tx as unknown as Prisma.TransactionClient,
      );

      // If this is a recurring task, create the recurrence configuration
      if (isRecurring && recurrenceConfig) {
        const nextOccurrence = this.recurrenceService.calculateNextOccurrence(
          task.dueDate || new Date(),
          recurrenceConfig,
        );

        await tx.recurringTask.create({
          data: {
            taskId: task.id,
            recurrenceType: recurrenceConfig.recurrenceType,
            interval: recurrenceConfig.interval,
            daysOfWeek: recurrenceConfig.daysOfWeek || [],
            dayOfMonth: recurrenceConfig.dayOfMonth,
            monthOfYear: recurrenceConfig.monthOfYear,
            endType: recurrenceConfig.endType,
            endDate: recurrenceConfig.endDate ? new Date(recurrenceConfig.endDate) : null,
            occurrenceCount: recurrenceConfig.occurrenceCount,
            nextOccurrence,
            isActive: true,
          },
        });
      }

      return task;
    });
  }

  async bulkCreate(
    dto: BulkCreateTasksDto,
    userId: string,
  ): Promise<{
    created: number;
    failed: number;
    failures: Array<{
      index: number;
      title: string;
      reason: string;
    }>;
  }> {
    // Validate empty tasks array first
    if (!dto.tasks || dto.tasks.length === 0) {
      throw new BadRequestException('Tasks array cannot be empty');
    }

    // Verify status exists before checking project access
    const status = await this.prisma.taskStatus.findUnique({
      where: { id: dto.statusId },
    });
    if (!status) {
      throw new BadRequestException('Invalid status ID');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: {
        id: true,
        slug: true,
        workspaceId: true,
        workspace: {
          select: {
            organizationId: true,
            organization: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const projectAccess = await this.accessControl.getProjectAccess(dto.projectId, userId);
    if (!projectAccess.canChange) {
      throw new ForbiddenException('Insufficient permissions to create tasks in this project');
    }

    let sprintId = dto.sprintId;
    if (!sprintId) {
      const defaultSprint = await this.prisma.sprint.findFirst({
        where: { projectId: project.id, isDefault: true },
      });
      sprintId = defaultSprint?.id;
    }

    const tasks = dto.tasks;
    const failures: Array<{ index: number; title: string; reason: string }> = [];
    const validTasks: Array<{
      title: string;
      description?: string;
      type: TaskType;
      priority: TaskPriority;
      dueDate?: Date;
      projectId: string;
      statusId: string;
      createdBy: string;
      updatedBy: string;
      taskNumber: number;
      slug: string;
      sprintId?: string;
      isRecurring: boolean;
    }> = [];

    // Validate each task before bulk insert
    tasks.forEach((item, index) => {
      // Validate title
      if (!item.title || item.title.trim().length === 0) {
        failures.push({
          index,
          title: item.title || '(empty)',
          reason: 'Title is required',
        });
        return;
      }

      // Validate title length
      if (item.title.length > 500) {
        failures.push({
          index,
          title: item.title.substring(0, 50) + '...',
          reason: 'Title exceeds maximum length of 500 characters',
        });
        return;
      }

      // Validate description length if provided
      if (item.description && item.description.length > 5000) {
        failures.push({
          index,
          title: item.title,
          reason: 'Description exceeds maximum length of 5000 characters',
        });
        return;
      }

      // Validate dueDate format if provided
      if (item.dueDate) {
        const date = new Date(item.dueDate);
        if (isNaN(date.getTime())) {
          failures.push({
            index,
            title: item.title,
            reason: 'Invalid due date format. Use YYYY-MM-DD',
          });
          return;
        }
      }

      // Task is valid, add to validTasks with proper enum types
      validTasks.push({
        title: sanitizeText(item.title),
        description: item.description ? sanitizeHtml(item.description) : undefined,
        type: this.getTaskType(item.type),
        priority: this.getTaskPriority(item.priority),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        projectId: dto.projectId,
        statusId: dto.statusId,
        createdBy: userId,
        updatedBy: userId,
        taskNumber: 0, // Will be set below
        slug: '', // Will be set below
        sprintId,
        isRecurring: false,
      });
    });

    // If all tasks failed validation, return early
    if (validTasks.length === 0 && failures.length > 0) {
      return {
        created: 0,
        failed: failures.length,
        failures,
      };
    }

    return this.prisma.$transaction(
      async (tx) => {
        const projects = await tx.$queryRaw<{ slug: string; task_prefix: string | null }[]>`
          SELECT slug, task_prefix FROM projects WHERE id = ${dto.projectId}::uuid FOR UPDATE
        `;

        if (!projects || projects.length === 0) {
          throw new NotFoundException('Project not found');
        }

        const taskPrefix = projects[0].task_prefix || projects[0].slug;

        const lastTask = await tx.task.findFirst({
          where: { projectId: dto.projectId },
          orderBy: { taskNumber: 'desc' },
          select: { taskNumber: true },
        });

        let nextNumber = lastTask ? lastTask.taskNumber + 1 : 1;

        // Assign task numbers and slugs to valid tasks
        const taskRecords = validTasks.map((task) => {
          const num = nextNumber++;
          const slug = `${taskPrefix}-${num}`;

          // Build task record without undefined values for createMany
          return {
            title: task.title,
            type: task.type,
            priority: task.priority,
            projectId: task.projectId,
            statusId: task.statusId,
            createdBy: task.createdBy,
            updatedBy: task.updatedBy,
            taskNumber: num,
            slug,
            isRecurring: task.isRecurring,
            ...(task.description !== undefined && { description: task.description }),
            ...(task.dueDate !== undefined && { dueDate: task.dueDate }),
            ...(task.sprintId !== undefined && { sprintId: task.sprintId }),
          };
        });

        // If no valid tasks to create, return early
        if (taskRecords.length === 0) {
          return {
            created: 0,
            failed: failures.length,
            failures,
          };
        }

        // Create tasks and seed ranks for each
        const createdTasks = await Promise.all(
          taskRecords.map(async (record) => {
            const createdTask = await tx.task.create({
              data: record,
            });

            await this.taskRanksService.seedForTask(
              createdTask.id,
              createdTask.projectId,
              project.workspaceId,
              project.workspace.organizationId,
              tx as unknown as Prisma.TransactionClient,
            );

            return createdTask;
          }),
        );

        return {
          created: createdTasks.length,
          failed: failures.length,
          failures,
        };
      },
      {
        timeout: 60000,
      },
    );
  }
  // Updated Task Create with Attachments
  async createWithAttachments(
    createTaskDto: CreateTaskDto,
    userId: string,
    files?: Express.Multer.File[],
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
      select: {
        slug: true,
        id: true,
        workspaceId: true,
        workspace: {
          select: {
            organizationId: true,
            organization: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Permission checks
    const projectAccess = await this.accessControl.getProjectAccess(
      createTaskDto.projectId,
      userId,
    );

    if (!projectAccess.canChange) {
      throw new ForbiddenException('Insufficient permissions to create task in this project');
    }

    // Validate that startDate is before dueDate
    if (createTaskDto.startDate && createTaskDto.dueDate) {
      if (new Date(createTaskDto.startDate) > new Date(createTaskDto.dueDate)) {
        throw new BadRequestException('Start date must be before the due date');
      }
    }

    let sprintId = createTaskDto.sprintId;

    if (!sprintId) {
      const sprintResult = await this.prisma.sprint.findFirst({
        where: { projectId: project.id, isDefault: true },
      });
      sprintId = sprintResult?.id;
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const { taskNumber, taskSlug } = await this.getNextTaskNumber(tx, createTaskDto.projectId);
      const { assigneeIds, reporterIds, description, isRecurring, recurrenceConfig, ...taskData } =
        createTaskDto;

      // Build task create data - filter out undefined values
      const taskCreateData: any = {
        description: description ? sanitizeHtml(description) : undefined,
        createdBy: userId,
        taskNumber,
        slug: taskSlug,
        sprintId: sprintId,
        isRecurring: isRecurring || false,
      };

      // Add optional fields only if they have values
      if (taskData.title) taskCreateData.title = sanitizeText(taskData.title);
      if (taskData.type) taskCreateData.type = taskData.type;
      if (taskData.priority) taskCreateData.priority = taskData.priority;
      if (taskData.projectId) taskCreateData.projectId = taskData.projectId;
      if (taskData.statusId) taskCreateData.statusId = taskData.statusId;
      if (taskData.startDate) taskCreateData.startDate = taskData.startDate;
      if (taskData.dueDate) taskCreateData.dueDate = taskData.dueDate;
      if (taskData.storyPoints !== undefined) taskCreateData.storyPoints = taskData.storyPoints;
      if (taskData.originalEstimate !== undefined)
        taskCreateData.originalEstimate = taskData.originalEstimate;
      if (taskData.remainingEstimate !== undefined)
        taskCreateData.remainingEstimate = taskData.remainingEstimate;
      if (taskData.customFields)
        taskCreateData.customFields = sanitizeObject(taskData.customFields);
      if (taskData.parentTaskId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          taskData.parentTaskId,
        );
        if (!isUuid) {
          const parentTask = await tx.task.findFirst({
            where: { slug: taskData.parentTaskId },
            select: { id: true },
          });
          if (!parentTask) {
            throw new NotFoundException(`Parent task with slug ${taskData.parentTaskId} not found`);
          }
          taskCreateData.parentTaskId = parentTask.id;
        } else {
          taskCreateData.parentTaskId = taskData.parentTaskId;
        }
      }
      if (taskData.completedAt !== undefined) taskCreateData.completedAt = taskData.completedAt;
      if (taskData.allowEmailReplies !== undefined)
        taskCreateData.allowEmailReplies = taskData.allowEmailReplies;

      // Only add assignees if there are any
      if (assigneeIds?.length) {
        taskCreateData.assignees = {
          create: assigneeIds.map((id) => ({ userId: id })),
        };
      }

      // Only add reporters if there are any
      if (reporterIds?.length) {
        taskCreateData.reporters = {
          create: reporterIds.map((id) => ({ userId: id })),
        };
      }

      // --- Create Task ---
      const createdTask = await tx.task.create({
        data: taskCreateData,
      });

      // --- Seed Task Ranks ---
      await this.taskRanksService.seedForTask(
        createdTask.id,
        createdTask.projectId,
        project.workspaceId,
        project.workspace.organizationId,
        tx as unknown as Prisma.TransactionClient,
      );

      // If this is a recurring task, create the recurrence configuration
      if (isRecurring && recurrenceConfig) {
        const nextOccurrence = this.recurrenceService.calculateNextOccurrence(
          createdTask.dueDate || new Date(),
          recurrenceConfig,
        );

        await tx.recurringTask.create({
          data: {
            taskId: createdTask.id,
            recurrenceType: recurrenceConfig.recurrenceType,
            interval: recurrenceConfig.interval,
            daysOfWeek: recurrenceConfig.daysOfWeek || [],
            dayOfMonth: recurrenceConfig.dayOfMonth,
            monthOfYear: recurrenceConfig.monthOfYear,
            endType: recurrenceConfig.endType,
            endDate: recurrenceConfig.endDate ? new Date(recurrenceConfig.endDate) : null,
            occurrenceCount: recurrenceConfig.occurrenceCount,
            nextOccurrence,
            isActive: true,
          },
        });
      }

      // --- Handle Attachments ---
      if (files && files.length > 0) {
        const attachmentPromises = files.map(async (file) => {
          const { url, key, size } = await this.storageService.saveFile(
            file,
            `tasks/${createdTask.id}`,
          );

          return tx.taskAttachment.create({
            data: {
              taskId: createdTask.id,
              fileName: file.originalname,
              fileSize: size,
              mimeType: file.mimetype,
              url: url, // Static/local or pre-signed path
              storageKey: key,
              createdBy: userId,
            },
          });
        });

        await Promise.all(attachmentPromises);
      }

      return createdTask;
    });

    // --- Return task with attachments + presigned URLs ---
    return this.getTaskWithPresignedUrls(task.id);
  }

  // Helper method to fetch task and generate presigned URLs for attachments
  private async getTaskWithPresignedUrls(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organization: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: {
          select: { id: true, name: true, status: true },
        },
        parentTask: {
          select: { id: true, title: true, slug: true, type: true },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            url: true,
            storageKey: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            childTasks: true,
            comments: true,
            attachments: true,
            watchers: true,
          },
        },
      },
    });

    // Generate presigned URLs for attachments
    if (task && task.attachments.length > 0) {
      const attachmentsWithUrls = await Promise.all(
        task.attachments.map(async (attachment) => {
          // If URL is null (S3 case), generate presigned URL
          // const _isCloud = attachment.url;
          const viewUrl = attachment.url
            ? attachment.url
            : attachment?.storageKey &&
              (await this.storageService.getFileUrl(attachment?.storageKey));

          return {
            ...attachment,
            viewUrl, // Add presigned URL for viewing
          };
        }),
      );

      return this.flattenTaskRelations({
        ...task,
        attachments: attachmentsWithUrls,
      });
    }
    return task ? this.flattenTaskRelations(task) : task;
  }

  /**
   * bulkUpdateTasksStatus - moved after findAll for logical grouping
   */

  async findAll(
    organizationId: string,
    projectId?: string[],
    sprintId?: string,
    workspaceId?: string[],
    parentTaskId?: string,
    priorities?: string[],
    statuses?: string[],
    types?: string[],
    assigneeIds?: string[],
    reporterIds?: string[],
    userId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string,
    page: number = 1,
    limit: number = 20,
    groupBy?: string,
  ): Promise<{
    data: Task[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filterCounts: {
      priorities: { value: string; count: number }[];
      types: { value: string; count: number }[];
      statuses: { id: string; name: string; count: number }[];
      assignees: { id: string; name: string; count: number }[];
      reporters: { id: string; name: string; count: number }[];
    };
  }> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const access = await this.accessControl.getOrgAccess(organizationId, userId);

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Build base where clause
    const whereClause: any = {
      // Ensure tasks belong to the organization through project->workspace->organization
      project: {
        workspace: {
          organizationId: organizationId,
        },
      },
    };

    // If not super admin and not organization elevated user (OWNER/MANAGER), apply visibility filters
    if (!access.isSuperAdmin && !access.isElevated) {
      whereClause.project.OR = this.accessControl.getProjectVisibilityFilter(userId);
    }

    // Add conditions using AND array to avoid conflicts
    const andConditions: any[] = [];

    // Filter by workspace if provided
    if (workspaceId && workspaceId.length > 0) {
      andConditions.push({
        project: {
          workspaceId: { in: workspaceId },
        },
      });
    }

    // Filter by project if provided
    if (projectId && projectId.length > 0) {
      andConditions.push({
        projectId: { in: projectId },
      });
    }

    // Filter by sprint if provided
    if (sprintId) {
      andConditions.push({
        sprintId: sprintId,
      });
    }

    // Handle parentTaskId filtering
    if (parentTaskId !== undefined) {
      if (parentTaskId === 'all') {
        // Do not filter by parentTaskId to include both main tasks and subtasks
      } else if (parentTaskId === 'null' || parentTaskId === '' || parentTaskId === null) {
        whereClause.parentTaskId = null;
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          parentTaskId,
        );
        if (isUuid) {
          whereClause.parentTaskId = parentTaskId;
        } else {
          // Resolve slug to UUID
          const task = await this.prisma.task.findFirst({
            where: { slug: parentTaskId },
            select: { id: true },
          });
          if (task) {
            whereClause.parentTaskId = task.id;
          } else {
            // If slug not found, we set it to a non-existent UUID to return no results
            whereClause.parentTaskId = '00000000-0000-0000-0000-000000000000';
          }
        }
      }
    } else {
      // Default: show only top-level tasks (not subtasks).
      // This aligns with the rank-sort SQL which also filters IS NULL,
      // ensuring the task count and page data are consistent.
      whereClause.parentTaskId = null;
    }

    // Filter by priorities if provided
    if (priorities && priorities.length > 0) {
      andConditions.push({
        priority: { in: priorities },
      });
    }

    // Filter by statuses if provided
    if (statuses && statuses.length > 0) {
      andConditions.push({
        statusId: { in: statuses },
      });
    } else {
      // Exclude 'DONE' status tasks by default when no status filter is provided
      andConditions.push({
        status: {
          category: { not: 'DONE' },
        },
      });
    }

    // Filter by types if provided
    if (types && types.length > 0) {
      andConditions.push({
        type: { in: types },
      });
    }

    if (assigneeIds && assigneeIds.length > 0) {
      andConditions.push({
        assignees: {
          some: { userId: { in: assigneeIds } },
        },
      });
    }
    if (reporterIds && reporterIds.length > 0) {
      andConditions.push({
        reporters: {
          some: { userId: { in: reporterIds } },
        },
      });
    }
    // Add search functionality
    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: search.trim(), mode: 'insensitive' } },
          { description: { contains: search.trim(), mode: 'insensitive' } },
        ],
      });
    }

    // User access restrictions for non-elevated users
    // if (!isElevated) {
    //   andConditions.push({
    //     OR: [
    //       { assignees: { some: { userId: userId } } },
    //       { reporters: { some: { userId: userId } } },
    //       { createdBy: userId },
    //     ],
    //   });
    // }

    // Add all conditions to the where clause
    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Pagination calculation
    const skip = (page - 1) * limit;

    const orderByArray: any[] = [];
    if (groupBy && groupBy !== 'none') {
      if (groupBy === 'status') {
        orderByArray.push({ status: { position: 'asc' } });
        orderByArray.push({ statusId: 'asc' });
      } else if (groupBy === 'priority') {
        orderByArray.push({ priority: 'asc' });
      } else if (groupBy === 'type') {
        orderByArray.push({ type: 'asc' });
      } else if (groupBy === 'project') {
        orderByArray.push({ project: { name: 'asc' } });
        orderByArray.push({ projectId: 'asc' });
      } else if (groupBy === 'dueDate') {
        orderByArray.push({ dueDate: 'asc' });
      } else if (groupBy === 'createdAt') {
        orderByArray.push({ createdAt: 'asc' });
      }
    }

    let orderBy: any = { taskNumber: 'desc' };
    let isRankSort = false;
    let scopeType = 'ORGANIZATION';
    let scopeId = organizationId;
    const viewType = 'LIST';

    const canUseRankSort = !groupBy || groupBy === 'none';

    if (
      canUseRankSort &&
      (sortBy === 'listRank' || sortBy === 'workspaceListRank' || sortBy === 'displayOrder')
    ) {
      isRankSort = true;
      if (projectId && projectId.length > 0) {
        scopeType = 'PROJECT';
        scopeId = projectId[0];
      } else if (workspaceId && workspaceId.length > 0) {
        scopeType = 'WORKSPACE';
        scopeId = workspaceId[0];
      } else {
        scopeType = 'ORGANIZATION';
        scopeId = organizationId;
      }
    } else if (sortBy === 'dueIn' || sortBy === 'dueDate') {
      orderBy = { dueDate: sortOrder === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy) {
      const validSortFields = [
        'createdAt',
        'updatedAt',
        'completedAt',
        'priority',
        'storyPoints',
        'title',
        'taskNumber',
      ];
      if (validSortFields.includes(sortBy)) {
        orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
      } else if (sortBy === 'status') {
        orderBy = { status: { name: sortOrder === 'asc' ? 'asc' : 'desc' } };
      } else if (sortBy === 'commentsCount') {
        orderBy = { comments: { _count: sortOrder === 'asc' ? 'asc' : 'desc' } };
      }
    }

    if (orderByArray.length > 0) {
      orderBy = [...orderByArray, orderBy];
    }

    let tasks: (Task & { [key: string]: any })[] = [];
    let total = 0;

    const includeConfig = {
      labels: {
        select: {
          taskId: true,
          labelId: true,
          label: {
            select: { id: true, name: true, color: true, description: true },
          },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          workspace: {
            select: { id: true, name: true, slug: true, organizationId: true },
          },
          inbox: true,
        },
      },
      assignees: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      reporters: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      status: { select: { id: true, name: true, color: true, category: true } },
      sprint: { select: { id: true, name: true, slug: true, status: true } },
      parentTask: { select: { id: true, title: true, slug: true, type: true } },
      _count: { select: { childTasks: true, comments: true, attachments: true } },
    };

    if (isRankSort) {
      const rankOrderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const sqlLimit = limit;
      const sqlOffset = skip;

      // Build the scope-specific WHERE predicate so LIMIT/OFFSET pages the
      // correct filtered set rather than the entire organisation.
      let rankedTaskIds: { id: string }[];

      let parentTaskCondition = Prisma.empty;
      if (parentTaskId === 'all') {
        parentTaskCondition = Prisma.empty;
      } else if (whereClause.parentTaskId) {
        parentTaskCondition = Prisma.sql`AND t."parent_task_id" = ${whereClause.parentTaskId}::uuid`;
      } else {
        parentTaskCondition = Prisma.sql`AND t."parent_task_id" IS NULL`;
      }

      let statusCondition = Prisma.empty;
      if (statuses && statuses.length > 0) {
        const statusSql = statuses.map((s) => Prisma.sql`${s}::uuid`);
        statusCondition = Prisma.sql`AND t.status_id IN (${Prisma.join(statusSql)})`;
      } else {
        statusCondition = Prisma.sql`AND t.status_id IN (SELECT id FROM task_statuses WHERE category::text != 'DONE')`;
      }

      if (scopeType === 'PROJECT') {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            AND t.project_id = ${scopeId}::uuid
            ${parentTaskCondition}
            ${sprintId ? Prisma.sql`AND t.sprint_id = ${sprintId}::uuid` : Prisma.empty}
            ${statusCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      } else if (scopeType === 'WORKSPACE') {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            AND p."workspace_id" = ${scopeId}::uuid
            ${parentTaskCondition}
            ${sprintId ? Prisma.sql`AND t.sprint_id = ${sprintId}::uuid` : Prisma.empty}
            ${statusCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      } else {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            ${parentTaskCondition}
            ${sprintId ? Prisma.sql`AND t.sprint_id = ${sprintId}::uuid` : Prisma.empty}
            ${statusCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      }

      const taskIds = rankedTaskIds.map((r) => r.id);

      total = await this.prisma.task.count({ where: whereClause });

      if (taskIds.length > 0) {
        tasks = await this.prisma.task.findMany({
          where: {
            ...whereClause,
            id: { in: taskIds },
          },
          include: includeConfig,
        });

        // Re-order Prisma's results to mirror exactly the $queryRaw ID ordering
        const taskMap = new Map(tasks.map((t) => [t.id, t]));
        tasks = taskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is Task & { [key: string]: any } => !!t);
      }
    } else {
      if (groupBy && groupBy !== 'none') {
        tasks = await this.prisma.task.findMany({
          where: whereClause,
          include: includeConfig,
          orderBy,
        });
        total = tasks.length;
      } else {
        [tasks, total] = await this.prisma.$transaction([
          this.prisma.task.findMany({
            where: whereClause,
            include: includeConfig,
            orderBy,
            skip,
            take: limit,
          }),
          this.prisma.task.count({ where: whereClause }),
        ]);
      }
    }

    // Transform the response
    const transformedTasks = tasks.map((task) => ({
      ...task,
      showEmailReply: task.project?.inbox?.enabled === true,
      labels: (
        (task.labels as Array<{ taskId: string; labelId: string; label: any }> | undefined) || []
      ).map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));

    // Compute filter facet counts using the same whereClause
    const [priorityCounts, typeCounts, statusCounts, assigneeCounts, reporterCounts] =
      await this.prisma.$transaction([
        this.prisma.task.groupBy({
          by: ['priority'],
          where: whereClause,
          _count: true,
          orderBy: { priority: 'asc' },
        }),
        this.prisma.task.groupBy({
          by: ['type'],
          where: whereClause,
          _count: true,
          orderBy: { type: 'asc' },
        }),
        this.prisma.task.groupBy({
          by: ['statusId'],
          where: whereClause,
          _count: true,
          orderBy: { statusId: 'asc' },
        }),
        this.prisma.taskAssignee.groupBy({
          by: ['userId'],
          where: { task: whereClause },
          _count: true,
          orderBy: { userId: 'asc' },
        }),
        this.prisma.taskReporter.groupBy({
          by: ['userId'],
          where: { task: whereClause },
          _count: true,
          orderBy: { userId: 'asc' },
        }),
      ]);

    // Fetch status names for display
    const statusIds = statusCounts.map((s) => s.statusId);
    const statusNames =
      statusIds.length > 0
        ? await this.prisma.taskStatus.findMany({
            where: { id: { in: statusIds } },
            select: { id: true, name: true },
          })
        : [];
    const statusNameMap = new Map(statusNames.map((s) => [s.id, s.name]));

    // Fetch assignee names for display
    const assigneeUserIds = assigneeCounts.map((a) => a.userId);
    const assigneeUsers =
      assigneeUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: assigneeUserIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const assigneeNameMap = new Map(
      assigneeUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    // Fetch reporter names for display
    const reporterUserIds = reporterCounts.map((r) => r.userId);
    const reporterUsers =
      reporterUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: reporterUserIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const reporterNameMap = new Map(
      reporterUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    const filterCounts = {
      priorities: priorityCounts.map((p) => ({
        value: p.priority,
        count: p._count as unknown as number,
      })),
      types: typeCounts.map((t) => ({
        value: t.type,
        count: t._count as unknown as number,
      })),
      statuses: statusCounts.map((s) => ({
        id: s.statusId,
        name: statusNameMap.get(s.statusId) || '',
        count: s._count as unknown as number,
      })),
      assignees: assigneeCounts.map((a) => ({
        id: a.userId,
        name: assigneeNameMap.get(a.userId) || '',
        count: a._count as unknown as number,
      })),
      reporters: reporterCounts.map((r) => ({
        id: r.userId,
        name: reporterNameMap.get(r.userId) || '',
        count: r._count as unknown as number,
      })),
    };

    let finalTasks = this.flattenTasksList(transformedTasks);
    let totalPages = Math.ceil(total / limit);

    if (groupBy && groupBy !== 'none') {
      type TaskType = (typeof finalTasks)[number];

      const getGroupKey = (task: TaskType): string => {
        switch (groupBy) {
          case 'status':
            return task.statusId || 'no-status';
          case 'priority':
            return task.priority || 'no-priority';
          case 'type':
            return task.type || 'no-type';
          case 'project':
            return task.projectId || 'no-project';
          case 'dueDate':
            return task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'no-date';
          case 'createdAt':
            return task.createdAt
              ? new Date(task.createdAt).toISOString().split('T')[0]
              : 'no-date';
          default:
            return 'all';
        }
      };

      // Group contiguous tasks
      const groups: TaskType[][] = [];
      let currentGroup: TaskType[] = [];
      let lastKey: string | null = null;

      for (const task of finalTasks) {
        const key = getGroupKey(task);
        if (lastKey === null) {
          currentGroup.push(task);
          lastKey = key;
        } else if (key === lastKey) {
          currentGroup.push(task);
        } else {
          groups.push(currentGroup);
          currentGroup = [task];
          lastKey = key;
        }
      }
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // Distribute groups into pages
      const pages: TaskType[][] = [];
      let currentPageTasks: TaskType[] = [];

      for (const group of groups) {
        if (currentPageTasks.length === 0) {
          currentPageTasks.push(...group);
        } else if (currentPageTasks.length + group.length <= limit) {
          currentPageTasks.push(...group);
        } else {
          pages.push(currentPageTasks);
          currentPageTasks = [...group];
        }
      }
      if (currentPageTasks.length > 0) {
        pages.push(currentPageTasks);
      }

      totalPages = pages.length;
      finalTasks = pages[page - 1] || [];
    }

    return {
      data: finalTasks,
      total,
      page,
      limit,
      totalPages,
      filterCounts,
    };
  }

  async getTasks(
    organizationId: string,
    projectId?: string[],
    sprintId?: string,
    workspaceId?: string[],
    parentTaskId?: string,
    priorities?: string[],
    statuses?: string[],
    types?: string[],
    userId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string,
    page: number = 1,
    limit: number = 20,
    viewType: ViewType = ViewType.LIST,
    from?: Date,
    to?: Date,
    dateField: string = 'dueDate',
    groupBy?: string,
  ): Promise<{
    data: Task[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const access = await this.accessControl.getOrgAccess(organizationId, userId);

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Build base where clause
    const whereClause: any = {
      project: {
        workspace: { organizationId },
      },
    };

    // If not super admin and not organization elevated user (OWNER/MANAGER), apply visibility filters
    if (!access.isSuperAdmin && !access.isElevated) {
      whereClause.project.OR = this.accessControl.getProjectVisibilityFilter(userId);
    }

    const andConditions: any[] = [];

    if (workspaceId?.length) {
      andConditions.push({ project: { workspaceId: { in: workspaceId } } });
    }

    if (projectId?.length) {
      andConditions.push({ projectId: { in: projectId } });
    }

    if (sprintId) {
      andConditions.push({ sprintId });
    }

    if (parentTaskId !== undefined) {
      if (parentTaskId === 'all') {
        // Do not filter by parentTaskId to include both main tasks and subtasks
      } else if (parentTaskId === 'null' || parentTaskId === '' || parentTaskId === null) {
        whereClause.parentTaskId = null;
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          parentTaskId,
        );
        if (isUuid) {
          whereClause.parentTaskId = parentTaskId;
        } else {
          // Resolve slug to UUID
          const parentTask = await this.prisma.task.findFirst({
            where: { slug: parentTaskId },
            select: { id: true },
          });
          if (parentTask) {
            whereClause.parentTaskId = parentTask.id;
          } else {
            // If slug not found, we set it to a non-existent UUID to return no results
            whereClause.parentTaskId = '00000000-0000-0000-0000-000000000000';
          }
        }
      }
    } else {
      // Default to showing only main tasks (not subtasks) for backward compatibility
      whereClause.parentTaskId = null;
    }

    if (priorities?.length) {
      andConditions.push({ priority: { in: priorities } });
    }

    if (statuses?.length) {
      andConditions.push({ statusId: { in: statuses } });
    }

    if (types?.length) {
      andConditions.push({ type: { in: types } });
    }

    if (search?.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: search.trim(), mode: 'insensitive' } },
          { description: { contains: search.trim(), mode: 'insensitive' } },
        ],
      });
    }

    if (from || to) {
      const dateFilter: any = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = to;

      const validDateFields = ['dueDate', 'startDate', 'createdAt', 'updatedAt', 'completedAt'];
      const field = validDateFields.includes(dateField) ? dateField : 'dueDate';

      andConditions.push({ [field]: dateFilter });
    }

    // Add all conditions to the where clause
    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Pagination calculation
    const skip = (page - 1) * limit;

    const orderByArray: any[] = [];
    if (groupBy && groupBy !== 'none') {
      if (groupBy === 'status') {
        orderByArray.push({ status: { position: 'asc' } });
        orderByArray.push({ statusId: 'asc' });
      } else if (groupBy === 'priority') {
        orderByArray.push({ priority: 'asc' });
      } else if (groupBy === 'type') {
        orderByArray.push({ type: 'asc' });
      } else if (groupBy === 'project') {
        orderByArray.push({ project: { name: 'asc' } });
        orderByArray.push({ projectId: 'asc' });
      } else if (groupBy === 'dueDate') {
        orderByArray.push({ dueDate: 'asc' });
      } else if (groupBy === 'createdAt') {
        orderByArray.push({ createdAt: 'asc' });
      }
    }

    let orderBy: any = { taskNumber: 'desc' };
    let isRankSort = false;
    let scopeType = 'ORGANIZATION';
    let scopeId = organizationId;

    const canUseRankSort = !groupBy || groupBy === 'none';

    if (
      canUseRankSort &&
      (sortBy === 'listRank' || sortBy === 'workspaceListRank' || sortBy === 'displayOrder')
    ) {
      isRankSort = true;
      if (projectId && projectId.length > 0) {
        scopeType = 'PROJECT';
        scopeId = projectId[0];
      } else if (workspaceId && workspaceId.length > 0) {
        scopeType = 'WORKSPACE';
        scopeId = workspaceId[0];
      } else {
        scopeType = 'ORGANIZATION';
        scopeId = organizationId;
      }
    } else if (sortBy === 'dueIn' || sortBy === 'dueDate') {
      orderBy = { dueDate: sortOrder === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy) {
      const validSortFields = [
        'createdAt',
        'updatedAt',
        'completedAt',
        'priority',
        'storyPoints',
        'title',
        'taskNumber',
      ];
      if (validSortFields.includes(sortBy)) {
        orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
      } else if (sortBy === 'status') {
        orderBy = { status: { name: sortOrder === 'asc' ? 'asc' : 'desc' } };
      } else if (sortBy === 'commentsCount') {
        orderBy = { comments: { _count: sortOrder === 'asc' ? 'asc' : 'desc' } };
      }
    }

    if (orderByArray.length > 0) {
      orderBy = [...orderByArray, orderBy];
    }

    const includeConfig = {
      labels: {
        select: {
          taskId: true,
          labelId: true,
          label: {
            select: { id: true, name: true, color: true, description: true },
          },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          workspace: {
            select: { id: true, name: true, slug: true, organizationId: true },
          },
        },
      },
      assignees: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      reporters: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      status: { select: { id: true, name: true, color: true, category: true } },
      sprint: { select: { id: true, name: true, slug: true, status: true } },
      parentTask: { select: { id: true, title: true, slug: true, type: true } },
      _count: { select: { childTasks: true, comments: true, attachments: true } },
    };

    let tasks: (Task & { [key: string]: any })[] = [];
    let total = 0;

    if (isRankSort) {
      const rankOrderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const sqlLimit = limit;
      const sqlOffset = skip;

      const parentTaskCondition =
        parentTaskId === 'all'
          ? Prisma.empty
          : parentTaskId && parentTaskId !== 'null' && parentTaskId !== ''
            ? Prisma.sql`AND t."parent_task_id" = ${whereClause.parentTaskId}::uuid`
            : Prisma.sql`AND t."parent_task_id" IS NULL`;

      const sprintCondition = sprintId
        ? Prisma.sql`AND t.sprint_id = ${sprintId}::uuid`
        : Prisma.empty;

      // Build scope-specific WHERE so LIMIT/OFFSET pages within the correct scope
      let rankedTaskIds: { id: string }[];

      if (scopeType === 'PROJECT') {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            AND t.project_id = ${scopeId}::uuid
            ${parentTaskCondition}
            ${sprintCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      } else if (scopeType === 'WORKSPACE') {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            AND p."workspace_id" = ${scopeId}::uuid
            ${parentTaskCondition}
            ${sprintCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      } else {
        rankedTaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id
            AND tr."scope_type"::text = ${scopeType}
            AND tr."scope_id"::uuid = ${scopeId}::uuid
            AND tr."view_type"::text = ${viewType}
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w."organization_id"::uuid = ${organizationId}::uuid
            ${parentTaskCondition}
            ${sprintCondition}
          ORDER BY tr.rank ${Prisma.raw(rankOrderDir)} NULLS LAST, t.created_at ${Prisma.raw(rankOrderDir)}
          LIMIT ${Prisma.raw(sqlLimit.toString())}
          OFFSET ${Prisma.raw(sqlOffset.toString())}`;
      }

      const taskIds = rankedTaskIds.map((r) => r.id);

      total = await this.prisma.task.count({ where: whereClause });

      if (taskIds.length > 0) {
        tasks = await this.prisma.task.findMany({
          where: {
            ...whereClause,
            id: { in: taskIds },
          },
          include: includeConfig,
        });

        // Re-order Prisma's results to mirror exactly the $queryRaw ID ordering
        const taskMap = new Map(tasks.map((t) => [t.id, t]));
        tasks = taskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is Task & { [key: string]: any } => !!t);
      }
    } else {
      if (groupBy && groupBy !== 'none') {
        tasks = await this.prisma.task.findMany({
          where: whereClause,
          include: includeConfig,
          orderBy,
        });
        total = tasks.length;
      } else {
        [tasks, total] = await Promise.all([
          this.prisma.task.findMany({
            where: whereClause,
            include: includeConfig,
            orderBy,
            take: limit,
            skip: skip,
          }),
          this.prisma.task.count({ where: whereClause }),
        ]);
      }
    }

    const formattedTasks = tasks.map((task) => ({
      ...task,
      labels: (
        (task.labels as Array<{ taskId: string; labelId: string; label: any }> | undefined) || []
      ).map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));

    let finalTasks = this.flattenTasksList(formattedTasks);
    let totalPages = Math.ceil(total / limit);

    if (groupBy && groupBy !== 'none') {
      type TaskType = (typeof finalTasks)[number];

      const getGroupKey = (task: TaskType): string => {
        switch (groupBy) {
          case 'status':
            return task.statusId || 'no-status';
          case 'priority':
            return task.priority || 'no-priority';
          case 'type':
            return task.type || 'no-type';
          case 'project':
            return task.projectId || 'no-project';
          case 'dueDate':
            return task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'no-date';
          case 'createdAt':
            return task.createdAt
              ? new Date(task.createdAt).toISOString().split('T')[0]
              : 'no-date';
          default:
            return 'all';
        }
      };

      // Group contiguous tasks
      const groups: TaskType[][] = [];
      let currentGroup: TaskType[] = [];
      let lastKey: string | null = null;

      for (const task of finalTasks) {
        const key = getGroupKey(task);
        if (lastKey === null) {
          currentGroup.push(task);
          lastKey = key;
        } else if (key === lastKey) {
          currentGroup.push(task);
        } else {
          groups.push(currentGroup);
          currentGroup = [task];
          lastKey = key;
        }
      }
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // Distribute groups into pages
      const pages: TaskType[][] = [];
      let currentPageTasks: TaskType[] = [];

      for (const group of groups) {
        if (currentPageTasks.length === 0) {
          currentPageTasks.push(...group);
        } else if (currentPageTasks.length + group.length <= limit) {
          currentPageTasks.push(...group);
        } else {
          pages.push(currentPageTasks);
          currentPageTasks = [...group];
        }
      }
      if (currentPageTasks.length > 0) {
        pages.push(currentPageTasks);
      }

      totalPages = pages.length;
      finalTasks = pages[page - 1] || [];
    }

    return {
      data: finalTasks as any,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * getTasksGrouped — returns tasks pre-grouped by the requested field.
   *
   * TWO MODES:
   * 1. Initial load  (groupKey absent)  — returns ALL groups with their first page.
   * 2. Load-more    (groupKey present)  — returns only the requested group's next
   *    page (offset-based), appending to existing frontend state.
   */

  async getTasksGrouped(
    dto: GetGroupedTasksDto,
    userId: string,
  ): Promise<{
    groups: {
      key: string;
      label: string;
      totalCount: number;
      tasks: any[];
      page?: number;
    }[];
    groupBy: string;
    page?: number;
    limitPerGroup?: number;
  }> {
    if (!userId) throw new ForbiddenException('User context required');

    const { organizationId, groupBy, limitPerGroup = 20, groupKey, page = 1 } = dto;
    const parsedLimit = Number(limitPerGroup);
    const parsedPage = Number(page);

    const access = await this.accessControl.getOrgAccess(organizationId, userId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    // ── Base where clause (same access-control pattern as findAll) ──────────
    const baseWhere: any = {
      project: { workspace: { organizationId } },
    };
    if (!access.isSuperAdmin && !access.isElevated) {
      baseWhere.project.OR = this.accessControl.getProjectVisibilityFilter(userId);
    }

    const andConditions: any[] = [];
    const parseIds = (csv?: string) =>
      csv
        ? csv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const workspaceIds = parseIds(dto.workspaceId);
    const projectIds = parseIds(dto.projectId);
    const priorities = parseIds(dto.priorities);
    const statuses = parseIds(dto.statuses);
    const types = parseIds(dto.types);
    const assigneeIds = parseIds(dto.assigneeIds);
    const reporterIds = parseIds(dto.reporterIds);

    if (workspaceIds.length) andConditions.push({ project: { workspaceId: { in: workspaceIds } } });
    if (projectIds.length) andConditions.push({ projectId: { in: projectIds } });
    if (dto.sprintId) andConditions.push({ sprintId: dto.sprintId });
    if (priorities.length) andConditions.push({ priority: { in: priorities } });
    if (statuses.length) andConditions.push({ statusId: { in: statuses } });
    if (types.length) andConditions.push({ type: { in: types } });
    if (assigneeIds.length)
      andConditions.push({ assignees: { some: { userId: { in: assigneeIds } } } });
    if (reporterIds.length)
      andConditions.push({ reporters: { some: { userId: { in: reporterIds } } } });
    if (dto.search?.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: dto.search.trim(), mode: 'insensitive' } },
          { description: { contains: dto.search.trim(), mode: 'insensitive' } },
        ],
      });
    }
    if (andConditions.length) baseWhere.AND = andConditions;

    // ── Standard include config ─────────────────────────────────────────────
    const includeConfig = {
      labels: {
        select: {
          taskId: true,
          labelId: true,
          label: { select: { id: true, name: true, color: true, description: true } },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          workspace: { select: { id: true, name: true, slug: true, organizationId: true } },
        },
      },
      assignees: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      reporters: {
        select: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
      status: { select: { id: true, name: true, color: true, category: true } },
      sprint: { select: { id: true, name: true, slug: true, status: true } },
      parentTask: { select: { id: true, title: true, slug: true, type: true } },
      _count: { select: { childTasks: true, comments: true, attachments: true } },
    };

    const formatTasks = (tasks: any[]): any[] =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      tasks.map((t: any) => ({
        ...t,

        labels: ((t.labels || []) as any[]).map((tl: any) => ({
          taskId: tl.taskId,
          labelId: tl.labelId,
          name: tl.label.name,
          color: tl.label.color,
          description: tl.label.description,
        })),
      }));

    // ── Field-specific grouping logic ───────────────────────────────────────
    interface RawGroup {
      key: string;
      label: string;
      extraWhere: any;
    }
    let rawGroups: RawGroup[] = [];

    switch (groupBy) {
      case GroupByField.STATUS: {
        const counts = await this.prisma.task.groupBy({
          by: ['statusId'],
          where: baseWhere,
          _count: true,
        });
        const statusIds = counts.map((c) => c.statusId).filter(Boolean);
        const statusRows = statusIds.length
          ? await this.prisma.taskStatus.findMany({
              where: { id: { in: statusIds } },
              select: { id: true, name: true },
            })
          : [];
        const nameMap = new Map(statusRows.map((s) => [s.id, s.name]));
        rawGroups = counts.map((c) => ({
          key: c.statusId ?? 'no-status',
          label: nameMap.get(c.statusId ?? '') ?? 'No Status',
          extraWhere: c.statusId ? { statusId: c.statusId } : { statusId: null },
        }));
        break;
      }
      case GroupByField.PRIORITY: {
        const PRIORITY_ORDER: Record<string, number> = {
          HIGHEST: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
          LOWEST: 4,
          URGENT: 5,
        };
        const PRIORITY_LABELS: Record<string, string> = {
          HIGHEST: 'Highest',
          HIGH: 'High',
          MEDIUM: 'Medium',
          LOW: 'Low',
          LOWEST: 'Lowest',
          URGENT: 'Urgent',
        };
        const counts = await this.prisma.task.groupBy({
          by: ['priority'],
          where: baseWhere,
          _count: true,
        });
        rawGroups = counts
          .map((c) => ({
            key: c.priority ?? 'no-priority',
            label: PRIORITY_LABELS[c.priority ?? ''] ?? c.priority ?? 'No Priority',
            extraWhere: c.priority ? { priority: c.priority } : { priority: null },
          }))
          .sort((a, b) => (PRIORITY_ORDER[a.key] ?? 99) - (PRIORITY_ORDER[b.key] ?? 99));
        break;
      }
      case GroupByField.PROJECT: {
        const counts = await this.prisma.task.groupBy({
          by: ['projectId'],
          where: baseWhere,
          _count: true,
        });
        const projectIds2 = counts.map((c) => c.projectId).filter(Boolean);
        const projectRows = projectIds2.length
          ? await this.prisma.project.findMany({
              where: { id: { in: projectIds2 } },
              select: { id: true, name: true },
            })
          : [];
        const projMap = new Map(projectRows.map((p) => [p.id, p.name]));
        rawGroups = counts.map((c) => ({
          key: c.projectId ?? 'no-project',
          label: projMap.get(c.projectId ?? '') ?? 'No Project',
          extraWhere: c.projectId ? { projectId: c.projectId } : { projectId: null },
        }));
        break;
      }
      case GroupByField.ASSIGNEE: {
        const counts = await this.prisma.taskAssignee.groupBy({
          by: ['userId'],
          where: { task: baseWhere },
          _count: true,
        });
        const userIds = counts.map((c) => c.userId);
        const userRows = userIds.length
          ? await this.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : [];
        const userMap = new Map(userRows.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
        rawGroups = [
          ...counts.map((c) => ({
            key: c.userId,
            label: userMap.get(c.userId) ?? 'Unknown',
            extraWhere: { assignees: { some: { userId: c.userId } } },
          })),
        ];
        // Add "Unassigned" group
        const unassignedCount = await this.prisma.task.count({
          where: { ...baseWhere, assignees: { none: {} } },
        });
        if (unassignedCount > 0) {
          rawGroups.push({
            key: 'unassigned',
            label: 'Unassigned',
            extraWhere: { assignees: { none: {} } },
          });
        }
        break;
      }
      case GroupByField.TYPE: {
        const TYPE_LABELS: Record<string, string> = {
          TASK: 'Task',
          BUG: 'Bug',
          EPIC: 'Epic',
          STORY: 'Story',
          SUBTASK: 'Sub-task',
        };
        const counts = await this.prisma.task.groupBy({
          by: ['type'],
          where: baseWhere,
          _count: true,
        });
        rawGroups = counts.map((c) => ({
          key: c.type ?? 'no-type',
          label: TYPE_LABELS[c.type ?? ''] ?? c.type ?? 'No Type',
          extraWhere: c.type ? { type: c.type } : { type: null },
        }));
        break;
      }
      case GroupByField.DUE_DATE: {
        // Group by calendar date — qualify column with table alias to avoid ambiguity
        const dateGroups = await this.prisma.$queryRaw<{ date_key: Date | null; cnt: bigint }[]>`
          SELECT DATE(t.due_date) AS date_key, COUNT(*) AS cnt
          FROM tasks t
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id::text = ${organizationId}
          GROUP BY DATE(t.due_date)
          ORDER BY date_key ASC NULLS LAST
        `;
        rawGroups = dateGroups.map((r) => {
          // Prisma returns PostgreSQL DATE as a JS Date object, not a plain string
          const key = r.date_key
            ? r.date_key instanceof Date
              ? r.date_key.toISOString().slice(0, 10)
              : String(r.date_key).slice(0, 10)
            : 'no-date';
          const label = r.date_key
            ? new Date(`${key}T12:00:00.000Z`).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
              })
            : 'No Due Date';
          return {
            key,
            label,
            extraWhere: r.date_key
              ? {
                  dueDate: {
                    gte: new Date(`${key}T00:00:00.000Z`),
                    lt: new Date(`${key}T23:59:59.999Z`),
                  },
                }
              : { dueDate: null },
          };
        });
        break;
      }
      case GroupByField.CREATED_AT: {
        // Qualify column with table alias to avoid ambiguity in the multi-table join
        const dateGroups = await this.prisma.$queryRaw<{ date_key: Date | null; cnt: bigint }[]>`
          SELECT DATE(t.created_at) AS date_key, COUNT(*) AS cnt
          FROM tasks t
          INNER JOIN projects p ON t.project_id = p.id
          INNER JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id::text = ${organizationId}
          GROUP BY DATE(t.created_at)
          ORDER BY date_key ASC NULLS LAST
        `;
        rawGroups = dateGroups.map((r) => {
          const key = r.date_key
            ? r.date_key instanceof Date
              ? r.date_key.toISOString().slice(0, 10)
              : String(r.date_key).slice(0, 10)
            : 'no-date';
          const label = r.date_key
            ? new Date(`${key}T12:00:00.000Z`).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
              })
            : 'No Created Date';
          return {
            key,
            label,
            extraWhere: r.date_key
              ? {
                  createdAt: {
                    gte: new Date(`${key}T00:00:00.000Z`),
                    lt: new Date(`${key}T23:59:59.999Z`),
                  },
                }
              : { createdAt: null },
          };
        });
        break;
      }
      default:
        throw new BadRequestException(`Unsupported groupBy field: ${String(groupBy)}`);
    }

    // ── MODE 2: Load-more for a single group ────────────────────────────────
    if (groupKey) {
      // Find the matching group descriptor from rawGroups
      const target = rawGroups.find((g) => g.key === groupKey);
      if (!target) {
        // Group not found — return empty (filters may have changed)
        return { groups: [], groupBy, page: parsedPage, limitPerGroup: parsedLimit };
      }

      const groupWhere = { ...baseWhere, ...target.extraWhere };
      if (andConditions.length && target.extraWhere) {
        groupWhere.AND = [...(baseWhere.AND || []), ...(target.extraWhere.AND || [])];
      }

      const skip = (parsedPage - 1) * parsedLimit;
      const [rawTasks, totalCount] = await Promise.all([
        this.prisma.task.findMany({
          where: groupWhere,
          include: includeConfig,
          orderBy: { createdAt: 'desc' },
          take: parsedLimit,
          skip,
        }),
        this.prisma.task.count({ where: groupWhere }),
      ]);

      return {
        groups: [
          {
            key: target.key,
            label: target.label,
            totalCount,
            tasks: formatTasks(rawTasks),
            page: parsedPage,
          },
        ],
        groupBy,
        page: parsedPage,
        limitPerGroup: parsedLimit,
      };
    }

    // ── MODE 1: Initial load — fetch first page of ALL groups in parallel ────
    const groups = await Promise.all(
      rawGroups.map(async (g) => {
        const groupWhere = { ...baseWhere, ...g.extraWhere };
        if (andConditions.length && g.extraWhere) {
          groupWhere.AND = [...(baseWhere.AND || []), ...(g.extraWhere.AND || [])];
        }

        const [rawTasks, totalCount] = await Promise.all([
          this.prisma.task.findMany({
            where: groupWhere,
            include: includeConfig,
            orderBy: { createdAt: 'desc' },
            take: parsedLimit,
          }),
          this.prisma.task.count({ where: groupWhere }),
        ]);

        return {
          key: g.key,
          label: g.label,
          totalCount,
          tasks: formatTasks(rawTasks),
          page: 1,
        };
      }),
    );

    return {
      groups: groups.filter((g) => g.totalCount > 0),
      groupBy,
      page: 1,
      limitPerGroup: parsedLimit,
    };
  }

  async findOne(id: string, userId: string) {
    const { isElevated, task: taskFromAccess } = await this.accessControl.getTaskAccess(id, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskFromAccess.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organization: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        parentTask: {
          select: { id: true, title: true, slug: true, type: true },
        },
        childTasks: isElevated
          ? {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                priority: true,
                status: {
                  select: { name: true, color: true, category: true },
                },
                assignees: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                      },
                    },
                  },
                },
                reporters: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                      },
                    },
                  },
                },
              },
            }
          : {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                priority: true,
                status: {
                  select: { name: true, color: true, category: true },
                },
                assignees: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                      },
                    },
                  },
                },
              },
              where: {
                OR: [
                  { assignees: { some: { userId: userId } } },
                  { reporters: { some: { userId: userId } } },
                  { createdBy: userId },
                ],
              },
            },
        labels: {
          include: {
            label: {
              select: { id: true, name: true, color: true, description: true },
            },
          },
        },
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
        timeEntries: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { date: 'desc' },
        },
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            id: true,
          },
        },
        recurringConfig: {
          select: {
            id: true,
            recurrenceType: true,
            interval: true,
            daysOfWeek: true,
            dayOfMonth: true,
            monthOfYear: true,
            endType: true,
            endDate: true,
            occurrenceCount: true,
            currentOccurrence: true,
            nextOccurrence: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            childTasks: true,
            comments: true,
            attachments: true,
            watchers: true,
            timeEntries: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const projectInbox = await this.prisma.projectInbox.findUnique({
      where: { projectId: task.projectId },
    });
    return this.flattenTaskRelations({
      ...task,
      showEmailReply: projectInbox,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    });
  }

  async findByKey(key: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { slug: key },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check access
    await this.accessControl.getTaskAccess(task.id, userId);

    return this.findOne(task.id, userId);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    const {
      canChange,
      role,
      task: taskFromAccess,
    } = await this.accessControl.getTaskAccess(id, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    if (!canChange) {
      throw new ForbiddenException('Insufficient permissions to update this task');
    }

    // Members can ONLY update task status
    if (role === Role.MEMBER) {
      const restrictedFields = [
        'title',
        'description',
        'priority',
        'startDate',
        'dueDate',
        'type',
        'storyPoints',
        'originalEstimate',
        'remainingEstimate',
        'projectId',
        'assigneeIds',
        'reporterIds',
        'sprintId',
        'parentTaskId',
        'isRecurring',
        'recurrenceConfig',
        'allowEmailReplies',
        'stopRecurrence',
      ];
      const attemptedChanges = Object.keys(updateTaskDto).filter(
        (key) => updateTaskDto[key] !== undefined,
      );
      const violation = attemptedChanges.find((field) => restrictedFields.includes(field));

      if (violation) {
        throw new ForbiddenException(`Members are not allowed to update the ${violation} field`);
      }
    }

    const task = taskFromAccess;

    const effectiveStartDate = updateTaskDto.startDate ?? task?.startDate?.toISOString();
    const effectiveDueDate = updateTaskDto.dueDate ?? task?.dueDate?.toISOString();
    if (effectiveStartDate && effectiveDueDate) {
      if (new Date(effectiveStartDate) > new Date(effectiveDueDate)) {
        throw new BadRequestException('Start date must be before the due date');
      }
    }

    try {
      let taskStatus;

      if (updateTaskDto.statusId) {
        taskStatus = await this.prisma.taskStatus.findUnique({
          where: { id: updateTaskDto.statusId },
        });

        if (!taskStatus) {
          throw new NotFoundException('Task status not found');
        }
      }

      // Handle completedAt based on status
      if (taskStatus?.category === 'DONE') {
        updateTaskDto.completedAt = new Date().toISOString();
      } else if (taskStatus) {
        updateTaskDto.completedAt = null;
      }
      const {
        assigneeIds,
        reporterIds,
        description,
        title,
        customFields,
        parentTaskId,
        ...taskData
      } = updateTaskDto;
      const updateData: any = { ...taskData };

      // Resolve parentTaskId if it's a slug
      if (parentTaskId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          parentTaskId,
        );
        if (!isUuid) {
          const parentTask = await this.prisma.task.findFirst({
            where: { slug: parentTaskId },
            select: { id: true },
          });
          if (!parentTask) {
            throw new NotFoundException(`Parent task with slug ${parentTaskId} not found`);
          }
          updateData.parentTaskId = parentTask.id;
        } else {
          updateData.parentTaskId = parentTaskId;
        }
      } else if (parentTaskId === null) {
        updateData.parentTaskId = null;
      }

      // Sanitize description if provided
      if (description !== undefined) {
        updateData.description = sanitizeHtml(description);
      }

      // Sanitize title if provided
      if (title !== undefined) {
        updateData.title = sanitizeText(title);
      }

      // Sanitize customFields if provided
      if (customFields !== undefined) {
        updateData.customFields = sanitizeObject(customFields);
      }

      // Handle assignees update
      if (assigneeIds !== undefined) {
        if (assigneeIds.length > 0) {
          const existingUsers = await this.prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true },
          });
          const foundIds = new Set(existingUsers.map((u) => u.id));
          const missingIds = assigneeIds.filter((id) => !foundIds.has(id));
          if (missingIds.length > 0) {
            throw new NotFoundException(`Users not found: ${missingIds.join(', ')}`);
          }
        }
        updateData.assignees = {
          deleteMany: {},
          create: assigneeIds.map((id) => ({ userId: id })),
        };
      }

      // Handle reporters update
      if (reporterIds !== undefined) {
        if (reporterIds.length > 0) {
          const existingUsers = await this.prisma.user.findMany({
            where: { id: { in: reporterIds } },
            select: { id: true },
          });
          const foundIds = new Set(existingUsers.map((u) => u.id));
          const missingIds = reporterIds.filter((id) => !foundIds.has(id));
          if (missingIds.length > 0) {
            throw new NotFoundException(`Users not found: ${missingIds.join(', ')}`);
          }
        }
        updateData.reporters = {
          deleteMany: {},
          create: reporterIds.map((id) => ({ userId: id })),
        };
      }
      const updatedTask = await this.prisma.task.update({
        where: { id: taskFromAccess.id },
        data: updateData,
        include: {
          project: {
            select: { id: true, name: true, slug: true },
          },
          assignees: {
            select: {
              user: {
                select: { id: true, firstName: true, lastName: true, avatar: true },
              },
            },
          },
          reporters: {
            select: {
              user: {
                select: { id: true, firstName: true, lastName: true, avatar: true },
              },
            },
          },
          status: {
            select: { id: true, name: true, color: true, category: true },
          },
          parentTask: {
            select: { id: true, title: true, slug: true, type: true },
          },
          _count: {
            select: { childTasks: true, comments: true },
          },
        },
      });

      return this.flattenTaskRelations(updatedTask);
    } catch (error: any) {
      if (error.code === 'P2025' || error instanceof NotFoundException) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Task not found');
        }
        throw error;
      }
      this.logger.error(`Failed to update the task: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<Task> {
    const { isElevated, task } = await this.accessControl.getTaskAccess(id, userId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!isElevated) {
      throw new ForbiddenException('Only managers and owners can delete tasks');
    }

    try {
      // Check if task exists and has subtasks
      const taskWithCounts = await this.prisma.task.findUnique({
        where: { id: task.id },
        select: {
          id: true,
          _count: {
            select: { childTasks: true },
          },
        },
      });

      if (!taskWithCounts) {
        throw new NotFoundException('Task not found');
      }

      await this.prisma.task.delete({
        where: { id: task.id },
      });
      return task;
    } catch (error: any) {
      this.logger.error('Failed to delete the task');
      if (error.code === 'P2025') {
        throw new NotFoundException('Task not found');
      }
      throw error;
    }
  }

  async addComment(taskId: string, comment: string, userId: string) {
    // Check task access first and get task object
    const { task } = await this.accessControl.getTaskAccess(taskId, userId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const newComment = await this.prisma.taskComment.create({
      data: {
        content: sanitizeHtml(comment),
        taskId: task.id,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return newComment;
  }

  async findByOrganization(
    orgId: string,
    assigneeId?: string,
    priority?: TaskPriority,
    search?: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<{
    tasks: Task[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const access = await this.accessControl.getOrgAccess(orgId, userId);

    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });

    const workspaceIds = workspaces.map((w) => w.id);
    if (workspaceIds.length === 0) {
      return {
        tasks: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const projects = await this.prisma.project.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) {
      return {
        tasks: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const whereClause: any = {
      projectId: { in: projectIds },
      parentTaskId: null,
    };

    if (priority) {
      whereClause.priority = priority;
    }

    const andConditions: any[] = [];

    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // If not elevated (and not super admin), apply visibility filters
    if (!access.isSuperAdmin && !access.isElevated) {
      andConditions.push({
        OR: [
          ...this.accessControl.getTaskVisibilityFilter(userId),
          { assignees: { some: { userId: userId } } },
          { reporters: { some: { userId: userId } } },
          { createdBy: userId },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const totalCount = await this.prisma.task.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        labels: { include: { label: true } },
        project: { select: { id: true, name: true, slug: true } },
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: { select: { id: true, name: true, slug: true, status: true } },
        parentTask: {
          select: { id: true, title: true, slug: true, type: true },
        },
        _count: { select: { childTasks: true, comments: true } },
      },
      orderBy: { taskNumber: 'desc' },
      skip,
      take: limit,
    });

    const transformedTasks = tasks.map((task) => ({
      ...task,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));

    return {
      tasks: this.flattenTasksList(transformedTasks),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findTodaysTasks(
    organizationId: string,
    filters: {
      assigneeId?: string;
      reporterId?: string;
      userId?: string;
    } = {},
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<{
    tasks: Task[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const access = await this.accessControl.getOrgAccess(organizationId, userId);

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true },
    });

    const workspaceIds = workspaces.map((w) => w.id);
    if (workspaceIds.length === 0) {
      return {
        tasks: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const projects = await this.prisma.project.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) {
      return {
        tasks: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const whereClause: Prisma.TaskWhereInput = {
      projectId: { in: projectIds },
      OR: [
        { dueDate: { gte: startOfDay, lte: endOfDay } },
        { createdAt: { gte: startOfDay, lte: endOfDay } },
        { updatedAt: { gte: startOfDay, lte: endOfDay } },
        { completedAt: { gte: startOfDay, lte: endOfDay } },
      ],
    };

    const userFilters: Prisma.TaskWhereInput[] = [];

    if (filters.assigneeId) {
      userFilters.push({ assignees: { some: { userId: filters.assigneeId } } });
    }

    if (filters.reporterId) {
      userFilters.push({ reporters: { some: { userId: filters.reporterId } } });
    }

    if (filters.userId) {
      userFilters.push(
        { assignees: { some: { userId: filters.userId } } },
        { reporters: { some: { userId: filters.userId } } },
        { createdBy: filters.userId },
      );
    }

    // If not elevated (and not super admin), apply visibility and user filtering
    if (!access.isSuperAdmin && !access.isElevated) {
      const visibilityAndUserFilters: Prisma.TaskWhereInput[] = [
        ...this.accessControl.getTaskVisibilityFilter(userId),
        ...(userFilters.length > 0
          ? userFilters
          : [
              { assignees: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
              { createdBy: userId },
            ]),
      ];
      whereClause.AND = [{ OR: whereClause.OR }, { OR: visibilityAndUserFilters }];
      delete whereClause.OR;
    } else if (userFilters.length > 0) {
      // Elevated users only get filtered if they provided specific filter params
      whereClause.AND = [{ OR: whereClause.OR }, { OR: userFilters }];
      delete whereClause.OR;
    }

    const [totalCount, tasks] = await Promise.all([
      this.prisma.task.count({ where: whereClause }),
      this.prisma.task.findMany({
        where: whereClause,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              workspace: {
                select: { id: true, name: true, organizationId: true },
              },
            },
          },
          assignees: {
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                },
              },
            },
          },
          reporters: {
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                },
              },
            },
          },
          status: {
            select: { id: true, name: true, color: true, category: true },
          },
          sprint: {
            select: { id: true, name: true, status: true },
          },
          parentTask: {
            select: { id: true, title: true, type: true },
          },
          _count: {
            select: { childTasks: true, comments: true, timeEntries: true },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      tasks: this.flattenTasksList(tasks),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getTasksGroupedByStatus(
    params: TasksByStatusParams,
    userId: string,
  ): Promise<TasksByStatus[]> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const { slug, includeSubtasks = false, statusId, sprintId, page = 1, limit = 25 } = params;

    try {
      // Fetch project with workflow and statuses
      const project = await this.prisma.project.findUnique({
        where: { slug },
        include: {
          workflow: {
            include: {
              statuses: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });

      if (!project || !project.workflow) {
        throw new NotFoundException('Project or project workflow not found');
      }

      // Check project access
      const projectAccess = await this.accessControl.getProjectAccess(project.id, userId);

      // Build where clause
      const whereClause: any = {
        projectId: project.id,
      };
      if (sprintId) {
        whereClause.sprintId = sprintId;
      }

      // Filter by user if not elevated
      if (!projectAccess.isElevated) {
        whereClause.OR = [
          {
            assignees: {
              some: { userId: userId },
            },
          },
          {
            reporters: {
              some: { userId: userId },
            },
          },
          {
            createdBy: userId,
          },
        ];
      }

      // Exclude subtasks if specified
      if (!includeSubtasks) {
        whereClause.parentTaskId = null;
      }

      // Filter workflow statuses based on statusId parameter
      let workflowStatuses = project.workflow.statuses;
      if (statusId) {
        workflowStatuses = workflowStatuses.filter((status) => status.id === statusId);

        if (workflowStatuses.length === 0) {
          throw new NotFoundException(`Status with ID ${statusId} not found in project workflow`);
        }
      }

      // Only get tasks from workflow statuses
      whereClause.status = {
        id: {
          in: workflowStatuses.map((status) => status.id),
        },
      };

      // Normalize pagination values
      const currentPage = Math.max(1, page);
      const pageLimit = Math.min(100, Math.max(1, limit));
      const skip = (currentPage - 1) * pageLimit;

      // Get counts for each status
      const taskCountsByStatus = await Promise.all(
        workflowStatuses.map(async (status) => {
          const count = await this.prisma.task.count({
            where: {
              ...whereClause,
              statusId: status.id,
            },
          });
          return { statusId: status.id, count };
        }),
      );

      const countMap = new Map(taskCountsByStatus.map((item) => [item.statusId, item.count]));

      // Fetch paginated tasks for each status in parallel
      const statusTasksPromises = workflowStatuses.map(async (status) => {
        const totalCount = countMap.get(status.id) || 0;
        const totalPages = Math.ceil(totalCount / pageLimit);

        // Fetch IDs in order using ranks
        const rankedIds = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          LEFT JOIN task_ranks tr ON t.id = tr.task_id 
            AND tr.scope_type = 'PROJECT'::"ScopeType"
            AND tr.scope_id = ${project.id}::uuid
            AND tr.view_type = 'BOARD'::"ViewType"
          WHERE t.status_id = ${status.id}::uuid
            AND t.project_id = ${project.id}::uuid
            ${sprintId ? Prisma.raw(`AND t.sprint_id = '${sprintId}'::uuid`) : Prisma.empty}
            ${!includeSubtasks ? Prisma.raw('AND t.parent_task_id IS NULL') : Prisma.empty}
          ORDER BY tr.rank DESC NULLS LAST, t.created_at DESC
          LIMIT ${Prisma.raw(pageLimit.toString())}
          OFFSET ${Prisma.raw(skip.toString())}
        `;

        const taskIds = rankedIds.map((r) => r.id);

        const tasks =
          taskIds.length > 0
            ? await this.prisma.task.findMany({
                where: {
                  id: { in: taskIds },
                },
                include: {
                  status: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                      category: true,
                      position: true,
                    },
                  },
                  assignees: {
                    select: {
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          avatar: true,
                        },
                      },
                    },
                  },
                  reporters: {
                    select: {
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                },
              })
            : [];

        // Manual re-order to match rankedIds
        const taskMap = new Map(tasks.map((t) => [t.id, t]));
        const sortedTasks = taskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is (typeof tasks)[0] => !!t);

        return {
          statusId: status.id,
          statusName: status.name,
          statusColor: status.color,
          statusCategory: status.category,
          tasks: sortedTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description || undefined,
            priority: task.priority,
            taskNumber: task.taskNumber,
            assignees: task.assignees
              ? task.assignees.map((assignee) => ({
                  id: assignee.user.id,
                  firstName: assignee.user.firstName,
                  lastName: assignee.user.lastName,
                  avatar: assignee.user.avatar || undefined,
                }))
              : undefined,
            reporters: task.reporters
              ? task.reporters.map((reporter) => ({
                  id: reporter.user.id,
                  firstName: reporter.user.firstName,
                  lastName: reporter.user.lastName,
                }))
              : undefined,
            dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          })),
          pagination: {
            total: totalCount,
            page: currentPage,
            limit: pageLimit,
            totalPages: totalPages,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
          },
        };
      });

      const results = await Promise.all(statusTasksPromises);

      return results;
    } catch (error) {
      this.logger.error('Error fetching tasks grouped by status:');
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch tasks grouped by status');
    }
  }

  // Additional helper methods with role-based filtering
  async findSubtasksByParent(parentTaskId: string, userId: string): Promise<Task[]> {
    const { isElevated, task } = await this.accessControl.getTaskAccess(parentTaskId, userId);

    const whereClause: any = {
      parentTaskId: task!.id,
    };

    // If not elevated, filter to user-related subtasks only
    if (!isElevated) {
      whereClause.OR = [{ assigneeId: userId }, { reporterId: userId }, { createdBy: userId }];
    }

    const subtasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        labels: { include: { label: true } },
        project: {
          select: { id: true, name: true, slug: true },
        },
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        parentTask: {
          select: { id: true, title: true, slug: true, type: true },
        },
        _count: {
          select: { childTasks: true, comments: true },
        },
      },
      orderBy: { taskNumber: 'asc' },
    });
    return this.flattenTasksList(subtasks);
  }

  async findMainTasks(
    projectId?: string,
    workspaceId?: string,
    priorities?: string[],
    statuses?: string[],
    userId?: string,
  ): Promise<Task[]> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const whereClause: any = {
      parentTaskId: null,
    };

    // Handle workspace filtering
    if (workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, organizationId: true },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      // Check workspace access
      const access = await this.accessControl.getWorkspaceAccess(workspaceId, userId);

      whereClause.project = {
        workspaceId,
      };

      // If not super admin and not workspace elevated user, apply visibility filters within workspace
      if (!access.isSuperAdmin && !access.isElevated) {
        whereClause.project.OR = this.accessControl.getProjectVisibilityFilter(userId);
      }
    } else if (projectId) {
      await this.accessControl.getProjectAccess(projectId, userId);
      whereClause.projectId = projectId;
    } else {
      // If neither workspaceId nor projectId is provided, we still need to ensure
      // the user only sees what they have access to.
      // This is less common for findMainTasks but should be handled.
      throw new BadRequestException('Either projectId or workspaceId must be provided');
    }

    // Add priority filter
    if (priorities && priorities.length > 0) {
      whereClause.priority = { in: priorities };
    }

    // Add status filter
    if (statuses && statuses.length > 0) {
      whereClause.statusId = { in: statuses };
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        labels: { include: { label: true } },
        project: {
          select: { id: true, name: true, slug: true },
        },
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        _count: {
          select: { childTasks: true, comments: true },
        },
      },
      orderBy: { taskNumber: 'desc' },
    });

    return this.flattenTasksList(
      tasks.map((task) => ({
        ...task,
        labels: task.labels.map((taskLabel) => ({
          taskId: taskLabel.taskId,
          labelId: taskLabel.labelId,
          name: taskLabel.label.name,
          color: taskLabel.label.color,
          description: taskLabel.label.description,
        })),
      })),
    );
  }

  async bulkDeleteTasks(params: {
    taskIds?: string[];
    projectId?: string;
    all?: boolean;
    excludedIds?: string[];
    userId: string;
  }): Promise<{
    deletedCount: number;
    failedTasks: Array<{ id: string; reason: string }>;
  }> {
    const { taskIds, projectId, all, excludedIds, userId } = params;

    if ((!taskIds || taskIds.length === 0) && !all) {
      throw new BadRequestException('No task IDs provided and "all" flag not set');
    }

    // Build task filter
    const taskFilter: any = {};
    if (all) {
      if (projectId) taskFilter.projectId = projectId;
      if (excludedIds && excludedIds.length > 0) {
        taskFilter.id = { notIn: excludedIds };
      }
    } else {
      let finalTaskIds = taskIds || [];
      if (excludedIds && excludedIds.length > 0) {
        finalTaskIds = finalTaskIds.filter((id) => !excludedIds.includes(id));
      }
      taskFilter.id = { in: finalTaskIds };
    }

    // Fetch tasks with project and member info
    const tasks = await this.prisma.task.findMany({
      where: taskFilter,
      include: {
        project: {
          include: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    const deletableTasks: string[] = [];
    const failedTasks: Array<{ id: string; reason: string }> = [];

    for (const task of tasks) {
      try {
        const { isElevated } = await this.accessControl.getTaskAccess(task.id, userId);
        if (isElevated) {
          deletableTasks.push(task.id);
        } else {
          failedTasks.push({
            id: task.id,
            reason: 'Insufficient permissions',
          });
        }
      } catch (error) {
        failedTasks.push({
          id: task.id,
          reason: error.message || 'Permission check failed',
        });
      }
    }

    // Handle missing tasks when using specific IDs
    if (taskIds && taskIds.length > 0) {
      const foundTaskIds = tasks.map((t) => t.id);
      const missingTaskIds = taskIds.filter((id) => !foundTaskIds.includes(id));
      missingTaskIds.forEach((id) => failedTasks.push({ id, reason: 'Task not found' }));
    }

    // Delete tasks directly (cascade will handle related records)
    let deletedCount = 0;
    if (deletableTasks.length > 0) {
      try {
        const result = await this.prisma.task.deleteMany({
          where: { id: { in: deletableTasks } },
        });
        deletedCount = result.count;
      } catch (error) {
        this.logger.error('Failed to bulk delete tasks');
        throw new InternalServerErrorException('Failed to delete tasks: ' + error.message);
      }
    }

    return { deletedCount, failedTasks };
  }

  /**
   * Complete current occurrence and generate the next one for recurring tasks
   */
  async completeOccurrenceAndGenerateNext(taskId: string, userId: string) {
    // Verify task access
    const { task: taskFromAccess } = await this.accessControl.getTaskAccess(taskId, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskFromAccess.id },
      include: {
        recurringConfig: true,
        assignees: { select: { userId: true } },
        reporters: { select: { userId: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.isRecurring || !task.recurringConfig) {
      throw new BadRequestException('This task is not a recurring task');
    }

    const recurringConfig = task.recurringConfig;

    // Check if recurrence is complete
    if (this.recurrenceService.isRecurrenceComplete(recurringConfig)) {
      // Just mark this task as complete without generating next
      const completedTask = await this.update(
        taskId,
        { completedAt: new Date().toISOString() },
        userId,
      );
      return {
        completedTask,
        nextTask: null,
      };
    }

    // Mark current task as complete
    const completedTask = await this.update(
      taskId,
      { completedAt: new Date().toISOString() },
      userId,
    );

    // Calculate next occurrence
    const nextOccurrence = this.recurrenceService.calculateNextOccurrence(
      task.dueDate || new Date(),
      recurringConfig,
    );

    // Create next task instance
    const nextTask = await this.create(
      {
        title: task.title,
        description: task.description || undefined,
        type: task.type,
        priority: task.priority,
        projectId: task.projectId,
        statusId: task.statusId,
        sprintId: task.sprintId || undefined,
        dueDate: nextOccurrence.toISOString(),
        assigneeIds: task.assignees.map((a) => a.userId),
        reporterIds: task.reporters.map((r) => r.userId),
        isRecurring: false, // Next instance is not itself recurring
      },
      userId,
    );

    // Update recurring config
    await this.prisma.recurringTask.update({
      where: { id: recurringConfig.id },
      data: {
        currentOccurrence: recurringConfig.currentOccurrence + 1,
        nextOccurrence,
      },
    });

    return {
      completedTask,
      nextTask,
    };
  }

  /**
   * Add recurrence configuration to an existing non-recurring task
   */
  async addRecurrence(taskId: string, recurrenceConfig: RecurrenceConfigDto, userId: string) {
    const { task: taskFromAccess } = await this.accessControl.getTaskAccess(taskId, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskFromAccess.id },
      include: { recurringConfig: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.isRecurring || task.recurringConfig) {
      throw new BadRequestException('This task is already a recurring task');
    }

    const nextOccurrence = this.recurrenceService.calculateNextOccurrence(
      task.dueDate || new Date(),
      recurrenceConfig,
    );

    // Create recurring task configuration
    const recurringTask = await this.prisma.recurringTask.create({
      data: {
        taskId: taskFromAccess.id,
        recurrenceType: recurrenceConfig.recurrenceType,
        interval: recurrenceConfig.interval,
        daysOfWeek: recurrenceConfig.daysOfWeek || [],
        dayOfMonth: recurrenceConfig.dayOfMonth,
        monthOfYear: recurrenceConfig.monthOfYear,
        endType: recurrenceConfig.endType,
        endDate: recurrenceConfig.endDate ? new Date(recurrenceConfig.endDate) : null,
        occurrenceCount: recurrenceConfig.occurrenceCount,
        nextOccurrence,
        currentOccurrence: 1,
        isActive: true,
      },
    });

    // Update task to mark it as recurring
    await this.prisma.task.update({
      where: { id: taskFromAccess.id },
      data: { isRecurring: true },
    });

    return recurringTask;
  }

  /**
   * Update recurrence configuration for a task
   */
  async updateRecurrenceConfig(
    taskId: string,
    recurrenceConfig: RecurrenceConfigDto,
    userId: string,
  ) {
    const { task: taskFromAccess } = await this.accessControl.getTaskAccess(taskId, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskFromAccess.id },
      include: { recurringConfig: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.isRecurring || !task.recurringConfig) {
      throw new BadRequestException('This task is not a recurring task');
    }

    const nextOccurrence = this.recurrenceService.calculateNextOccurrence(
      task.dueDate || new Date(),
      recurrenceConfig,
    );

    return this.prisma.recurringTask.update({
      where: { id: task.recurringConfig.id },
      data: {
        recurrenceType: recurrenceConfig.recurrenceType,
        interval: recurrenceConfig.interval,
        daysOfWeek: recurrenceConfig.daysOfWeek || [],
        dayOfMonth: recurrenceConfig.dayOfMonth,
        monthOfYear: recurrenceConfig.monthOfYear,
        endType: recurrenceConfig.endType,
        endDate: recurrenceConfig.endDate ? new Date(recurrenceConfig.endDate) : null,
        occurrenceCount: recurrenceConfig.occurrenceCount,
        nextOccurrence,
      },
    });
  }

  /**
   * Stop recurrence for a task
   */
  async stopRecurrence(taskId: string, userId: string) {
    const { task: taskFromAccess } = await this.accessControl.getTaskAccess(taskId, userId);

    if (!taskFromAccess) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskFromAccess.id },
      include: { recurringConfig: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.isRecurring || !task.recurringConfig) {
      throw new BadRequestException('This task is not a recurring task');
    }

    // Deactivate recurrence
    await this.prisma.recurringTask.delete({
      where: { id: task.recurringConfig.id },
    });

    // Update task to mark it as not recurring
    return this.prisma.task.update({
      where: { id: taskFromAccess.id },
      data: { isRecurring: false },
    });
  }

  /**
   * Get all recurring tasks for a project
   */
  async getRecurringTasks(projectId: string, userId: string) {
    // Verify project access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workspace: {
          select: { organizationId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.accessControl.getOrgAccess(project.workspace.organizationId, userId);

    const recurringTasks = await this.prisma.task.findMany({
      where: {
        projectId,
        isRecurring: true,
      },
      include: {
        recurringConfig: true,
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
      },
    });
    return this.flattenTasksList(recurringTasks);
  }

  async bulkUpdateTasksStatus(params: {
    taskIds?: string[];
    projectId?: string;
    all?: boolean;
    excludedIds?: string[];
    statusId?: string;
    userId: string;
    search?: string;
    statuses?: string;
    priorities?: string;
    types?: string;
    assignees?: string;
    reporters?: string;
    sprintId?: string;
    workspaceId?: string;
  }): Promise<{
    updatedCount: number;
    updatedTasks: Task[];
    failedTasks: Array<{ id: string; reason: string }>;
  }> {
    const {
      taskIds,
      projectId,
      all,
      excludedIds,
      statusId,
      userId,
      search,
      statuses,
      priorities,
      types,
      assignees,
      reporters,
      sprintId,
      workspaceId,
    } = params;

    if ((!taskIds || taskIds.length === 0) && !all) {
      throw new BadRequestException('No task IDs provided and "all" flag not set');
    }

    // Build task filter
    const taskFilter: any = {};
    if (all) {
      if (projectId) taskFilter.projectId = projectId;
      if (workspaceId) taskFilter.project = { workspaceId };

      const andConditions: any[] = [];
      if (statuses) andConditions.push({ statusId: { in: statuses.split(',') } });
      if (priorities) andConditions.push({ priority: { in: priorities.split(',') } });
      if (types) andConditions.push({ type: { in: types.split(',') } });
      if (sprintId) andConditions.push({ sprintId });

      if (search?.trim()) {
        andConditions.push({
          OR: [
            { title: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ],
        });
      }

      if (assignees) {
        andConditions.push({ assignees: { some: { userId: { in: assignees.split(',') } } } });
      }
      if (reporters) {
        andConditions.push({ reporters: { some: { userId: { in: reporters.split(',') } } } });
      }
      if (excludedIds && excludedIds.length > 0) {
        andConditions.push({ id: { notIn: excludedIds } });
      }

      if (andConditions.length > 0) {
        taskFilter.AND = andConditions;
      }
    } else {
      let finalTaskIds = taskIds || [];
      if (excludedIds && excludedIds.length > 0) {
        finalTaskIds = finalTaskIds.filter((id) => !excludedIds.includes(id));
      }
      taskFilter.id = { in: finalTaskIds };
    }

    const tasks = await this.prisma.task.findMany({
      where: taskFilter,
      include: {
        project: {
          include: {
            workflow: {
              include: { statuses: true },
            },
          },
        },
      },
    });

    const updatedTasks: Task[] = [];
    let failedTasks: Array<{ id: string; reason: string }> = [];

    // Handle missing tasks when using specific IDs
    if (taskIds && taskIds.length > 0 && !all) {
      const foundTaskIds = tasks.map((t) => t.id);
      const missingTaskIds = taskIds.filter((id) => !foundTaskIds.includes(id));
      failedTasks = missingTaskIds.map((id) => ({
        id,
        reason: 'Task not found',
      }));
    }

    // Pre-fetch status if statusId is provided
    let globalTargetStatus: any = null;
    if (statusId) {
      globalTargetStatus = await this.prisma.taskStatus.findUnique({
        where: { id: statusId },
      });
      if (!globalTargetStatus) {
        throw new NotFoundException('Target status not found');
      }
    }

    for (const task of tasks) {
      try {
        // Permission check
        const { canChange } = await this.accessControl.getTaskAccess(task.id, userId);
        if (!canChange) {
          failedTasks.push({
            id: task.id,
            reason: 'Insufficient permissions to update this task',
          });
          continue;
        }

        let statusToApply: any = null;
        if (!statusId) {
          // Find first status with category DONE in task's project workflow
          statusToApply = task.project.workflow?.statuses.find((s) => s.category === 'DONE');
          if (!statusToApply) {
            failedTasks.push({
              id: task.id,
              reason: 'No "Done" status found for this project workflow',
            });
            continue;
          }
        } else {
          // First, check if the provided statusId is directly available in this task's project workflow
          statusToApply = task.project.workflow?.statuses.find((s) => s.id === statusId);

          // If not directly available (common in multi-workflow/org-wide views),
          // try to find a status with the same name in this project's workflow
          if (!statusToApply && globalTargetStatus) {
            const targetStatusName = (globalTargetStatus.name as string).toLowerCase();
            statusToApply = task.project.workflow?.statuses.find(
              (s: any) => (s.name as string).toLowerCase() === targetStatusName,
            );
          }

          if (!statusToApply) {
            failedTasks.push({
              id: task.id,
              reason: `Status "${globalTargetStatus?.name || 'Unknown'}" is not available for this project's workflow`,
            });
            continue;
          }
        }

        const updateData: any = {
          statusId: statusToApply.id,
          updatedBy: userId,
        };

        // If it's a DONE category status, set completedAt
        if (statusToApply.category === 'DONE') {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }

        const updatedTask = await this.prisma.task.update({
          where: { id: task.id },
          data: updateData,
          include: {
            status: { select: { id: true, name: true, color: true, category: true } },
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: { id: true, name: true, slug: true, organizationId: true },
                },
              },
            },
            assignees: {
              select: {
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
                },
              },
            },
            reporters: {
              select: {
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
                },
              },
            },
            sprint: { select: { id: true, name: true, slug: true, status: true } },
            _count: {
              select: { childTasks: true, comments: true, attachments: true },
            },
          },
        });

        updatedTasks.push(updatedTask as unknown as Task);
      } catch (err: any) {
        failedTasks.push({
          id: task.id,
          reason: err.message || 'Unknown error occurred during update',
        });
      }
    }

    return {
      updatedCount: updatedTasks.length,
      updatedTasks: this.flattenTasksList(updatedTasks),
      failedTasks,
    };
  }

  async reorderTask(taskId: string, userId: string, dto: ReorderDto) {
    const { task } = await this.accessControl.getTaskAccess(taskId, userId);

    // Resolve neighbors if they are slugs
    let afterId = dto.afterTaskId;
    let beforeId = dto.beforeTaskId;

    if (
      afterId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(afterId)
    ) {
      const afterTask = await this.prisma.task.findFirst({
        where: { slug: afterId },
        select: { id: true },
      });
      if (afterTask) afterId = afterTask.id;
    }

    if (
      beforeId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(beforeId)
    ) {
      const beforeTask = await this.prisma.task.findFirst({
        where: { slug: beforeId },
        select: { id: true },
      });
      if (beforeTask) beforeId = beforeTask.id;
    }

    return this.taskRanksService.reorder({
      taskId: task!.id,
      ...dto,
      afterTaskId: afterId,
      beforeTaskId: beforeId,
    });
  }

  async bulkAssignTasks(params: {
    taskIds?: string[];
    projectId?: string;
    all?: boolean;
    excludedIds?: string[];
    assigneeIds?: string[];
    userId: string;
    search?: string;
    statuses?: string;
    priorities?: string;
    types?: string;
    assignees?: string;
    reporters?: string;
    sprintId?: string;
    workspaceId?: string;
  }): Promise<{
    assignedCount: number;
    updatedTasks: Task[];
    failedTasks: Array<{ id: string; reason: string }>;
  }> {
    const {
      taskIds,
      projectId,
      all,
      excludedIds,
      assigneeIds,
      userId,
      search,
      statuses,
      priorities,
      types,
      assignees,
      reporters,
      sprintId,
      workspaceId,
    } = params;

    if ((!taskIds || taskIds.length === 0) && !all) {
      throw new BadRequestException('No task IDs provided and "all" flag not set');
    }

    if (!assigneeIds) {
      throw new BadRequestException(
        'assigneeIds must be provided (can be empty array to clear assignments)',
      );
    }

    // Verify all assignee user IDs exist (skip if clearing assignments with empty array)
    if (assigneeIds.length > 0) {
      const existingUsers = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true },
      });
      if (existingUsers.length !== assigneeIds.length) {
        const foundIds = existingUsers.map((u) => u.id);
        const missingIds = assigneeIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(`Invalid assignee IDs: ${missingIds.join(', ')}`);
      }
    }

    // Build task filter (same pattern as bulkUpdateTasksStatus)
    const taskFilter: any = {};
    if (all) {
      if (projectId) taskFilter.projectId = projectId;
      if (workspaceId) taskFilter.project = { workspaceId };

      const andConditions: any[] = [];
      if (statuses) andConditions.push({ statusId: { in: statuses.split(',') } });
      if (priorities) andConditions.push({ priority: { in: priorities.split(',') } });
      if (types) andConditions.push({ type: { in: types.split(',') } });
      if (sprintId) andConditions.push({ sprintId });

      if (search?.trim()) {
        andConditions.push({
          OR: [
            { title: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ],
        });
      }

      if (assignees) {
        andConditions.push({ assignees: { some: { userId: { in: assignees.split(',') } } } });
      }
      if (reporters) {
        andConditions.push({ reporters: { some: { userId: { in: reporters.split(',') } } } });
      }
      if (excludedIds && excludedIds.length > 0) {
        andConditions.push({ id: { notIn: excludedIds } });
      }

      if (andConditions.length > 0) {
        taskFilter.AND = andConditions;
      }
    } else {
      let finalTaskIds = taskIds || [];
      if (excludedIds && excludedIds.length > 0) {
        finalTaskIds = finalTaskIds.filter((id) => !excludedIds.includes(id));
      }
      taskFilter.id = { in: finalTaskIds };
    }

    const tasks = await this.prisma.task.findMany({
      where: taskFilter,
      include: {
        assignees: { select: { userId: true } },
      },
    });

    let updatedTasks: Task[] = [];
    let failedTasks: Array<{ id: string; reason: string }> = [];

    // Handle missing tasks when using specific IDs
    if (taskIds && taskIds.length > 0 && !all) {
      const foundTaskIds = tasks.map((t) => t.id);
      const missingTaskIds = taskIds.filter((id) => !foundTaskIds.includes(id));
      failedTasks = missingTaskIds.map((id) => ({
        id,
        reason: 'Task not found',
      }));
    }

    // Batch permission checks
    const permissionChecks = await Promise.all(
      tasks.map(async (task) => {
        const { canChange } = await this.accessControl.getTaskAccess(task.id, userId);
        return { taskId: task.id, canChange };
      }),
    );

    const permissionMap = new Map(permissionChecks.map((p) => [p.taskId, p.canChange]));

    // Separate tasks by permission
    const allowedTaskIds = tasks.filter((task) => permissionMap.get(task.id)).map((t) => t.id);
    const deniedTasks = tasks.filter((task) => !permissionMap.get(task.id));

    // Add permission errors to failedTasks
    deniedTasks.forEach((task) => {
      failedTasks.push({
        id: task.id,
        reason: 'Insufficient permissions to update this task',
      });
    });

    if (allowedTaskIds.length > 0) {
      // Delete all existing assignees in batch
      await this.prisma.taskAssignee.deleteMany({
        where: { taskId: { in: allowedTaskIds } },
      });

      // If not clearing, create new assignees in batch
      if (assigneeIds.length > 0) {
        const assigneeData = allowedTaskIds.flatMap((taskId) =>
          assigneeIds.map((userId) => ({
            taskId,
            userId,
          })),
        );

        await this.prisma.taskAssignee.createMany({
          data: assigneeData,
        });
      }
    }

    // Fetch updated tasks in batch
    if (allowedTaskIds.length > 0) {
      const updatedTasksList = await this.prisma.task.findMany({
        where: { id: { in: allowedTaskIds } },
        include: {
          status: { select: { id: true, name: true, color: true, category: true } },
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              workspace: {
                select: { id: true, name: true, slug: true, organizationId: true },
              },
            },
          },
          assignees: {
            select: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
              },
            },
          },
          reporters: {
            select: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
              },
            },
          },
          sprint: { select: { id: true, name: true, slug: true, status: true } },
          _count: {
            select: { childTasks: true, comments: true, attachments: true },
          },
        },
      });

      updatedTasks = updatedTasksList as unknown as Task[];
    }

    return {
      assignedCount: updatedTasks.length,
      updatedTasks: this.flattenTasksList(updatedTasks),
      failedTasks,
    };
  }
}
