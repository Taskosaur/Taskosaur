// src/modules/notifications/notifications.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  createNotification(data: {
    title: string;
    message: string;
    type: NotificationType;
    userId: string;
    organizationId?: string;
    priority?: NotificationPriority;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    createdBy?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || NotificationPriority.MEDIUM,
        userId: data.userId,
        organizationId: data.organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
        createdBy: data.createdBy,
      },
    });
  }

  async getUserNotifications(
    userId: string,
    filters: {
      isRead?: boolean;
      type?: NotificationType;
      organizationId?: string;
    } = {},
    page: number = 1,
    limit: number = 20,
  ) {
    const whereClause: any = { userId };

    if (filters.isRead !== undefined) {
      whereClause.isRead = filters.isRead;
    }

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.organizationId) {
      whereClause.organizationId = filters.organizationId;
    }

    const [notifications, totalCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

    return {
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  markAllAsRead(userId: string, organizationId?: string) {
    const whereClause: any = { userId, isRead: false };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    return this.prisma.notification.updateMany({
      where: whereClause,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  getUnreadCount(userId: string, organizationId?: string) {
    const whereClause: any = { userId, isRead: false };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    return this.prisma.notification.count({
      where: whereClause,
    });
  }

  deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // Notification creators for different events
  async notifyTaskAssigned(
    taskId: string,
    assigneeIds: string[], // Changed from single assigneeId to array
    assignedBy: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: {
              select: { organizationId: true },
            },
          },
        },
      },
    });

    if (!task || !assigneeIds?.length) return;

    // Create notifications for all assignees concurrently
    const notificationPromises = assigneeIds.map((assigneeId) =>
      this.createNotification({
        title: 'New Task Assignment',
        message: `You have been assigned to task "${task.title}"`,
        type: NotificationType.TASK_ASSIGNED,
        userId: assigneeId,
        organizationId: task.project.workspace.organizationId,
        entityType: 'Task',
        entityId: taskId,
        actionUrl: `/tasks/${taskId}`,
        createdBy: assignedBy,
        priority: NotificationPriority.HIGH,
      }),
    );

    // Execute all notifications concurrently and return results
    return Promise.all(notificationPromises);
  }

  async notifyTaskStatusChanged(
    taskId: string,
    oldStatus: string,
    newStatus: string,
    changedBy: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true, // Multiple assignees
        reporters: true, // Multiple reporters
        project: {
          include: {
            workspace: {
              select: { organizationId: true },
            },
          },
        },
      },
    });

    if (!task) return;

    // Collect all users to notify (assignees and reporters, excluding the person who made the change)
    const usersToNotify = new Set<string>();

    // Add all assignees
    task.assignees?.forEach((assignee: any) => {
      if (assignee.id !== changedBy) {
        usersToNotify.add(assignee.id as string);
      }
    });

    // Add all reporters
    task.reporters?.forEach((reporter: any) => {
      if (reporter.id !== changedBy) {
        usersToNotify.add(reporter.id as string);
      }
    });

    if (usersToNotify.size === 0) return [];

    // Create notifications for all unique users
    const notifications = Array.from(usersToNotify).map((userId) =>
      this.createNotification({
        title: 'Task Status Updated',
        message: `Task "${task.title}" status changed from ${oldStatus} to ${newStatus}`,
        type: NotificationType.TASK_STATUS_CHANGED,
        userId: userId,
        organizationId: task.project.workspace.organizationId,
        entityType: 'Task',
        entityId: taskId,
        actionUrl: `/tasks/${taskId}`,
        createdBy: changedBy,
      }),
    );

    return Promise.all(notifications);
  }

  async notifyTaskDueSoon(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true, // Multiple assignees instead of single assignee
        project: {
          include: {
            workspace: {
              select: { organizationId: true },
            },
          },
        },
      },
    });

    if (!task || !task.assignees?.length || !task.dueDate) return;

    // Create notifications for all assignees
    const notifications = task.assignees.map((assignee) =>
      this.createNotification({
        title: 'Task Due Soon',
        message: `Task "${task.title}" is due soon`,
        type: NotificationType.TASK_DUE_SOON,
        userId: assignee.id,
        organizationId: task.project.workspace.organizationId,
        entityType: 'Task',
        entityId: taskId,
        actionUrl: `/tasks/${taskId}`,
        priority: NotificationPriority.HIGH,
      }),
    );

    return Promise.all(notifications);
  }

  // Add these methods to your notifications.service.ts

  async getNotificationById(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  deleteMultipleNotifications(notificationIds: string[], userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
    });
  }

  async getUserNotificationStats(userId: string, organizationId?: string) {
    const whereClause: any = { userId };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const [totalCount, unreadCount, typeStats] = await Promise.all([
      this.prisma.notification.count({ where: whereClause }),
      this.prisma.notification.count({
        where: { ...whereClause, isRead: false },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: whereClause,
        _count: {
          type: true,
        },
      }),
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await this.prisma.notification.count({
      where: {
        ...whereClause,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    return {
      total: totalCount,
      unread: unreadCount,
      read: totalCount - unreadCount,
      recent: recentCount,
      byType: typeStats.reduce(
        (acc, stat) => {
          acc[stat.type] = stat._count.type;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
  // src/modules/notifications/notifications.service.ts
  async getNotificationsByUserAndOrganization(
    userId: string,
    organizationId: string,
    filters: {
      isRead?: boolean;
      type?: NotificationType;
      priority?: NotificationPriority;
      startDate?: Date;
      endDate?: Date;
    } = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    notifications: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    summary: {
      total: number;
      unread: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
    };
  }> {
    // Build where clause for user and organization
    const whereClause: any = {
      userId: userId,
      organizationId: organizationId,
    };

    // Apply additional filters
    if (filters.isRead !== undefined) {
      whereClause.isRead = filters.isRead;
    }

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.priority) {
      whereClause.priority = filters.priority;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = filters.endDate;
      }
    }

    // Get paginated notifications and total count
    const [notifications, totalCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { isRead: 'asc' }, // Unread first
          { createdAt: 'desc' }, // Then by newest
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

    // Fetch entity details for each notification
    const notificationsWithEntities = await Promise.all(
      notifications.map(async (notification) => {
        let entityDetails: any = null;

        if (notification.entityId && notification.entityType) {
          entityDetails = await this.getEntityDetails(
            notification.entityType,
            notification.entityId,
          );
        }

        return {
          ...notification,
          entity: entityDetails,
        };
      }),
    );

    // Get summary statistics
    const [unreadCount, typeStats, priorityStats] = await Promise.all([
      this.prisma.notification.count({
        where: { ...whereClause, isRead: false },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { type: true },
      }),
      this.prisma.notification.groupBy({
        by: ['priority'],
        where: whereClause,
        _count: { priority: true },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      notifications: notificationsWithEntities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        total: totalCount,
        unread: unreadCount,
        byType: typeStats.reduce(
          (acc, stat) => {
            acc[stat.type] = stat._count.type;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byPriority: priorityStats.reduce(
          (acc, stat) => {
            acc[stat.priority] = stat._count.priority;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }

  // Helper method to fetch entity details based on type
  private async getEntityDetails(entityType: string, entityId: string) {
    const type = entityType.toLowerCase();

    try {
      switch (type) {
        case 'task': {
          const task = await this.prisma.task.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              priority: true,
              taskNumber: true,
              status: {
                select: { id: true, name: true, color: true, category: true },
              },
              project: { select: { id: true, name: true, slug: true } },
            },
          });

          if (!task) return null;
          return {
            id: task.id,
            type: 'task',
            name: task.title,
            slug: task.slug,
            parent: task.project ? { ...task.project } : undefined,
            extra: {
              priority: task.priority,
              taskNumber: task.taskNumber,
              status: task.status,
            },
          };
        }

        case 'taskcomment':
        case 'task comment': {
          const comment = await this.prisma.taskComment.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              content: true,
              createdAt: true,
              task: {
                select: { id: true, title: true, slug: true, taskNumber: true },
              },
            },
          });

          if (!comment) return null;
          return {
            id: comment.id,
            type: 'task_comment',
            name: `Comment on ${comment.task?.title ?? 'Task'}`,
            parent: comment.task ? { ...comment.task } : undefined,
            extra: {
              content: comment.content,
              createdAt: comment.createdAt,
            },
          };
        }

        case 'project': {
          const project = await this.prisma.project.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatar: true,
              workspace: { select: { id: true, name: true, slug: true } },
            },
          });

          if (!project) return null;
          return {
            id: project.id,
            type: 'project',
            name: project.name,
            slug: project.slug,
            parent: project.workspace ? { ...project.workspace } : undefined,
            extra: {
              avatar: project.avatar,
              description: project.description,
            },
          };
        }

        case 'workspace': {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatar: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
          });

          if (!workspace) return null;
          return {
            id: workspace.id,
            type: 'workspace',
            name: workspace.name,
            slug: workspace.slug,
            parent: workspace.organization ? { ...workspace.organization } : undefined,
            extra: {
              avatar: workspace.avatar,
              description: workspace.description,
            },
          };
        }

        case 'organization': {
          const org = await this.prisma.organization.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatar: true,
            },
          });

          if (!org) return null;
          return {
            id: org.id,
            type: 'organization',
            name: org.name,
            slug: org.slug,
            extra: {
              avatar: org.avatar,
              description: org.description,
            },
          };
        }

        case 'sprint': {
          const sprint = await this.prisma.sprint.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              name: true,
              goal: true,
              status: true,
              startDate: true,
              endDate: true,
              project: { select: { id: true, name: true, slug: true } },
            },
          });

          if (!sprint) return null;
          return {
            id: sprint.id,
            type: 'sprint',
            name: sprint.name,
            parent: sprint.project ? { ...sprint.project } : undefined,
            extra: {
              goal: sprint.goal,
              status: sprint.status,
              startDate: sprint.startDate,
              endDate: sprint.endDate,
            },
          };
        }

        case 'invitation': {
          const invitation = await this.prisma.invitation.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              inviteeEmail: true,
              role: true,
              status: true,
              expiresAt: true,
              organization: { select: { id: true, name: true, slug: true } },
              workspace: { select: { id: true, name: true, slug: true } },
              project: { select: { id: true, name: true, slug: true } },
            },
          });

          if (!invitation) return null;
          return {
            id: invitation.id,
            type: 'invitation',
            name: invitation.inviteeEmail,
            extra: {
              role: invitation.role,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
            },
            parent:
              invitation.project || invitation.workspace || invitation.organization || undefined,
          };
        }

        case 'taskattachment':
        case 'task attachment': {
          const attachment = await this.prisma.taskAttachment.findUnique({
            where: { id: entityId },
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              task: { select: { id: true, title: true, slug: true } },
            },
          });

          if (!attachment) return null;
          return {
            id: attachment.id,
            type: 'task_attachment',
            name: attachment.fileName,
            parent: attachment.task ? { ...attachment.task } : undefined,
            extra: {
              fileSize: attachment.fileSize,
              mimeType: attachment.mimeType,
            },
          };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error(`Error fetching ${entityType} with id ${entityId}:`, error);
      return null;
    }
  }
}
