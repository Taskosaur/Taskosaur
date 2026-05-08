// src/activity-log/activity-log.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ActivityLog, ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);
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
    let resolvedEntityId = data.entityId;

    // Resolve taskId if it's a slug and entityType is Task
    if (data.entityType.toLowerCase() === 'task') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.entityId,
      );

      if (!isUuid) {
        const task = await this.prisma.task.findFirst({
          where: { slug: data.entityId },
          select: { id: true },
        });
        if (task) {
          resolvedEntityId = task.id;
        } else {
          this.logger.warn(
            `Could not resolve task slug to UUID for activity log: ${data.entityId}`,
          );
        }
      }
    }

    const finalIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      resolvedEntityId,
    );

    if (!finalIsUuid && resolvedEntityId) {
      this.logger.error(
        `Attempting to log activity with non-UUID entityId: ${resolvedEntityId} (EntityType: ${data.entityType})`,
      );
      return; // Prevent Prisma crash
    }

    return await this.prisma.activityLog.create({
      data: {
        type: data.type,
        description: data.description,
        entityType: data.entityType,
        entityId: resolvedEntityId,
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

  async getTaskParticipants(taskIdOrSlug: string): Promise<string[]> {
    if (!taskIdOrSlug) return [];

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        taskIdOrSlug,
      );

      const task = await this.prisma.task.findFirst({
        where: isUuid ? { id: taskIdOrSlug } : { slug: taskIdOrSlug },
        select: {
          assignees: true,
          reporters: true,
        },
      });

      return [
        ...(task?.assignees.map((assignee) => assignee.userId) || []),
        ...(task?.reporters.map((reporter) => reporter.userId) || []),
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
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            entityId,
          );
          const task = await this.prisma.task.findFirst({
            where: isUuid ? { id: entityId } : { slug: entityId },
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

        case 'sprint': {
          const sprint = await this.prisma.sprint.findUnique({
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
          return sprint?.project?.workspace?.organizationId || undefined;
        }

        default:
          return undefined;
      }
    } catch (error) {
      console.error('Error getting organization ID:', error);
      return undefined;
    }
  }

  async getTaskActivities(
    taskIdOrSlug: string,
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
    // Resolve taskId if it's a slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      taskIdOrSlug,
    );

    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskIdOrSlug } : { slug: taskIdOrSlug },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const taskId = task.id;

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
        OR
        (al.entity_type = 'Sprint' AND (
          al.entity_id IN (
            SELECT s.id FROM sprints s
            JOIN projects p ON s.project_id = p.id
            WHERE p.workspace_id = ${workspaceId}::uuid
          )
          OR (
            al.new_value->>'projectId' IN (
              SELECT id::text FROM projects WHERE workspace_id = ${workspaceId}::uuid
            )
          )
          OR (
            al.old_value->>'projectId' IN (
              SELECT id::text FROM projects WHERE workspace_id = ${workspaceId}::uuid
            )
          )
        ))
    `;
    const totalCount = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    // ✅ Fixed raw query with proper UUID casting and slug joins for navigation
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
      u.avatar,
      COALESCE(t.slug, ct.slug) as task_slug,
      COALESCE(tp.slug, ctp.slug) as task_project_slug,
      COALESCE(tw.slug, ctw.slug) as task_workspace_slug,
      pp.slug as project_slug,
      pw.slug as project_workspace_slug,
      ws.slug as workspace_slug,
      sp.slug as sprint_slug,
      spp.slug as sprint_project_slug,
      spw.slug as sprint_workspace_slug
    FROM activity_logs al
    JOIN users u ON al.user_id = u.id
    -- Standard Task join for types where entity_id is taskId
    LEFT JOIN tasks t ON (al.entity_type IN ('Task', 'Task Label', 'TaskAttachment', 'Task Attchment')) AND al.entity_id = t.id
    LEFT JOIN projects tp ON t.project_id = tp.id
    LEFT JOIN workspaces tw ON tp.workspace_id = tw.id
    -- Join for Task Comment where entity_id is commentId
    LEFT JOIN task_comments tc ON (al.entity_type IN ('Task Comment', 'TaskComment')) AND al.entity_id = tc.id
    LEFT JOIN tasks ct ON tc.task_id = ct.id
    LEFT JOIN projects ctp ON ct.project_id = ctp.id
    LEFT JOIN workspaces ctw ON ctp.workspace_id = ctw.id
    -- Standard Project/Workspace/Sprint joins
    LEFT JOIN projects pp ON al.entity_type = 'Project' AND al.entity_id = pp.id
    LEFT JOIN workspaces pw ON pp.workspace_id = pw.id
    LEFT JOIN workspaces ws ON al.entity_type = 'Workspace' AND al.entity_id = ws.id
    LEFT JOIN sprints sp ON al.entity_type = 'Sprint' AND al.entity_id = sp.id
    LEFT JOIN projects spp ON sp.project_id = spp.id
    LEFT JOIN workspaces spw ON spp.workspace_id = spw.id
    WHERE
      (al.entity_type = 'Workspace' AND al.entity_id = ${workspaceId}::uuid)
      OR
      (al.entity_type = 'Project' AND al.entity_id IN (
        SELECT id FROM projects WHERE workspace_id = ${workspaceId}::uuid
      ))
      OR
      (al.entity_type IN ('Task', 'Task Label', 'TaskAttachment', 'Task Attchment') AND al.entity_id IN (
        SELECT t.id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.workspace_id = ${workspaceId}::uuid
      ))
      OR
      (al.entity_type IN ('Task Comment', 'TaskComment') AND al.entity_id IN (
        SELECT tc.id FROM task_comments tc
        JOIN tasks t ON tc.task_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE p.workspace_id = ${workspaceId}::uuid
      ))
      OR
      (al.entity_type = 'Sprint' AND (
        al.entity_id IN (
          SELECT s.id FROM sprints s
          JOIN projects p ON s.project_id = p.id
          WHERE p.workspace_id = ${workspaceId}::uuid
        )
        OR (
          al.new_value->>'projectId' IN (
            SELECT id::text FROM projects WHERE workspace_id = ${workspaceId}::uuid
          )
        )
        OR (
          al.old_value->>'projectId' IN (
            SELECT id::text FROM projects WHERE workspace_id = ${workspaceId}::uuid
          )
        )
      ))
    ORDER BY al.created_at DESC
    LIMIT ${limit}::int
    OFFSET ${offset}::int
  `;

    const mapped = activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      entityType: activity.entity_type,
      entityId: activity.entity_id,
      createdAt: activity.created_at,
      taskSlug: activity.task_slug || null,
      projectSlug:
        activity.task_project_slug || activity.project_slug || activity.sprint_project_slug || null,
      workspaceSlug:
        activity.task_workspace_slug ||
        activity.project_workspace_slug ||
        activity.workspace_slug ||
        activity.sprint_workspace_slug ||
        null,
      sprintSlug: activity.sprint_slug || null,
      user: {
        id: activity.user_id,
        name: `${activity.first_name} ${activity.last_name}`,
        email: activity.email,
        avatar: activity.avatar,
      },
    }));

    return {
      activities: mapped,
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
  ) {
    const offset = (page - 1) * limit;

    const entityTypeFilter = filters?.entityType
      ? Prisma.sql`AND al.entity_type = ${filters.entityType}`
      : Prisma.empty;

    const userIdFilter = filters?.userId
      ? Prisma.sql`AND al.user_id = ${filters.userId}::uuid`
      : Prisma.empty;

    const startDateFilter = filters?.startDate
      ? Prisma.sql`AND al.created_at >= ${filters.startDate}`
      : Prisma.empty;

    const endDateFilter = filters?.endDate
      ? Prisma.sql`AND al.created_at <= ${filters.endDate}`
      : Prisma.empty;

    const totalResult: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count
      FROM activity_logs al
      WHERE (
        al.organization_id = ${organizationId}::uuid
        OR (al.entity_type = 'Workspace' AND al.entity_id IN (
          SELECT id FROM workspaces WHERE organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type = 'Project' AND al.entity_id IN (
          SELECT p.id FROM projects p
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type = 'Task' AND al.entity_id IN (
          SELECT t.id FROM tasks t
          JOIN projects p ON t.project_id = p.id
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type = 'Sprint' AND al.entity_id IN (
          SELECT s.id FROM sprints s
          JOIN projects p ON s.project_id = p.id
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
      )
      ${entityTypeFilter}
      ${userIdFilter}
      ${startDateFilter}
      ${endDateFilter}
    `;

    const totalCount = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    const activities: any[] = await this.prisma.$queryRaw`
      SELECT
        al.id,
        al.type,
        al.description,
        al.entity_type,
        al.entity_id,
        al.new_value,
        al.created_at,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar,
        COALESCE(t.slug, ct.slug) as task_slug,
        COALESCE(tp.slug, ctp.slug) as task_project_slug,
        COALESCE(tw.slug, ctw.slug) as task_workspace_slug,
        pp.slug as project_slug,
        pw.slug as project_workspace_slug,
        ws.slug as workspace_slug,
        sp.slug as sprint_slug,
        spp.slug as sprint_project_slug,
        spw.slug as sprint_workspace_slug
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      -- Standard Task join for types where entity_id is taskId
      LEFT JOIN tasks t ON (al.entity_type IN ('Task', 'Task Label', 'TaskAttachment', 'Task Attchment')) AND al.entity_id = t.id
      LEFT JOIN projects tp ON t.project_id = tp.id
      LEFT JOIN workspaces tw ON tp.workspace_id = tw.id
      -- Join for Task Comment where entity_id is commentId
      LEFT JOIN task_comments tc ON (al.entity_type IN ('Task Comment', 'TaskComment')) AND al.entity_id = tc.id
      LEFT JOIN tasks ct ON tc.task_id = ct.id
      LEFT JOIN projects ctp ON ct.project_id = ctp.id
      LEFT JOIN workspaces ctw ON ctp.workspace_id = ctw.id
      -- Standard Project/Workspace/Sprint joins
      LEFT JOIN projects pp ON al.entity_type = 'Project' AND al.entity_id = pp.id
      LEFT JOIN workspaces pw ON pp.workspace_id = pw.id
      LEFT JOIN workspaces ws ON al.entity_type = 'Workspace' AND al.entity_id = ws.id
      LEFT JOIN sprints sp ON al.entity_type = 'Sprint' AND al.entity_id = sp.id
      LEFT JOIN projects spp ON sp.project_id = spp.id
      LEFT JOIN workspaces spw ON spp.workspace_id = spw.id
      WHERE (
        al.organization_id = ${organizationId}::uuid
        OR (al.entity_type = 'Workspace' AND al.entity_id IN (
          SELECT id FROM workspaces WHERE organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type = 'Project' AND al.entity_id IN (
          SELECT p.id FROM projects p
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type IN ('Task', 'Task Label', 'TaskAttachment', 'Task Attchment') AND al.entity_id IN (
          SELECT t.id FROM tasks t
          JOIN projects p ON t.project_id = p.id
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type IN ('Task Comment', 'TaskComment') AND al.entity_id IN (
          SELECT tc.id FROM task_comments tc
          JOIN tasks t ON tc.task_id = t.id
          JOIN projects p ON t.project_id = p.id
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
        OR (al.entity_type = 'Sprint' AND al.entity_id IN (
          SELECT s.id FROM sprints s
          JOIN projects p ON s.project_id = p.id
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.organization_id = ${organizationId}::uuid
        ))
      )
      ${entityTypeFilter}
      ${userIdFilter}
      ${startDateFilter}
      ${endDateFilter}
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
        newValue: activity.new_value,
        createdAt: activity.created_at,
        taskSlug: activity.task_slug || null,
        projectSlug:
          activity.task_project_slug ||
          activity.project_slug ||
          activity.sprint_project_slug ||
          null,
        workspaceSlug:
          activity.task_workspace_slug ||
          activity.project_workspace_slug ||
          activity.workspace_slug ||
          activity.sprint_workspace_slug ||
          null,
        sprintSlug: activity.sprint_slug || null,
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
}
