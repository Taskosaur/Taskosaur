import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { TaskStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskStatusDto, CreateTaskStatusFromProjectDto } from './dto/create-task-status.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TaskStatusesService {
  private readonly logger = new Logger(TaskStatusesService.name);

  // A task status belongs to a workflow, which belongs to an organization.
  // Mutating a status must be restricted to a SUPER_ADMIN or a member of that
  // organization. The @Roles decorators on the controller are inert because
  // RolesGuard is not applied there, so the tenant boundary is enforced here;
  // otherwise any authenticated user could edit, reorder, or delete any other
  // organization's task statuses by UUID.
  private async assertOrgMemberForWorkflow(workflowId: string, userId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (actor?.role === Role.SUPER_ADMIN) return;

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { organizationId: true, organization: { select: { ownerId: true } } },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    // The organization owner is always authorized, even without an explicit
    // membership row.
    if (workflow.organization?.ownerId === userId) return;

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: workflow.organizationId },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  private async assertOrgMemberForStatus(statusId: string, userId: string): Promise<void> {
    const status = await this.prisma.taskStatus.findUnique({
      where: { id: statusId },
      select: { workflowId: true },
    });
    if (!status) {
      throw new NotFoundException('Task status not found');
    }
    await this.assertOrgMemberForWorkflow(status.workflowId, userId);
  }

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
    await this.assertOrgMemberForWorkflow(createTaskStatusDto.workflowId, userId);
    try {
      const existingStatus = await this.prisma.taskStatus.findFirst({
        where: {
          workflowId: createTaskStatusDto.workflowId,
          name: createTaskStatusDto.name,
          deletedAt: {
            not: null,
          },
        },
      });
      if (existingStatus) {
        existingStatus.deletedAt = null;
        existingStatus.deletedBy = null;
        return await this.prisma.taskStatus.update({
          where: {
            id: existingStatus.id,
          },
          data: {
            ...existingStatus,
            updatedBy: userId,
          },
        });
      }
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
      this.logger.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Status with this name already exists in this workflow');
      }
      throw error;
    }
  }

  findAll(workflowId?: string, organizationId?: string): Promise<TaskStatus[]> {
    const whereClause: any = { deletedAt: null };

    if (workflowId) {
      whereClause.workflowId = workflowId;
    } else if (organizationId) {
      whereClause.workflow = {
        organizationId: organizationId,
      };
    }

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
      orderBy: [
        {
          workflowId: 'asc',
        },
        {
          position: 'asc',
        },
      ],
    });
  }

  async findOne(id: string): Promise<TaskStatus> {
    const taskStatus = await this.prisma.taskStatus.findUnique({
      where: { id, deletedAt: null },
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
    await this.assertOrgMemberForStatus(id, userId);
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
      this.logger.error(error);
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
    for (const { id } of statusUpdates) {
      await this.assertOrgMemberForStatus(id, userId);
    }
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
      this.logger.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('One or more task statuses not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOrgMemberForStatus(id, userId);
    try {
      // Check if status exists and is not already deleted
      const existingStatus = await this.prisma.taskStatus.findUnique({
        where: { id },
      });

      if (!existingStatus) {
        throw new NotFoundException('Task status not found');
      }

      if (existingStatus.deletedAt) {
        throw new ConflictException('This status has already been deleted');
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete related status transitions
        await tx.statusTransition.deleteMany({
          where: {
            OR: [{ fromStatusId: id }, { toStatusId: id }],
          },
        });

        await tx.taskStatus.updateMany({
          where: {
            workflowId: existingStatus.workflowId,
            position: { gt: existingStatus.position },
          },
          data: {
            position: {
              decrement: 1,
            },
            updatedBy: userId,
          },
        });

        // Perform soft delete on the status
        await tx.taskStatus.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            deletedBy: userId,
          },
        });
      });
    } catch (error) {
      this.logger.error(error);
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
      where: { workflowId: project.workflowId, deletedAt: null },
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

  async findDeleted(workflowId?: string): Promise<TaskStatus[]> {
    const whereClause = workflowId
      ? { workflowId, deletedAt: { not: null } }
      : { deletedAt: { not: null } };

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
        deletedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  async restore(id: string, userId: string): Promise<TaskStatus> {
    await this.assertOrgMemberForStatus(id, userId);
    try {
      const existingStatus = await this.prisma.taskStatus.findUnique({
        where: { id },
      });

      if (!existingStatus) {
        throw new NotFoundException('Task status not found');
      }

      if (!existingStatus.deletedAt) {
        throw new ConflictException('This status is not deleted and cannot be restored');
      }

      // Check if status name conflicts with existing active status
      const conflictingStatus = await this.prisma.taskStatus.findFirst({
        where: {
          workflowId: existingStatus.workflowId,
          name: existingStatus.name,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (conflictingStatus) {
        throw new ConflictException('A status with this name already exists in the workflow');
      }

      const restoredStatus = await this.prisma.taskStatus.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
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

      return restoredStatus;
    } catch (error) {
      this.logger.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Task status not found');
      }
      throw error;
    }
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
    await this.assertOrgMemberForWorkflow(workflowId, userId);

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
      this.logger.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Status with this name already exists in this workflow');
      }
      throw error;
    }
  }
}
