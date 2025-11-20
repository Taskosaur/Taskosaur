import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
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
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<Project> {
    // Verify workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: createProjectDto.workspaceId },
      select: {
        organizationId: true,
        organization: { select: { ownerId: true } },
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

    if (!workspace) throw new NotFoundException('Workspace not found');

    // Check if user can create projects in this workspace
    if (workspace.organization.ownerId !== userId) {
      // const _orgMember = await this.prisma.organizationMember.findUnique({
      //   where: {
      //     userId_organizationId: {
      //       userId,
      //       organizationId: workspace.organizationId,
      //     },
      //   },
      //   select: { role: true },
      // });
      // const _wsMember = await this.prisma.workspaceMember.findUnique({
      //   where: {
      //     userId_workspaceId: {
      //       userId,
      //       workspaceId: createProjectDto.workspaceId,
      //     },
      //   },
      //   select: { role: true },
      // });
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
      throw new NotFoundException('Default workflow not found for organization');
    }
    const workspaceOwners = workspace.members.map((member) => ({
      userId: member.userId,
      role: member.role,
    }));
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
        const membersToAdd = new Map<string, Role>();
        membersToAdd.set(userId, Role.OWNER);
        workspaceOwners.forEach((member) => {
          if (!membersToAdd.has(member.userId)) {
            membersToAdd.set(member.userId, member.role);
          }
        });
        // Add creator as project member with MANAGER role
        await Promise.all(
          Array.from(membersToAdd.entries()).map(([memberId, memberRole]) =>
            tx.projectMember.create({
              data: {
                userId: memberId,
                projectId: project.id,
                role: memberRole,
                createdBy: userId,
                updatedBy: userId,
              },
            }),
          ),
        );

        return project;
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Project with this key already exists in this workspace');
      }
      throw error;
    }
  }

  findAll(
    workspaceId?: string,
    userId?: string,
    filters?: {
      status?: string;
      priority?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const { status, priority, search, page = 1, pageSize = 10 } = filters || {};

    // Normalize status and priority to strings (handle potential arrays from query params)
    const normalizedStatus: string | undefined = status
      ? Array.isArray(status)
        ? status[0]
        : status
      : undefined;
    const normalizedPriority: string | undefined = priority
      ? Array.isArray(priority)
        ? priority[0]
        : priority
      : undefined;

    // Validate types after normalization
    if (normalizedStatus !== undefined && typeof normalizedStatus !== 'string') {
      throw new BadRequestException('Invalid type for parameter "status". Must be a string.');
    }
    if (normalizedPriority !== undefined && typeof normalizedPriority !== 'string') {
      throw new BadRequestException('Invalid type for parameter "priority". Must be a string.');
    }

    // Additional sanitization for status values
    if (normalizedStatus && !/^[a-zA-Z0-9,_-]+$/.test(normalizedStatus)) {
      throw new BadRequestException('Invalid status value format.');
    }
    // Additional sanitization for priority values
    if (normalizedPriority && !/^[a-zA-Z0-9,_-]+$/.test(normalizedPriority)) {
      throw new BadRequestException('Invalid priority value format.');
    }

    const whereClause: any = {
      archive: false,
      OR: [{ members: { some: { userId } } }, { visibility: 'PUBLIC' }],
    };
    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }
    if (normalizedStatus) {
      whereClause.status = normalizedStatus.includes(',')
        ? { in: normalizedStatus.split(',').map((s: string) => s.trim()) }
        : normalizedStatus;
    }

    // Step 3: Add priority filter
    if (normalizedPriority) {
      whereClause.priority = normalizedPriority.includes(',')
        ? { in: normalizedPriority.split(',').map((p: string) => p.trim()) }
        : normalizedPriority;
    }

    // Step 4: Add search filter
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

    // Step 5: Query projects with pagination
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

  async findByOrganizationId(filters: ProjectFilters, userId: string): Promise<Project[]> {
    const {
      organizationId,
      workspaceId,
      status,
      priority,
      page = 1,
      pageSize = 10,
      search,
    } = filters;

    // Normalize status and priority to strings (handle potential arrays from query params)
    const normalizedStatus: string | undefined = status
      ? Array.isArray(status)
        ? status[0]
        : status
      : undefined;
    const normalizedPriority: string | undefined = priority
      ? Array.isArray(priority)
        ? priority[0]
        : priority
      : undefined;

    // Validate types after normalization
    if (normalizedStatus !== undefined && typeof normalizedStatus !== 'string') {
      throw new BadRequestException('Invalid type for parameter "status". Must be a string.');
    }
    if (normalizedPriority !== undefined && typeof normalizedPriority !== 'string') {
      throw new BadRequestException('Invalid type for parameter "priority". Must be a string.');
    }

    // Additional sanitization for status values
    if (normalizedStatus && !/^[a-zA-Z0-9,_-]+$/.test(normalizedStatus)) {
      throw new BadRequestException('Invalid status value format.');
    }
    // Additional sanitization for priority values
    if (normalizedPriority && !/^[a-zA-Z0-9,_-]+$/.test(normalizedPriority)) {
      throw new BadRequestException('Invalid priority value format.');
    }

    // Step 1: Verify org exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) throw new NotFoundException('Organization not found');
    const whereClause: any = {
      workspace: { organizationId },
      archive: false,
      OR: [{ members: { some: { userId } } }, { visibility: 'PUBLIC' }],
    };
    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }
    if (normalizedStatus) {
      whereClause.status = normalizedStatus.includes(',')
        ? { in: normalizedStatus.split(',').map((s: string) => s.trim()) }
        : normalizedStatus;
    }
    if (normalizedPriority) {
      whereClause.priority = normalizedPriority.includes(',')
        ? { in: normalizedPriority.split(',').map((p: string) => p.trim()) }
        : normalizedPriority;
    }
    if (search) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
      whereClause.AND = [...(whereClause.AND || []), { OR: searchConditions }];
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
              select: { id: true, name: true, slug: true, avatar: true },
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

  /**
   * Helper method to get accessible project IDs based on workspace-level permissions
   */
  private async getAccessibleProjectIds(
    organizationId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<string[]> {
    // Get all workspaces in the organization (filtered by workspaceId if provided)
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        organizationId,
        archive: false,
        ...(workspaceId && { id: workspaceId }),
      },
      select: { id: true },
    });

    const accessibleProjectIds: string[] = [];

    // Check each workspace
    for (const workspace of workspaces) {
      try {
        // If not elevated at workspace level, get projects user is member of OR INTERNAL projects
        const memberProjects = await this.prisma.project.findMany({
          where: {
            workspaceId: workspace.id,
            archive: false,
            OR: [{ members: { some: { userId } } }, { visibility: 'INTERNAL' }],
          },
          select: { id: true },
        });
        accessibleProjectIds.push(...memberProjects.map((p) => p.id));
      } catch (error) {
        console.error('Error accessing workspace:', error);
        // If user doesn't have access to workspace, skip it
        // This handles the ForbiddenException from getWorkspaceAccess
        continue;
      }
    }

    // Also add PUBLIC projects from this organization
    const publicProjects = await this.prisma.project.findMany({
      where: {
        workspace: { organizationId },
        visibility: 'PUBLIC',
        archive: false,
      },
      select: { id: true },
    });

    accessibleProjectIds.push(...publicProjects.map((p) => p.id));

    return [...new Set(accessibleProjectIds)]; // Remove duplicates
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
              where: {
                OR: [
                  { assignees: { some: { id: userId } } },
                  { reporters: { some: { id: userId } } },
                ],
              },
              take: 10,
            },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findByKey(workspaceId: string, key: string, userId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: key } },
      select: { id: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Check access
    await this.accessControl.getProjectAccess(project.id, userId);

    return this.findOne(project.id, userId);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string): Promise<Project> {
    const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

    if (!isElevated) {
      throw new ForbiddenException('Insufficient permissions to update project');
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
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Project with this key already exists in this workspace');
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
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async archiveProject(id: string, userId: string): Promise<void> {
    const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

    if (!isElevated) {
      throw new ForbiddenException('Insufficient permissions to archive project');
    }

    try {
      await this.prisma.project.update({
        where: { id },
        data: { archive: true },
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  // Additional helper methods for search functionality
  findBySearch(workspaceId?: string, organizationId?: string, search?: string, userId?: string) {
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
    whereClause.OR = [{ members: { some: { userId } } }];

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

  async getProjectBySlug(slug: string) {
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

  async validateProjectSlug(
    aiSlug: string,
  ): Promise<
    | { status: 'exact'; slug: string }
    | { status: 'fuzzy'; slug: string; score: number }
    | { status: 'not_found' }
  > {
    // 1. Exact match
    const exact = await this.prisma.project.findFirst({
      where: { slug: aiSlug },
      select: { slug: true },
    });

    if (exact) {
      return { status: 'exact', slug: exact.slug };
    }
    // 2. Fuzzy match
    const fuzzy = await this.prisma.$queryRawUnsafe<{ slug: string; score: number }[]>(
      `
      SELECT slug, similarity(slug, $1) AS score
      FROM "projects"
      ORDER BY score DESC
      LIMIT 3`,
      aiSlug,
    );

    if (fuzzy.length > 0 && fuzzy[0].score >= 0.4) {
      return { status: 'fuzzy', slug: fuzzy[0].slug, score: fuzzy[0].score };
    }
    return { status: 'not_found' };
  }
  async getAllSlugsByWorkspaceId(workspaceId: string): Promise<string[]> {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: { slug: true },
    });
    return projects.map((project) => project.slug);
  }
}
