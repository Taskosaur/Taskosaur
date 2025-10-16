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
import { InvitationStatus, Role, WorkspaceMember } from '@prisma/client';
import { WorkspaceMembersService } from '../workspace-members/workspace-members.service';
import { OrganizationMembersService } from '../organization-members/organization-members.service';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private workspaceMember: WorkspaceMembersService,
    private organizationMember: OrganizationMembersService
  ) { }

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

    await this.checkExistingMembership(dto);

    // Check if user exists and is already an org member
    const user = await this.prisma.user.findUnique({
      where: { email: dto.inviteeEmail },
    });

    // If user exists and is an org member, add them directly for workspace/project invitations
    if (user && (dto.workspaceId || dto.projectId)) {
      const isOrgMember = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: owningOrgId,
          },
        },
      });

      if (isOrgMember) {
        return await this.addExistingOrgMemberDirectly(dto, user.id, inviterId, owningOrgId);
      }
    }

    // Standard invitation flow for non-org members or organization invitations
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

    // Try to send the invitation email, but don't fail the entire operation if email fails
    try {
      await this.sendInvitationEmail(invitation);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Continue execution - the invitation was created successfully
    }

    return invitation;
  }

  /**
   * Add existing organization member directly to workspace or project
   * without sending an invitation
   */
  private async addExistingOrgMemberDirectly(
    dto: CreateInvitationDto,
    userId: string,
    inviterId: string,
    organizationId: string
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        },
      });

      if (!user) {
        throw new NotFoundException('user not found');
      }
      const inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: { firstName: true, lastName: true },
      });

      const inviterName = inviter
        ? `${inviter.firstName} ${inviter.lastName}`.trim()
        : 'A team member';
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      if (dto.workspaceId) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: dto.workspaceId },
          select: { id: true, name: true, slug: true },
        });

        if (!workspace) {
          throw new NotFoundException('Workspace not found');
        }

        const workspaceMember = await this.workspaceMember.create({
          userId,
          workspaceId: workspace.id,
          role: dto.role as Role,
          createdBy: inviterId,
        });
        try {
          await this.emailService.sendDirectAddNotificationEmail(user.email, {
            inviterName,
            entityName: workspace.name,
            entityType: 'workspace',
            role: dto.role,
            entityUrl: `${process.env.FRONTEND_URL}/workspaces/${workspace.slug}`,
            organizationName: organization?.name,
          });
        } catch (error) {
          console.error('Failed to send direct add notification email:', error);
        }

        return {
          type: 'direct_add',
          message: `User ${user.email} was added directly to the workspace as they are already an organization member`,
          member: workspaceMember,
          entity: {
            type: 'workspace',
            ...workspace,
          },
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        };
      } else if (dto.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: dto.projectId },
          include: {
            workspace: {
              select: { id: true, name: true, slug: true },
            },
          },
        });

        if (!project) {
          throw new NotFoundException('Project not found');
        }
        const isWorkspaceMember = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: project.workspaceId,
            },
          },
        });
        if (!isWorkspaceMember) {
          await this.workspaceMember.create({
            userId,
            workspaceId: project.workspaceId,
            role: 'MEMBER',
            createdBy: inviterId,
          });
        }

        // Add to project
        const projectMember = await prisma.projectMember.create({
          data: {
            userId,
            projectId: dto.projectId,
            role: dto.role as any,
            createdBy: inviterId,
          },
        });

        try {
          await this.emailService.sendDirectAddNotificationEmail(user.email, {
            inviterName,
            entityName: project.name,
            entityType: 'project',
            role: dto.role,
            entityUrl: `${process.env.FRONTEND_URL}/projects/${project.slug}`,
            organizationName: organization?.name,
          });
        } catch (error) {
          console.error('Failed to send direct add notification email:', error);
        }

        return {
          type: 'direct_add',
          message: `User ${user.email} was added directly to the project as they are already an organization member`,
          member: projectMember,
          entity: {
            type: 'project',
            id: project.id,
            name: project.name,
            slug: project.slug,
          },
          workspace: project.workspace,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          addedToWorkspace: !isWorkspaceMember,
        };
      }
    });
  }



  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
        workspace: {
          include: {
            organization: true, // Include organization info for workspace invitations
          },
        },
        project: {
          include: {
            workspace: {
              include: {
                organization: true, // Include organization info for project invitations
              },
            },
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
      // Handle organization invitation
      if (invitation.organizationId) {
        const existingOrgMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: invitation.organizationId,
          },
        });

        if (!existingOrgMember) {
          await this.organizationMember.create({
            userId,
            organizationId: invitation.organizationId,
            role: invitation.role as any,
            createdBy: invitation.inviterId
          });
        }
      }
      // Handle workspace invitation - add to organization first, then workspace
      else if (invitation.workspaceId && invitation.workspace) {
        const organizationId = invitation.workspace.organizationId;
        const existingOrgMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: organizationId,
          },
        });

        if (!existingOrgMember) {
          await this.organizationMember.create({
            userId,
            organizationId: organizationId,
            role: "MEMBER",
            createdBy: invitation.inviterId
          });
        }

        // Then add to workspace
        const existingWorkspaceMember = await prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        });

        if (!existingWorkspaceMember) {
          await this.workspaceMember.create(
            {
              userId,
              workspaceId: invitation.workspaceId,
              role: invitation.role as Role,
              createdBy: invitation.inviterId
            })
        }
      }
      // Handle project invitation - add to organization, workspace, then project
      else if (invitation.projectId && invitation.project) {
        // Add to organization first (top level)
        const organizationId = invitation.project.workspace.organizationId;
        const existingOrgMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: organizationId,
          },
        });

        if (!existingOrgMember) {
          await prisma.organizationMember.create({
            data: {
              userId,
              organizationId: organizationId,
              role: "MEMBER",
              createdBy: invitation.inviterId,
            },
          });
        }

        // Then add to workspace (middle level)
        const workspaceId = invitation.project.workspace.id;
        const existingWorkspaceMember = await prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: workspaceId,
          },
        });

        if (!existingWorkspaceMember) {
          await this.workspaceMember.create(
            {
              userId,
              workspaceId: workspaceId,
              role: "MEMBER",
              createdBy: invitation.inviterId
            })
        }

        // Finally add to project (bottom level)
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

  async getEntityInvitations({
    entityType,
    entityId,
  }: {
    entityType: 'organization' | 'workspace' | 'project';
    entityId: string;
  }) {
    const whereClause: any = {
      status: { in: [InvitationStatus.PENDING, InvitationStatus.DECLINED] },
      expiresAt: { gt: new Date() },
    };

    // Dynamically set the entity filter
    if (entityType === 'organization') {
      whereClause.organizationId = entityId;
    } else if (entityType === 'workspace') {
      whereClause.workspaceId = entityId;
    } else if (entityType === 'project') {
      whereClause.projectId = entityId;
    } else {
      throw new Error('Invalid entity type');
    }

    return await this.prisma.invitation.findMany({
      where: whereClause,
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

  async resendInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        inviter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        workspace: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Only allow resending PENDING invitations
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Cannot resend ${invitation.status.toLowerCase()} invitation`);
    }

    // Generate new token and expiration date
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Update invitation with new token and expiration
    const updatedInvitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        inviterId: userId, // Update to current user who is resending
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

    // Try to send the invitation email, but don't fail the entire operation if email fails
    let emailSent = false;
    let emailError = null;

    try {
      await this.sendInvitationEmail(updatedInvitation);
      emailSent = true;
    } catch (error) {
      console.error('Failed to send resend invitation email:', error);
      emailError = error.message;
      // Continue execution - the invitation was updated successfully
    }

    return {
      message: emailSent
        ? 'Invitation resent successfully'
        : 'Invitation updated successfully, but email delivery failed',
      invitation: updatedInvitation,
      emailSent,
      emailError: emailSent ? null : emailError,
    };
  }

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
