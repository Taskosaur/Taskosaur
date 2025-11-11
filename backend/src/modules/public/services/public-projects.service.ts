import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicDataFilterService } from './public-data-filter.service';
import { PublicProjectDto } from '../dto/public-project.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class PublicProjectsService {
  constructor(
    private prisma: PrismaService,
    private dataFilter: PublicDataFilterService,
  ) {}

  async getPublicProject(
    workspaceSlug: string,
    projectSlug: string,
  ): Promise<PublicProjectDto> {
    console.log('Fetching public project:', workspaceSlug, projectSlug);
    const project = await this.prisma.project.findFirst({
      where: {
        slug: projectSlug,
        workspace: { slug: workspaceSlug },
        visibility: 'PUBLIC',
      },
      include: {
        workspace: { include: { organization: true } },
        _count: {
          select: {
            tasks: true,
            sprints: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Public project not found');
    }

    return this.dataFilter.filterProjectData(project, true);
  }

  async getWorkspacePublicProjects(
    workspaceSlug: string,
  ): Promise<PublicProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        workspace: { slug: workspaceSlug },
        visibility: 'PUBLIC',
      },
      include: {
        workspace: { select: { slug: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) =>
      this.dataFilter.filterProjectData(project),
    );
  }
  async publicProjectStatus(projectSlug: string): Promise<TaskStatus[]> {
    const project = await this.prisma.project.findFirst({
      where: {
        slug: projectSlug,
        visibility: 'PUBLIC',
      },
      include: {
        workspace: { include: { organization: true } },
        _count: {
          select: {
            tasks: true,
            sprints: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Public project not found');
    }
    const whereClause = { workflowId: project.workflowId };

    return this.prisma.taskStatus.findMany({
      where: whereClause,
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });
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
