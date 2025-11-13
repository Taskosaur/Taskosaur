import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Sprint, SprintStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(private prisma: PrismaService) {}

  async create(createSprintDto: CreateSprintDto, userId: string): Promise<Sprint> {
    // Check if project exists
    const project = await this.prisma.project.findUnique({
      where: { slug: createSprintDto.projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if there's already an active sprint in this project
    if (createSprintDto.status === SprintStatus.ACTIVE) {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: {
          projectId: createSprintDto.projectId,
          status: SprintStatus.ACTIVE,
        },
      });

      if (activeSprint) {
        throw new ConflictException('There is already an active sprint in this project');
      }
    }

    return this.prisma.sprint.create({
      data: {
        ...createSprintDto,
        projectId: project.id,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
  }

  findAll(projectId?: string, status?: SprintStatus): Promise<Sprint[]> {
    const whereClause: any = {
      archive: false,
    };

    if (projectId) whereClause.projectId = projectId;
    if (status) whereClause.status = status;

    return this.prisma.sprint.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
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
      orderBy: [
        { status: 'asc' }, // Active first, then planning, then completed
        { createdAt: 'desc' },
      ],
    });
  }
  findAllByProjectSlug(slug?: string, status?: SprintStatus): Promise<Sprint[]> {
    const whereClause: any = {
      archive: false,
    };

    if (slug) {
      whereClause.project = {
        slug: slug,
      };
    }

    if (status) {
      whereClause.status = status;
    }

    return this.prisma.sprint.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
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
      orderBy: [
        { status: 'asc' }, // Custom sort logic: planning < active < completed
        { createdAt: 'desc' }, // Recent sprints first
      ],
    });
  }

  async findOne(id: string): Promise<Sprint> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        tasks: {
          include: {
            assignees: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            reporters: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
            _count: {
              select: {
                childTasks: true,
                comments: true,
              },
            },
          },
          orderBy: {
            priority: 'desc',
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    return sprint;
  }

  getActiveSprint(projectId: string) {
    return this.prisma.sprint.findFirst({
      where: {
        projectId,
        status: SprintStatus.ACTIVE,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tasks: {
          include: {
            assignees: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
          },
          orderBy: {
            priority: 'desc',
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });
  }

  async update(id: string, updateSprintDto: UpdateSprintDto, userId: string): Promise<Sprint> {
    // If updating to active status, check for conflicts
    if (updateSprintDto.status === SprintStatus.ACTIVE) {
      const currentSprint = await this.prisma.sprint.findUnique({
        where: { id },
        select: { projectId: true, status: true },
      });

      if (!currentSprint) {
        throw new NotFoundException('Sprint not found');
      }

      // Only check for active sprint conflict if the current sprint is not already active
      if (currentSprint.status !== SprintStatus.ACTIVE) {
        const activeSprint = await this.prisma.sprint.findFirst({
          where: {
            projectId: currentSprint.projectId,
            status: SprintStatus.ACTIVE,
            id: { not: id },
          },
        });

        if (activeSprint) {
          throw new ConflictException('There is already an active sprint in this project');
        }
      }
    }

    try {
      const sprint = await this.prisma.sprint.update({
        where: { id },
        data: {
          ...updateSprintDto,
          updatedBy: userId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          createdByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      });

      return sprint;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Sprint not found');
      }
      throw error;
    }
  }

  async startSprint(id: string): Promise<Sprint> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        projectId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.status !== SprintStatus.PLANNING) {
      throw new BadRequestException('Only planning sprints can be started');
    }

    if (!sprint.startDate || !sprint.endDate) {
      throw new BadRequestException('Sprint must have start and end dates to be started');
    }

    // Check for existing active sprint
    const activeSprint = await this.prisma.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        status: SprintStatus.ACTIVE,
      },
    });

    if (activeSprint) {
      throw new ConflictException('There is already an active sprint in this project');
    }

    return this.update(id, { status: SprintStatus.ACTIVE }, 'system');
  }

  async completeSprint(id: string): Promise<Sprint> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.status !== SprintStatus.ACTIVE) {
      throw new BadRequestException('Only active sprints can be completed');
    }

    return this.update(id, { status: SprintStatus.COMPLETED }, 'system');
  }

  async remove(id: string): Promise<void> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.status === SprintStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete an active sprint');
    }

    try {
      await this.prisma.sprint.delete({
        where: { id },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Sprint not found');
      }
      throw error;
    }
  }
  async archiveSprint(id: string): Promise<void> {
    try {
      await this.prisma.sprint.update({
        where: { id },
        data: { archive: true },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Sprint not found');
      }
      throw error;
    }
  }
}
