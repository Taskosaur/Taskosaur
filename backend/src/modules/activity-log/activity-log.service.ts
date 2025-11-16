// src/activity-log/activity-log.service.ts
import { Injectable } from '@nestjs/common';
import { ActivityLog, ActivityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async logActivity(data: {
    type: ActivityType;
    description: string;
    entityType: string;
    entityId: string;
    userId: string;
    organizationId?: string;
    oldValue?: any;
    newValue?: any;
  }) {
    return await this.prisma.activityLog.create({
      data: {
        type: data.type,
        description: data.description,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId,
        organizationId: data.organizationId,
        oldValue: data.oldValue || null,
        newValue: data.newValue || null,
        createdBy: data.userId,
        updatedBy: data.userId,
      },
    });
  }

  public getPrisma(): PrismaService {
    return this.prisma;
  }
  // Task-specific logging methods
  async logTaskCreated(task: any, userId: string) {
    return await this.logActivity({
      type: 'TASK_CREATED',
      description: `Created task "${task.title}" [${task.key}]`,
      entityType: 'Task',
      entityId: task.id,
      userId,
      newValue: task,
    });
  }

  async logTaskUpdated(oldTask: any, newTask: any, userId: string) {
    return await this.logActivity({
      type: 'TASK_UPDATED',
      description: `Updated task "${newTask.title}"`,
      entityType: 'Task',
      entityId: newTask.id,
      userId,
      oldValue: oldTask,
      newValue: newTask,
    });
  }

  async logTaskStatusChanged(task: any, oldStatus: string, newStatus: string, userId: string) {
    return await this.logActivity({
      type: 'TASK_STATUS_CHANGED',
      description: `Changed task "${task.title}" status from "${oldStatus}" to "${newStatus}"`,
      entityType: 'Task',
      entityId: task.id,
      userId,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
    });
  }

  async logTaskAssigned(task: any, assigneeId: string, userId: string) {
    return await this.logActivity({
      type: 'TASK_ASSIGNED',
      description: `Assigned task "${task.title}" to user`,
      entityType: 'Task',
      entityId: task.id,
      userId,
      newValue: { assigneeId },
    });
  }

  async getTaskParticipants(taskId: string): Promise<string[]> {
    if (!taskId) return [];

    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: {
          assignees: true,
          reporters: true,
        },
      });

      return [
        ...(task?.assignees.map((assignee) => assignee.id) || []),
        ...(task?.reporters.map((reporter) => reporter.id) || []),
      ].filter(Boolean);
    } catch (error) {
      console.error('Error getting task participants:', error);
      return [];
    }
  }

  async getWorkspaceMembers(workspaceId: string): Promise<string[]> {
    if (!workspaceId) return [];

    try {
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });

      return members.map((member) => member.userId);
    } catch (error) {
      console.error('Error getting workspace members:', error);
      return [];
    }
  }
  // Add these methods to your ActivityLogService
  async getProjectMembers(projectId: string): Promise<string[]> {
    if (!projectId) return [];
    try {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    } catch (error) {
      console.error('Error getting project members:', error);
      return [];
    }
  }

  async getOrganizationMembers(organizationId: string): Promise<string[]> {
    if (!organizationId) return [];
    try {
      const members = await this.prisma.organizationMember.findMany({
        where: { organizationId },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    } catch (error) {
      console.error('Error getting organization members:', error);
      return [];
    }
  }

  async getOrganizationIdFromEntity(
    entityType: string,
    entityId: string,
  ): Promise<string | undefined> {
    try {
      switch (entityType.toLowerCase()) {
        case 'task': {
          const task = await this.prisma.task.findUnique({
            where: { id: entityId },
            select: {
              project: {
                select: {
                  workspace: {
                    select: {
                      organizationId: true,
                    },
                  },
                },
              },
            },
          });
          return task?.project?.workspace?.organizationId || undefined;
        }

        case 'project': {
          const project = await this.prisma.project.findUnique({
            where: { id: entityId },
            select: {
              workspace: {
                select: {
                  organizationId: true,
                },
              },
            },
          });
          return project?.workspace?.organizationId || undefined;
        }

        case 'workspace': {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: entityId },
            select: { organizationId: true },
          });
          return workspace?.organizationId || undefined;
        }

        case 'organization':
          return entityId;

        default:
          return undefined;
      }
    } catch (error) {
      console.error('Error getting organization ID:', error);
      return undefined;
    }
  }

  async getTaskActivities(
    taskId: string,
    page: number = 1,
    limit: number = 50,
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
    // Validate task exists
    const taskExists = await this.prisma.task.findFirst({
      where: { id: taskId },
    });

    if (!taskExists) {
      throw new Error('Task not found');
    }

    // Simple where clause - just match entityId with taskId
    const whereClause = {
      entityId: taskId,
    };

    // Get total count for pagination
    const totalCount = await this.prisma.activityLog.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    // Fetch activities with user information
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
    return {
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // Helper method to get related activity data
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

  // activity-log.service.ts
  // More efficient version using raw query or better Prisma relations
  // Fixed version of getRecentActivityByWorkspaceOptimized
  async getRecentActivityByWorkspaceOptimized(
    workspaceId: string,
    limit: number = 10,
    page: number = 1,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }
    const totalResult: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count
      FROM activity_logs al
      WHERE 
        (al.entity_type = 'Workspace' AND al.entity_id = ${workspaceId}::uuid)
        OR 
        (al.entity_type = 'Project' AND al.entity_id IN (
          SELECT id FROM projects WHERE workspace_id = ${workspaceId}::uuid
        ))
        OR
        (al.entity_type = 'Task' AND al.entity_id IN (
          SELECT t.id FROM tasks t 
          JOIN projects p ON t.project_id = p.id 
          WHERE p.workspace_id = ${workspaceId}::uuid
        ))
    `;
    const totalCount = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    // ✅ Fixed raw query with proper UUID casting
    const activities: any[] = await this.prisma.$queryRaw`
    SELECT 
      al.id,
      al.type,
      al.description,
      al.entity_type,
      al.entity_id,
      al.created_at,
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.avatar
    FROM activity_logs al
    JOIN users u ON al.user_id = u.id
    WHERE 
      (al.entity_type = 'Workspace' AND al.entity_id = ${workspaceId}::uuid)
      OR 
      (al.entity_type = 'Project' AND al.entity_id IN (
        SELECT id FROM projects WHERE workspace_id = ${workspaceId}::uuid
      ))
      OR
      (al.entity_type = 'Task' AND al.entity_id IN (
        SELECT t.id FROM tasks t 
        JOIN projects p ON t.project_id = p.id 
        WHERE p.workspace_id = ${workspaceId}::uuid
      ))
    ORDER BY al.created_at DESC
    LIMIT ${limit}::int
    OFFSET ${offset}::int
  `;

    return {
      activities: activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        entityType: activity.entity_type,
        entityId: activity.entity_id,
        createdAt: activity.created_at,
        user: {
          id: activity.user_id,
          name: `${activity.first_name} ${activity.last_name}`,
          email: activity.email,
          avatar: activity.avatar,
        },
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // activity-log.service.ts
  async getRecentActivityByOrganization(
    organizationId: string,
    limit: number = 10,
    page: number = 1,
  ): Promise<{
    activities: ActivityLog[]; // Keep the original ActivityLog type
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const whereClause = {
      organizationId: organizationId,
    };

    const [totalCount, activities] = await Promise.all([
      this.prisma.activityLog.count({
        where: whereClause,
      }),
      this.prisma.activityLog.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      activities: activities, // ✅ Return the full ActivityLog objects
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
  // Add these methods to your ActivityLogService

  async getOrganizationActivityStats(
    organizationId: string,
    days: number = 30,
  ): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    activitiesByUser: Array<{
      userId: string;
      userName: string;
      count: number;
    }>;
    activitiesByDate: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.prisma.activityLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const totalActivities = activities.length;

    // Group by type
    const activitiesByType = activities.reduce(
      (acc, activity) => {
        acc[activity.type] = (acc[activity.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Group by user
    const userActivityMap = activities.reduce(
      (acc, activity) => {
        const key = activity.userId;
        if (!acc[key]) {
          acc[key] = {
            userId: activity.userId,
            userName: `${activity.user.firstName} ${activity.user.lastName}`,
            count: 0,
          };
        }
        acc[key].count++;
        return acc;
      },
      {} as Record<string, any>,
    );

    const activitiesByUser = Object.values(userActivityMap);

    // Group by date
    const dateActivityMap = activities.reduce(
      (acc, activity) => {
        const date = activity.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const activitiesByDate = Object.entries(dateActivityMap).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalActivities,
      activitiesByType,
      activitiesByUser,
      activitiesByDate,
    };
  }

  async getUserRecentActivity(
    userId: string,
    limit: number = 10,
    page: number = 1,
    organizationId?: string,
  ): Promise<{
    activities: ActivityLog[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const whereClause: any = { userId };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const [totalCount, activities] = await Promise.all([
      this.prisma.activityLog.count({ where: whereClause }),
      this.prisma.activityLog.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // src/modules/activity-log/activity-log.service.ts

  async getRecentActivityByOrganizationComprehensive(
    organizationId: string,
    limit: number = 10,
    page: number = 1,
    filters?: {
      entityType?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{
    activities: ActivityLog[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    // Get all workspaces in the organization
    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const workspaceIds = workspaces.map((w) => w.id);

    // Get all projects in organization workspaces
    const projects = await this.prisma.project.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    // Get all tasks in organization projects
    const tasks = await this.prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);

    // Build comprehensive where clause
    const whereClause: any = {
      OR: [
        // Direct organization activities
        { organizationId: organizationId },
        // Workspace activities within the organization
        {
          entityType: 'Workspace',
          entityId: { in: workspaceIds },
        },
        // Project activities within organization workspaces
        {
          entityType: 'Project',
          entityId: { in: projectIds },
        },
        // Task activities within organization projects
        {
          entityType: 'Task',
          entityId: { in: taskIds },
        },
      ],
    };

    // Apply additional filters
    if (filters) {
      const additionalFilters: any[] = [];

      if (filters.entityType) {
        additionalFilters.push({ entityType: filters.entityType });
      }

      if (filters.userId) {
        additionalFilters.push({ userId: filters.userId });
      }

      if (filters.startDate) {
        additionalFilters.push({ createdAt: { gte: filters.startDate } });
      }

      if (filters.endDate) {
        additionalFilters.push({ createdAt: { lte: filters.endDate } });
      }

      if (additionalFilters.length > 0) {
        whereClause.AND = additionalFilters;
      }
    }

    const [totalCount, activities] = await Promise.all([
      this.prisma.activityLog.count({ where: whereClause }),
      this.prisma.activityLog.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
