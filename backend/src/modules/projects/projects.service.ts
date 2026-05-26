import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Project, Role, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import slugify from 'slugify';
import { DEFAULT_SPRINT } from '../../constants/defaultWorkflow';
import { AccessControlService } from 'src/common/access-control.utils';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { SettingsService } from '../settings/settings.service';
import { InputSanitizer } from '../../common/utils/input-sanitizer';

type ProjectFilters = {
  organizationId: string;
  workspaceId?: string;
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

function generateTaskPrefix(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  let prefix = '';
  if (words.length > 1) {
    prefix = words.map((w) => w.charAt(0)).join('');
  } else {
    const consonants = name.replace(/[aeiou\s-]/gi, '');
    prefix = consonants.length >= 2 ? consonants : name;
  }
  return prefix.substring(0, 4).toUpperCase();
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
    private readonly activityLog: ActivityLogService,
    private settingsService: SettingsService,
  ) {}

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'SUPER_ADMIN';
  }

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

    // Check if organization is archived
    const org = await this.prisma.organization.findUnique({
      where: { id: workspace.organizationId },
      select: { id: true, archive: true },
    });
    if (org?.archive) {
      throw new ForbiddenException('Cannot create project in an archived organization');
    }

    const isOrgOwner = workspace.organization.ownerId === userId;
    const superAdmin = await this.isSuperAdmin(userId);

    // Check global setting for project creation
    const allowProjectCreation = await this.settingsService.get('allow_project_creation');
    if (allowProjectCreation === 'false') {
      // Only MANAGER+ at workspace level, org owner, or SUPER_ADMIN can create when disabled
      if (!isOrgOwner && !superAdmin) {
        const wsMember = await this.prisma.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId, workspaceId: createProjectDto.workspaceId } },
          select: { role: true },
        });
        if (!wsMember || (wsMember.role !== Role.OWNER && wsMember.role !== Role.MANAGER)) {
          throw new ForbiddenException(
            'Project creation is restricted. Please contact your workspace admin.',
          );
        }
      }
    } else {
      // Default behavior: org owner and SUPER_ADMIN can always create, others need non-VIEWER role
      if (!isOrgOwner && !superAdmin) {
        const wsMember = await this.prisma.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId, workspaceId: createProjectDto.workspaceId } },
          select: { role: true },
        });
        if (!wsMember || wsMember.role === Role.VIEWER) {
          throw new ForbiddenException(
            'Insufficient permissions to create projects in this workspace',
          );
        }
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
      // Escape special regex characters to prevent ReDoS vulnerability
      const escapedBaseSlug = baseSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const slugRegex = new RegExp(`^${escapedBaseSlug}-(\\d+)$`);
      existing.forEach((p) => {
        const match = p.slug.match(slugRegex);
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

    // Validate workflowId if provided - ensure it belongs to the same organization
    let workflowIdToUse = createProjectDto.workflowId || defaultWorkflow.id;
    if (createProjectDto.workflowId) {
      const customWorkflow = await this.prisma.workflow.findUnique({
        where: { id: createProjectDto.workflowId },
        select: { id: true, organizationId: true },
      });

      if (!customWorkflow) {
        throw new NotFoundException('Custom workflow not found');
      }

      if (customWorkflow.organizationId !== workspace.organizationId) {
        throw new ForbiddenException(
          'Custom workflow must belong to the same organization as the workspace',
        );
      }

      workflowIdToUse = customWorkflow.id;
    }

    const workspaceOwners = workspace.members.map((member) => ({
      userId: member.userId,
      role: member.role,
    }));

    let retryCount = 0;
    const maxRetries = 5;

    let taskPrefix = createProjectDto.taskPrefix
      ? createProjectDto.taskPrefix.toUpperCase()
      : generateTaskPrefix(createProjectDto.name);
    if (!/^[A-Z0-9]+$/.test(taskPrefix)) {
      taskPrefix = 'PROJ';
    }
    taskPrefix = taskPrefix.substring(0, 8);

    while (retryCount < maxRetries) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const project = await tx.project.create({
            data: {
              ...createProjectDto,
              slug,
              taskPrefix,
              workflowId: workflowIdToUse,
              createdBy: userId,
              updatedBy: userId,
              sprints: {
                create: {
                  name: DEFAULT_SPRINT.name,
                  goal: DEFAULT_SPRINT.goal,
                  status: DEFAULT_SPRINT.status,
                  isDefault: DEFAULT_SPRINT.isDefault,
                  startDate: new Date(),
                  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          (error.meta.target as string[]).includes('slug')
        ) {
          retryCount++;
          // Fetch existing again to get the latest max suffix
          const existing = await this.prisma.project.findMany({
            where: { slug: { startsWith: baseSlug } },
            select: { slug: true },
          });
          let maxSuffix = 0;
          // Escape special regex characters to prevent ReDoS vulnerability
          const escapedBaseSlug = baseSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const slugRegex = new RegExp(`^${escapedBaseSlug}-(\\d+)$`);
          existing.forEach((p) => {
            const match = p.slug.match(slugRegex);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxSuffix) maxSuffix = num;
            }
          });
          slug = `${baseSlug}-${maxSuffix + 1}`;
          continue;
        }
        this.logger.error(
          `Error creating project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Project with this key already exists in this workspace');
        }
        throw error;
      }
    }
    throw new ConflictException('Could not generate a unique slug after multiple attempts');
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
  ) {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    const { status, priority, search, page, pageSize } = filters || {};

    // Sanitize pagination parameters
    const { page: sanitizedPage, pageSize: sanitizedPageSize } = InputSanitizer.sanitizePagination(
      page,
      pageSize,
      100, // Max page size
    );

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

    // Sanitize search parameter
    const sanitizedSearch = InputSanitizer.sanitizeSearch(search);

    const isSuperAdmin = await this.isSuperAdmin(userId);

    const whereClause: any = {
      archive: false,
      workspace: { archive: false },
    };
    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
        { workspace: { organization: { ownerId: userId } } },
        {
          workspace: {
            members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
          },
        },
      ];
    }
    if (workspaceId) {
      whereClause.workspace.id = workspaceId;
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

    // Step 4: Add search filter with sanitized input
    if (sanitizedSearch) {
      // Escape special LIKE characters for defense in depth
      const escapedSearch = InputSanitizer.escapeLikeString(sanitizedSearch);
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { name: { contains: escapedSearch, mode: 'insensitive' } },
            { slug: { contains: escapedSearch, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Step 5: Query projects with sanitized pagination
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
      skip: (sanitizedPage - 1) * sanitizedPageSize,
      take: sanitizedPageSize,
    });
  }

  async findByOrganizationId(filters: ProjectFilters, userId: string): Promise<Project[]> {
    const { organizationId, workspaceId, status, priority, page, pageSize, search } = filters;

    // Sanitize pagination parameters
    const { page: sanitizedPage, pageSize: sanitizedPageSize } = InputSanitizer.sanitizePagination(
      page,
      pageSize,
      100, // Max page size
    );

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

    // Sanitize search parameter
    const sanitizedSearch = InputSanitizer.sanitizeSearch(search);

    // Step 1: Verify org exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const isSuperAdmin = await this.isSuperAdmin(userId);

    const whereClause: any = {
      workspace: { organizationId, archive: false },
      archive: false,
    };
    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
        { workspace: { organization: { ownerId: userId } } },
        {
          workspace: {
            members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
          },
        },
      ];
    }
    if (workspaceId) {
      whereClause.workspace.id = workspaceId;
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
    if (sanitizedSearch) {
      const escapedSearch = InputSanitizer.escapeLikeString(sanitizedSearch);
      const searchConditions = [
        { name: { contains: escapedSearch, mode: 'insensitive' } },
        { slug: { contains: escapedSearch, mode: 'insensitive' } },
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
      skip: (sanitizedPage - 1) * sanitizedPageSize,
      take: sanitizedPageSize,
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
    const isSuperAdmin = await this.isSuperAdmin(userId);

    const whereClause: any = {
      workspace: {
        organizationId,
        ...(workspaceId && { id: workspaceId }),
      },
      archive: false,
    };
    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
      ];
    }

    const projects = await this.prisma.project.findMany({
      where: whereClause,
      select: { id: true },
    });

    return projects.map((p) => p.id);
  }

  async getBulkProjectHealthStats(projectIds: string[], userId: string) {
    if (!projectIds || projectIds.length === 0) return {};

    const isSuperAdmin = await this.isSuperAdmin(userId);
    const whereClause: any = {
      id: { in: projectIds },
      archive: false,
    };

    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
        { workspace: { organization: { ownerId: userId } } },
        {
          workspace: {
            members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
          },
        },
      ];
    }

    const accessibleProjects = await this.prisma.project.findMany({
      where: whereClause,
      select: { id: true },
    });

    const validProjectIds = accessibleProjects.map((p) => p.id);
    if (validProjectIds.length === 0) return {};

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: validProjectIds },
        isArchived: false,
      },
      select: {
        id: true,
        projectId: true,
        dueDate: true,
        status: { select: { category: true } },
      },
    });

    const stats: Record<string, any> = {};
    for (const projectId of validProjectIds) {
      stats[projectId] = {
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        upcomingTasks: 0,
        completionPredictor: 0,
        heatmapData: Array(14).fill(0), // Next 14 days
      };
    }

    const now = new Date();
    // Start of today (normalized to 00:00:00)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    tasks.forEach((task) => {
      const projStats = stats[task.projectId];
      projStats.totalTasks++;
      if (task.status?.category === 'DONE') {
        projStats.completedTasks++;
      } else {
        if (task.dueDate) {
          const taskDate = new Date(task.dueDate);
          const taskDayStart = new Date(
            taskDate.getFullYear(),
            taskDate.getMonth(),
            taskDate.getDate(),
          );

          if (taskDayStart < today) {
            projStats.overdueTasks++;
          } else {
            projStats.upcomingTasks++;
            // Calculate day difference for heatmap (0 = today, 1 = tomorrow, ..., 13 = day 14)
            const diffTime = Math.abs(taskDayStart.getTime() - today.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 14) {
              projStats.heatmapData[diffDays]++;
            }
          }
        } else {
          // Task has no due date, count as upcoming/pending
          projStats.upcomingTasks++;
        }
      }
    });

    for (const projectId of validProjectIds) {
      const projStats = stats[projectId];
      let healthScore = 100;
      if (projStats.totalTasks > 0) {
        const completionRate = projStats.completedTasks / projStats.totalTasks;
        healthScore = completionRate * 100;

        // Penalize for overdue tasks
        // Assuming 50% overdue tasks reduces score by 25 points (adjust as needed)
        const overduePenalty = (projStats.overdueTasks / projStats.totalTasks) * 50;
        healthScore = Math.max(0, healthScore - overduePenalty);
      } else {
        healthScore = 0; // No tasks
      }
      projStats.completionPredictor = Math.round(healthScore);
    }

    return stats;
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
                  { assignees: { some: { userId: userId } } },
                  { reporters: { some: { userId: userId } } },
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
      this.logger.error(
        `Error updating project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
      this.logger.error(
        `Error deleting project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async archiveProject(id: string, userId: string, userRole?: Role): Promise<void> {
    // SUPER_ADMIN has unrestricted access
    if (userRole !== Role.SUPER_ADMIN) {
      const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

      if (!isElevated) {
        throw new ForbiddenException('Insufficient permissions to archive project');
      }
    }

    // Get project details before archiving for audit log
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        workspace: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Archive all tasks in the project
        await tx.task.updateMany({
          where: { projectId: id },
          data: {
            isArchived: true,
            archivedBy: userId,
          },
        });

        // Archive the project
        await tx.project.update({
          where: { id },
          data: { archive: true },
        });
      });

      // Log the archive activity
      await this.activityLog.logActivity({
        type: 'PROJECT_ARCHIVED',
        description: `Archived project "${project.name}" (${project.slug})`,
        entityType: 'Project',
        entityId: project.id,
        userId,
        organizationId: project.workspace.organizationId,
        oldValue: { archived: false },
        newValue: { archived: true },
      });
    } catch (error: any) {
      this.logger.error(
        `Error archiving project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async unarchiveProject(id: string, userId: string, userRole?: Role): Promise<void> {
    // SUPER_ADMIN has unrestricted access
    if (userRole !== Role.SUPER_ADMIN) {
      const { isElevated } = await this.accessControl.getProjectAccess(id, userId);

      if (!isElevated) {
        throw new ForbiddenException('Insufficient permissions to unarchive project');
      }
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        workspace: {
          select: {
            id: true,
            name: true,
            archive: true,
            organizationId: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.workspace.archive) {
      throw new ForbiddenException(
        `Cannot unarchive project: parent workspace "${project.workspace.name}" is still archived. Unarchive the workspace first.`,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Unarchive all tasks in the project
        await tx.task.updateMany({
          where: { projectId: id },
          data: {
            isArchived: false,
            archivedBy: null,
          },
        });

        // Unarchive the project
        await tx.project.update({
          where: { id },
          data: { archive: false },
        });
      });

      // Log the unarchive activity
      await this.activityLog.logActivity({
        type: 'PROJECT_UNARCHIVED',
        description: `Unarchived project "${project.name}" (${project.slug})`,
        entityType: 'Project',
        entityId: project.id,
        userId,
        organizationId: project.workspace.organizationId,
        oldValue: { archived: true },
        newValue: { archived: false },
      });
    } catch (error: any) {
      this.logger.error(
        `Error unarchiving project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (error.code === 'P2025') {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async findArchivedByWorkspace(workspaceId: string, userId: string) {
    await this.accessControl.getWorkspaceAccess(workspaceId, userId);
    return this.prisma.project.findMany({
      where: { archive: true, workspaceId, workspace: { archive: false } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        workspace: { select: { id: true, name: true, slug: true, archive: true } },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findArchivedByOrganization(organizationId: string, userId: string) {
    await this.accessControl.getOrgAccess(organizationId, userId);
    return this.prisma.project.findMany({
      where: { archive: true, workspace: { organizationId, archive: false } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        workspace: { select: { id: true, name: true, slug: true, archive: true } },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Additional helper methods for search functionality
  async findBySearch(
    workspaceId?: string,
    organizationId?: string,
    search?: string,
    userId?: string,
  ) {
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    // Sanitize search parameter
    const sanitizedSearch = InputSanitizer.sanitizeSearch(search);

    const isSuperAdmin = await this.isSuperAdmin(userId);

    const whereClause: any = { archive: false, workspace: { archive: false } };

    // Add scope filtering
    if (workspaceId) {
      whereClause.workspace.id = workspaceId;
    } else if (organizationId) {
      whereClause.workspace.organizationId = organizationId;
    }

    // Add user access filtering
    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
        { workspace: { organization: { ownerId: userId } } },
        {
          workspace: {
            members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
          },
        },
      ];
    }

    // Add search filter with sanitized input
    if (sanitizedSearch) {
      const escapedSearch = InputSanitizer.escapeLikeString(sanitizedSearch);
      const searchConditions = [
        { name: { contains: escapedSearch, mode: 'insensitive' } },
        { description: { contains: escapedSearch, mode: 'insensitive' } },
        { slug: { contains: escapedSearch, mode: 'insensitive' } },
      ];

      if (!isSuperAdmin) {
        whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
        delete whereClause.OR;
      } else {
        whereClause.AND = [{ OR: searchConditions }];
      }
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
    page?: number | string,
    limit?: number | string,
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

    // Sanitize pagination parameters
    const { page: sanitizedPage, pageSize: sanitizedLimit } = InputSanitizer.sanitizePagination(
      page,
      limit,
      100, // Max page size
    );

    // Sanitize search parameter
    const sanitizedSearch = InputSanitizer.sanitizeSearch(search);

    const isSuperAdmin = await this.isSuperAdmin(userId);

    const whereClause: any = { archive: false, workspace: { archive: false } };

    if (workspaceId) {
      whereClause.workspace.id = workspaceId;
    } else if (organizationId) {
      whereClause.workspace.organizationId = organizationId;
    }

    // Add user access filtering
    if (!isSuperAdmin) {
      whereClause.OR = [
        { visibility: 'PUBLIC', workspace: { organization: { members: { some: { userId } } } } },
        { members: { some: { userId } } },
        {
          visibility: 'INTERNAL',
          workspace: { members: { some: { userId } } },
        },
        { workspace: { organization: { ownerId: userId } } },
        {
          workspace: {
            members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
          },
        },
      ];
    }

    if (sanitizedSearch) {
      const escapedSearch = InputSanitizer.escapeLikeString(sanitizedSearch);
      const searchConditions = [
        { name: { contains: escapedSearch, mode: 'insensitive' } },
        { description: { contains: escapedSearch, mode: 'insensitive' } },
        { slug: { contains: escapedSearch, mode: 'insensitive' } },
      ];

      if (!isSuperAdmin) {
        whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
        delete whereClause.OR;
      } else {
        whereClause.AND = [{ OR: searchConditions }];
      }
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
        skip: (sanitizedPage - 1) * sanitizedLimit,
        take: sanitizedLimit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / sanitizedLimit);

    return {
      projects,
      pagination: {
        currentPage: sanitizedPage,
        totalPages,
        totalCount,
        hasNextPage: sanitizedPage < totalPages,
        hasPrevPage: sanitizedPage > 1,
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
