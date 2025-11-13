import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface GanttTask {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  progress: number;
  dependencies: string[];
  assignees?:
    | {
        id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
      }[]
    | undefined;
  priority: string;
  status: {
    name: string;
    color: string;
  };
  type: string;
  key: string;
  parent?: string;
  children?: GanttTask[];
}

export interface GanttData {
  tasks: GanttTask[];
  timeline: {
    start: Date;
    end: Date;
    duration: number; // in days
  };
  criticalPath: string[];
  milestones: {
    id: string;
    title: string;
    date: Date;
    type: 'sprint_start' | 'sprint_end' | 'project_milestone';
  }[];
}

@Injectable()
export class GanttService {
  constructor(private prisma: PrismaService) {}

  async getProjectGanttData(projectId: string): Promise<GanttData> {
    // Fetch all project data
    const [project, tasks, sprints, dependencies] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      this.prisma.task.findMany({
        where: { projectId },
        include: {
          assignees: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          status: {
            select: { name: true, color: true },
          },
          dependsOn: {
            include: {
              blockingTask: {
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sprint.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
      this.prisma.taskDependency.findMany({
        where: {
          dependentTask: { projectId },
        },
        select: {
          dependentTaskId: true,
          blockingTaskId: true,
          type: true,
        },
      }),
    ]);

    if (!project) {
      throw new Error('Project not found');
    }

    // Transform tasks to Gantt format
    const ganttTasks: GanttTask[] = tasks.map((task) => {
      const progress = this.calculateTaskProgress(task.status.name);
      const dependencies = task.dependsOn.map((dep) => dep.blockingTask.id);

      return {
        id: task.id,
        title: task.title,
        start: task.startDate,
        end: task.dueDate,
        progress,
        dependencies,
        assignees: task.assignees
          ? task.assignees.map((assignee) => ({
              id: assignee.id,
              firstName: assignee.firstName,
              lastName: assignee.lastName,
              avatar: assignee.avatar || undefined,
            }))
          : undefined,
        priority: task.priority,
        status: task.status,
        type: task.type,
        key: task.slug,
        parent: task.parentTaskId || undefined,
      };
    });

    // Build task hierarchy
    const taskMap = new Map(ganttTasks.map((task) => [task.id, task]));
    const rootTasks: GanttTask[] = [];

    ganttTasks.forEach((task) => {
      if (task.parent) {
        const parent = taskMap.get(task.parent);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(task);
        }
      } else {
        rootTasks.push(task);
      }
    });

    // Calculate timeline
    const timeline = this.calculateTimeline(ganttTasks, project);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(ganttTasks, dependencies);

    // Generate milestones
    const milestones = this.generateMilestones(sprints);

    return {
      tasks: rootTasks,
      timeline,
      criticalPath,
      milestones,
    };
  }

  async getSprintGanttData(sprintId: string): Promise<GanttData> {
    const [sprint, tasks] = await Promise.all([
      this.prisma.sprint.findUnique({
        where: { id: sprintId },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          projectId: true,
        },
      }),
      this.prisma.task.findMany({
        where: { sprintId },
        include: {
          assignees: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          status: {
            select: { name: true, color: true },
          },
          dependsOn: {
            include: {
              blockingTask: {
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    const ganttTasks: GanttTask[] = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      start: task.startDate || sprint.startDate,
      end: task.dueDate || sprint.endDate,
      progress: this.calculateTaskProgress(task.status.name),
      dependencies: task.dependsOn.map((dep) => dep.blockingTask.id),
      assignees: task.assignees
        ? task.assignees.map((assignee) => ({
            id: assignee.id,
            firstName: assignee.firstName,
            lastName: assignee.lastName,
            avatar: assignee.avatar || undefined,
          }))
        : undefined,
      priority: task.priority,
      status: task.status,
      type: task.type,
      key: task.slug,
    }));

    const timeline = this.calculateTimeline(ganttTasks, sprint);
    const criticalPath = this.calculateCriticalPath(ganttTasks, []);

    const milestones = [
      {
        id: String(sprint.id),
        title: `${sprint.name} Start`,
        date: sprint.startDate as Date,
        type: 'sprint_start' as const,
      },
      {
        id: `${String(sprint.id)}_end`,
        title: `${sprint.name} End`,
        date: sprint.endDate as Date,
        type: 'sprint_end' as const,
      },
    ];

    return {
      tasks: ganttTasks,
      timeline,
      criticalPath,
      milestones,
    };
  }

  async getResourceAllocation(projectId: string): Promise<any> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        assignees: {
          some: {}, // Tasks that have at least one assignee
        },
        startDate: { not: null },
        dueDate: { not: null },
      },
      include: {
        assignees: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Group tasks by assignee using Map
    type ResourceType = {
      assignee: { id: string; name: string; avatar: string | null };
      tasks: Array<{
        id: string;
        title: string;
        start: Date | null;
        end: Date | null;
        storyPoints: number;
      }>;
      workload: number;
    };
    const resourceMap = new Map<string, ResourceType>();

    tasks.forEach((task) => {
      // Since each task can have multiple assignees, iterate through all of them
      task.assignees.forEach((assignee) => {
        const assigneeId = assignee.id;

        // Initialize assignee in map if not exists
        if (!resourceMap.has(assigneeId)) {
          resourceMap.set(assigneeId, {
            assignee: {
              id: assignee.id,
              name: `${assignee.firstName} ${assignee.lastName}`,
              avatar: assignee.avatar,
            },
            tasks: [],
            workload: 0,
          });
        }

        const resource = resourceMap.get(assigneeId)!;

        // Add task to this assignee's list
        const taskItem = {
          id: String(task.id),
          title: task.title,
          start: task.startDate ?? null,
          end: task.dueDate ?? null,
          storyPoints: task.storyPoints || 1,
        };
        resource.tasks.push(taskItem);

        // Calculate workload (story points divided by number of assignees for fair distribution)
        const storyPointsPerAssignee = (task.storyPoints || 1) / task.assignees.length;
        resource.workload += storyPointsPerAssignee;
      });
    });

    return Array.from(resourceMap.values());
  }

  private calculateTaskProgress(statusName: string): number {
    // Map status names to progress percentages
    const statusProgressMap: { [key: string]: number } = {
      'To Do': 0,
      TODO: 0,
      Backlog: 0,
      'In Progress': 50,
      IN_PROGRESS: 50,
      Review: 80,
      REVIEW: 80,
      Testing: 90,
      TESTING: 90,
      Done: 100,
      DONE: 100,
      Completed: 100,
      COMPLETED: 100,
    };

    return statusProgressMap[statusName] || 0;
  }

  private calculateTimeline(
    tasks: GanttTask[],
    project: any,
  ): { start: Date; end: Date; duration: number } {
    const taskDates = tasks
      .filter((task) => task.start && task.end)
      .flatMap((task) => [task.start!, task.end!]);

    const projectStart = project.startDate;
    const projectEnd = project.endDate;

    const allDates = [
      ...taskDates,
      ...(projectStart ? [projectStart] : []),
      ...(projectEnd ? [projectEnd] : []),
    ];

    if (allDates.length === 0) {
      const now = new Date();
      return {
        start: now,
        end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        duration: 30,
      };
    }

    const start = new Date(Math.min(...allDates.map((d: Date) => d.getTime())));
    const end = new Date(Math.max(...allDates.map((d: Date) => d.getTime())));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    return { start, end, duration };
  }

  private calculateCriticalPath(tasks: GanttTask[], dependencies: any[]): string[] {
    // Simplified critical path calculation
    // In a real implementation, you'd use CPM (Critical Path Method) algorithm

    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    // const _criticalTasks: string[] = [];

    // Find tasks with no dependencies that have the longest duration
    const rootTasks = tasks.filter((task) => task.dependencies.length === 0);

    // For now, return the longest sequence of dependent tasks
    let longestPath: string[] = [];

    rootTasks.forEach((rootTask) => {
      const path = this.findLongestPath(
        rootTask,
        taskMap,
        dependencies as Array<{ blockingTaskId: string; dependentTaskId: string }>,
      );
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    });

    return longestPath;
  }

  private findLongestPath(
    task: GanttTask,
    taskMap: Map<string, GanttTask>,
    dependencies: Array<{ blockingTaskId: string; dependentTaskId: string }>,
  ): string[] {
    const path = [task.id];

    // Find tasks that depend on this task
    const dependentTasks = dependencies
      .filter((dep) => dep.blockingTaskId === task.id)
      .map((dep) => taskMap.get(dep.dependentTaskId))
      .filter((task): task is GanttTask => task !== undefined);

    if (dependentTasks.length === 0) {
      return path;
    }

    // Recursively find the longest path from dependent tasks
    let longestSubPath: string[] = [];
    dependentTasks.forEach((depTask) => {
      const subPath = this.findLongestPath(depTask, taskMap, dependencies);
      if (subPath.length > longestSubPath.length) {
        longestSubPath = subPath;
      }
    });

    return [...path, ...longestSubPath];
  }

  private generateMilestones(sprints: any[]): any[] {
    const milestones: any[] = [];

    sprints.forEach((sprint) => {
      if (sprint.startDate) {
        milestones.push({
          id: sprint.id,
          title: `${sprint.name} Start`,
          date: sprint.startDate,
          type: 'sprint_start',
        });
      }

      if (sprint.endDate) {
        milestones.push({
          id: `${sprint.id}_end`,
          title: `${sprint.name} End`,
          date: sprint.endDate,
          type: 'sprint_end',
        });
      }
    });

    return milestones.sort(
      (a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime(),
    );
  }
}
