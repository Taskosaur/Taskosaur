import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ProjectMember,
  Role,
  Role as ProjectRole,
  Role as WorkspaceRole,
  Role as OrganizationRole,
  ProjectVisibility,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectMemberDto, InviteProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

@Injectable()
export class ProjectMembersService {
  private readonly logger = new Logger(ProjectMembersService.name);
  private readonly uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(private prisma: PrismaService) {}

  private validateUuid(id: string, name: string = 'ID') {
    if (!id || !this.uuidRegex.test(id)) {
      throw new BadRequestException(`Invalid ${name} format`);
    }
  }

  async create(
    createProjectMemberDto: CreateProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    const { userId, projectId, role = ProjectRole.MEMBER } = createProjectMemberDto;

    this.validateUuid(projectId, 'Project ID');
    this.validateUuid(userId, 'User ID');

    // Verify project exists and get workspace/organization info
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!requestUserId) {
      throw new BadRequestException('Request User ID is required');
    }

    // Authorization check: requester must be admin/owner of project, workspace, or org, or a SUPER_ADMIN
    const actor = await this.prisma.user.findFirst({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null, null]
      : await Promise.all([
          this.findByUserAndProject(requestUserId, projectId, requestUserId),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId: project.workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: project.workspace.organizationId,
              },
            },
          }),
        ]);

    const isOrgOwner = project.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin =
      requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;
    const isProjectAdmin =
      requesterProjectMember?.role === ProjectRole.OWNER ||
      requesterProjectMember?.role === ProjectRole.MANAGER;

    if (!isSuperAdmin && !isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
      throw new ForbiddenException('Only admins can add members to this project');
    }

    // Role escalation check: only owners/org admins can assign OWNER role
    if (role === ProjectRole.OWNER) {
      const isHigherAdmin =
        isSuperAdmin ||
        isOrgOwner ||
        isOrgAdmin ||
        isWorkspaceAdmin ||
        requesterProjectMember?.role === ProjectRole.OWNER;
      if (!isHigherAdmin) {
        throw new ForbiddenException(
          'Only project owners or organization/workspace admins can assign the OWNER role',
        );
      }
    }

    // Already validated above

    // Verify user exists and is a member of the workspace
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        workspaceMembers: {
          where: { workspaceId: project.workspaceId },
          select: { id: true, role: true },
        },
        organizationMembers: {
          where: { organizationId: project.workspace.organizationId },
          select: { id: true, role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.workspaceMembers.length === 0 && user.organizationMembers.length === 0) {
      throw new BadRequestException(
        'User must be a member of the workspace or organization to join this project',
      );
    }

    // Validate role
    if (role && !Object.values(Role).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    try {
      return await this.prisma.projectMember.create({
        data: {
          userId,
          projectId,
          role,
          createdBy: requestUserId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              username: true,
              avatar: true,
              status: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              color: true,
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
        },
      });
    } catch (error) {
      this.logger.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this project');
      }
      if (error instanceof Error && error.name === 'PrismaClientValidationError') {
        throw new BadRequestException('Invalid data provided to Prisma');
      }
      throw error;
    }
  }

  async inviteByEmail(
    inviteProjectMemberDto: InviteProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    const { email, projectId, role = ProjectRole.MEMBER } = inviteProjectMemberDto;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.create(
      {
        userId: user.id,
        projectId,
        role,
      },
      requestUserId,
    );
  }

  async findAll(
    requestUserId: string,
    projectId?: string,
    search?: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: ProjectMember[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    // Authorization check
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          visibility: true,
          workspaceId: true,
          workspace: {
            select: {
              organizationId: true,
              organization: { select: { ownerId: true } },
            },
          },
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const actor = await this.prisma.user.findFirst({
        where: { id: requestUserId },
        select: { role: true },
      });

      const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

      const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
        ? [null, null, null]
        : await Promise.all([
            this.findByUserAndProject(requestUserId, projectId, requestUserId),
            this.prisma.workspaceMember.findUnique({
              where: {
                userId_workspaceId: {
                  userId: requestUserId,
                  workspaceId: project.workspaceId,
                },
              },
            }),
            this.prisma.organizationMember.findUnique({
              where: {
                userId_organizationId: {
                  userId: requestUserId,
                  organizationId: project.workspace.organizationId,
                },
              },
            }),
          ]);

      const isOrgOwner = project.workspace.organization.ownerId === requestUserId;
      const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
      const isWorkspaceAdmin =
        requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
        requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;

      // Access logic:
      // 1. Project members, Org Owners/Admins, Workspace Owners/Managers always have access, or SUPER_ADMIN
      // 2. If PUBLIC, everyone has access
      // 3. If INTERNAL, workspace members have access
      // 4. Otherwise (PRIVATE), only those in #1 have access

      const hasExplicitAccess =
        isSuperAdmin || requesterProjectMember || isOrgOwner || isOrgAdmin || isWorkspaceAdmin;

      if (!hasExplicitAccess) {
        if (project.visibility === ProjectVisibility.PUBLIC) {
          // Public project: allow
        } else if (project.visibility === ProjectVisibility.INTERNAL && requesterWorkspaceMember) {
          // Internal project and user is a workspace member: allow
        } else {
          // Private project or user not in workspace: forbid
          throw new ForbiddenException('You are not authorized to view members of this project');
        }
      }
    }

    const actorForScope = projectId
      ? null
      : await this.prisma.user.findFirst({
          where: { id: requestUserId },
          select: { role: true },
        });
    const isSuperAdminScope = actorForScope?.role === OrganizationRole.SUPER_ADMIN;

    const whereClause: any = {};

    if (projectId) {
      whereClause.projectId = projectId;
    } else if (!isSuperAdminScope) {
      // No project filter was supplied. Restrict the listing to projects the
      // caller actually participates in (as a project member or a member of
      // the project's workspace). Without this, omitting projectId bypassed
      // the authorization block above and returned every project's members
      // (with PII) across all organizations.
      whereClause.project = {
        OR: [
          { members: { some: { userId: requestUserId } } },
          { workspace: { members: { some: { userId: requestUserId } } } },
        ],
      };
    }

    if (search && search.trim()) {
      whereClause.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const total = await this.prisma.projectMember.count({ where: whereClause });

    const queryOptions: Prisma.ProjectMemberFindManyArgs = {
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            avatar: true,
            status: true,
            lastLoginAt: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
            color: true,
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
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    };

    // Apply pagination only if both page and limit are provided
    if (page && limit) {
      queryOptions.skip = (page - 1) * limit;
      queryOptions.take = limit;
    }

    const data = await this.prisma.projectMember.findMany(queryOptions);

    return { data, total, page, limit };
  }

  async findAllByWorkspace(workspaceId: string, requestUserId: string): Promise<any[]> {
    // Verify workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Authorization check
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null]
      : await Promise.all([
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: workspace.organizationId,
              },
            },
          }),
        ]);

    if (!isSuperAdmin && !requesterWorkspaceMember && !requesterOrgMember) {
      throw new ForbiddenException('You are not authorized to view members in this workspace');
    }

    const users = await this.prisma.user.findMany({
      where: {
        projectMembers: {
          some: {
            project: {
              workspaceId,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        projectMembers: {
          where: {
            project: {
              workspaceId,
            },
          },
          select: {
            id: true,
            projectId: true,
            role: true,
            joinedAt: true,
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                avatar: true,
                color: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          take: 1,
        },
      },
    });

    return users.map((user) => {
      const member = user.projectMembers[0];
      return {
        id: member.id,
        userId: user.id,
        projectId: member.projectId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: (user as any).username,
          avatar: user.avatar,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
        },
        project: member.project,
      };
    });
  }

  async findOne(id: string, requestUserId: string): Promise<ProjectMember> {
    const member = await this.prisma.projectMember.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            timezone: true,
            language: true,
            status: true,
            lastLoginAt: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            status: true,
            priority: true,
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                organizationId: true,
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
      },
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    // Authorization check
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null, null]
      : await Promise.all([
          this.findByUserAndProject(requestUserId, member.projectId, requestUserId),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId: member.project.workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: (member.project.workspace as any).organizationId,
              },
            },
          }),
        ]);

    if (
      !isSuperAdmin &&
      !requesterProjectMember &&
      !requesterWorkspaceMember &&
      !requesterOrgMember
    ) {
      throw new ForbiddenException('You are not authorized to view this project member');
    }

    return member;
  }

  async findByUserAndProject(userId: string, projectId: string, requestUserId?: string) {
    this.validateUuid(userId, 'User ID');
    this.validateUuid(projectId, 'Project ID');

    if (requestUserId) {
      this.validateUuid(requestUserId, 'Request User ID');
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          visibility: true,
          workspaceId: true,
          workspace: {
            select: {
              organizationId: true,
              organization: { select: { ownerId: true } },
            },
          },
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const actor = await this.prisma.user.findUnique({
        where: { id: requestUserId },
        select: { role: true },
      });

      const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

      const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
        ? [null, null, null]
        : await Promise.all([
            this.prisma.projectMember.findUnique({
              where: { userId_projectId: { userId: requestUserId, projectId } },
            }),
            this.prisma.workspaceMember.findUnique({
              where: {
                userId_workspaceId: {
                  userId: requestUserId,
                  workspaceId: project.workspaceId,
                },
              },
            }),
            this.prisma.organizationMember.findUnique({
              where: {
                userId_organizationId: {
                  userId: requestUserId,
                  organizationId: project.workspace.organizationId,
                },
              },
            }),
          ]);

      const isOrgOwner = project.workspace.organization.ownerId === requestUserId;
      const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
      const isWorkspaceAdmin =
        requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
        requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;

      const hasExplicitAccess =
        isSuperAdmin || requesterProjectMember || isOrgOwner || isOrgAdmin || isWorkspaceAdmin;

      if (!hasExplicitAccess) {
        if (project.visibility === ProjectVisibility.PUBLIC) {
          // Public project: allow
        } else if (project.visibility === ProjectVisibility.INTERNAL && requesterWorkspaceMember) {
          // Internal project and user is a workspace member: allow
        } else {
          // Private project or user not in workspace: forbid
          throw new ForbiddenException('You are not authorized to view this project member');
        }
      }
    }

    return this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateProjectMemberDto: UpdateProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    // Get current member info
    const member = await this.prisma.projectMember.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
            workspace: {
              select: {
                organizationId: true,
                organization: {
                  select: {
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    // Check requester permissions at different levels
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null, null]
      : await Promise.all([
          this.findByUserAndProject(requestUserId, member.projectId, requestUserId),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId: member.project.workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: member.project.workspace.organizationId,
              },
            },
          }),
        ]);

    if (
      !isSuperAdmin &&
      !requesterProjectMember &&
      !requesterWorkspaceMember &&
      !requesterOrgMember
    ) {
      throw new ForbiddenException(
        'You are not a member of this project, workspace, or organization',
      );
    }

    // Permission check: organization owner, org/workspace/project admins can update
    const isOrgOwner = member.project.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin =
      requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;
    const isProjectAdmin =
      requesterProjectMember?.role === ProjectRole.OWNER ||
      requesterProjectMember?.role === ProjectRole.MANAGER;

    if (!isSuperAdmin && !isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
      throw new ForbiddenException('Only admins can update member roles');
    }

    // Role escalation check: only owners/org admins can promote to OWNER role
    if (updateProjectMemberDto.role === ProjectRole.OWNER) {
      const isHigherAdmin =
        isSuperAdmin ||
        isOrgOwner ||
        isOrgAdmin ||
        isWorkspaceAdmin ||
        requesterProjectMember?.role === ProjectRole.OWNER;
      if (!isHigherAdmin) {
        throw new ForbiddenException(
          'Only project owners or organization/workspace admins can assign the OWNER role',
        );
      }
    }

    // Validate role
    if (updateProjectMemberDto.role && !Object.values(Role).includes(updateProjectMemberDto.role)) {
      throw new BadRequestException(`Invalid role: ${updateProjectMemberDto.role}`);
    }

    try {
      const updatedMember = await this.prisma.projectMember.update({
        where: { id },
        data: updateProjectMemberDto,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
              status: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              color: true,
            },
          },
        },
      });

      return updatedMember;
    } catch (error) {
      this.logger.error(error);
      if (error instanceof Error && error.name === 'PrismaClientValidationError') {
        throw new BadRequestException('Invalid data provided to Prisma');
      }
      throw error;
    }
  }

  async remove(id: string, requestUserId: string): Promise<void> {
    // Get current member info
    const member = await this.prisma.projectMember.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
            workspace: {
              select: {
                organizationId: true,
                organization: {
                  select: {
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    // Check requester permissions
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null, null]
      : await Promise.all([
          this.findByUserAndProject(requestUserId, member.projectId, requestUserId),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId: member.project.workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: member.project.workspace.organizationId,
              },
            },
          }),
        ]);

    // Users can remove themselves, or admins can remove others
    const isSelfRemoval = member.userId === requestUserId;
    const isOrgOwner = member.project.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin =
      requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;
    const isProjectAdmin =
      requesterProjectMember?.role === ProjectRole.OWNER ||
      requesterProjectMember?.role === ProjectRole.MANAGER;

    if (
      !isSuperAdmin &&
      !isSelfRemoval &&
      !isOrgOwner &&
      !isOrgAdmin &&
      !isWorkspaceAdmin &&
      !isProjectAdmin
    ) {
      throw new ForbiddenException('You can only remove yourself or you must be an admin');
    }

    await this.prisma.projectMember.delete({
      where: { id },
    });
  }

  async bulkRemove(memberIds: string[], requestUserId: string): Promise<{ removed: number }> {
    if (!memberIds.length) {
      throw new BadRequestException('No member IDs provided');
    }

    const members = await this.prisma.projectMember.findMany({
      where: { id: { in: memberIds } },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
            workspace: {
              select: {
                organizationId: true,
                organization: { select: { ownerId: true } },
              },
            },
          },
        },
      },
    });

    if (members.length === 0) {
      throw new NotFoundException('No project members found for the given IDs');
    }

    const projectIds = [...new Set(members.map((m) => m.projectId))];
    if (projectIds.length > 1) {
      throw new BadRequestException('All members must belong to the same project');
    }

    if (members.some((m) => m.userId === requestUserId)) {
      throw new BadRequestException('Cannot include yourself in bulk removal');
    }

    const project = members[0].project;
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
        await Promise.all([
          this.prisma.projectMember.findUnique({
            where: { userId_projectId: { userId: requestUserId, projectId: project.id } },
          }),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: { userId: requestUserId, workspaceId: project.workspaceId },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: project.workspace.organizationId,
              },
            },
          }),
        ]);

      const isOrgOwner = project.workspace.organization.ownerId === requestUserId;
      const isOrgAdmin = requesterOrgMember?.role === 'OWNER';
      const isWorkspaceAdmin =
        requesterWorkspaceMember?.role === 'OWNER' || requesterWorkspaceMember?.role === 'MANAGER';
      const isProjectAdmin =
        requesterProjectMember?.role === 'OWNER' || requesterProjectMember?.role === 'MANAGER';

      if (!isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
        throw new ForbiddenException('Only admins can bulk remove members');
      }
    }

    await this.prisma.projectMember.deleteMany({
      where: { id: { in: memberIds } },
    });

    return { removed: members.length };
  }

  async getUserProjects(userId: string, requestUserId: string): Promise<ProjectMember[]> {
    // Users can always view their own projects
    if (userId === requestUserId) {
      return this.prisma.projectMember.findMany({
        where: { userId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatar: true,
              color: true,
              status: true,
              priority: true,
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
              _count: {
                select: {
                  members: true,
                  tasks: true,
                  sprints: true,
                },
              },
            },
          },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });
    }

    // For viewing other users' projects, check if requester has admin access
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === Role.SUPER_ADMIN;

    if (isSuperAdmin) {
      // SUPER_ADMIN can view any user's projects
      return this.prisma.projectMember.findMany({
        where: { userId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatar: true,
              color: true,
              status: true,
              priority: true,
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
              _count: {
                select: {
                  members: true,
                  tasks: true,
                  sprints: true,
                },
              },
            },
          },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });
    }

    // Check if requester is org admin or workspace admin
    // First, get the target user's organization/workspace memberships
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationMembers: {
          select: { organizationId: true, role: true },
        },
        workspaceMembers: {
          select: { workspaceId: true, role: true },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Get requester's memberships
    const [requesterOrgMembers, requesterWorkspaceMembers] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { userId: requestUserId },
        select: { organizationId: true, role: true },
      }),
      this.prisma.workspaceMember.findMany({
        where: { userId: requestUserId },
        select: { workspaceId: true, role: true },
      }),
    ]);

    // Build sets of org/workspace IDs where requester is admin
    const requesterOrgAdminIds = new Set(
      requesterOrgMembers.filter((m) => m.role === Role.OWNER).map((m) => m.organizationId),
    );

    const requesterWorkspaceAdminIds = new Set(
      requesterWorkspaceMembers
        .filter((m) => m.role === Role.OWNER || m.role === Role.MANAGER)
        .map((m) => m.workspaceId),
    );

    // Check if requester has admin access to any org/workspace the target user belongs to
    const targetOrgIds = targetUser.organizationMembers.map((m) => m.organizationId);
    const targetWorkspaceIds = targetUser.workspaceMembers.map((m) => m.workspaceId);

    const hasOrgAdminAccess = targetOrgIds.some((orgId) => requesterOrgAdminIds.has(orgId));
    const hasWorkspaceAdminAccess = targetWorkspaceIds.some((wsId) =>
      requesterWorkspaceAdminIds.has(wsId),
    );

    if (!hasOrgAdminAccess && !hasWorkspaceAdminAccess) {
      throw new ForbiddenException(
        'You can only view your own projects or projects of users in your organization/workspace',
      );
    }

    // Requester has admin access, return the target user's projects
    return this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            status: true,
            priority: true,
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
            _count: {
              select: {
                members: true,
                tasks: true,
                sprints: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });
  }

  async getProjectStats(projectId: string, requestUserId: string): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        workspaceId: true,
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Authorization check
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: { role: true },
    });

    const isSuperAdmin = actor?.role === OrganizationRole.SUPER_ADMIN;

    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] = isSuperAdmin
      ? [null, null, null]
      : await Promise.all([
          this.findByUserAndProject(requestUserId, projectId, requestUserId),
          this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: requestUserId,
                workspaceId: project.workspaceId,
              },
            },
          }),
          this.prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: requestUserId,
                organizationId: project.workspace.organizationId,
              },
            },
          }),
        ]);

    if (
      !isSuperAdmin &&
      !requesterProjectMember &&
      !requesterWorkspaceMember &&
      !requesterOrgMember
    ) {
      throw new ForbiddenException('You are not authorized to view statistics for this project');
    }

    const [totalMembers, roleStats, recentJoins] = await Promise.all([
      // Total members count
      this.prisma.projectMember.count({
        where: { projectId },
      }),

      // Members by role
      this.prisma.projectMember.groupBy({
        by: ['role'],
        where: { projectId },
        _count: { role: true },
      }),

      // Recent joins (last 30 days)
      this.prisma.projectMember.count({
        where: {
          projectId,
          joinedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalMembers,
      roleDistribution: roleStats.reduce(
        (acc, stat) => {
          acc[stat.role] = stat._count.role;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentJoins,
    };
  }
}
