import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from 'src/common/access-control.utils';
import { ChartDataResponse, ChartType } from './dto/get-charts-query.dto';
import { UserSource } from '@prisma/client';

export interface KPIMetrics {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalBugs: number;
  resolvedBugs: number;
  activeSprints: number;
  projectCompletionRate: number;
  taskCompletionRate: number;
  bugResolutionRate: number;
  overallProductivity: number;
}

export interface QualityMetrics {
  totalBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  resolvedCriticalBugs: number;
  bugResolutionRate: number;
  criticalBugResolutionRate: number;
}

export interface WorkspaceProjectCount {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  projectCount: number;
}

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  activeTasks: number;
  reportedTasks: number;
}

@Injectable()
export class OrganizationChartsService {
  private readonly logger = new Logger(OrganizationChartsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Get multiple chart data types in a single request
   */
  async getMultipleChartData(
    orgId: string,
    userId: string,
    chartTypes: ChartType[],
  ): Promise<ChartDataResponse> {
    this.logger.log(
      `Fetching chart data for organization ${orgId}, types: ${chartTypes.join(', ')}`,
    );

    try {
      // Execute all chart requests in parallel for better performance
      const chartPromises = chartTypes.map(async (type) => {
        try {
          const data = await this.getSingleChartData(orgId, userId, type);
          return { type, data, error: null };
        } catch (error) {
          this.logger.error(
            `Failed to fetch chart data for type ${type}: ${error.message}`,
            error.stack,
          );
          return { type, data: null, error: error.message };
        }
      });

      const chartResults = await Promise.all(chartPromises);

      // Build response object
      const results: ChartDataResponse = {};
      chartResults.forEach(({ type, data, error }) => {
        results[type] = error ? { error } : data;
      });

      this.logger.log(`Successfully fetched chart data for ${chartTypes.length} chart types`);

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to fetch chart data for organization ${orgId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get single chart data based on type
   */
  private async getSingleChartData(
    orgId: string,
    userId: string,
    chartType: ChartType,
  ): Promise<any> {
    switch (chartType) {
      case ChartType.KPI_METRICS:
        return this.organizationKPIMetrics(orgId, userId);
      case ChartType.PROJECT_PORTFOLIO:
        return this.organizationProjectPortfolio(orgId, userId);
      case ChartType.TEAM_UTILIZATION:
        return this.organizationTeamUtilization(orgId, userId);
      case ChartType.TASK_DISTRIBUTION:
        return this.organizationTaskDistribution(orgId, userId);
      case ChartType.TASK_TYPE:
        return this.organizationTaskTypeDistribution(orgId, userId);
      case ChartType.SPRINT_METRICS:
        return this.organizationSprintMetrics(orgId, userId);
      case ChartType.QUALITY_METRICS:
        return this.organizationQualityMetrics(orgId, userId);
      case ChartType.WORKSPACE_PROJECT_COUNT:
        return this.organizationWorkspaceProjectCount(orgId, userId);
      case ChartType.MEMBER_WORKLOAD:
        return this.organizationMemberWorkload(orgId, userId);
      case ChartType.RESOURCE_ALLOCATION:
        return this.organizationResourceAllocation(orgId, userId);
      default:
        throw new BadRequestException(`Unsupported chart type: ${String(chartType)}`);
    }
  }

  /**
   * Helper method to calculate percentage with proper rounding
   */
  private calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
  }

  /**
   * Reusable scoped where fragments when not elevated
   * - Projects: user must be a member
   * - Workspaces: user must be a member
   * - Tasks: assigned to or reported by the user
   */
  private userScopedWhere(orgId: string, userId: string) {
    return {
      workspaceForUser: {
        organizationId: orgId,
        archive: false,
        members: { some: { userId } },
      },
      projectForUser: {
        archive: false,
        workspace: { organizationId: orgId, archive: false },
        members: { some: { userId } },
      },
      taskForUser: {
        project: { workspace: { organizationId: orgId }, archive: false },
        OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
      },
      sprintForUser: {
        archive: false,
        project: {
          archive: false,
          workspace: { organizationId: orgId, archive: false },
          members: { some: { userId } },
        },
      },
    };
  }

  /**
   * 1) KPI Metrics
   */
  async organizationKPIMetrics(orgId: string, userId: string): Promise<KPIMetrics> {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const now = new Date();

    if (isElevated) {
      const [
        totalWorkspaces,
        activeWorkspaces,
        totalProjects,
        activeProjects,
        completedProjects,
        totalMembers,
        totalTasks,
        completedTasks,
        overdueTasks,
        totalBugs,
        resolvedBugs,
        activeSprints,
      ] = await Promise.all([
        this.prisma.workspace.count({
          where: { organizationId: orgId, archive: false },
        }),
        this.prisma.workspace.count({
          where: { organizationId: orgId, archive: false },
        }),
        this.prisma.project.count({
          where: { workspace: { organizationId: orgId }, archive: false },
        }),
        this.prisma.project.count({
          where: {
            workspace: { organizationId: orgId },
            archive: false,
            status: 'ACTIVE',
          },
        }),
        this.prisma.project.count({
          where: {
            workspace: { organizationId: orgId },
            archive: false,
            status: 'COMPLETED',
          },
        }),
        this.prisma.organizationMember.count({
          where: { organizationId: orgId },
        }),
        this.prisma.task.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
          },
        }),
        this.prisma.task.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
            completedAt: { not: null },
          },
        }),
        this.prisma.task.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
            dueDate: { lt: now },
            completedAt: null,
          },
        }),
        this.prisma.task.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
            type: 'BUG',
          },
        }),
        this.prisma.task.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
            type: 'BUG',
            completedAt: { not: null },
          },
        }),
        this.prisma.sprint.count({
          where: {
            project: { workspace: { organizationId: orgId }, archive: false },
            status: 'ACTIVE',
            archive: false,
          },
        }),
      ]);

      return {
        totalWorkspaces,
        activeWorkspaces,
        totalProjects,
        activeProjects,
        completedProjects,
        totalMembers,
        totalTasks,
        completedTasks,
        overdueTasks,
        totalBugs,
        resolvedBugs,
        activeSprints,
        projectCompletionRate: this.calculatePercentage(completedProjects, totalProjects),
        taskCompletionRate: this.calculatePercentage(completedTasks, totalTasks),
        bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
        overallProductivity: this.calculatePercentage(completedTasks, totalTasks),
      };
    }

    // Non-elevated: user-scoped
    const scoped = this.userScopedWhere(orgId, userId);

    const [
      totalWorkspaces,
      activeWorkspaces,
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
      totalBugs,
      resolvedBugs,
      activeSprints,
      totalMembers,
    ] = await Promise.all([
      this.prisma.workspace.count({ where: scoped.workspaceForUser }),
      this.prisma.workspace.count({ where: scoped.workspaceForUser }),
      this.prisma.project.count({ where: scoped.projectForUser }),
      this.prisma.project.count({
        where: { ...scoped.projectForUser, status: 'ACTIVE' },
      }),
      this.prisma.project.count({
        where: { ...scoped.projectForUser, status: 'COMPLETED' },
      }),
      this.prisma.task.count({ where: scoped.taskForUser }),
      this.prisma.task.count({
        where: { ...scoped.taskForUser, completedAt: { not: null } },
      }),
      this.prisma.task.count({
        where: {
          ...scoped.taskForUser,
          dueDate: { lt: now },
          completedAt: null,
        },
      }),
      this.prisma.task.count({ where: { ...scoped.taskForUser, type: 'BUG' } }),
      this.prisma.task.count({
        where: {
          ...scoped.taskForUser,
          type: 'BUG',
          completedAt: { not: null },
        },
      }),
      this.prisma.sprint.count({
        where: { ...scoped.sprintForUser, status: 'ACTIVE' },
      }),
      this.prisma.organizationMember.count({
        where: { organizationId: orgId },
      }),
    ]);

    return {
      totalWorkspaces,
      activeWorkspaces,
      totalProjects,
      activeProjects,
      completedProjects,
      totalMembers, // User scope shows only current user
      totalTasks,
      completedTasks,
      overdueTasks,
      totalBugs,
      resolvedBugs,
      activeSprints,
      projectCompletionRate: this.calculatePercentage(completedProjects, totalProjects),
      taskCompletionRate: this.calculatePercentage(completedTasks, totalTasks),
      bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
      overallProductivity: this.calculatePercentage(completedTasks, totalTasks),
    };
  }

  /**
   * 2) Project Portfolio
   */
  async organizationProjectPortfolio(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const base = { workspace: { organizationId: orgId }, archive: false };
    const where = isElevated ? base : { ...base, members: { some: { userId } } };

    return this.prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
  }

  /**
   * 3) Team Utilization (roles distribution)
   */
  async organizationTeamUtilization(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);

    if (isElevated) {
      return this.prisma.organizationMember.groupBy({
        by: ['role'],
        where: { organizationId: orgId },
        _count: { role: true },
      });
    }

    const me = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    return me ? [{ role: me.role, _count: { role: 1 } }] : [];
  }

  /**
   * 4) Task Distribution by Priority
   */
  async organizationTaskDistribution(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        project: { workspace: { organizationId: orgId, archive: false } },
        ...(isElevated
          ? {}
          : {
              OR: [
                { assignees: { some: { id: userId } } },
                { reporters: { some: { id: userId } } },
              ],
            }),
      },
      select: { id: true, priority: true },
    });

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: {
        id: { in: tasks.map((t) => t.id) },
      },
      _count: { priority: true },
    });
  }

  /**
   * 5) Task Type Distribution
   */
  async organizationTaskTypeDistribution(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const base = {
      project: { workspace: { organizationId: orgId }, archive: false },
    };
    const where = isElevated
      ? base
      : {
          ...base,
          OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
        };

    return this.prisma.task.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
    });
  }

  /**
   * 6) Sprint Metrics
   */
  async organizationSprintMetrics(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);

    const sprints = await this.prisma.sprint.findMany({
      where: {
        archive: false,
        project: {
          workspace: { organizationId: orgId },
          archive: false,
          ...(isElevated ? {} : { members: { some: { userId } } }),
        },
      },
      select: { id: true, status: true },
    });

    return this.prisma.sprint.groupBy({
      by: ['status'],
      where: {
        id: { in: sprints.map((s) => s.id) },
      },
      _count: { status: true },
    });
  }

  /**
   * 7) Quality Metrics (bugs)
   */
  async organizationQualityMetrics(orgId: string, userId: string): Promise<QualityMetrics> {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const base = {
      project: { workspace: { organizationId: orgId }, archive: false },
      type: 'BUG' as const,
    };
    const where = isElevated
      ? base
      : {
          ...base,
          OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
        };

    const [totalBugs, resolvedBugs, criticalBugs, resolvedCriticalBugs] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: { ...where, completedAt: { not: null } },
      }),
      this.prisma.task.count({
        where: { ...where, priority: { in: ['HIGH', 'HIGHEST'] } },
      }),
      this.prisma.task.count({
        where: {
          ...where,
          priority: { in: ['HIGH', 'HIGHEST'] },
          completedAt: { not: null },
        },
      }),
    ]);

    return {
      totalBugs,
      resolvedBugs,
      criticalBugs,
      resolvedCriticalBugs,
      bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
      criticalBugResolutionRate: this.calculatePercentage(resolvedCriticalBugs, criticalBugs),
    };
  }

  /**
   * 8) Workspace Project Count
   */
  async organizationWorkspaceProjectCount(
    orgId: string,
    userId: string,
  ): Promise<WorkspaceProjectCount[]> {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const workspaceWhere = isElevated
      ? { organizationId: orgId, archive: false }
      : {
          organizationId: orgId,
          archive: false,
          members: { some: { userId } },
        };

    const workspaces = await this.prisma.workspace.findMany({
      where: workspaceWhere,
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { projects: { where: { archive: false } } } },
      },
      orderBy: { projects: { _count: 'desc' } },
    });

    return workspaces.map((w) => ({
      workspaceId: w.id,
      workspaceName: w.name,
      workspaceSlug: w.slug,
      projectCount: w._count.projects,
    }));
  }

  /**
   * 9) Member Workload Distribution
   */
  async organizationMemberWorkload(orgId: string, userId: string): Promise<MemberWorkload[]> {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);

    const userWhere = isElevated
      ? {
          organizationMembers: { some: { organizationId: orgId } },
          source: { not: UserSource.EMAIL_INBOX },
        }
      : {
          id: userId,
          organizationMembers: {
            some: { organizationId: orgId },
            source: { not: UserSource.EMAIL_INBOX },
          },
        };
    const members = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: {
          select: {
            assignedTasks: {
              where: {
                project: {
                  workspace: { organizationId: orgId },
                  archive: false,
                },
                completedAt: null,
              },
            },
            reportedTasks: {
              where: {
                project: {
                  workspace: { organizationId: orgId },
                  archive: false,
                },
              },
            },
          },
        },
      },
      orderBy: isElevated ? { assignedTasks: { _count: 'desc' } } : undefined,
    });

    return members.map((m) => ({
      memberId: m.id,
      memberName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Unknown User',
      activeTasks: m._count.assignedTasks,
      reportedTasks: m._count.reportedTasks,
    }));
  }

  /**
   * 10) Resource Allocation Matrix
   */
  async organizationResourceAllocation(orgId: string, userId: string) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const where = isElevated
      ? { workspace: { organizationId: orgId } }
      : { workspace: { organizationId: orgId, members: { some: { userId } } } };

    return this.prisma.workspaceMember.groupBy({
      by: ['workspaceId', 'role'],
      where,
      _count: { role: true },
      orderBy: [{ workspaceId: 'asc' }, { role: 'asc' }],
    });
  }
}
