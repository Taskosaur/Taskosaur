import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  WorkspaceMember,
  Role as WorkspaceRole,
  Role as OrganizationRole,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkspaceMemberDto,
  InviteWorkspaceMemberDto,
} from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

@Injectable()
export class WorkspaceMembersService {
  constructor(private prisma: PrismaService) {}

  async create(createWorkspaceMemberDto: CreateWorkspaceMemberDto): Promise<WorkspaceMember> {
    const { userId, workspaceId, role = WorkspaceRole.MEMBER } = createWorkspaceMemberDto;

    // Verify workspace exists and get organization info
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
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
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Verify user exists and is a member of the organization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        organizationMembers: {
          where: { organizationId: workspace.organizationId },
          select: { id: true, role: true },
        },
      },
    });
    console.log(JSON.stringify(user));
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.organizationMembers.length === 0) {
      throw new BadRequestException(
        'User must be a member of the organization to join this workspace',
      );
    }

    try {
      const wsMember = await this.prisma.workspaceMember.create({
        data: {
          userId,
          workspaceId,
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
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              color: true,
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
      });
      if (role === Role.OWNER || role === Role.MANAGER) {
        const wsProjects = await this.prisma.project.findMany({
          where: { workspaceId },
        });

        if (wsProjects.length > 0) {
          await this.prisma.projectMember.createMany({
            data: wsProjects.map((project) => ({
              userId,
              projectId: project.id,
              role,
            })),
            skipDuplicates: true,
          });
        }
      }
      return wsMember;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this workspace');
      }
      throw error;
    }
  }

  async inviteByEmail(
    inviteWorkspaceMemberDto: InviteWorkspaceMemberDto,
  ): Promise<WorkspaceMember> {
    const { email, workspaceId, role = WorkspaceRole.MEMBER } = inviteWorkspaceMemberDto;

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
      workspaceId,
      role,
    });
  }

  async findAll(
    workspaceId?: string,
    search?: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: WorkspaceMember[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    const whereClause: any = {};

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
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

    const isPaginated = !!(page && limit);

    if (!isPaginated) {
      // No pagination → return all
      const data = await this.prisma.workspaceMember.findMany({
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
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              color: true,
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
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });

      return { data, total: data.length };
    }

    // Pagination case
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workspaceMember.findMany({
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
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              color: true,
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
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.workspaceMember.count({ where: whereClause }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<WorkspaceMember> {
    const member = await this.prisma.workspaceMember.findUnique({
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
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                owner: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    return member;
  }

  findByUserAndWorkspace(userId: string, workspaceId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
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
        workspace: {
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
    updateWorkspaceMemberDto: UpdateWorkspaceMemberDto,
    requestUserId: string,
  ): Promise<WorkspaceMember> {
    // Get current member info
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            organizationId: true,
            organization: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    // Check if requester has permission to update
    const requesterWorkspaceMember = await this.findByUserAndWorkspace(
      requestUserId,
      member.workspaceId,
    );
    const requesterOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: requestUserId,
          organizationId: member.workspace.organizationId,
        },
      },
    });

    if (!requesterWorkspaceMember && !requesterOrgMember) {
      throw new ForbiddenException('You are not a member of this workspace or organization');
    }

    // Permission check: organization owner, org admins, or workspace admins can update
    const isOrgOwner = member.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin =
      requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;

    if (!isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin) {
      throw new ForbiddenException(
        'Only organization owners/admins or workspace admins can update member roles',
      );
    }

    if (
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER &&
      updateWorkspaceMemberDto.role === 'OWNER'
    ) {
      throw new ForbiddenException('Manager can not change the role to owner');
    }

    // Update workspace member and handle project members in a transaction
    const updatedMember = await this.prisma.$transaction(async (tx) => {
      // Update the workspace member
      const updated = await tx.workspaceMember.update({
        where: { id },
        data: updateWorkspaceMemberDto,
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
          workspace: {
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

      const userId = updated.userId;
      const workspaceId = updated.workspaceId;
      const role = updated.role;

      // Get all projects in this workspace
      const wsProjects = await tx.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });

      if (wsProjects.length > 0) {
        // Update or create project members for all projects in the workspace
        const projectMemberOperations = wsProjects.map((project) =>
          tx.projectMember.upsert({
            where: {
              userId_projectId: {
                userId: userId,
                projectId: project.id,
              },
            },
            update: {
              role: role, // Update existing member's role
            },
            create: {
              userId: userId,
              projectId: project.id,
              role: role, // Create new member with role
            },
          }),
        );

        // Execute all upsert operations
        await Promise.all(projectMemberOperations);
      }

      return updated;
    });

    return updatedMember;
  }

  async remove(id: string, requestUserId: string): Promise<void> {
    // Get current member info
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            organizationId: true,
            organization: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    // Check if requester has permission to remove
    const requesterWorkspaceMember = await this.findByUserAndWorkspace(
      requestUserId,
      member.workspaceId,
    );
    const requesterOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: requestUserId,
          organizationId: member.workspace.organizationId,
        },
      },
    });

    // Users can remove themselves, or admins can remove others
    const isSelfRemoval = member.userId === requestUserId;
    const isOrgOwner = member.workspace.organization.ownerId === requestUserId;
    const isOrgAdmin = requesterOrgMember?.role === OrganizationRole.OWNER;
    const isWorkspaceAdmin =
      requesterWorkspaceMember?.role === WorkspaceRole.OWNER ||
      requesterWorkspaceMember?.role === WorkspaceRole.MANAGER;

    if (!isSelfRemoval && !isOrgOwner && !isOrgAdmin && !isWorkspaceAdmin) {
      throw new ForbiddenException('You can only remove yourself or you must be an admin');
    }

    // Use transaction to remove member from workspace and all related projects
    await this.prisma.$transaction(async (prisma) => {
      // Get all projects in this workspace
      const projects = await prisma.project.findMany({
        where: { workspaceId: member.workspaceId },
        select: { id: true },
      });

      const projectIds = projects.map((p) => p.id);

      // Remove from all project memberships in this workspace
      await prisma.projectMember.deleteMany({
        where: {
          userId: member.userId,
          projectId: { in: projectIds },
        },
      });

      // Finally, remove the workspace membership
      await prisma.workspaceMember.delete({
        where: { id },
      });
    });
  }

  getUserWorkspaces(userId: string): Promise<WorkspaceMember[]> {
    return this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                members: true,
                projects: true,
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

  async getWorkspaceStats(workspaceId: string): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const [totalMembers, roleStats, recentJoins] = await Promise.all([
      // Total members count
      this.prisma.workspaceMember.count({
        where: { workspaceId },
      }),

      // Members by role
      this.prisma.workspaceMember.groupBy({
        by: ['role'],
        where: { workspaceId },
        _count: { role: true },
      }),

      // Recent joins (last 30 days)
      this.prisma.workspaceMember.count({
        where: {
          workspaceId,
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
