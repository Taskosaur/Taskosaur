// src/modules/invitations/invitations.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createInvitation(dto: CreateInvitationDto, inviterId: string) {
    const targetCount = [
      dto.organizationId,
      dto.workspaceId,
      dto.projectId,
    ].filter(Boolean).length;

    if (targetCount !== 1) {
      throw new BadRequestException(
        'Must specify exactly one of: organizationId, workspaceId, or projectId',
      );
    }
    let owningOrgId: string;
    if (dto.organizationId) {
      owningOrgId = dto.organizationId;
    } else if (dto.workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: dto.workspaceId },
        select: { organizationId: true },
      });
      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }
      owningOrgId = workspace.organizationId;
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { workspace: { select: { organizationId: true } } },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      owningOrgId = project.workspace.organizationId;
    }
    if (dto.workspaceId || dto.projectId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: owningOrgId,
          user: { email: dto.inviteeEmail },
        },
      });
      if (!membership) {
        throw new ForbiddenException(
          'User Email does not belong to this organization',
        );
      }
    }
    await this.checkExistingMembership(dto);

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        inviteeEmail: dto.inviteeEmail,
        organizationId: dto.organizationId ?? null,
        workspaceId: dto.workspaceId ?? null,
        projectId: dto.projectId ?? null,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('Invitation already exists for this email');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        inviterId,
        inviteeEmail: dto.inviteeEmail,
        organizationId: dto.organizationId ?? null,
        workspaceId: dto.workspaceId ?? null,
        projectId: dto.projectId ?? null,
        role: dto.role,
        token,
        expiresAt,
      },
      include: {
        inviter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        workspace: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.sendInvitationEmail(invitation);
    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
        workspace: true,
        project: {
          include: {
            workspace: true, // Include workspace info for project invitations
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been processed');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Get user email to verify
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email !== invitation.inviteeEmail) {
      throw new BadRequestException(
        'Invitation email does not match user email',
      );
    }

    // Use transaction to ensure data consistency
    await this.prisma.$transaction(async (prisma) => {
      if (invitation.organizationId) {
        const existingOrgMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: invitation.organizationId,
          },
        });

        if (!existingOrgMember) {
          await prisma.organizationMember.create({
            data: {
              userId,
              organizationId: invitation.organizationId,
              role: invitation.role as any,
              createdBy: invitation.inviterId,
            },
          });
        }
      } else if (invitation.workspaceId) {
        const existingWorkspaceMember = await prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        });

        if (!existingWorkspaceMember) {
          await prisma.workspaceMember.create({
            data: {
              userId,
              workspaceId: invitation.workspaceId,
              role: invitation.role as any,
              createdBy: invitation.inviterId,
            },
          });
        }
      } else if (invitation.projectId && invitation.project) {
        const existingProjectMember = await prisma.projectMember.findFirst({
          where: {
            userId,
            projectId: invitation.projectId,
          },
        });

        if (!existingProjectMember) {
          await prisma.projectMember.create({
            data: {
              userId,
              projectId: invitation.projectId,
              role: invitation.role as any,
              createdBy: invitation.inviterId,
            },
          });
        }
        const workspaceId = invitation.project.workspace.id;
        const existingWorkspaceMember = await prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: workspaceId,
          },
        });

        if (!existingWorkspaceMember) {
          const workspaceRole = this.getWorkspaceRoleFromProjectRole(
            invitation.role,
          );

          await prisma.workspaceMember.create({
            data: {
              userId,
              workspaceId: workspaceId,
              role: workspaceRole as any,
              createdBy: invitation.inviterId,
            },
          });
        }
      }

      // Update invitation status
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
        },
      });
    });

    return {
      message: 'Invitation accepted successfully',
      invitation: {
        id: invitation.id,
        entityType: invitation.organizationId
          ? 'organization'
          : invitation.workspaceId
            ? 'workspace'
            : 'project',
        entityName:
          invitation.organization?.name ||
          invitation.workspace?.name ||
          invitation.project?.name,
      },
    };
  }
  private getWorkspaceRoleFromProjectRole(projectRole: string): string {
    switch (projectRole.toUpperCase()) {
      case 'ADMIN':
        return 'ADMIN';
      case 'MANAGER':
        return 'MANAGER';
      case 'DEVELOPER':
      case 'MEMBER':
        return 'MEMBER';
      case 'VIEWER':
        return 'VIEWER';
      default:
        return 'MEMBER';
    }
  }

  async declineInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation has already been processed');
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
    });

    return { message: 'Invitation declined successfully' };
  }

  async getUserInvitations(email: string) {
    return this.prisma.invitation.findMany({
      where: {
        inviteeEmail: email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      orderBy: { createdAt: 'desc' },
    });
  }

  private async checkExistingMembership(dto: CreateInvitationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.inviteeEmail },
    });

    if (!user) {
      return; // User doesn't exist yet, can't be a member
    }

    if (dto.organizationId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: dto.organizationId,
          },
        },
      });
      if (member) {
        throw new BadRequestException(
          'User is already a member of this organization',
        );
      }
    }

    if (dto.workspaceId) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: user.id, workspaceId: dto.workspaceId },
        },
      });
      if (member) {
        throw new BadRequestException(
          'User is already a member of this workspace',
        );
      }
    }

    if (dto.projectId) {
      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: user.id, projectId: dto.projectId },
        },
      });
      if (member) {
        throw new BadRequestException(
          'User is already a member of this project',
        );
      }
    }
  }

  private async sendInvitationEmail(invitation: any) {
    const inviterName = `${invitation.inviter.firstName} ${invitation.inviter.lastName}`;
    let entityName = '';
    let entityType = '';

    if (invitation.organization) {
      entityName = invitation.organization.name;
      entityType = 'organization';
    } else if (invitation.workspace) {
      entityName = invitation.workspace.name;
      entityType = 'workspace';
    } else if (invitation.project) {
      entityName = invitation.project.name;
      entityType = 'project';
    }

    const invitationUrl = `${process.env.FRONTEND_URL}/invite?token=${invitation.token}`;

    await this.emailService.sendInvitationEmail(invitation.inviteeEmail, {
      inviterName,
      entityName,
      entityType,
      role: invitation.role,
      invitationUrl,
      expiresAt: invitation.expiresAt.toLocaleDateString(),
    });
  }
  // src/modules/invitations/invitations.service.ts

  async verifyInvitation(token: string) {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { token },
        include: {
          inviter: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      // Check if invitation is expired
      const now = new Date();
      const isExpired = invitation.expiresAt < now;

      // Check if invitation is still pending
      const isValid = invitation.status === 'PENDING' && !isExpired;
      const inviteeExists =
        (await this.prisma.user.findUnique({
          where: { email: invitation.inviteeEmail },
        })) !== null;
      let entityName = 'Unknown';
      let entityType = 'unknown';

      if (invitation.organization) {
        entityName = invitation.organization.name;
        entityType = 'organization';
      } else if (invitation.workspace) {
        entityName = invitation.workspace.name;
        entityType = 'workspace';
      } else if (invitation.project) {
        entityName = invitation.project.name;
        entityType = 'project';
      }

      return {
        success: true,
        message: isValid
          ? `Valid invitation to join ${entityName}`
          : isExpired
            ? 'Invitation has expired'
            : `Invitation is ${invitation.status.toLowerCase()}`,
        invitation: {
          id: invitation.id,
          email: invitation.inviteeEmail,
          entityType,
          entityName,
          role: invitation.role,
          status: invitation.status,
          invitedBy:
            invitation.inviter?.firstName && invitation.inviter?.lastName
              ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
              : invitation.inviter?.username || 'Unknown',
          invitedAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
          inviter: invitation.inviter,
          organization: invitation.organization,
          workspace: invitation.workspace,
          project: invitation.project,
        },
        isValid,
        isExpired,
        canRespond: isValid,
        inviteeExists,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Verify invitation error:', error);
      throw new BadRequestException('Failed to verify invitation');
    }
  }
}
