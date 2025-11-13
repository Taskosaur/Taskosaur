import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicDataFilterService } from './public-data-filter.service';
import { PublicTaskDto } from '../dto/public-task.dto';
import {
  ActivityType,
  TaskAttachment,
  TaskComment,
} from '@prisma/client';

export interface PublicTaskFilters {
  parentTaskId?: string;
  limit?: number;
  page?: number;
  status?: string;
  priority?: string;
  type?: string;
}
export interface PublicTaskPagination {
  data: PublicTaskDto[];
  page: number;
  total: number;
  limit: number;
  totalPages: number;
}
@Injectable()
export class PublicTasksService {
  constructor(
    private prisma: PrismaService,
    private dataFilter: PublicDataFilterService,
  ) {}

  async getPublicTasks(
    workspaceSlug: string,
    projectSlug: string,
    filters: PublicTaskFilters = {},
  ): Promise<PublicTaskPagination> {
    const project = await this.validatePublicProject(
      workspaceSlug,
      projectSlug,
    );

    const whereClause: any = {
      projectId: project.id,
      parentTaskId: null, // Only top-level tasks
    };

    // Add filters
    if (filters.status) {
      whereClause.status = { name: filters.status };
    }
    if (filters.priority) {
      whereClause.priority = filters.priority;
    }
    if (filters.type) {
      whereClause.type = filters.type;
    }
    if (filters.parentTaskId) {
      whereClause.parentTaskId = filters.parentTaskId;
    }
    const skip = ((filters.page || 1) - 1) * (filters.limit || 50);
    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        labels: {
          include: {
            label: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        childTasks: {
          where: {
            project: { visibility: 'PUBLIC' }, // Only public subtasks
          },
          include: {
            status: {
              select: { id: true, name: true, color: true, category: true },
            },
            labels: {
              include: {
                label: {
                  select: { id: true, name: true, color: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: skip || 0,
    });
    const total = await this.prisma.task.count({ where: whereClause });
    const filterTasks = tasks.map(task => this.dataFilter.filterTaskData({
      ...task,
      labels: task.labels.map(tl => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color })),
      subtasks: task.childTasks?.map(ct => ({
        ...ct,
        labels: ct.labels.map(tl => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color }))
      }))
    }));

    return {
      data: filterTasks,
      total,
      page: filters.page || 1,
      limit: filters.limit || 50,
      totalPages: Math.ceil(total / (filters.limit || 1)),
    };
  }

  async getPublicTask(taskId: string): Promise<any> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            visibility: true,
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
        childTasks: {
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

    if (task.project.visibility !== 'PUBLIC') {
      throw new ForbiddenException('This project is not public');
    }

    return task;
  }

  async getPublicTasksKanban(
    workspaceSlug: string,
    projectSlug: string,
  ): Promise<any> {
    const project = await this.validatePublicProject(
      workspaceSlug,
      projectSlug,
    );

    // Get all statuses for the project's workflow
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        Project: { some: { id: project.id } },
      },
      include: {
        statuses: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: {
                projectId: project.id,
                parentTaskId: null,
              },
              include: {
                labels: {
                  include: {
                    label: {
                      select: { id: true, name: true, color: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!workflow) {
      return { columns: [] };
    }

    const columns = workflow.statuses.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      category: status.category,
      tasks: status.tasks.map(task => this.dataFilter.filterTaskData({
        ...task,
        labels: task.labels.map(tl => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color }))
      }))
    }));

    return { columns };
  }

  private async validatePublicProject(
    workspaceSlug: string,
    projectSlug: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug: projectSlug,
        workspace: { slug: workspaceSlug },
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Public project not found');
    }

    return project;
  }

