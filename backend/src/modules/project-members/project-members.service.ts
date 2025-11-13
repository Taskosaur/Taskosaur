import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
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
  constructor(private prisma: PrismaService) {}

  async create(createProjectMemberDto: CreateProjectMemberDto): Promise<ProjectMember> {
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
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
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
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this project');
      }
      throw error;
    }
  }

  async inviteByEmail(inviteProjectMemberDto: InviteProjectMemberDto): Promise<ProjectMember> {
    const { email, projectId, role = ProjectRole.MEMBER } = inviteProjectMemberDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    return this.create({
      userId: user.id,
      projectId,
      role,
    });
  }

  async findAll(
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

  async findAllByWorkspace(workspaceId: string): Promise<any[]> {
    // Verify workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Get all projects under this workspace
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    const projectIds = projects.map((project) => project.id);

    if (projectIds.length === 0) {
      return [];
    }

    // Get all project members from these projects
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: {
          in: projectIds,
        },
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
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    // Remove duplicates by userId - keep first occurrence
    const uniqueUsers = new Map();
    const result: any[] = [];

    projectMembers.forEach((member) => {
      if (!uniqueUsers.has(member.userId)) {
        uniqueUsers.set(member.userId, true);
        result.push({
          id: member.id,
          userId: member.userId,
          projectId: member.projectId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
          project: member.project,
        });
      }
    });

    return result;
  }

  async findOne(id: string): Promise<ProjectMember> {
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

    if (!member) {
      throw new NotFoundException('Project member not found');
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

  getUserProjects(userId: string): Promise<ProjectMember[]> {
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

  async getProjectStats(projectId: string): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
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
