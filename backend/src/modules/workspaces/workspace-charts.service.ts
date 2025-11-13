// src/workspace/workspace-charts.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AccessControlService } from 'src/common/access-control.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MonthlyTaskCompletion,
  WorkspaceChartDataResponse,
  WorkspaceChartType,
  WorkspaceKPIMetrics,
} from './dto/get-workspace-charts-query.dto';

@Injectable()
export class WorkspaceChartsService {
  private readonly logger = new Logger(WorkspaceChartsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Get multiple workspace chart data types in a single request
   */
  async getMultipleWorkspaceChartData(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
    chartTypes: WorkspaceChartType[],
  ): Promise<WorkspaceChartDataResponse> {
    this.logger.log(
      `Fetching workspace chart data for ${workspaceSlug}, types: ${chartTypes.join(', ')}`,
    );

    try {
      // Execute all chart requests in parallel
      const workspaceResult = await this.prisma.workspace.findUnique({
        where: { organizationId_slug: { organizationId: organizationId, slug: workspaceSlug } },
      });
      if (!workspaceResult) {
        throw new NotFoundException(
          `Workspace with slug '${workspaceSlug}' not found in organization '${organizationId}'`,
        );
      }
      const chartPromises = chartTypes.map(async (type) => {
        try {
          const data = await this.getSingleWorkspaceChartData(
            organizationId,
            workspaceSlug,
            userId,
            type,
          );
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
      const results: WorkspaceChartDataResponse = {};
      chartResults.forEach(({ type, data, error }) => {
        results[type] = error ? { error } : data;
      });

      this.logger.log(
        `Successfully fetched workspace chart data for ${chartTypes.length} chart types`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to fetch workspace chart data for ${workspaceSlug}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get single workspace chart data based on type
   */
  private async getSingleWorkspaceChartData(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
    chartType: WorkspaceChartType,
  ): Promise<any> {
    switch (chartType) {
      case WorkspaceChartType.PROJECT_STATUS:
        return this.workspaceProjectStatusDistribution(organizationId, workspaceSlug, userId);
      case WorkspaceChartType.TASK_PRIORITY:
        return this.workspaceTaskPriorityBreakdown(organizationId, workspaceSlug, userId);
      case WorkspaceChartType.KPI_METRICS:
        return this.workspaceKPIMetrics(organizationId, workspaceSlug, userId);
      case WorkspaceChartType.TASK_TYPE:
        return this.workspaceTaskTypeDistribution(organizationId, workspaceSlug, userId);
      case WorkspaceChartType.SPRINT_STATUS:
        return this.workspaceSprintStatusOverview(organizationId, workspaceSlug, userId);
      case WorkspaceChartType.MONTHLY_COMPLETION:
        return this.workspaceMonthlyTaskCompletion(organizationId, workspaceSlug, userId);
      default:
        throw new BadRequestException(`Unsupported chart type: ${String(chartType)}`);
    }
  }

  /**
   * Helper method to get workspace and validate access
   */
  private async getWorkspaceWithAccess(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    return { workspace, isElevated };
  }

  /**
   * Helper method to calculate percentage with proper rounding
   */
  private calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
  }

  /**
   * 1) Project Status Distribution
   */
  async workspaceProjectStatusDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const projectWhere = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    return this.prisma.project.groupBy({
      by: ['status'],
      where: projectWhere,
      _count: { status: true },
    });
  }

  /**
   * 2) Task Priority Breakdown
   */
  async workspaceTaskPriorityBreakdown(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const projects = await this.prisma.project.findMany({
      where: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return [];
    }

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: {
        projectId: { in: projectIds },
        ...(isElevated
          ? {}
          : {
              OR: [
                { assignees: { some: { id: userId } } },
                { reporters: { some: { id: userId } } },
              ],
            }),
      },
      _count: { priority: true },
    });
  }

  /**
   * 3) KPI Metrics
   */
  async workspaceKPIMetrics(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ): Promise<WorkspaceKPIMetrics> {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const projectBase = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    const taskBase = {
      project: projectBase,
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    const [totalProjects, activeProjects, completedProjects, totalTasks, overdueTasks] =
      await Promise.all([
        this.prisma.project.count({ where: projectBase }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'ACTIVE' },
        }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'COMPLETED' },
        }),
        this.prisma.task.count({ where: taskBase }),
        this.prisma.task.count({
          where: { ...taskBase, dueDate: { lt: new Date() }, completedAt: null },
        }),
      ]);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      overdueTasks,
      completionRate: this.calculatePercentage(completedProjects, totalProjects),
    };
  }

  /**
   * 4) Task Type Distribution
   */
  async workspaceTaskTypeDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['type'],
      where: taskWhere,
      _count: { type: true },
    });
  }

  /**
   * 5) Sprint Status Overview
   */
  async workspaceSprintStatusOverview(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const projects = await this.prisma.project.findMany({
      where: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    return this.prisma.sprint.groupBy({
      by: ['status'],
      where: {
        archive: false,
        projectId: { in: projectIds },
      },
      _count: { status: true },
    });
  }

  /**
   * 6) Monthly Task Completion
   */
  async workspaceMonthlyTaskCompletion(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ): Promise<MonthlyTaskCompletion[]> {
    const { isElevated } = await this.getWorkspaceWithAccess(organizationId, workspaceSlug, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      completedAt: { not: null },
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    const monthlyData = tasks.reduce(
      (acc, task) => {
        if (task.completedAt) {
          const month = task.completedAt.toISOString().substring(0, 7);
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
