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
  Role as ProjectRole,
  Role as WorkspaceRole,
  Role as OrganizationRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectMemberDto, InviteProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

@Injectable()
export class ProjectMembersService {
  private readonly logger = new Logger(ProjectMembersService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createProjectMemberDto: CreateProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    const { userId, projectId, role = ProjectRole.MEMBER } = createProjectMemberDto;

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

    // Authorization check: requester must be admin/owner of project, workspace, or org
    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
      await Promise.all([
        this.findByUserAndProject(requestUserId, projectId),
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
    const isWorkspaceAdmin = requesterWorkspaceMember?.role === WorkspaceRole.OWNER;
    const isProjectAdmin =
      requesterProjectMember?.role === ProjectRole.OWNER ||
      requesterProjectMember?.role === ProjectRole.MANAGER;

    if (!isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
      throw new ForbiddenException('Only admins can add members to this project');
    }

    // Verify user exists and is a member of the workspace
    const user = await this.prisma.user.findUnique({
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
      throw error;
    }
  }

  async inviteByEmail(
    inviteProjectMemberDto: InviteProjectMemberDto,
    requestUserId: string,
  ): Promise<ProjectMember> {
    const { email, projectId, role = ProjectRole.MEMBER } = inviteProjectMemberDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User with this email not found');
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
        select: { workspaceId: true, workspace: { select: { organizationId: true } } },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
        await Promise.all([
          this.findByUserAndProject(requestUserId, projectId),
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

      if (!requesterProjectMember && !requesterWorkspaceMember && !requesterOrgMember) {
        throw new ForbiddenException('You are not authorized to view members of this project');
      }
    }

    const whereClause: any = {};

    if (projectId) {
      whereClause.projectId = projectId;
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
    const [requesterWorkspaceMember, requesterOrgMember] = await Promise.all([
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

    if (!requesterWorkspaceMember && !requesterOrgMember) {
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
    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
      await Promise.all([
        this.findByUserAndProject(requestUserId, member.projectId),
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

    if (!requesterProjectMember && !requesterWorkspaceMember && !requesterOrgMember) {
      throw new ForbiddenException('You are not authorized to view this project member');
    }

    return member;
  }

  findByUserAndProject(userId: string, projectId: string) {
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
    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
      await Promise.all([
        this.findByUserAndProject(requestUserId, member.projectId),
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

    if (!requesterProjectMember && !requesterWorkspaceMember && !requesterOrgMember) {
      throw new ForbiddenException(
        'You are not a member of this project, workspace, or organization',
      );
    }

    // Permission check: organization owner, org/workspace/project admins can update
    const isOrgOwner = member.project.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin = requesterWorkspaceMember?.role === WorkspaceRole.OWNER;
    const isProjectAdmin =
      requesterProjectMember?.role === ProjectRole.OWNER ||
      requesterProjectMember?.role === ProjectRole.MANAGER;

    if (!isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
      throw new ForbiddenException('Only admins can update member roles');
    }

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
    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
      await Promise.all([
        this.findByUserAndProject(requestUserId, member.projectId),
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

    if (!isSelfRemoval && !isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin && !isProjectAdmin) {
      throw new ForbiddenException('You can only remove yourself or you must be an admin');
    }

    await this.prisma.projectMember.delete({
      where: { id },
    });
  }

  async getUserProjects(userId: string, requestUserId: string): Promise<ProjectMember[]> {
    // Users can view their own projects, or admins might view others (for now restrict to self)
    if (userId !== requestUserId) {
      // Potentially allow org owners/admins to see other user's projects if they share an org
      // For simplicity and maximum security, we'll restrict to self for now.
      throw new ForbiddenException('You can only view your own projects');
    }

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
    const [requesterProjectMember, requesterWorkspaceMember, requesterOrgMember] =
      await Promise.all([
        this.findByUserAndProject(requestUserId, projectId),
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

    if (!requesterProjectMember && !requesterWorkspaceMember && !requesterOrgMember) {
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
