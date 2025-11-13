import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskStatusDto, CreateTaskStatusFromProjectDto } from './dto/create-task-status.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TaskStatusesService {
  findDefaultWorkflowByOrganizationId(organizationId: string) {
    return this.prisma.workflow.findFirst({
      where: {
        organizationId: organizationId,
        isDefault: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
      },
    });
  }
  constructor(private prisma: PrismaService) {}

  async create(createTaskStatusDto: CreateTaskStatusDto, userId: string): Promise<TaskStatus> {
    try {
      const taskCount = await this.prisma.taskStatus.count({
        where: {
          workflowId: createTaskStatusDto.workflowId,
        },
      });
      return await this.prisma.taskStatus.create({
        data: {
          ...createTaskStatusDto,
          position: taskCount + 1,
          createdBy: userId,
          updatedBy: userId,
        },
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
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Status with this name already exists in this workflow');
      }
      throw error;
    }
  }

  findAll(workflowId?: string): Promise<TaskStatus[]> {
    const whereClause = workflowId ? { workflowId } : {};

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

  async findOne(id: string): Promise<TaskStatus> {
    const taskStatus = await this.prisma.taskStatus.findUnique({
      where: { id },
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
        fromTransitions: {
          include: {
            toStatus: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
          },
        },
        toTransitions: {
          include: {
            fromStatus: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
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
    });

    if (!taskStatus) {
      throw new NotFoundException('Task status not found');
    }

    return taskStatus;
  }

  async update(
    id: string,
    updateTaskStatusDto: UpdateTaskStatusDto,
    userId: string,
  ): Promise<TaskStatus> {
    try {
      const taskStatus = await this.prisma.taskStatus.update({
        where: { id },
        data: {
          ...updateTaskStatusDto,
          updatedBy: userId,
        },
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

      return taskStatus;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Status with this name already exists in this workflow');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Task status not found');
      }
      throw error;
    }
  }
  async updatePositions(
    statusUpdates: { id: string; position: number }[],
    userId: string,
  ): Promise<TaskStatus[]> {
    try {
      // Use a transaction to ensure all updates happen atomically
      const updatedStatuses = await this.prisma.$transaction(
        statusUpdates.map(({ id, position }) =>
          this.prisma.taskStatus.update({
            where: { id },
            data: {
              position,
              updatedBy: userId,
            },
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
          }),
        ),
      );

      return updatedStatuses;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('One or more task statuses not found');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const taskCount = await this.prisma.task.count({
        where: {
          statusId: id,
        },
      });

      if (taskCount > 0) {
        throw new ConflictException(
          'This status cannot be deleted because it is associated with existing tasks.',
        );
      }
      await this.prisma.taskStatus.delete({
        where: { id },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Task status not found');
      }
      throw error;
    }
  }

  async findTaskStatusByProjectSlug(projectId: string): Promise<TaskStatus[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return [];
    }
    return this.prisma.taskStatus.findMany({
      where: { workflowId: project.workflowId },
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
  async createFromProject(
    createTaskStatusDto: CreateTaskStatusFromProjectDto,
    userId: string,
  ): Promise<TaskStatus> {
    const { name, projectId } = createTaskStatusDto;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workflow: true },
    });

    if (!project || !project.workflow) {
      throw new NotFoundException('Project or associated workflow not found');
    }

    const workflowId = project.workflow.id;

    try {
      const existingStatusCount = await this.prisma.taskStatus.count({
        where: { workflowId },
      });

      return await this.prisma.taskStatus.create({
        data: {
          name,
          workflowId,
          color: '#000000', // Default color
          category: 'TODO', // Default category
          position: existingStatusCount,
          isDefault: existingStatusCount === 0,
          createdBy: userId,
          updatedBy: userId,
        },
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
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Status with this name already exists in this workflow');
      }
      throw error;
    }
  }
}
