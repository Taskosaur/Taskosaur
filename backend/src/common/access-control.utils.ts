// access-control.utils.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AccessResult {
  isElevated: boolean;
  role: Role;
  canChange: boolean;
  userId: string;
  scopeId: string;
  scopeType: 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT' | 'TASK';
  isSuperAdmin: boolean;
}

@Injectable()
export class AccessControlService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if user is SUPER_ADMIN by looking up in database
   */
  private async checkSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'SUPER_ADMIN';
  }

  /**
   * Generic access checker that routes to appropriate method based on scope
   */
  async getResourceAccess(
    scope: 'organization' | 'workspace' | 'project' | 'task',
    resourceId: string,
    userId: string,
  ): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN first
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      const scopeType = scope.toUpperCase() as 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT' | 'TASK';
      return this.createSuperAdminAccess(userId, resourceId, scopeType);
    }

    // Validate scope
    const validScopes = ['organization', 'workspace', 'project', 'task'];
    if (!validScopes.includes(scope)) {
      throw new BadRequestException(
        `Invalid scope: ${scope}. Must be one of: ${validScopes.join(', ')}`,
      );
    }

    switch (scope) {
      case 'organization':
        return this.getOrgAccess(resourceId, userId);
      case 'workspace':
        return this.getWorkspaceAccess(resourceId, userId);
      case 'project':
        return this.getProjectAccess(resourceId, userId);
      case 'task':
        return this.getTaskAccess(resourceId, userId);
      default:
        throw new BadRequestException(`Unsupported scope: ${String(scope)}`);
    }
  }

  /**
   * Create SUPER_ADMIN access result (bypasses all checks)
   */
  private createSuperAdminAccess(
    userId: string,
    scopeId: string,
    scopeType: 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT' | 'TASK',
  ): AccessResult {
    return {
      isElevated: true,
      role: 'SUPER_ADMIN',
      canChange: true,
      userId,
      scopeId,
      scopeType,
      isSuperAdmin: true,
    };
  }

  /**
   * Get organization access for a user
   */
  async getOrgAccess(orgId: string, userId: string): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      return this.createSuperAdminAccess(userId, orgId, 'ORGANIZATION');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    if (org.ownerId === userId) {
      return {
        isElevated: true,
        role: Role.OWNER,
        canChange: true,
        userId,
        scopeId: orgId,
        scopeType: 'ORGANIZATION',
        isSuperAdmin: false,
      };
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    if (!member) throw new ForbiddenException('Not a member of this organization');

    const isElevated = member.role === Role.MANAGER || member.role === Role.OWNER;
    const canChange = member.role === Role.MANAGER || member.role === Role.OWNER;

    return {
      isElevated,
      role: member.role,
      canChange,
      userId,
      scopeId: orgId,
      scopeType: 'ORGANIZATION',
      isSuperAdmin: false,
    };
  }

  /**
   * Get workspace access for a user
   */
  async getWorkspaceAccess(workspaceId: string, userId: string): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      return this.createSuperAdminAccess(userId, workspaceId, 'WORKSPACE');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        organization: { select: { ownerId: true } },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    if (!wsMember) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const effectiveRole = wsMember?.role || Role.VIEWER;
    const isElevated = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;
    const canChange = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;

    return {
      isElevated,
      role: effectiveRole,
      canChange,
      userId,
      scopeId: workspaceId,
      scopeType: 'WORKSPACE',
      isSuperAdmin: false,
    };
  }

  /**
   * Get project access for a user
   */
  async getProjectAccess(projectId: string, userId: string): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      return this.createSuperAdminAccess(userId, projectId, 'PROJECT');
    }

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

    if (!project) throw new NotFoundException('Project not found');

    // Handle PUBLIC visibility (anyone authenticated gets read access)
    if (project.visibility === 'PUBLIC') {
      // Check if user has explicit project membership for write access
      const projectMember = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { role: true },
      });
      if (projectMember) {
        const isElevated = projectMember.role === Role.MANAGER || projectMember.role === Role.OWNER;
        return {
          isElevated,
          role: projectMember.role,
          canChange: isElevated,
          userId,
          scopeId: projectId,
          scopeType: 'PROJECT',
          isSuperAdmin: false,
        };
      }
      // Grant read-only access to public projects
      return {
        isElevated: false,
        role: Role.VIEWER,
        canChange: false,
        userId,
        scopeId: projectId,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }
    // Check project membership (PRIVATE projects)
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { role: true },
    });

    if (!projectMember) {
      throw new ForbiddenException('Not a member of this project');
    }

    const effectiveRole = projectMember?.role || Role.VIEWER;
    const isElevated = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;
    const canChange = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;

    return {
      isElevated,
      role: effectiveRole,
      canChange,
      userId,
      scopeId: projectId,
      scopeType: 'PROJECT',
      isSuperAdmin: false,
    };
  }

  /**
   * Get task access for a user
   */
  async getTaskAccess(taskId: string, userId: string): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      return this.createSuperAdminAccess(userId, taskId, 'TASK');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        createdBy: true,
        projectId: true,
        project: {
          select: {
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

    if (!task) throw new NotFoundException('Task not found');

    const { projectId, project } = task;
    const { workspaceId, workspace } = project;
    const { organizationId, organization } = workspace;

    // Organization owner bypass
    if (organization.ownerId === userId) {
      return {
        isElevated: true,
        role: Role.OWNER,
        canChange: true,
        userId,
        scopeId: taskId,
        scopeType: 'TASK',
        isSuperAdmin: false,
      };
    }

    // Check organization membership first (highest priority)
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });

    if (orgMember && (orgMember.role === Role.MANAGER || orgMember.role === Role.OWNER)) {
      return {
        isElevated: true,
        role: orgMember.role,
        canChange: true,
        userId,
        scopeId: taskId,
        scopeType: 'TASK',
        isSuperAdmin: false,
      };
    }

    // Check workspace membership
    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    if (wsMember && (wsMember.role === Role.MANAGER || wsMember.role === Role.OWNER)) {
      return {
        isElevated: true,
        role: wsMember.role,
        canChange: true,
        userId,
        scopeId: taskId,
        scopeType: 'TASK',
        isSuperAdmin: false,
      };
    }

    // Check project membership
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { role: true },
    });

    if (!projectMember && !wsMember && !orgMember) {
      throw new ForbiddenException("Not a member of this task's project");
    }

    const effectiveRole = projectMember?.role || wsMember?.role || orgMember?.role || Role.VIEWER;
    const isElevated =
      effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER || task.createdBy === userId;
    const canChange =
      effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER || task.createdBy === userId;

    return {
      isElevated,
      role: effectiveRole,
      canChange,
      userId,
      scopeId: taskId,
      scopeType: 'TASK',
      isSuperAdmin: false,
    };
  }

  /**
   * Get project access by slug
   */
  async getProjectAccessBySlug(slug: string, userId: string): Promise<AccessResult> {
    // Check if user is SUPER_ADMIN
    const isSuperAdmin = await this.checkSuperAdmin(userId);
    if (isSuperAdmin) {
      return this.createSuperAdminAccess(userId, slug, 'PROJECT');
    }

    const project = await this.prisma.project.findUnique({
      where: { slug: slug },
      select: {
        id: true,
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

    if (!project) throw new NotFoundException('Project not found');

    // Organization owner bypass
    if (project.workspace.organization.ownerId === userId) {
      return {
        isElevated: true,
        role: Role.OWNER,
        canChange: true,
        userId,
        scopeId: slug,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }

    // Check organization membership first (highest priority)
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: project.workspace.organizationId,
        },
      },
      select: { role: true },
    });

    if (orgMember && (orgMember.role === Role.MANAGER || orgMember.role === Role.OWNER)) {
      return {
        isElevated: true,
        role: orgMember.role,
        canChange: true,
        userId,
        scopeId: slug,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }

    // Check workspace membership
    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
      select: { role: true },
    });

    if (wsMember && (wsMember.role === Role.MANAGER || wsMember.role === Role.OWNER)) {
      return {
        isElevated: true,
        role: wsMember.role,
        canChange: true,
        userId,
        scopeId: slug,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }

    // Handle INTERNAL visibility (workspace members get read access)
    if (project.visibility === 'INTERNAL' && wsMember) {
      return {
        isElevated: false,
        role: wsMember.role,
        canChange: false, // Read-only for workspace members
        userId,
        scopeId: slug,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }

    // Handle PUBLIC visibility (anyone authenticated gets read access)
    if (project.visibility === 'PUBLIC') {
      // Check if user has explicit project membership for write access
      const projectMember = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: project.id } },
        select: { role: true },
      });

      if (projectMember) {
        const isElevated = projectMember.role === Role.MANAGER || projectMember.role === Role.OWNER;
        return {
          isElevated,
          role: projectMember.role,
          canChange: isElevated,
          userId,
          scopeId: slug,
          scopeType: 'PROJECT',
          isSuperAdmin: false,
        };
      }

      // Grant read-only access to public projects
      return {
        isElevated: false,
        role: Role.VIEWER,
        canChange: false,
        userId,
        scopeId: slug,
        scopeType: 'PROJECT',
        isSuperAdmin: false,
      };
    }

    // Check project membership (PRIVATE projects)
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: project.id } },
      select: { role: true },
    });

    if (!projectMember && !wsMember && !orgMember) {
      throw new ForbiddenException('Not a member of this project');
    }

    const effectiveRole = projectMember?.role || wsMember?.role || orgMember?.role || Role.VIEWER;
    const isElevated = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;
    const canChange = effectiveRole === Role.MANAGER || effectiveRole === Role.OWNER;

    return {
      isElevated,
      role: effectiveRole,
      canChange,
      userId,
      scopeId: slug,
      scopeType: 'PROJECT',
      isSuperAdmin: false,
    };
  }
}
