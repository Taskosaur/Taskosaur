import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicDataFilterService } from './public-data-filter.service';

@Injectable()
export class PublicCalendarService {
  constructor(
    private prisma: PrismaService,
    private dataFilter: PublicDataFilterService,
  ) {}

  async getPublicCalendarEvents(
    workspaceSlug: string,
    projectSlug: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const project = await this.validatePublicProject(
      workspaceSlug,
      projectSlug,
    );

    const whereClause: any = {
      projectId: project.id,
      OR: [
        { dueDate: { not: null } },
        { sprint: { startDate: { not: null } } },
        { sprint: { endDate: { not: null } } },
      ],
    };

    // Add date filters if provided
    if (startDate && endDate) {
      whereClause.OR = [
        {
          dueDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        {
          sprint: {
            OR: [
              {
                startDate: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              },
              {
                endDate: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              },
            ],
          },
        },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        sprint: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Transform tasks into calendar events
    const events: any[] = [];

    tasks.forEach((task) => {
      // Add task due date event
      if (task.dueDate) {
        events.push({
          id: `task-${task.id}`,
          title: task.title,
          date: task.dueDate,
          type: 'task-due',
          status: task.status,
          taskId: task.id,
        });
      }

      // Add sprint events
      if (task.sprint) {
        if (task.sprint.startDate) {
          events.push({
            id: `sprint-start-${task.sprint.id}`,
            title: `${task.sprint.name} starts`,
            date: task.sprint.startDate,
            type: 'sprint-start',
            sprintId: task.sprint.id,
          });
        }

        if (task.sprint.endDate) {
          events.push({
            id: `sprint-end-${task.sprint.id}`,
            title: `${task.sprint.name} ends`,
            date: task.sprint.endDate,
            type: 'sprint-end',
            sprintId: task.sprint.id,
          });
        }
      }
    });

    // Remove duplicates and sort by date
    const uniqueEvents = events.filter(
      (event, index, self) =>
        index === self.findIndex((e: any) => e.id === event.id),
    );

    return uniqueEvents.sort(
      (a: any, b: any) =>
        new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
    );
  }

  private async validatePublicProject(
    workspaceSlug: string,
    projectSlug: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        slug: projectSlug,
        workspace: { slug: workspaceSlug },
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Public project not found');
    }

    return project;
  }
}
