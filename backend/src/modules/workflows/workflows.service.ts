import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Workflow, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { DEFAULT_TASK_STATUSES } from 'src/constants/defaultWorkflow';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  // A workflow (and its statuses/transitions) belongs to an organization.
  // Every workflow operation must be restricted to a SUPER_ADMIN or a member
  // (or the owner) of that organization. The controller only authenticates via
  // JwtAuthGuard, so without these checks any authenticated user could read,
  // create, modify, or delete any organization's workflows across tenants.
  private async assertOrgMember(organizationId: string, userId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (actor?.role === Role.SUPER_ADMIN) return;

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.ownerId === userId) return;

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }

  private async assertOrgMemberForWorkflow(workflowId: string, userId: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { organizationId: true },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    await this.assertOrgMember(workflow.organizationId, userId);
  }

  // The organization ids the user may see workflows for (owned or joined).
  private async accessibleOrganizationIds(userId: string): Promise<string[]> {
    const [owned, memberships] = await Promise.all([
      this.prisma.organization.findMany({ where: { ownerId: userId }, select: { id: true } }),
      this.prisma.organizationMember.findMany({
        where: { userId },
        select: { organizationId: true },
      }),
    ]);
    return Array.from(
      new Set([...owned.map((o) => o.id), ...memberships.map((m) => m.organizationId)]),
    );
  }

  async create(createWorkflowDto: CreateWorkflowDto, userId: string): Promise<Workflow> {
    await this.assertOrgMember(createWorkflowDto.organizationId, userId);
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

  async findAll(userId: string, organizationId?: string): Promise<Workflow[]> {
    let whereClause: any;
    if (organizationId) {
      await this.assertOrgMember(organizationId, userId);
      whereClause = { organizationId };
    } else {
      // No organization filter: restrict to the organizations the caller can
      // see, rather than returning every organization's workflows.
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      whereClause =
        actor?.role === Role.SUPER_ADMIN
          ? {}
          : { organizationId: { in: await this.accessibleOrganizationIds(userId) } };
    }

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
        statuses: {
          where: { deletedAt: null },
        },
        _count: {
          select: {
            statuses: {
              where: { deletedAt: null },
            },
            transitions: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAllByOrganizationSlug(slug: string, userId: string): Promise<Workflow[]> {
    if (!slug) {
      throw new BadRequestException('Organization slug must be provided');
    }

    // First, find the organization by slug
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with slug "${slug}" not found`);
    }

    await this.assertOrgMember(organization.id, userId);

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
        statuses: {
          where: { deletedAt: null },
        },
        transitions: true, // include transitions if applicable
        _count: {
          select: {
            statuses: {
              where: { deletedAt: null },
            },
            transitions: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, userId: string): Promise<Workflow> {
    await this.assertOrgMemberForWorkflow(id, userId);
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
          where: { deletedAt: null },
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
            statuses: {
              where: { deletedAt: null },
            },
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

  async update(
    id: string,
    updateWorkflowDto: UpdateWorkflowDto,
    userId: string,
  ): Promise<Workflow> {
    await this.assertOrgMemberForWorkflow(id, userId);
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

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOrgMemberForWorkflow(id, userId);
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

  async getDefaultWorkflow(organizationId: string, userId: string) {
    await this.assertOrgMember(organizationId, userId);
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
          where: { deletedAt: null },
        },
      },
    });
  }
  async makeWorkflowDefault(
    workflowId: string,
    organizationId: string,
    userId: string,
  ): Promise<Workflow> {
    // userId is the authenticated principal (from the JWT), never a body field.
    await this.assertOrgMember(organizationId, userId);
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
