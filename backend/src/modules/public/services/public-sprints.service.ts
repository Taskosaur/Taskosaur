import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicDataFilterService } from './public-data-filter.service';
import { PublicSprintDto } from '../dto/public-sprint.dto';

@Injectable()
export class PublicSprintsService {
  constructor(
    private prisma: PrismaService,
    private dataFilter: PublicDataFilterService,
  ) {}

  async getPublicSprints(
    workspaceSlug: string,
    projectSlug: string,
  ): Promise<PublicSprintDto[]> {
    const project = await this.validatePublicProject(
      workspaceSlug,
      projectSlug,
    );

    const sprints = await this.prisma.sprint.findMany({
      where: {
        projectId: project.id,
      },
      include: {
        tasks: {
          include: {
            status: {
              select: { id: true, name: true, color: true, category: true },
            },
            labels: {
              include: {
                label: {
                  select: { id: true, name: true, color: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sprints.map((sprint) => this.dataFilter.filterSprintData(sprint));
  }

  async getPublicSprint(
    workspaceSlug: string,
    projectSlug: string,
    sprintId: string,
  ): Promise<PublicSprintDto> {
    await this.validatePublicProject(workspaceSlug, projectSlug);

    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        project: {
          slug: projectSlug,
          workspace: { slug: workspaceSlug },
          visibility: 'PUBLIC',
        },
      },
      include: {
        tasks: {
          include: {
            status: {
              select: { id: true, name: true, color: true, category: true },
            },
            labels: {
              include: {
                label: {
                  select: { id: true, name: true, color: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Public sprint not found');
    }

    return this.dataFilter.filterSprintData(sprint);
  }

  async getPublicSprintTasks(
    workspaceSlug: string,
    projectSlug: string,
    sprintId: string,
  ): Promise<any[]> {
    await this.validatePublicProject(workspaceSlug, projectSlug);

    const tasks = await this.prisma.task.findMany({
      where: {
        sprintId: sprintId,
        project: {
          slug: projectSlug,
          workspace: { slug: workspaceSlug },
          visibility: 'PUBLIC',
        },
      },
      include: {
        status: {
          select: { id: true, name: true, color: true, category: true },
        },
        labels: {
          include: {
            label: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(task => this.dataFilter.filterTaskData({
      ...task,
      labels: task.labels.map(tl => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color }))
    }));
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
