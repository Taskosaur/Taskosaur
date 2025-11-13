import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationMember, Role as OrganizationRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateOrganizationMemberDto,
  InviteOrganizationMemberDto,
} from './dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';
import { WorkspaceMembersService } from '../workspace-members/workspace-members.service';

@Injectable()
export class OrganizationMembersService {
  constructor(
    private prisma: PrismaService,
    private workspaceMembersService: WorkspaceMembersService,
  ) {}

  async create(
    createOrganizationMemberDto: CreateOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    const { userId, organizationId, role = OrganizationRole.MEMBER } = createOrganizationMemberDto;

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const orgMember = await this.prisma.organizationMember.create({
        data: {
          userId,
          organizationId,
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
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
      });
      if (orgMember.role === 'MANAGER' || orgMember.role === 'OWNER') {
        const workspaces = await this.prisma.workspace.findMany({
          where: { organizationId },
        });

        const role = orgMember.role;
        const userId = orgMember.userId;

        if (workspaces.length > 0) {
          await Promise.all(
            workspaces.map(async (workspace) => {
              await this.workspaceMembersService.create({
                userId,
                role,
                workspaceId: workspace.id,
              });
            }),
          );
        }
      }
      return orgMember;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this organization');
      }
      throw error;
    }
  }

  async inviteByEmail(
    inviteOrganizationMemberDto: InviteOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    const { email, organizationId, role = OrganizationRole.MEMBER } = inviteOrganizationMemberDto;

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
      organizationId,
      role,
    });
  }

  findAll(organizationId?: string, search?: string): Promise<OrganizationMember[]> {
    const whereClause: any = {};

    if (organizationId) {
      whereClause.organizationId = organizationId;
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

    return this.prisma.organizationMember.findMany({
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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // Admins first
        { joinedAt: 'asc' },
      ],
    });
  }
  async findAllByOrgSlug(
    slug?: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{
    data: OrganizationMember[];
    total: number;
    page?: number;
    limit?: number;
    roleCounts: {
      OWNER: number;
      MANAGER: number;
      MEMBER: number;
      VIEWER: number;
    };
  }> {
    const isPaginated = !!(page && limit);

    // Build search conditions
    const searchCondition = search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { username: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    // Combine base where clause with search
    const whereClause: any = {
      organization: { slug },
      ...searchCondition,
    };

    // Get role counts - Use a simpler where clause without nested relations
    const baseWhereClause = {
      organization: { slug },
    };

    // Get role counts using groupBy with simple where clause
    const roleCounts = await this.prisma.organizationMember.groupBy({
      by: ['role'],
      where: baseWhereClause, // Use base clause without search
      _count: {
        role: true,
      },
    });

    // Transform role counts into object with all roles
    const roleCountsMap = {
      OWNER: 0,
      MANAGER: 0,
      MEMBER: 0,
      VIEWER: 0,
    };

    roleCounts.forEach((item) => {
      if (item.role in roleCountsMap) {
        roleCountsMap[item.role as keyof typeof roleCountsMap] = item._count.role;
      }
    });

    if (!isPaginated) {
      // Return all results if pagination not provided
      const data = await this.prisma.organizationMember.findMany({
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
              username: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });

      return { data, total: data.length, roleCounts: roleCountsMap };
    }

    // Pagination case
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
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
              username: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.organizationMember.count({
        where: whereClause,
      }),
    ]);

    return { data, total, page, limit, roleCounts: roleCountsMap };
  }

  async findOne(id: string): Promise<OrganizationMember> {
    const member = await this.prisma.organizationMember.findUnique({
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
            emailVerified: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            website: true,
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
    });

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    return member;
  }

  findByUserAndOrganization(userId: string, organizationId: string) {
    return this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
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
        organization: {
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
    updateOrganizationMemberDto: UpdateOrganizationMemberDto,
    requestUserId: string,
  ): Promise<OrganizationMember> {
    // Get current member info
    const member = await this.prisma.organizationMember.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    // Check if requester has permission to update
    const requesterMember = await this.findByUserAndOrganization(
      requestUserId,
      member.organizationId,
    );

    if (!requesterMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Only organization owner or admins can update member roles
    const isOwner = member.organization.ownerId === requestUserId;
    const isAdmin =
      requesterMember.role === OrganizationRole.OWNER ||
      requesterMember.role === OrganizationRole.MANAGER;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only organization owners and admins can update member roles');
    }

    // Prevent demoting the organization owner
    if (
      member.organization.ownerId === member.userId &&
      updateOrganizationMemberDto.role !== OrganizationRole.OWNER
    ) {
      throw new BadRequestException('Cannot change the role of organization owner');
    }

    const updatedMember = await this.prisma.organizationMember.update({
      where: { id },
      data: updateOrganizationMemberDto,
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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
          },
        },
      },
    });
    const organizationId = updatedMember.organizationId;
    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId },
    });

    const role = updatedMember.role;
    const userId = updatedMember.userId;
    if (workspaces.length > 0) {
      await Promise.all(
        workspaces.map(async (workspace) => {
          const wsMember = await this.prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: { userId, workspaceId: workspace.id },
            },
          });
          if (wsMember) {
            await this.workspaceMembersService.update(
              wsMember.id,
              {
                role,
              },
              requestUserId,
            );
          }
        }),
      );
    }
    return updatedMember;
  }

  async remove(id: string, requestUserId: string): Promise<void> {
    // Get current member info
    const member = await this.prisma.organizationMember.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    // Check if requester has permission to remove
    const requesterMember = await this.findByUserAndOrganization(
      requestUserId,
      member.organizationId,
    );

    if (!requesterMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Users can remove themselves, or admins/owners can remove others
    const isSelfRemoval = member.userId === requestUserId;
    const isOwner = member.organization.ownerId === requestUserId;
    const isAdmin =
      requesterMember.role === OrganizationRole.OWNER ||
      requesterMember.role === OrganizationRole.MANAGER;

    if (!isSelfRemoval && !isOwner && !isAdmin) {
      throw new ForbiddenException('You can only remove yourself or you must be an admin/owner');
    }

    // Prevent removing the organization owner
    if (member.organization.ownerId === member.userId) {
      throw new BadRequestException('Cannot remove organization owner from organization');
    }

    // Use transaction to remove member from organization and all related workspaces/projects
    await this.prisma.$transaction(async (prisma) => {
      // Get all workspaces in this organization
      const workspaces = await prisma.workspace.findMany({
        where: { organizationId: member.organizationId },
        select: { id: true },
      });

      const workspaceIds = workspaces.map((w) => w.id);

      // Remove from all workspace memberships in this organization
      await prisma.workspaceMember.deleteMany({
        where: {
          userId: member.userId,
          workspaceId: { in: workspaceIds },
        },
      });

      // Get all projects in these workspaces
      const projects = await prisma.project.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true },
      });

      const projectIds = projects.map((p) => p.id);

      // Remove from all project memberships in this organization
      await prisma.projectMember.deleteMany({
        where: {
          userId: member.userId,
          projectId: { in: projectIds },
        },
      });

      // Finally, remove the organization membership
      await prisma.organizationMember.delete({
        where: { id },
      });
    });
  }

  async getUserOrganizations(userId: string) {
    // 1. Get the user role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    type OrgType = {
      id: string;
      name: string;
      slug: string;
      ownerId: string;
      description: string | null;
      avatar: string | null;
      website: string | null;
      _count: { members: number; workspaces: number };
      createdAt: Date;
      members: Array<{ role: string; joinedAt: Date; isDefault: boolean }>;
    };

    let organizations: OrgType[];

    // 2. If SUPER_ADMIN → fetch all organizations
    if (user?.role === 'SUPER_ADMIN') {
      organizations = await this.prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          avatar: true,
          website: true,
          ownerId: true,
          createdAt: true,
          _count: {
            select: {
              members: true,
              workspaces: true,
            },
          },
          members: {
            where: { userId },
            select: {
              id: true,
              role: true,
              joinedAt: true,
              isDefault: true,
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // 3. Normal users → only organizations they own or belong to
      organizations = await this.prisma.organization.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          avatar: true,
          website: true,
          ownerId: true,
          createdAt: true,

          _count: {
            select: {
              members: true,
              workspaces: true,
            },
          },
          members: {
            where: { userId },
            select: {
              id: true,
              role: true,
              joinedAt: true,
              isDefault: true,
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // 4. Transform response (SUPER_ADMIN gets role = SUPER_ADMIN)
    return organizations.map((org) => {
      const isOwner = org.ownerId === userId;
      const memberRecord = org.members[0];

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        avatar: org.avatar,
        website: org.website,
        _count: org._count,
        userRole:
          user?.role === 'SUPER_ADMIN'
            ? 'SUPER_ADMIN'
            : isOwner
              ? 'OWNER'
              : memberRecord?.role || 'MEMBER',
        joinedAt: memberRecord?.joinedAt || org.createdAt,
        isOwner,
        isDefault: memberRecord?.isDefault,
      };
    });
  }

  async getOrganizationStats(organizationId: string): Promise<any> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const [totalMembers, roleStats, recentJoins] = await Promise.all([
      // Total members count
      this.prisma.organizationMember.count({
        where: { organizationId },
      }),

      // Members by role
      this.prisma.organizationMember.groupBy({
        by: ['role'],
        where: { organizationId },
        _count: { role: true },
      }),

      // Recent joins (last 30 days)
      this.prisma.organizationMember.count({
        where: {
          organizationId,
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
  async setDefaultOrganizationByOrgAndUser(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember> {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!member) {
      throw new NotFoundException(
        'Organization member not found for the given user and organization',
      );
    }
    const updatedMember = await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
      return tx.organizationMember.update({
        where: { id: member.id },
        data: { isDefault: true },
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
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
      });
    });

    return updatedMember;
  }
}
