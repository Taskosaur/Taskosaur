import { Injectable } from '@nestjs/common';
import { Project, Task, Sprint } from '@prisma/client';
import { PublicProjectDto, PublicProjectStatsDto } from '../dto/public-project.dto';
import { PublicTaskDto } from '../dto/public-task.dto';
import { PublicSprintDto } from '../dto/public-sprint.dto';

@Injectable()
export class PublicDataFilterService {
  filterProjectData(project: any, includeStats = false): PublicProjectDto {
    const filtered: PublicProjectDto = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      color: project.color,
      avatar: project.avatar,
      status: project.status,
      priority: project.priority,
      visibility: project.visibility,
      startDate: project.startDate,
      endDate: project.endDate,
      createdAt: project.createdAt,
      workspace: project.workspace,
      organization: project.workspace?.organization,
      isPublicView: true
    };

    // Only include stats if explicitly requested and project allows it
    if (includeStats && project.settings?.allowPublicStats !== false) {
      filtered.stats = {
        // Cap sensitive numbers to prevent business intelligence gathering
        taskCount: project._count?.tasks ? Math.min(project._count.tasks, 100) : 0,
        completionRate: project.completionRate || 0,
        hasActiveSprints: (project._count?.sprints || 0) > 0
      };
    }

    return filtered;
  }

  filterTaskData(task: any): PublicTaskDto {
    const filtered: PublicTaskDto = {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      status: {
        id: task.status?.id,
        name: task.status?.name,
        color: task.status?.color,
        category: task.status?.category
      },
      isPublicView: true
    };

    // Add labels if present
    if (task.labels) {
      filtered.labels = task.labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color
      }));
    }

    // Only show public subtasks
    if (task.subtasks) {
      filtered.subtasks = task.subtasks
        .filter(subtask => subtask.project?.visibility === 'PUBLIC')
        .map(subtask => this.filterTaskData(subtask));
    }

    return filtered;
  }

  filterSprintData(sprint: any): PublicSprintDto {
    const totalTasks = sprint.tasks?.length || 0;
    const completedTasks = sprint.tasks?.filter(task =>
      task.status?.category === 'DONE'
    ).length || 0;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const filtered: PublicSprintDto = {
      id: sprint.id,
      name: sprint.name,
      description: sprint.description,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      createdAt: sprint.createdAt,
      progress,
      isPublicView: true
    };

    // Add filtered tasks if present
    if (sprint.tasks) {
      filtered.tasks = sprint.tasks.map(task => this.filterTaskData(task));
    }

    return filtered;
  }

  // Helper method to check if project is public
  isProjectPublic(project: any): boolean {
    return project?.visibility === 'PUBLIC';
  }

  // Helper method to sanitize sensitive counts
  sanitizeCount(count: number, maxShow: number = 100): number {
    return Math.min(count, maxShow);
  }
}