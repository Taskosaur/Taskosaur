import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EmailService } from '../email/email.service';
import { Role, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly emailService: EmailService,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [
      totalUsers,
      totalOrganizations,
      totalWorkspaces,
      totalProjects,
      totalTasks,
      newUsersThisWeek,
      newOrgsThisWeek,
      newProjectsThisWeek,
      newTasksThisWeek,
      activeUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.workspace.count(),
      this.prisma.project.count(),
      this.prisma.task.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.organization.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.project.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.task.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    ]);

    return {
      totalUsers,
      totalOrganizations,
      totalWorkspaces,
      totalProjects,
      totalTasks,
      newUsersThisWeek,
      newOrgsThisWeek,
      newProjectsThisWeek,
      newTasksThisWeek,
      activeUsers,
    };
  }

  async getUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: UserStatus,
    role?: Role,
  ) {
    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (role) where.role = role;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: { organizationMembers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        timezone: true,
        language: true,
        role: true,
        status: true,
        lastLoginAt: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        source: true,
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: { select: { members: true, workspaces: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserRole(id: string, role: Role, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Prevent demoting the last SUPER_ADMIN
    if (user.role === Role.SUPER_ADMIN && role !== Role.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new ForbiddenException('Cannot demote the last super admin');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  async updateUserStatus(id: string, status: UserStatus, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot change your own status');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = { status };

    // Revoke tokens when deactivating so user can't continue using existing sessions
    if (status === UserStatus.INACTIVE || status === UserStatus.SUSPENDED) {
      data.refreshToken = null;
      data.resetToken = null;
      data.resetTokenExpiry = null;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        ownedOrganizations: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Prevent deleting the last super admin
    if (user.role === Role.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last super admin');
      }
    }

    // Prevent deleting users who own organizations — transfer ownership first
    if (user.ownedOrganizations.length > 0) {
      const orgNames = user.ownedOrganizations.map((o) => o.name).join(', ');
      throw new ForbiddenException(
        `Cannot delete user who owns organizations: ${orgNames}. Transfer ownership first.`,
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUserId,
        password: null,
        refreshToken: null,
        resetToken: null,
        resetTokenExpiry: null,
        defaultOrganizationId: null,
      },
    });

    // Remove from all organization/workspace/project memberships
    await Promise.all([
      this.prisma.organizationMember.deleteMany({ where: { userId: id } }),
      this.prisma.workspaceMember.deleteMany({ where: { userId: id } }),
      this.prisma.projectMember.deleteMany({ where: { userId: id } }),
    ]);

    return {
      success: true,
      message: `User "${user.firstName} ${user.lastName}" (${user.email}) has been deleted.`,
    };
  }

  async resetUserPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Generate a reset token, store the hash, email the plain token to the user
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const hashedResetToken = await bcrypt.hash(resetToken, 10);

    await this.prisma.user.update({
      where: { id },
      data: { resetToken: hashedResetToken, resetTokenExpiry },
    });

    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(user.email, {
      userName: user.firstName,
      resetToken: resetToken, // Pass the plain token (not hashed)
      resetUrl: resetUrl,
    });

    return {
      success: true,
      resetLink: `/reset-password?token=${resetToken}`,
      message: `Password reset email sent to ${user.email}. Valid for 24 hours.`,
    };
  }

  async getOrganizations(page: number = 1, limit: number = 20, search?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          archive: true,
          createdAt: true,
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: { members: true, workspaces: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrganizationDetail(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        members: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { projects: true, members: true } },
          },
        },
        _count: {
          select: { members: true, workspaces: true },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async deleteOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // Clear defaultOrganizationId for users who have this as their default
    await this.prisma.user.updateMany({
      where: { defaultOrganizationId: id },
      data: { defaultOrganizationId: null },
    });

    // Clear global default_organization_id setting if it points to this org
    const defaultOrgSetting = await this.settingsService.get('default_organization_id');
    if (defaultOrgSetting === id) {
      await this.settingsService.set(
        'default_organization_id',
        '',
        undefined,
        undefined,
        'registration',
      );
    }

    // Delete the organization (cascade will handle members, workspaces, etc.)
    await this.prisma.organization.delete({ where: { id } });

    return { success: true, message: `Organization "${org.name}" deleted` };
  }

  async toggleOrganizationArchive(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, archive: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { archive: !org.archive },
      select: { id: true, name: true, archive: true },
    });

    return updated;
  }

  async transferOrganizationOwnership(orgId: string, newOwnerId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (org.ownerId === newOwnerId) {
      throw new ForbiddenException('User is already the owner of this organization');
    }

    const newOwner = await this.prisma.user.findUnique({
      where: { id: newOwnerId },
      select: { id: true },
    });
    if (!newOwner) throw new NotFoundException('New owner user not found');

    // Ensure the new owner is a member, promote to OWNER
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: newOwnerId, organizationId: orgId } },
    });

    return this.prisma.$transaction(async (tx) => {
      // If not a member, add them as OWNER
      if (!membership) {
        await tx.organizationMember.create({
          data: {
            userId: newOwnerId,
            organizationId: orgId,
            role: 'OWNER',
            createdBy: newOwnerId,
            updatedBy: newOwnerId,
          },
        });
      } else if (membership.role !== 'OWNER') {
        // Promote to OWNER if not already
        await tx.organizationMember.update({
          where: { id: membership.id },
          data: { role: 'OWNER' },
        });
      }

      // Demote previous owner to MANAGER (keep them as member)
      if (org.ownerId !== newOwnerId) {
        const prevOwnerMembership = await tx.organizationMember.findUnique({
          where: { userId_organizationId: { userId: org.ownerId, organizationId: orgId } },
        });
        if (prevOwnerMembership && prevOwnerMembership.role === 'OWNER') {
          await tx.organizationMember.update({
            where: { id: prevOwnerMembership.id },
            data: { role: 'MANAGER' },
          });
        }
      }

      // Transfer ownership
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { ownerId: newOwnerId },
        select: {
          id: true,
          name: true,
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Returns SMTP config with source info (env vs db) for the admin config page.
   * Env var values are returned as readonly; DB values are editable.
   * Passwords are masked.
   */
  async getSmtpConfigWithSource() {
    const fields = [
      { key: 'smtp_host', envKey: 'SMTP_HOST' },
      { key: 'smtp_port', envKey: 'SMTP_PORT' },
      { key: 'smtp_user', envKey: 'SMTP_USER' },
      { key: 'smtp_pass', envKey: 'SMTP_PASS' },
      { key: 'smtp_from', envKey: 'SMTP_FROM' },
    ];

    const result: Array<{
      key: string;
      value: string;
      source: 'env' | 'db' | 'none';
      readonly: boolean;
    }> = [];

    for (const field of fields) {
      const dbValue = await this.settingsService.get(field.key);
      const envValue = this.configService.get<string>(field.envKey);

      if (envValue) {
        // Env var is set — show it as readonly
        result.push({
          key: field.key,
          value: field.key === 'smtp_pass' ? '••••••••' : envValue,
          source: 'env',
          readonly: true,
        });
      } else if (dbValue) {
        // DB value exists — editable
        result.push({
          key: field.key,
          value: field.key === 'smtp_pass' ? '••••••••' : dbValue,
          source: 'db',
          readonly: false,
        });
      } else {
        result.push({
          key: field.key,
          value: '',
          source: 'none',
          readonly: false,
        });
      }
    }

    return result;
  }

  /**
   * Test SMTP configuration by verifying server connection and authentication
   */
  async testSmtpConfig(): Promise<{ success: boolean; message: string }> {
    const getSmtpValue = async (key: string, envKey: string, fallback = ''): Promise<string> => {
      return (
        this.configService.get<string>(envKey) || (await this.settingsService.get(key)) || fallback
      );
    };

    const smtpHost = await getSmtpValue('smtp_host', 'SMTP_HOST');
    const smtpPort = Number(await getSmtpValue('smtp_port', 'SMTP_PORT', '587'));
    const smtpUser = await getSmtpValue('smtp_user', 'SMTP_USER');
    const smtpPass = await getSmtpValue('smtp_pass', 'SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new BadRequestException(
        'SMTP configuration is incomplete. Please set host, username, and password.',
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: this.configService.get('NODE_ENV') !== 'development',
        },
      });

      await transporter.verify();
      transporter.close();

      return {
        success: true,
        message: `SMTP connection to ${smtpHost}:${smtpPort} verified successfully`,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`SMTP test failed: ${msg}`);
    }
  }
}
