import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Workflow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { DEFAULT_TASK_STATUSES } from 'src/constants/defaultWorkflow';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  create(createWorkflowDto: CreateWorkflowDto, userId: string): Promise<Workflow> {
    return this.prisma.$transaction(async (tx) => {
      if (createWorkflowDto.isDefault) {
        await tx.workflow.updateMany({
          where: {
            organizationId: createWorkflowDto.organizationId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const workflow = await tx.workflow.create({
        data: {
          ...createWorkflowDto,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
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
              statuses: true,
              transitions: true,
            },
          },
        },
      });

      await tx.taskStatus.createMany({
        data: DEFAULT_TASK_STATUSES.map((status) => ({
          ...status,
          workflowId: workflow.id,
          createdBy: userId,
          updatedBy: userId,
        })),
      });

      return workflow;
    });
  }

  findAll(organizationId?: string): Promise<Workflow[]> {
    const whereClause = organizationId ? { organizationId } : {};

    return this.prisma.workflow.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        statuses: true, // include all workflow statuses
        _count: {
          select: {
            statuses: true,
            transitions: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAllByOrganizationSlug(slug: string): Promise<Workflow[]> {
    if (!slug) {
      throw new Error('Organization slug must be provided');
    }

    // First, find the organization by slug
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!organization) {
      throw new Error(`Organization with slug "${slug}" not found`);
    }

    return this.prisma.workflow.findMany({
      where: { organizationId: organization.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        statuses: true, // include all workflow statuses
        transitions: true, // include transitions if applicable
        _count: {
          select: {
            statuses: true,
            transitions: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        statuses: {
          orderBy: {
            position: 'asc',
          },
        },
        transitions: {
          include: {
            fromStatus: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
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
        _count: {
          select: {
            statuses: true,
            transitions: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  update(id: string, updateWorkflowDto: UpdateWorkflowDto, userId: string): Promise<Workflow> {
    return this.prisma.$transaction(async (tx) => {
      // If this is set as default, unset other defaults in the same organization
      if (updateWorkflowDto.isDefault) {
        const currentWorkflow = await tx.workflow.findUnique({
          where: { id },
          select: { organizationId: true },
        });

        if (currentWorkflow) {
          await tx.workflow.updateMany({
            where: {
              organizationId: currentWorkflow.organizationId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }
      }

      try {
        const workflow = await tx.workflow.update({
          where: { id },
          data: {
            ...updateWorkflowDto,
            updatedBy: userId,
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
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
                statuses: true,
                transitions: true,
              },
            },
          },
        });

        return workflow;
      } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
          throw new NotFoundException('Workflow not found');
        }
        throw error;
      }
    });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.workflow.delete({
        where: { id },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workflow not found');
      }
      throw error;
    }
  }

  getDefaultWorkflow(organizationId: string) {
    return this.prisma.workflow.findFirst({
      where: {
        organizationId,
        isDefault: true,
      },
      include: {
        statuses: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  }
  async makeWorkflowDefault(
    workflowId: string,
    organizationId: string,
    userId: string,
  ): Promise<Workflow> {
    try {
      const updatedWorkflow = await this.prisma.$transaction(async (prisma) => {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { organization: true },
        });

        if (!workflow) {
          throw new NotFoundException('Workflow not found');
        }

        if (workflow.organizationId !== organizationId) {
          throw new BadRequestException('Workflow does not belong to this organization');
        }

        // unset any existing default
        await prisma.workflow.updateMany({
          where: {
            organizationId: organizationId,
            isDefault: true,
          },
          data: {
            isDefault: false,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        });

        // set new default and return it
        return prisma.workflow.update({
          where: { id: workflowId },
          data: {
            isDefault: true,
            updatedBy: userId,
            updatedAt: new Date(),
          },
          include: { organization: true },
        });
      });

      return updatedWorkflow;
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workflow not found');
      }
      throw error;
    }
  }
}
