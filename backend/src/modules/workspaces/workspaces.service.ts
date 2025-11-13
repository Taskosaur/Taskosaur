import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, Workspace } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AccessControlService } from 'src/common/access-control.utils';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
  ) {}

  async create(createWorkspaceDto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    const { isElevated } = await this.accessControl.getOrgAccess(
      createWorkspaceDto.organizationId,
      userId,
    );
    if (!isElevated) {
      throw new ForbiddenException('Insufficient permissions to create workspace');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: createWorkspaceDto.organizationId },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: {
            role: {
              in: [Role.OWNER, Role.MANAGER],
            },
          },
          select: { userId: true, role: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    // Generate unique slug
    const uniqueSlug = await this.generateUniqueSlug(
      createWorkspaceDto.slug,
      createWorkspaceDto.organizationId,
    );

    const workspace = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          ...createWorkspaceDto,
          slug: uniqueSlug,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, avatar: true },
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
          _count: { select: { members: true, projects: true } },
        },
      });
      const membersToAdd = new Map<string, Role>();
      membersToAdd.set(userId, Role.OWNER);
      membersToAdd.set(organization.ownerId, Role.OWNER);
      organization.members.forEach((member) => {
        if (!membersToAdd.has(member.userId)) {
          membersToAdd.set(member.userId, member.role);
        }
      });
      await Promise.all(
        Array.from(membersToAdd.entries()).map(([memberId, memberRole]) =>
          tx.workspaceMember.create({
            data: {
              userId: memberId,
              workspaceId: workspace.id,
              role: memberRole,
              createdBy: userId,
              updatedBy: userId,
            },
          }),
        ),
      );

      return workspace;
    });

    return workspace;
  }

  private async generateUniqueSlug(baseSlug: string, organizationId: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
        select: { id: true },
      });

      if (!existingWorkspace) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
  findAll(userId: string, organizationId?: string, search?: string): Promise<Workspace[]> {
    const whereClause: any = { archive: false, organizationId };
    if (userId) {
      whereClause.members = { some: { userId } };
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.workspace.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithPagination(
    userId: string,
    organizationId?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    workspaces: Workspace[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const whereClause: any = { archive: false, organizationId };
    if (userId) {
      whereClause.members = { some: { userId } };
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.workspace.count({
      where: whereClause,
    });
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const workspaces = await this.prisma.workspace.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      workspaces,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    await this.accessControl.getWorkspaceAccess(id, userId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
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
        projects: {
          where: {
            archive: false,
            members: { some: { userId } },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            status: true,
            priority: true,
            _count: { select: { tasks: true, members: true } },
          },
        },
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async findBySlug(organizationId: string, slug: string, userId: string): Promise<Workspace> {
    // Check organization access first
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return workspace;
  }

  async update(
    id: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
    userId: string,
  ): Promise<Workspace> {
    await this.accessControl.getWorkspaceAccess(id, userId);

    try {
      const workspace = await this.prisma.workspace.update({
        where: { id },
        data: { ...updateWorkspaceDto, updatedBy: userId },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, avatar: true },
          },
          createdByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: { select: { members: true, projects: true } },
        },
      });

      return workspace;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Workspace with this slug already exists in this organization');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.workspace.delete({ where: { id } });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async archiveWorkspace(id: string): Promise<void> {
    try {
      await this.prisma.workspace.update({
        where: { id },
        data: { archive: true },
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  // Chart methods with role-based filtering
  async workspaceProjectStatusDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const projectWhere = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    return this.prisma.project.groupBy({
      by: ['status'],
      where: projectWhere,
      _count: { status: true },
    });
  }

  async workspaceTaskPriorityBreakdown(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: taskWhere,
      _count: { priority: true },
    });
  }

  async workspaceKPIMetrics(organizationId: string, workspaceSlug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const projectBase = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    const taskBase = {
      project: projectBase,
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    const [totalProjects, activeProjects, completedProjects, totalTasks, overdueTasks] =
      await Promise.all([
        this.prisma.project.count({ where: projectBase }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'ACTIVE' },
        }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'COMPLETED' },
        }),
        this.prisma.task.count({ where: taskBase }),
        this.prisma.task.count({
          where: { ...taskBase, dueDate: { lt: new Date() }, completedAt: null },
        }),
      ]);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      overdueTasks,
      completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0,
    };
  }

  async workspaceTaskTypeDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['type'],
      where: taskWhere,
      _count: { type: true },
    });
  }

  async workspaceSprintStatusOverview(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const sprintWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      archive: false,
    };

    return this.prisma.sprint.groupBy({
      by: ['status'],
      where: sprintWhere,
      _count: { status: true },
    });
  }

  async workspaceMonthlyTaskCompletion(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      completedAt: { not: null },
      ...(isElevated
        ? {}
        : {
            OR: [{ assignees: { some: { id: userId } } }, { reporters: { some: { id: userId } } }],
          }),
    };

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    const monthlyData = tasks.reduce(
      (acc, task) => {
        if (task.completedAt) {
          const month = task.completedAt.toISOString().substring(0, 7);
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      count,
    }));
  }

  async findAllSlugs(organization_id: string): Promise<string[]> {
    if (organization_id === '' || organization_id === null || organization_id === undefined)
      return [];
    const workspaces = await this.prisma.workspace.findMany({
      where: { archive: false, organizationId: organization_id },
      select: { slug: true },
    });
    return workspaces.map((w) => w.slug);
  }

  async getIdBySlug(slug: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { slug },
      select: { id: true },
    });
    return workspace ? workspace.id : null;
  }
}
