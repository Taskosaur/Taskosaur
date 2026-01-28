import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { WorkspaceMember, Role as WorkspaceRole, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkspaceMemberDto,
  InviteWorkspaceMemberDto,
} from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

@Injectable()
export class WorkspaceMembersService {
  constructor(private prisma: PrismaService) {}

  private async checkActorPermissions(
    actorId: string,
    workspaceId: string,
    requiredRole?: Role,
  ): Promise<void> {
    // 1. Check if user is a SUPER_ADMIN
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });

    if (actor?.role === Role.SUPER_ADMIN) {
      return;
    }

    // 2. Get workspace and its organization info
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        organizationId: true,
        organization: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 3. Check if requester is org owner
    if (workspace.organization.ownerId === actorId) {
      return;
    }

    // 4. Check org membership and role
    const requesterOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: actorId,
          organizationId: workspace.organizationId,
        },
      },
    });

    if (requesterOrgMember?.role === Role.OWNER || requesterOrgMember?.role === Role.MANAGER) {
      // Org owners and managers have full access to all workspaces in their org
      return;
    }

    // 5. Check workspace membership and role
    const requesterWorkspaceMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: actorId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!requesterWorkspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (requiredRole) {
      const roles: Role[] = [Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN];
      const actorRoleIndex = roles.indexOf(requesterWorkspaceMember.role);
      const requiredRoleIndex = roles.indexOf(requiredRole);

      if (actorRoleIndex < requiredRoleIndex) {
        throw new ForbiddenException(`${requiredRole} privileges required`);
      }
    }
  }

  async create(
    createWorkspaceMemberDto: CreateWorkspaceMemberDto,
    actorId?: string,
  ): Promise<WorkspaceMember> {
    const { userId, workspaceId, role = WorkspaceRole.MEMBER } = createWorkspaceMemberDto;

    if (actorId) {
      await this.checkActorPermissions(actorId, workspaceId, Role.MANAGER);
    }

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
          createdBy: actorId,
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
              createdBy: actorId,
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
    actorId?: string,
  ): Promise<WorkspaceMember> {
    const { email, workspaceId, role = WorkspaceRole.MEMBER } = inviteWorkspaceMemberDto;

    if (actorId) {
      await this.checkActorPermissions(actorId, workspaceId, Role.MANAGER);
    }

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
        workspaceId,
        role,
      },
      actorId,
    );
  }

  async findAll(
    workspaceId?: string,
    search?: string,
    page?: number,
    limit?: number,
    actorId?: string,
  ): Promise<{
    data: WorkspaceMember[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    if (actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { role: true },
      });

      if (actor?.role !== Role.SUPER_ADMIN) {
        if (!workspaceId) {
          throw new BadRequestException('workspaceId is required for non-super-admins');
        }
        await this.checkActorPermissions(actorId, workspaceId);
      }
    }

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

  async findOne(id: string, actorId?: string): Promise<WorkspaceMember> {
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
                ownerId: true,
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

    if (actorId) {
      await this.checkActorPermissions(actorId, member.workspaceId);
    }

    return member;
  }

  async findByUserAndWorkspace(userId: string, workspaceId: string, actorId?: string) {
    if (actorId) {
      await this.checkActorPermissions(actorId, workspaceId);
    }

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
    actorId: string,
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
    await this.checkActorPermissions(actorId, member.workspaceId, Role.MANAGER);

    if (updateWorkspaceMemberDto.role === 'OWNER') {
      // Double check if requester has OWNER role if they are trying to promote someone to OWNER
      await this.checkActorPermissions(actorId, member.workspaceId, Role.OWNER);
    }

    // Update workspace member and handle project members in a transaction
    const updatedMember = await this.prisma.$transaction(async (tx) => {
      // Update the workspace member
      const updated = await tx.workspaceMember.update({
        where: { id },
        data: {
          ...updateWorkspaceMemberDto,
          updatedBy: actorId,
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
              updatedBy: actorId,
            },
            create: {
              userId: userId,
              projectId: project.id,
              role: role, // Create new member with role
              createdBy: actorId,
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

  async remove(id: string, actorId: string): Promise<void> {
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

    // Users can remove themselves, or admins can remove others
    const isSelfRemoval = member.userId === actorId;
    if (!isSelfRemoval) {
      await this.checkActorPermissions(actorId, member.workspaceId, Role.MANAGER);
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

  async getUserWorkspaces(userId: string, actorId?: string): Promise<WorkspaceMember[]> {
    if (actorId && userId !== actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { role: true },
      });
      if (actor?.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('You can only view your own workspaces');
      }
    }

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

  async getWorkspaceStats(workspaceId: string, actorId?: string): Promise<any> {
    if (actorId) {
      await this.checkActorPermissions(actorId, workspaceId);
    }

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
