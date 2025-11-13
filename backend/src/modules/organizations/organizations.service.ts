import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  DEFAULT_WORKFLOW,
  DEFAULT_TASK_STATUSES,
  DEFAULT_STATUS_TRANSITIONS,
  DEFAULT_PROJECT,
  DEFAULT_SPRINT,
  DEFAULT_TASKS,
} from '../../constants/defaultWorkflow';
import slugify from 'slugify';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, {
      lower: true,
      strict: true, // remove special chars
    });

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const exists = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!exists) break; // ✅ slug is available
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(
    createOrganizationDto: CreateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    try {
      const slug = await this.generateUniqueSlug(createOrganizationDto.name);

      const organization = await this.prisma.organization.create({
        data: {
          name: createOrganizationDto.name,
          description: createOrganizationDto.description,
          avatar: createOrganizationDto.avatar,
          website: createOrganizationDto.website,
          settings: createOrganizationDto.settings,
          ownerId: createOrganizationDto.ownerId,
          slug,
          createdBy: userId,
          updatedBy: userId,
          workflows: {
            create: {
              name: DEFAULT_WORKFLOW.name,
              description: DEFAULT_WORKFLOW.description,
              isDefault: true,
              createdBy: userId,
              updatedBy: userId,
              statuses: {
                create: DEFAULT_TASK_STATUSES.map((status) => ({
                  name: status.name,
                  color: status.color,
                  category: status.category,
                  position: status.position,
                  isDefault: status.isDefault,
                  createdBy: userId,
                  updatedBy: userId,
                })),
              },
            },
          },
        },
        include: {
          workflows: {
            where: { isDefault: true },
            include: { statuses: true },
          },
        },
      });

      // Add org member as OWNER
      await this.prisma.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          role: 'OWNER',
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Create default status transitions
      const defaultWorkflow = organization.workflows[0];
      if (defaultWorkflow) {
        await this.createDefaultStatusTransitions(
          defaultWorkflow.id,
          defaultWorkflow.statuses,
          userId,
        );
      }

      // Conditionally create workspace if provided
      let workspace;
      if (createOrganizationDto.defaultWorkspace) {
        const workspaceSlug = await this.generateUniqueWorkspaceSlug(
          createOrganizationDto.defaultWorkspace.name,
          organization.id,
        );

        workspace = await this.prisma.workspace.create({
          data: {
            name: createOrganizationDto.defaultWorkspace.name,
            description: 'Default workspace',
            slug: workspaceSlug,
            organizationId: organization.id,
            createdBy: userId,
            updatedBy: userId,
            members: {
              create: {
                userId,
                role: 'OWNER',
                createdBy: userId,
                updatedBy: userId,
              },
            },
          },
        });
      }
      // Conditionally create project if provided
      let project:
        | {
            id: string;
            slug: string;
            sprints: Array<{ isDefault: boolean; id: string }>;
            workflow: { statuses: Array<{ id: string; name: string }> } | null;
          }
        | undefined;
      if (createOrganizationDto.defaultProject && workspace) {
        const projectSlug = await this.generateUniqueProjectSlug(
          createOrganizationDto.defaultProject.name,
          workspace.id as string,
        );

        project = await this.prisma.project.create({
          data: {
            name: createOrganizationDto.defaultProject.name,
            description: 'Default project',
            slug: projectSlug,
            workspaceId: workspace.id,
            workflowId: defaultWorkflow.id,
            createdBy: userId,
            updatedBy: userId,
            color: DEFAULT_PROJECT.color,
            sprints: {
              create: {
                name: DEFAULT_SPRINT.name,
                goal: DEFAULT_SPRINT.goal,
                status: DEFAULT_SPRINT.status,
                isDefault: DEFAULT_SPRINT.isDefault,
                createdBy: userId,
                updatedBy: userId,
              },
            },
            members: {
              create: {
                userId,
                role: 'MANAGER',
                createdBy: userId,
                updatedBy: userId,
              },
            },
          },
          select: {
            id: true,
            slug: true,
            sprints: {
              select: {
                id: true,
                isDefault: true,
              },
            },
            workflow: {
              select: {
                statuses: {
                  select: {
                    id: true,
                    name: true,
                  },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        });
      }
      // Create default tasks if project was created
      if (project) {
        const defaultSprint = project.sprints.find((s: { isDefault: boolean }) => s.isDefault);
        if (!project.workflow || project.workflow.statuses.length === 0) {
          throw new NotFoundException('Default workflow or statuses not found for the project');
        }
        const workflowStatuses = project.workflow.statuses;
        await this.prisma.task.createMany({
          data: DEFAULT_TASKS.map((task, index) => {
            const status =
              workflowStatuses.find((s: { name: string }) => s.name === task.status) ??
              workflowStatuses[0];
            return {
              title: task.title,
              description: task.description,
              priority: task.priority,
              statusId: status.id,
              projectId: project.id,
              sprintId: defaultSprint?.id || null,
              taskNumber: index + 1,
              slug: `${project.slug}-${index + 1}`,
              createdBy: userId,
              updatedBy: userId,
            };
          }),
        });
      }

      return organization;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Organization with this slug already exists');
      }
      throw error;
    }
  }

  // Helper method to generate unique workspace slug
  private async generateUniqueWorkspaceSlug(name: string, organizationId: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.workspace.findFirst({
        where: { slug, organizationId },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // Helper method to generate unique project slug
  private async generateUniqueProjectSlug(name: string, workspaceId: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.project.findFirst({
        where: { slug, workspaceId },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async createDefaultStatusTransitions(
    workflowId: string,
    statuses: any[],
    userId: string,
  ) {
    // Create a map of status names to IDs
    const statusMap = new Map(statuses.map((status) => [status.name, status.id]));

    const transitionsToCreate = DEFAULT_STATUS_TRANSITIONS.filter(
      (transition) => statusMap.has(transition.from) && statusMap.has(transition.to),
    ).map((transition) => ({
      name: `${transition.from} → ${transition.to}`,
      workflowId,
      fromStatusId: statusMap.get(transition.from),
      toStatusId: statusMap.get(transition.to),
      createdBy: userId,
      updatedBy: userId,
    }));

    if (transitionsToCreate.length > 0) {
      await this.prisma.statusTransition.createMany({
        data: transitionsToCreate,
      });
    }
  }
  // ... rest of your methods remain the same
  findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: { archive: false },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            _count: {
              select: {
                projects: true,
                members: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async findBySlug(slug: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            _count: {
              select: {
                projects: true,
                members: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    try {
      const organization = await this.prisma.organization.update({
        where: { id },
        data: {
          ...updateOrganizationDto,
          updatedBy: userId,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
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
              members: true,
              workspaces: true,
            },
          },
        },
      });

      return organization;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Organization with this slug already exists');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Organization not found');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Organization> {
    try {
      return await this.prisma.organization.delete({
        where: { id },
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Organization not found');
      }
      throw error;
    }
  }

  async getOrganizationStats(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const activeProjects = await this.prisma.project.count({
      where: {
        workspace: {
          organizationId,
        },
        status: 'ACTIVE',
      },
    });

    const totalActiveWorkspaces = await this.prisma.workspace.count({
      where: {
        organizationId,
      },
    });

    const taskStats = await this.prisma.task.groupBy({
      by: ['statusId'],
      where: {
        project: {
          workspace: {
            organizationId,
          },
        },
      },
      _count: {
        id: true,
      },
    });

    const statusCategories = await this.prisma.taskStatus.findMany({
      where: {
        workflow: {
          organizationId,
        },
      },
      select: {
        id: true,
        category: true,
      },
    });

    const recentActivities = await this.prisma.activityLog.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    const statusCategoryMap = new Map(
      statusCategories.map((status) => [status.id, status.category]),
    );

    // Calculate task counts
    let totalTasks = 0;
    let openTasks = 0;
    let completedTasks = 0;

    taskStats.forEach((stat) => {
      const count = stat._count.id;
      totalTasks += count;

      const category = statusCategoryMap.get(stat.statusId);
      if (category === 'DONE') {
        completedTasks += count;
      } else {
        openTasks += count;
      }
    });

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      statistics: {
        totalTasks,
        openTasks,
        completedTasks,
        activeProjects,
        totalActiveWorkspaces,
      },
      recentActivities: recentActivities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        entityType: activity.entityType,
        entityId: activity.entityId,
        createdAt: activity.createdAt,
        user: {
          id: activity.user.id,
          name: `${activity.user.firstName} ${activity.user.lastName}`,
          email: activity.user.email,
          avatar: activity.user.avatar,
        },
      })),
    };
  }

  // Helper method to get default workflow for a project
  async getDefaultWorkflow(organizationId: string) {
    return await this.prisma.workflow.findFirst({
      where: {
        organizationId,
        isDefault: true,
      },
      include: {
        statuses: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async archiveOrganization(id: string): Promise<void> {
    try {
      await this.prisma.organization.update({
        where: { id },
        data: { archive: true },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Organization not found');
      }
      throw error;
    }
  }
}
