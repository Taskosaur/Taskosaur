import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Project, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import slugify from 'slugify';
import { DEFAULT_SPRINT } from '../../constants/defaultWorkflow';
import { AccessControlService } from 'src/common/access-control.utils';

type ProjectFilters = {
  organizationId: string;
  workspaceId?: string;
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private accessControl: AccessControlService) { }

  async create(
    createProjectDto: CreateProjectDto,
    userId: string,
  ): Promise<Project> {
    // Verify workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: createProjectDto.workspaceId },
      select: {
        organizationId: true,
        organization: { select: { ownerId: true } },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    // Check if user can create projects in this workspace
    if (workspace.organization.ownerId !== userId) {
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: workspace.organizationId,
          },
        },
        select: { role: true },
      });

      const wsMember = await this.prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: createProjectDto.workspaceId,
          },
        },
        select: { role: true },
      });

      const canCreate =
        orgMember?.role === Role.MANAGER ||
        orgMember?.role === Role.OWNER ||
        wsMember?.role === Role.MANAGER ||
        wsMember?.role === Role.OWNER;

      if (!canCreate) {
        throw new ForbiddenException(
          'Insufficient permissions to create project in this workspace',
        );
      }
    }

    // Generate unique slug
    const baseSlug = slugify(createProjectDto.slug, {
      lower: true,
      strict: true,
    });
    let slug = baseSlug;

    const existing = await this.prisma.project.findMany({
      where: { slug: { startsWith: baseSlug } },
    });

    if (existing.length > 0) {
      let maxSuffix = 0;
      existing.forEach((p) => {
        const match = p.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSuffix) maxSuffix = num;
        }
      });
      slug = `${baseSlug}-${maxSuffix + 1}`;
    }

    // Get default workflow
    const defaultWorkflow = await this.prisma.workflow.findFirst({
      where: { organizationId: workspace.organizationId, isDefault: true },
    });

    if (!defaultWorkflow) {
      throw new NotFoundException(
        'Default workflow not found for organization',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            ...createProjectDto,
            slug,
            workflowId: createProjectDto.workflowId || defaultWorkflow.id,
            createdBy: userId,
            updatedBy: userId,
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
          },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organization: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
            workflow: {
              select: {
                id: true,
                name: true,
                isDefault: true,
                statuses: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    category: true,
                    position: true,
                  },
                  orderBy: { position: 'asc' },
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
            sprints: {
              select: {
                id: true,
                name: true,
                goal: true,
                status: true,
                startDate: true,
                endDate: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { members: true, tasks: true, sprints: true } },
          },
        });

        // Add creator as project member with MANAGER role
        await tx.projectMember.create({
          data: {
            userId,
            projectId: project.id,
            role: Role.MANAGER,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        return project;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Project with this key already exists in this workspace',
        );
      }
      throw error;
    }
  }

  async findAll(
    workspaceId?: string,
    userId?: string,
    filters?: {
      status?: string;
      priority?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<Project[]> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const { status, priority, search, page = 1, pageSize = 10 } = filters || {};

    // ✅ Step 1: Check workspace access (if workspaceId is given)
    let isElevated = false;
    if (workspaceId) {
      const access = await this.accessControl.getWorkspaceAccess(workspaceId, userId);
      isElevated = access.isElevated;
    }

    // ✅ Step 2: Build where clause
    const whereClause: any = { archive: false };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    // 🔹 Add status filter (handles multiple values like "ACTIVE,COMPLETED")
    if (status) {
      whereClause.status = status.includes(',')
        ? { in: status.split(',').map(s => s.trim()) }
        : status;
    }

    // 🔹 Add priority filter (handles multiple values like "HIGH,LOW")
    if (priority) {
      whereClause.priority = priority.includes(',')
        ? { in: priority.split(',').map(p => p.trim()) }
        : priority;
    }

    // 🔹 Add search filter
    if (search) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Restrict if not elevated
    if (!isElevated) {
      whereClause.OR = [
        { workspace: { organization: { ownerId: userId } } },
        { workspace: { organization: { members: { some: { userId } } } } },
        { workspace: { members: { some: { userId } } } },
        { members: { some: { userId } } },
      ];
    }

    // ✅ Step 3: Query projects with pagination
    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
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
        _count: { select: { members: true, tasks: true, sprints: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }



  async findByOrganizationId(
    filters: ProjectFilters,
    userId: string,
  ): Promise<Project[]> {
    const {
      organizationId,
      workspaceId,
      status,
      priority,
      page = 1,
      pageSize = 10,
      search,
    } = filters;

    // Step 1: Verify org exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    // Step 2: Get access level
    const { isElevated } = await this.accessControl.getOrgAccess(
      organizationId,
      userId,
    );

    // Step 3: Build where clause
    const whereClause: any = {
      workspace: { organizationId },
      archive: false,
      ...(status && {
        status: status.includes(',')
          ? { in: status.split(',').map(s => s.trim()) }
          : status,
      }),
      ...(priority && {
        priority: priority.includes(',')
          ? { in: priority.split(',').map(p => p.trim()) }
          : priority,
      }),
      ...(workspaceId && { workspaceId }),
    };

    if (!isElevated) {
      // restrict to projects where user is a member
      whereClause.OR = [
        { workspace: { members: { some: { userId } } } },
        { members: { some: { userId } } },
      ];
    }

    // Step 4: Add search filter
    if (search) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } }
          ],
        },
      ];
    }

    // Step 5: Query projects with same include structure as findOne
    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        workflow: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            statuses: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
                position: true,
              },
              orderBy: { position: 'asc' },
            },
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
        _count: { select: { members: true, tasks: true, sprints: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }



  async findOne(id: string, userId: string): Promise<Project> {
    const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        workflow: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            statuses: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
                position: true,
              },
              orderBy: { position: 'asc' },
            },
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
        // Show tasks based on access level
        tasks: isElevated
          ? {
            select: {
              id: true,
              title: true,
              type: true,
              priority: true,
              status: true,
            },
            take: 10,
          }
          : {
            select: {
              id: true,
              title: true,
              type: true,
              priority: true,
              status: true,
            },
            where: { OR: [{ assigneeId: userId }, { reporterId: userId }] },
            take: 10,
          },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findByKey(
    workspaceId: string,
    key: string,
    userId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: key } },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Check access
    await this.accessControl.getProjectAccess(project.id, userId);

    return this.findOne(project.id, userId);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ): Promise<Project> {
    const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

    if (!isElevated) {
      throw new ForbiddenException(
        'Insufficient permissions to update project',
      );
    }

    try {
      return await this.prisma.project.update({
        where: { id },
        data: { ...updateProjectDto, updatedBy: userId },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          createdByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: { select: { members: true, tasks: true, sprints: true } },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Project with this key already exists in this workspace',
        );
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const { role } = await this.accessControl.getProjectAccess(id, userId);

    if (role !== Role.OWNER && role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only owners can delete projects');
    }
    try {
      await this.prisma.project.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async archiveProject(id: string, userId: string): Promise<void> {
    const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

    if (!isElevated) {
      throw new ForbiddenException(
        'Insufficient permissions to archive project',
      );
    }

    try {
      await this.prisma.project.update({
        where: { id },
        data: { archive: true },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  // Additional helper methods for search functionality
  async findBySearch(
    workspaceId?: string,
    organizationId?: string,
    search?: string,
    userId?: string,
  ): Promise<Project[]> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const whereClause: any = { archive: false };

    // Add scope filtering
    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    } else if (organizationId) {
      whereClause.workspace = { organizationId };
    }

    // Add user access filtering
    whereClause.OR = [
      { workspace: { organization: { ownerId: userId } } },
      { workspace: { organization: { members: { some: { userId } } } } },
      { workspace: { members: { some: { userId } } } },
      { members: { some: { userId } } },
    ];

    // Add search filter
    if (search && search.trim()) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];

      whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
      delete whereClause.OR;
    }

    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: { select: { members: true, tasks: true, sprints: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithPagination(
    workspaceId?: string,
    organizationId?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<{
    projects: Project[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const whereClause: any = { archive: false };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    } else if (organizationId) {
      whereClause.workspace = { organizationId };
    }

    // Add user access filtering
    whereClause.OR = [
      { workspace: { organization: { ownerId: userId } } },
      { workspace: { organization: { members: { some: { userId } } } } },
      { workspace: { members: { some: { userId } } } },
      { members: { some: { userId } } },
    ];

    if (search && search.trim()) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];

      whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
      delete whereClause.OR;
    }

    const [totalCount, projects] = await Promise.all([
      this.prisma.project.count({ where: whereClause }),
      this.prisma.project.findMany({
        where: whereClause,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          _count: { select: { members: true, tasks: true, sprints: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      projects,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getProjectBySlug(slug: string, userId: string): Promise<Project | null> {
    // Find project by slug
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        members: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastLoginAt: true,
              },
            },
            role: true,
          },
        },
        _count: { select: { members: true, tasks: true, sprints: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    // Optionally, add access control here if needed
    return project;
  }
}
