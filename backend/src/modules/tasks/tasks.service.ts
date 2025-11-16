import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { Task, TaskPriority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksByStatus, TasksByStatusParams } from './dto/task-by-status.dto';
import { AccessControlService } from 'src/common/access-control.utils';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
    private storageService: StorageService,
  ) {}

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
    const { organizationId, organization } = project.workspace;

    if (organization.ownerId !== userId) {
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true },
      });

      const wsMember = await this.prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: project.workspaceId },
        },
        select: { role: true },
      });

      const projectMember = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: project.id } },
        select: { role: true },
      });

      const canCreate = orgMember || wsMember || projectMember;

      if (!canCreate) {
        throw new ForbiddenException('Insufficient permissions to create task in this project');
      }
    }

    const sprintResult = await this.prisma.sprint.findFirst({
      where: { projectId: project.id, isDefault: true },
    });
    const sprintId = sprintResult?.id || null;

    const lastTask = await this.prisma.task.findFirst({
      where: { projectId: createTaskDto.projectId },
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    });

    const taskNumber = lastTask ? lastTask.taskNumber + 1 : 1;
    const key = `${project.slug}-${taskNumber}`;
    const { assigneeIds, reporterIds, ...taskData } = createTaskDto;
    return this.prisma.task.create({
      data: {
        ...taskData,
        createdBy: userId,
        taskNumber,
        slug: key,
        sprintId: sprintId,
        assignees: assigneeIds?.length
          ? {
              connect: assigneeIds.map((id) => ({ id })),
            }
          : undefined,
        // Connect multiple reporters
        reporters: reporterIds?.length
          ? {
              connect: reporterIds.map((id) => ({ id })),
            }
          : undefined,
      },
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
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporters: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
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
    const { organizationId, organization } = project.workspace;

    if (organization.ownerId !== userId) {
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true },
      });

      const wsMember = await this.prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: project.workspaceId },
        },
        select: { role: true },
      });

      const projectMember = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: project.id } },
        select: { role: true },
      });

      const canCreate = orgMember || wsMember || projectMember;

      if (!canCreate) {
        throw new ForbiddenException('Insufficient permissions to create task in this project');
      }
    }

    const sprintResult = await this.prisma.sprint.findFirst({
      where: { projectId: project.id, isDefault: true },
    });
    const sprintId = sprintResult?.id || null;

    const lastTask = await this.prisma.task.findFirst({
      where: { projectId: createTaskDto.projectId },
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    });

    const taskNumber = lastTask ? lastTask.taskNumber + 1 : 1;
    const key = `${project.slug}-${taskNumber}`;
    const { assigneeIds, reporterIds, ...taskData } = createTaskDto;

    // --- Create Task ---
    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        createdBy: userId,
        taskNumber,
        slug: key,
        sprintId: sprintId,
        assignees: assigneeIds?.length
          ? {
              connect: assigneeIds.map((id) => ({ id })),
            }
          : undefined,
        reporters: reporterIds?.length
          ? {
              connect: reporterIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    // --- Handle Attachments ---
    if (files && files.length > 0) {
      const attachmentPromises = files.map(async (file) => {
        const { url, key, size } = await this.storageService.saveFile(file, `tasks/${task.id}`);

        return this.prisma.taskAttachment.create({
          data: {
            taskId: task.id,
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
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporters: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
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

      return {
        ...task,
        attachments: attachmentsWithUrls,
      };
    }
    return task;
  }

  async findAll(
    organizationId: string,
    projectId?: string[],
    sprintId?: string,
    workspaceId?: string[],
    parentTaskId?: string,
    priorities?: string[],
    statuses?: string[],
    assigneeIds?: string[],
    reporterIds?: string[],
    userId?: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
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

    await this.accessControl.getOrgAccess(organizationId, userId);

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
      parentTaskId: null,
      // Ensure tasks belong to the organization through project->workspace->organization
      project: {
        workspace: {
          organizationId: organizationId,
        },
      },
    };

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
      if (parentTaskId === 'null' || parentTaskId === '' || parentTaskId === null) {
        whereClause.parentTaskId = null;
      } else {
        whereClause.parentTaskId = parentTaskId;
      }
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
    }
    if (assigneeIds && assigneeIds.length > 0) {
      andConditions.push({
        assignees: {
          some: { id: { in: assigneeIds } },
        },
      });
    }
    if (reporterIds && reporterIds.length > 0) {
      andConditions.push({
        reporters: {
          some: { id: { in: reporterIds } },
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
    //       { assignees: { some: { id: userId } } },
    //       { reporters: { some: { id: userId } } },
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
    // Execute query and count in transaction
    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: whereClause,
        include: {
          labels: {
            select: {
              taskId: true,
              labelId: true,
              label: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  description: true,
                },
              },
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
              inbox: true,
            },
          },
          assignees: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          reporters: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          status: {
            select: { id: true, name: true, color: true, category: true },
          },
          sprint: { select: { id: true, name: true, status: true } },
          parentTask: {
            select: { id: true, title: true, slug: true, type: true },
          },
          _count: {
            select: { childTasks: true, comments: true, attachments: true },
          },
        },
        orderBy: { taskNumber: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where: whereClause }),
    ]);

    // Transform the response
    const transformedTasks = tasks.map((task) => ({
      ...task,
      showEmailReply: task.project?.inbox?.enabled === true,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));
    return {
      data: transformedTasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    userId?: string,
    search?: string,
  ): Promise<Task[]> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const { isElevated } = await this.accessControl.getOrgAccess(organizationId, userId);

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
      parentTaskId: null,
      project: {
        workspace: { organizationId },
      },
    };

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
      whereClause.parentTaskId =
        parentTaskId === 'null' || parentTaskId === '' ? null : parentTaskId;
    }

    if (priorities?.length) {
      andConditions.push({ priority: { in: priorities } });
    }

    if (statuses?.length) {
      andConditions.push({ statusId: { in: statuses } });
    }

    if (search?.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: search.trim(), mode: 'insensitive' } },
          { description: { contains: search.trim(), mode: 'insensitive' } },
        ],
      });
    }

    if (!isElevated) {
      andConditions.push({
        OR: [
          { assignees: { some: { id: userId } } },
          { reporters: { some: { id: userId } } },
          { createdBy: userId },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
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
              select: { id: true, name: true, organizationId: true },
            },
          },
        },
        assignees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporters: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: { select: { id: true, name: true, status: true } },
        parentTask: {
          select: { id: true, title: true, slug: true, type: true },
        },
        _count: {
          select: { childTasks: true, comments: true, attachments: true },
        },
      },
      orderBy: { taskNumber: 'desc' },
    });

    return tasks.map((task) => ({
      ...task,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));
  }

  async findOne(id: string, userId: string) {
    const { isElevated } = await this.accessControl.getTaskAccess(id, userId);

    const task = await this.prisma.task.findUnique({
      where: { id },
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
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporters: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
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
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
                reporters: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
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
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
              where: {
                OR: [
                  { assignees: { some: { id: userId } } },
                  { reporters: { some: { id: userId } } },
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
    return {
      ...task,
      showEmailReply: projectInbox,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    };
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
    const { isElevated } = await this.accessControl.getTaskAccess(id, userId);

    // Check if user can update this task
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { select: { id: true } },
        reporters: { select: { id: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const isAssignee = task.assignees.some((assignee) => assignee.id === userId);
    const isReporter = task.reporters.some((reporter) => reporter.id === userId);
    // Allow update if user is elevated OR is the assignee/reporter/creator
    const canUpdate = isElevated || isAssignee || isReporter || task.createdBy === userId;

    if (!canUpdate) {
      throw new ForbiddenException('Insufficient permissions to update this task');
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
      const { assigneeIds, reporterIds, ...taskData } = updateTaskDto;
      const updateData: any = { ...taskData };

      // Handle assignees update
      if (assigneeIds !== undefined) {
        updateData.assignees = {
          set: assigneeIds.map((id) => ({ id })),
        };
      }

      // Handle reporters update
      if (reporterIds !== undefined) {
        updateData.reporters = {
          set: reporterIds.map((id) => ({ id })),
        };
      }
      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            select: { id: true, name: true, slug: true },
          },
          assignees: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          reporters: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
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

      return updatedTask;
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Task not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const { isElevated } = await this.accessControl.getTaskAccess(id, userId);

    if (!isElevated) {
      throw new ForbiddenException('Only managers and owners can delete tasks');
    }

    try {
      const taskWithSubtasks = await this.prisma.task.findUnique({
        where: { id },
        include: {
          _count: {
            select: { childTasks: true },
          },
        },
      });

      if (!taskWithSubtasks) {
        throw new NotFoundException('Task not found');
      }

      await this.prisma.task.delete({
        where: { id },
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Task not found');
      }
      throw error;
    }
  }

  async addComment(taskId: string, comment: string, userId: string) {
    // Check task access first
    await this.accessControl.getTaskAccess(taskId, userId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const newComment = await this.prisma.taskComment.create({
      data: {
        content: comment,
        taskId: taskId,
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

    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);

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

    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If not elevated, filter to user-related tasks only
    if (!isElevated) {
      const userFilters = [{ assigneeId: userId }, { reporterId: userId }, { createdBy: userId }];

      if (search && search.trim()) {
        whereClause.AND = [{ OR: whereClause.OR }, { OR: userFilters }];
        delete whereClause.OR;
      } else {
        whereClause.OR = userFilters;
      }
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
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporters: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: { select: { id: true, name: true, status: true } },
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
      tasks: transformedTasks,
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

    const { isElevated } = await this.accessControl.getOrgAccess(organizationId, userId);

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

    const whereClause: any = {
      projectId: { in: projectIds },
      OR: [
        { dueDate: { gte: startOfDay, lte: endOfDay } },
        { createdAt: { gte: startOfDay, lte: endOfDay } },
        { updatedAt: { gte: startOfDay, lte: endOfDay } },
        { completedAt: { gte: startOfDay, lte: endOfDay } },
      ],
    };

    const userFilters: any[] = [];

    if (filters.assigneeId) {
      userFilters.push({ assigneeId: filters.assigneeId });
    }

    if (filters.reporterId) {
      userFilters.push({ reporterId: filters.reporterId });
    }

    if (filters.userId) {
      userFilters.push(
        { assigneeId: filters.userId },
        { reporterId: filters.userId },
        { createdBy: filters.userId },
      );
    }

    // If not elevated, apply user filtering
    if (!isElevated && userFilters.length > 0) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: userFilters }];
      delete whereClause.OR;
    } else if (!isElevated) {
      // No specific filters but not elevated, default to user's tasks
      const defaultUserFilters = [
        { assigneeId: userId },
        { reporterId: userId },
        { createdBy: userId },
      ];
      whereClause.AND = [{ OR: whereClause.OR }, { OR: defaultUserFilters }];
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
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
            },
          },
          reporters: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
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
      tasks,
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
              some: { id: userId },
            },
          },
          {
            reporters: {
              some: { id: userId },
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

        const tasks = await this.prisma.task.findMany({
          where: {
            ...whereClause,
            statusId: status.id,
            sprintId,
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
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            reporters: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [{ taskNumber: 'desc' }],
          skip: skip,
          take: pageLimit,
        });

        return {
          statusId: status.id,
          statusName: status.name,
          statusColor: status.color,
          statusCategory: status.category,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description || undefined,
            priority: task.priority,
            taskNumber: task.taskNumber,
            assignees: task.assignees
              ? task.assignees.map((assignee) => ({
                  id: assignee.id,
                  firstName: assignee.firstName,
                  lastName: assignee.lastName,
                  avatar: assignee.avatar || undefined,
                }))
              : undefined,
            reporters: task.reporters
              ? task.reporters.map((reporter) => ({
                  id: reporter.id,
                  firstName: reporter.firstName,
                  lastName: reporter.lastName,
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
      console.error('Error fetching tasks grouped by status:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch tasks grouped by status');
    }
  }

  // Additional helper methods with role-based filtering
  async findSubtasksByParent(parentTaskId: string, userId: string): Promise<Task[]> {
    await this.accessControl.getTaskAccess(parentTaskId, userId);

    const { isElevated } = await this.accessControl.getTaskAccess(parentTaskId, userId);

    const whereClause: any = {
      parentTaskId: parentTaskId,
    };

    // If not elevated, filter to user-related subtasks only
    if (!isElevated) {
      whereClause.OR = [{ assigneeId: userId }, { reporterId: userId }, { createdBy: userId }];
    }

    return this.prisma.task.findMany({
      where: whereClause,
      include: {
        labels: { include: { label: true } },
        project: {
          select: { id: true, name: true, slug: true },
        },
        assignees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporters: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
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
      const { isElevated } = await this.accessControl.getOrgAccess(
        workspace.organizationId,
        userId,
      );

      const projects = await this.prisma.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });

      const projectIds = projects.map((project) => project.id);
      whereClause.projectId = { in: projectIds };

      // If not elevated, filter to user-related tasks only
      if (!isElevated) {
        whereClause.OR = [{ assigneeId: userId }, { reporterId: userId }, { createdBy: userId }];
      }
    } else if (projectId) {
      const { isElevated } = await this.accessControl.getTaskAccess(projectId, userId);
      whereClause.projectId = projectId;

      if (!isElevated) {
        whereClause.OR = [{ assigneeId: userId }, { reporterId: userId }, { createdBy: userId }];
      }
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
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporters: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
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

    return tasks.map((task) => ({
      ...task,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    }));
  }

  async bulkDeleteTasks(params: {
    taskIds?: string[];
    projectId?: string;
    all?: boolean;
    userId: string;
  }): Promise<{
    deletedCount: number;
    failedTasks: Array<{ id: string; reason: string }>;
  }> {
    const { taskIds, projectId, all, userId } = params;

    if ((!taskIds || taskIds.length === 0) && !all) {
      throw new BadRequestException('No task IDs provided and "all" flag not set');
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    // Build task filter
    const taskFilter: any = {};
    if (all) {
      if (projectId) taskFilter.projectId = projectId;
    } else {
      taskFilter.id = { in: taskIds };
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
      let canDelete = false;
      if (isSuperAdmin) canDelete = true;
      else if (task.createdBy === userId) canDelete = true;
      else if (task.project.members.length > 0) {
        const memberRole = task.project.members[0].role;
        if (memberRole === 'OWNER' || memberRole === 'MANAGER') canDelete = true;
      }

      if (canDelete) deletableTasks.push(task.id);
      else
        failedTasks.push({
          id: task.id,
          reason: 'Insufficient permissions to delete this task',
        });
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
        console.error(error);
        throw new InternalServerErrorException('Failed to delete tasks: ' + error.message);
      }
    }

    return { deletedCount, failedTasks };
  }
}