  async getTaskActivities(
    taskId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      activityTypes?: ActivityType[];
      includeChatActivities?: boolean;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<{
    activities: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        slug: true,
        project: {
          select: {
            id: true,
            name: true,
            visibility: true,
            slug: true,
            workspace: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.visibility !== 'PUBLIC') {
      throw new ForbiddenException('This project is not public');
    }
    const activityTypeFilter: any = {};

    if (filters?.activityTypes && filters.activityTypes.length > 0) {
      activityTypeFilter.type = { in: filters.activityTypes };
    } else if (filters?.includeChatActivities !== false) {
      activityTypeFilter.type = {
        in: [
          ActivityType.TASK_CREATED,
          ActivityType.TASK_UPDATED,
          ActivityType.TASK_ASSIGNED,
          ActivityType.TASK_STATUS_CHANGED,
          ActivityType.TASK_COMMENTED,
          ActivityType.TASK_LABEL_ADDED,
          ActivityType.TASK_LABEL_REMOVED,
        ],
      };
    }

    const dateFilter: any = {};
    if (filters?.dateFrom || filters?.dateTo) {
      dateFilter.createdAt = {};
      if (filters.dateFrom) dateFilter.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) dateFilter.createdAt.lte = filters.dateTo;
    }
    const whereClause = {
      OR: [
        {
          entityId: taskId,
          entityType: 'Task',
          ...activityTypeFilter,
          ...dateFilter,
        },
        {
          entityType: 'Task Comment',
          ...activityTypeFilter,
          ...dateFilter,
          OR: [
            {
              newValue: { path: ['taskId'], equals: taskId },
            },
            {
              oldValue: { path: ['taskId'], equals: taskId },
            },
          ],
        },
        {
          entityType: 'Task Label',
          ...activityTypeFilter,
          ...dateFilter,
          entityId: taskId,
        },
      ],
    };
    const totalCount = await this.prisma.activityLog.count({
      where: whereClause,
    });
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    const activities = await this.prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    const commentIds = activities
      .filter((activity) => activity.entityType === 'TaskComment')
      .map((activity) => activity.entityId);

    let comments: any[] = [];
    if (commentIds.length > 0) {
      comments = await this.prisma.taskComment.findMany({
        where: { id: { in: commentIds } },
        select: {
          id: true,
          content: true,
          taskId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
    const transformedActivities = activities.map((activity) => {
      const relatedComment = comments.find((c) => c.id === activity.entityId);

      return {
        id: activity.id,
        type: activity.type,
        description: activity.description,
        entityType: activity.entityType,
        entityId: activity.entityId,
        oldValue: activity.oldValue,
        newValue: activity.newValue,
        createdAt: activity.createdAt,
        user: activity.user,
        task: {
          id: task.id,
          title: task.title,
          slug: task.slug,
          project: task.project,
        },
        relatedData: this.getRelatedActivityData(activity, relatedComment),
      };
    });
    return {
      activities: transformedActivities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
  private getRelatedActivityData(activity: any, comment?: any) {
    switch (activity.entityType) {
      case 'TaskComment':
        return comment
          ? {
              comment,
              type: 'comment',
            }
          : null;
      case 'Task':
        return {
          type: 'task',
        };
      default:
        return null;
    }
  }

  async getPublicTaskComments(taskId?: string): Promise<TaskComment[]> {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    /** -------------------------
     * 1️⃣ Verify the task exists and project is public
     * ------------------------- */
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        project: {
          select: {
            id: true,
            name: true,
            visibility: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.visibility !== 'PUBLIC') {
      throw new ForbiddenException('This project is not public');
    }

    /** -------------------------
     * 2️⃣ Build comment filter
     * ------------------------- */
    const whereClause: any = {
      taskId,
      parentCommentId: null, // Only top-level comments
    };

    /** -------------------------
     * 3️⃣ Fetch comments + replies
     * ------------------------- */
    const comments = await this.prisma.taskComment.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return comments;
  }
  getPublicTaskAttachment(taskId?: string): Promise<TaskAttachment[]> {
    const whereClause: any = {};

    if (taskId) {
      whereClause.taskId = taskId;
    }

    return this.prisma.taskAttachment.findMany({
      where: {
        ...whereClause,
        task: {
          project: {
            visibility: 'PUBLIC', // ✅ Only include attachments from public projects
          },
        },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                visibility: true, // optional, in case you want to confirm it’s public
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
