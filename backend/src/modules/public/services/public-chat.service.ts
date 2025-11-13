// src/project/project-charts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ProjectChartDataResponse,
  ProjectChartType,
  ProjectKPIMetrics,
  SprintVelocity,
  TaskStatusFlow,
} from 'src/modules/projects/dto/get-project-charts-query.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProjectChartsService {
  private readonly logger = new Logger(ProjectChartsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get multiple project chart data types in a single request
   */
  async getMultipleProjectChartData(
    projectSlug: string,
    chartTypes: ProjectChartType[],
  ): Promise<ProjectChartDataResponse> {
    this.logger.log(
      `Fetching project chart data for ${projectSlug}, types: ${chartTypes.join(', ')}`,
    );

    try {
      // Check project visibility once before fetching all charts
      await this.getProjectWithVisibilityCheck(projectSlug);

      // Execute all chart requests in parallel
      const chartPromises = chartTypes.map(async (type) => {
        const data = await this.getSingleProjectChartData(projectSlug, type);
        return { type, data };
      });

      const chartResults = await Promise.all(chartPromises);

      // Build response object
      const results: ProjectChartDataResponse = {};
      chartResults.forEach(({ type, data }) => {
        results[type] = data;
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

      // ✅ Re-throw to make sure caller sees proper HTTP error
      if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to fetch project chart data');
    }
  }

  /**
   * Get single project chart data based on type
   */
  private async getSingleProjectChartData(
    projectSlug: string,
    chartType: ProjectChartType,
  ): Promise<any> {
    switch (chartType) {
      case ProjectChartType.TASK_STATUS:
        return this.projectTaskStatusFlow(projectSlug);
      case ProjectChartType.TASK_TYPE:
        return this.projectTaskTypeDistribution(projectSlug);
      case ProjectChartType.KPI_METRICS:
        return this.projectKPIMetrics(projectSlug);
      case ProjectChartType.TASK_PRIORITY:
        return this.projectTaskPriorityDistribution(projectSlug);
      case ProjectChartType.SPRINT_VELOCITY:
        return this.projectSprintVelocityTrend(projectSlug);
      default:
        throw new BadRequestException(`Unsupported chart type: ${String(chartType)}`);
    }
  }

  /**
   * Helper method to get project and validate visibility
   */
  private async getProjectWithVisibilityCheck(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        visibility: true, // Assuming you have a visibility field
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  /**
   * Helper method to calculate percentage with proper rounding
   */
  private calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
  }

  /**
   * 1) Task Status Flow - Public projects only
   */
  async projectTaskStatusFlow(projectSlug: string): Promise<TaskStatusFlow[]> {
    // const _project = await this.getProjectWithVisibilityCheck(projectSlug);

    const projectWithWorkflow = await this.prisma.project.findUnique({
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

    if (!projectWithWorkflow?.workflow) {
      throw new NotFoundException('Project workflow not found');
    }

    return projectWithWorkflow.workflow.statuses.map((status) => ({
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
   * 2) Task Type Distribution - Public projects only
   */
  async projectTaskTypeDistribution(projectSlug: string) {
    const project = await this.getProjectWithVisibilityCheck(projectSlug);

    const taskWhere = {
      projectId: project.id,
    };

    return this.prisma.task.groupBy({
      by: ['type'],
      where: taskWhere,
      _count: { type: true },
    });
  }

  /**
   * 3) KPI Metrics - Public projects only
   */
  async projectKPIMetrics(projectSlug: string): Promise<ProjectKPIMetrics> {
    const project = await this.getProjectWithVisibilityCheck(projectSlug);

    const taskWhere = {
      projectId: project.id,
    };

    const [totalTasks, completedTasks, activeSprints, totalBugs, resolvedBugs] =
      await Promise.all([
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
   * 4) Task Priority Distribution - Public projects only
   */
  async projectTaskPriorityDistribution(projectSlug: string) {
    const project = await this.getProjectWithVisibilityCheck(projectSlug);

    const taskWhere = {
      projectId: project.id,
    };

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: taskWhere,
      _count: { priority: true },
    });
  }

  /**
   * 5) Sprint Velocity Trend - Public projects only
   */
  async projectSprintVelocityTrend(
    projectSlug: string,
  ): Promise<SprintVelocity[]> {
    const project = await this.getProjectWithVisibilityCheck(projectSlug);

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
      velocity: sprint.tasks.reduce(
        (sum, task) => sum + (task.storyPoints || 0),
        0,
      ),
    }));
  }

  /**
   * Sprint Burndown (separate endpoint due to sprintId parameter) - Public projects only
   */
  async projectSprintBurndown(sprintId: string, projectSlug: string) {
    await this.getProjectWithVisibilityCheck(projectSlug);

    return this.prisma.task.findMany({
      where: {
        sprintId,
        project: {
          slug: projectSlug,
          archive: false,
        },
        sprint: { archive: false },
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
