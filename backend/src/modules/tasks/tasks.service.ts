import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { StatusCategory, Task, TaskPriority, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksByStatus, TasksByStatusParams } from './dto/task-by-status.dto';
import { AccessControlService } from 'src/common/access-control.utils';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
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
        throw new ForbiddenException(
          'Insufficient permissions to create task in this project',
        );
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

    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        createdBy: userId,
        taskNumber,
        slug: key,
        sprintId: sprintId,
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
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporter: {
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

  async findAll(
    organizationId: string,
    projectId?: string[],
    sprintId?: string,
    workspaceId?: string[],
    parentTaskId?: string,
    priorities?: string[],
    statuses?: string[],
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

    const { isElevated } = await this.accessControl.getOrgAccess(
      organizationId,
      userId,
    );

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
      if (
        parentTaskId === 'null' ||
        parentTaskId === '' ||
        parentTaskId === null
      ) {
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
    if (!isElevated) {
      andConditions.push({
        OR: [
          { assigneeId: userId },
          { reporterId: userId },
          { createdBy: userId },
        ],
      });
    }

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
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
            },
          },
          reporter: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
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

    const { isElevated } = await this.accessControl.getOrgAccess(
      organizationId,
      userId,
    );

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
          { assigneeId: userId },
          { reporterId: userId },
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
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
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

  async findOne(id: string, userId: string): Promise<Task | any> {
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
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reporter: {
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
                assignee: {
                  select: {
                    id: true,
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
                assignee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
              where: {
                OR: [
                  { assigneeId: userId },
                  { reporterId: userId },
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

    return {
      ...task,
      labels: task.labels.map((taskLabel) => ({
        taskId: taskLabel.taskId,
        labelId: taskLabel.labelId,
        name: taskLabel.label.name,
        color: taskLabel.label.color,
        description: taskLabel.label.description,
      })),
    };
  }

  async findByKey(key: string, userId: string): Promise<Task> {
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

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const { isElevated } = await this.accessControl.getTaskAccess(id, userId);

    // Check if user can update this task
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { assigneeId: true, reporterId: true, createdBy: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Allow update if user is elevated OR is the assignee/reporter/creator
    const canUpdate =
      isElevated ||
      task.assigneeId === userId ||
      task.reporterId === userId ||
      task.createdBy === userId;

    if (!canUpdate) {
      throw new ForbiddenException(
        'Insufficient permissions to update this task',
      );
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

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateTaskDto,
        include: {
          project: {
            select: { id: true, name: true, slug: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          reporter: {
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
      const userFilters = [
        { assigneeId: userId },
        { reporterId: userId },
        { createdBy: userId },
      ];

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
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporter: {
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

    const { isElevated } = await this.accessControl.getOrgAccess(
      organizationId,
      userId,
    );

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
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
            },
          },
          reporter: {
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

    const { type, slug, includeSubtasks = false } = params;
    try {
      const whereClause: any = {};
      let workflowStatuses: any[] = [];

      if (type === 'project') {
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
          throw new Error('Project or project workflow not found');
        }

        // Check project access
        await this.accessControl.getProjectAccess(project.id, userId);

        whereClause.projectId = project.id;
        workflowStatuses = project.workflow.statuses;
      }

      // Check if user has elevated access
      let isElevated = false;
      if (type === 'project') {
        const projectAccess = await this.accessControl.getProjectAccess(
          whereClause.projectId,
          userId,
        );
        isElevated = projectAccess.isElevated;
      }

      // Optional: Filter by user if not elevated
      if (!isElevated) {
        whereClause.OR = [
          { assigneeId: userId },
          { reporterId: userId },
          { createdBy: userId },
        ];
      }

      // Optional: Exclude subtasks
      if (!includeSubtasks) {
        whereClause.parentTaskId = null;
      }

      // Only get tasks that have statuses from the relevant workflow
      whereClause.status = {
        id: {
          in: workflowStatuses.map((status) => status.id),
        },
      };

      const tasks = await this.prisma.task.findMany({
        where: whereClause,
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
          assignee: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          reporter: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ status: { position: 'asc' } }, { taskNumber: 'desc' }],
      });

      const statusMap = new Map<string, TasksByStatus>();

      // Initialize all workflow statuses
      workflowStatuses.forEach((status) => {
        statusMap.set(status.id, {
          statusId: status.id,
          statusName: status.name,
          statusColor: status.color,
          statusCategory: status.category as StatusCategory,
          tasks: [],
          _count: 0,
        });
      });

      // Group tasks by status
      tasks.forEach((task) => {
        const statusId = task.status.id;
        const statusGroup = statusMap.get(statusId);

        if (statusGroup) {
          statusGroup.tasks.push({
            id: task.id,
            title: task.title,
            description: task.description || undefined,
            priority: task.priority,
            taskNumber: task.taskNumber,
            assignee: task.assignee
              ? {
                  id: task.assignee.id,
                  firstName: task.assignee.firstName,
                  lastName: task.assignee.lastName,
                  avatar: task.assignee.avatar || undefined,
                }
              : undefined,
            reporter: task.reporter
              ? {
                  id: task.reporter.id,
                  firstName: task.reporter.firstName,
                  lastName: task.reporter.lastName,
                }
              : undefined,
            dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          });

          statusGroup._count += 1;
        }
      });

      return Array.from(statusMap.values());
    } catch (error) {
      console.error('Error fetching tasks grouped by status:', error);
      throw new Error('Failed to fetch tasks grouped by status');
    }
  }

  // Additional helper methods with role-based filtering
  async findSubtasksByParent(
    parentTaskId: string,
    userId: string,
  ): Promise<Task[]> {
    await this.accessControl.getTaskAccess(parentTaskId, userId);

    const { isElevated } = await this.accessControl.getTaskAccess(
      parentTaskId,
      userId,
    );

    const whereClause: any = {
      parentTaskId: parentTaskId,
    };

    // If not elevated, filter to user-related subtasks only
    if (!isElevated) {
      whereClause.OR = [
        { assigneeId: userId },
        { reporterId: userId },
        { createdBy: userId },
      ];
    }

    return this.prisma.task.findMany({
      where: whereClause,
      include: {
        labels: { include: { label: true } },
        project: {
          select: { id: true, name: true, slug: true },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporter: {
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
        whereClause.OR = [
          { assigneeId: userId },
          { reporterId: userId },
          { createdBy: userId },
        ];
      }
    } else if (projectId) {
      const { isElevated } = await this.accessControl.getTaskAccess(
        projectId,
        userId,
      );
      whereClause.projectId = projectId;

      if (!isElevated) {
        whereClause.OR = [
          { assigneeId: userId },
          { reporterId: userId },
          { createdBy: userId },
        ];
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
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        reporter: {
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
}
