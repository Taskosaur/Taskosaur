// src/modules/notifications/notifications.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) { }

  async createNotification(data: {
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

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string, organizationId?: string) {
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

  async getUnreadCount(userId: string, organizationId?: string) {
    const whereClause: any = { userId, isRead: false };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    return this.prisma.notification.count({
      where: whereClause,
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
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
    const notificationPromises = assigneeIds.map(assigneeId =>
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
      })
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
    task.assignees?.forEach(assignee => {
      if (assignee.id !== changedBy) {
        usersToNotify.add(assignee.id);
      }
    });

    // Add all reporters
    task.reporters?.forEach(reporter => {
      if (reporter.id !== changedBy) {
        usersToNotify.add(reporter.id);
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
      })
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

  async deleteMultipleNotifications(notificationIds: string[], userId: string) {
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
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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
      notifications,
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
}
