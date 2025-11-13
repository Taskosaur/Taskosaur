// src/project/project-charts.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from 'src/common/access-control.utils';
import {
  ProjectChartDataResponse,
  ProjectChartType,
  ProjectKPIMetrics,
  SprintVelocity,
  TaskStatusFlow,
} from './dto/get-project-charts-query.dto';

@Injectable()
export class ProjectChartsService {
  private readonly logger = new Logger(ProjectChartsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Get multiple project chart data types in a single request
   */
  async getMultipleProjectChartData(
    projectSlug: string,
    userId: string,
    chartTypes: ProjectChartType[],
  ): Promise<ProjectChartDataResponse> {
    this.logger.log(
      `Fetching project chart data for ${projectSlug}, types: ${chartTypes.join(', ')}`,
    );

    try {
      // Execute all chart requests in parallel
      const projectResult = await this.prisma.project.findUnique({ where: { slug: projectSlug } });
      if (!projectResult) {
        throw new NotFoundException(`Workspace with slug '${projectSlug}' not found'`);
      }
      const chartPromises = chartTypes.map(async (type) => {
        try {
          const data = await this.getSingleProjectChartData(projectSlug, userId, type);
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
      const results: ProjectChartDataResponse = {};
      chartResults.forEach(({ type, data, error }) => {
        results[type] = error ? { error } : data;
      });

      this.logger.log(
        `Successfully fetched project chart data for ${chartTypes.length} chart types`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to fetch project chart data for ${projectSlug}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get single project chart data based on type
   */
  private async getSingleProjectChartData(
    projectSlug: string,
    userId: string,
    chartType: ProjectChartType,
  ): Promise<any> {
    switch (chartType) {
      case ProjectChartType.TASK_STATUS:
        return this.projectTaskStatusFlow(projectSlug, userId);
      case ProjectChartType.TASK_TYPE:
        return this.projectTaskTypeDistribution(projectSlug, userId);
      case ProjectChartType.KPI_METRICS:
        return this.projectKPIMetrics(projectSlug, userId);
      case ProjectChartType.TASK_PRIORITY:
        return this.projectTaskPriorityDistribution(projectSlug, userId);
      case ProjectChartType.SPRINT_VELOCITY:
        return this.projectSprintVelocityTrend(projectSlug, userId);
      default:
        throw new BadRequestException(`Unsupported chart type: ${String(chartType)}`);
    }
  }

  /**
   * Helper method to get project and validate access
   */
  private async getProjectWithAccess(projectSlug: string, userId: string) {
    const { isElevated } = await this.accessControl.getProjectAccessBySlug(projectSlug, userId);

    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return { project, isElevated };
  }

  /**
   * Helper method to calculate percentage with proper rounding
   */
  private calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
  }

  /**
   * 1) Task Status Flow
   */
  async projectTaskStatusFlow(projectSlug: string, userId: string): Promise<TaskStatusFlow[]> {
    const { isElevated } = await this.accessControl.getProjectAccessBySlug(projectSlug, userId);

    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        workflow: {
          include: {
            statuses: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
                position: true,
                _count: {
                  select: {
                    tasks: {
                      where: {
                        project: { slug: projectSlug },
                        ...(isElevated
                          ? {}
                          : {
                              OR: [
                                { assignees: { some: { id: userId } } },
                                { reporters: { some: { id: userId } } },
                              ],
                            }),
                      },
                    },
                  },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!project?.workflow) {
      throw new NotFoundException('Project workflow not found');
    }

    return project.workflow.statuses.map((status) => ({
      statusId: status.id,
      count: status._count.tasks,
      status: {
        id: status.id,
        name: status.name,
        color: status.color,
        category: status.category,
        position: status.position,
      },
    }));
  }

  /**
   * 2) Task Type Distribution
   */
  async projectTaskTypeDistribution(projectSlug: string, userId: string) {
    const { project, isElevated } = await this.getProjectWithAccess(projectSlug, userId);

    const taskWhere = {
      projectId: project.id,
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
   * 3) KPI Metrics
   */
  async projectKPIMetrics(projectSlug: string, userId: string): Promise<ProjectKPIMetrics> {
    const { project, isElevated } = await this.getProjectWithAccess(projectSlug, userId);

    const taskWhere = {
      projectId: project.id,
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    const [totalTasks, completedTasks, activeSprints, totalBugs, resolvedBugs] = await Promise.all([
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({
        where: { ...taskWhere, completedAt: { not: null } },
      }),
      this.prisma.sprint.count({
        where: {
          projectId: project.id,
          archive: false,
          status: 'ACTIVE',
        },
      }),
      this.prisma.task.count({ where: { ...taskWhere, type: 'BUG' } }),
      this.prisma.task.count({
        where: { ...taskWhere, type: 'BUG', completedAt: { not: null } },
      }),
    ]);

    return {
      totalTasks,
      completedTasks,
      activeSprints,
      totalBugs,
      resolvedBugs,
      completionRate: this.calculatePercentage(completedTasks, totalTasks),
      bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
    };
  }

  /**
   * 4) Task Priority Distribution
   */
  async projectTaskPriorityDistribution(projectSlug: string, userId: string) {
    const { project, isElevated } = await this.getProjectWithAccess(projectSlug, userId);

    const taskWhere = {
      projectId: project.id,
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: taskWhere,
      _count: { priority: true },
    });
  }

  /**
   * 5) Sprint Velocity Trend
   */
  async projectSprintVelocityTrend(projectSlug: string, userId: string): Promise<SprintVelocity[]> {
    const { project, isElevated } = await this.getProjectWithAccess(projectSlug, userId);

    const sprints = await this.prisma.sprint.findMany({
      where: {
        projectId: project.id,
        status: 'COMPLETED',
        archive: false,
      },
      include: {
        tasks: {
          where: {
            completedAt: { not: null },
            ...(isElevated
              ? {}
              : {
                  OR: [
                    { assignees: { some: { id: userId } } },
                    { reporters: { some: { id: userId } } },
                  ],
                }),
          },
          select: { storyPoints: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      velocity: sprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0),
    }));
  }

  /**
   * Sprint Burndown (separate endpoint due to sprintId parameter)
   */
  async projectSprintBurndown(sprintId: string, projectSlug: string, userId: string) {
    const { isElevated } = await this.accessControl.getProjectAccessBySlug(projectSlug, userId);

    return this.prisma.task.findMany({
      where: {
        sprintId,
        project: { archive: false },
        sprint: { archive: false },
        ...(isElevated
          ? {}
          : {
              OR: [
                { assignees: { some: { id: userId } } },
                { reporters: { some: { id: userId } } },
              ],
            }),
      },
      select: {
        completedAt: true,
        storyPoints: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
