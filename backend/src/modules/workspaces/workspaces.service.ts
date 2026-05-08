import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ActivityType, Role, Workspace } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AccessControlService } from 'src/common/access-control.utils';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private accessControl: AccessControlService,
    private settingsService: SettingsService,
    private activityLog: ActivityLogService,
  ) {}

  async create(createWorkspaceDto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    // getOrgAccess throws ForbiddenException if user is not an org member
    const orgAccess = await this.accessControl.getOrgAccess(
      createWorkspaceDto.organizationId,
      userId,
    );

    // Check global setting for workspace creation
    const allowWsCreation = await this.settingsService.get('allow_workspace_creation');
    if (allowWsCreation === 'false') {
      // Only elevated users (OWNER/MANAGER) and SUPER_ADMIN can create when disabled
      if (!orgAccess.isElevated && !orgAccess.isSuperAdmin) {
        throw new ForbiddenException(
          'Workspace creation is restricted. Please contact your organization admin.',
        );
      }
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: createWorkspaceDto.organizationId },
      select: {
        id: true,
        ownerId: true,
        archive: true,
        members: {
          select: { userId: true, role: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.archive) {
      throw new ForbiddenException('Cannot create workspace in an archived organization');
    }
    // Validate parent workspace if provided
    let parentPath = '';
    if (createWorkspaceDto.parentWorkspaceId) {
      const parentWorkspace = await this.prisma.workspace.findUnique({
        where: { id: createWorkspaceDto.parentWorkspaceId },
        select: { id: true, organizationId: true, path: true, archive: true },
      });

      if (!parentWorkspace) {
        throw new NotFoundException('Parent workspace not found');
      }

      if (parentWorkspace.organizationId !== createWorkspaceDto.organizationId) {
        throw new BadRequestException('Parent workspace must belong to the same organization');
      }

      if (parentWorkspace.archive) {
        throw new BadRequestException('Cannot create a child workspace under an archived parent');
      }
      parentPath = parentWorkspace.path || `/${parentWorkspace.id}`;
    }

    // Generate unique slug
    const uniqueSlug = await this.generateUniqueSlug(
      createWorkspaceDto.slug,
      createWorkspaceDto.organizationId,
    );

    try {
      const workspace = await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: createWorkspaceDto.name,
            slug: uniqueSlug,
            description: createWorkspaceDto.description,
            avatar: createWorkspaceDto.avatar,
            color: createWorkspaceDto.color,
            settings: createWorkspaceDto.settings,
            organizationId: createWorkspaceDto.organizationId,
            parentWorkspaceId: createWorkspaceDto.parentWorkspaceId || null,
            path: '',
            createdBy: userId,
            updatedBy: userId,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, avatar: true },
            },
            parentWorkspace: {
              select: { id: true, name: true, slug: true },
            },
            createdByUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            updatedByUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: { select: { members: true, projects: true, childWorkspaces: true } },
          },
        });

        const workspacePath = parentPath ? `${parentPath}/${workspace.id}` : `/${workspace.id}`;

        await tx.workspace.update({
          where: { id: workspace.id },
          data: { path: workspacePath },
        });
        const membersToAdd = new Map<string, Role>();
        membersToAdd.set(userId, Role.OWNER);
        membersToAdd.set(organization.ownerId, Role.OWNER);

        const shouldInherit = createWorkspaceDto.inheritMembers !== false;

        if (shouldInherit) {
          if (createWorkspaceDto.parentWorkspaceId) {
            // Inherit from parent workspace
            const parentWorkspace = await tx.workspace.findUnique({
              where: { id: createWorkspaceDto.parentWorkspaceId },
              select: {
                members: {
                  select: { userId: true, role: true },
                },
              },
            });
            parentWorkspace?.members.forEach((member) => {
              if (!membersToAdd.has(member.userId)) {
                membersToAdd.set(member.userId, member.role);
              }
            });
          } else {
            // Inherit from organization (existing behavior)
            organization.members.forEach((member) => {
              if (!membersToAdd.has(member.userId)) {
                membersToAdd.set(member.userId, member.role);
              }
            });
          }
        }

        await Promise.all(
          Array.from(membersToAdd.entries()).map(([memberId, memberRole]) =>
            tx.workspaceMember.create({
              data: {
                userId: memberId,
                workspaceId: workspace.id,
                role: memberRole,
                createdBy: userId,
                updatedBy: userId,
              },
            }),
          ),
        );

        // Handle label & workflow inheritance from parent workspace
        const inheritanceSettings: Record<string, any> = {};

        if (createWorkspaceDto.parentWorkspaceId) {
          if (createWorkspaceDto.inheritLabels) {
            // Fetch label definitions from parent workspace's used labels
            let parentLabels = await tx.label.findMany({
              where: {
                workspaceLabels: {
                  some: { workspaceId: createWorkspaceDto.parentWorkspaceId },
                },
              },
              select: { id: true, name: true, color: true, description: true },
            });

            // Fallback: If no labels are found via WorkspaceLabel,
            // fetch labels directly from the projects within the parent workspace.
            if (parentLabels.length === 0) {
              parentLabels = await tx.label.findMany({
                where: {
                  project: { workspaceId: createWorkspaceDto.parentWorkspaceId },
                },
                select: { id: true, name: true, color: true, description: true },
              });

              // Backfill the parent workspace with these labels
              if (parentLabels.length > 0) {
                await tx.workspaceLabel.createMany({
                  data: parentLabels.map((l) => ({
                    workspaceId: createWorkspaceDto.parentWorkspaceId!,
                    labelId: l.id,
                  })),
                  skipDuplicates: true,
                });
              }
            }
            if (parentLabels.length > 0) {
              inheritanceSettings.inheritedLabelTemplates = parentLabels.map((l) => ({
                name: l.name,
                color: l.color,
                description: l.description,
              }));

              await tx.workspaceLabel.createMany({
                data: parentLabels.map((l) => ({
                  workspaceId: workspace.id,
                  labelId: l.id,
                })),
                skipDuplicates: true,
              });
            }
          }

          if (createWorkspaceDto.inheritWorkflows) {
            // Fetch workflow IDs used by parent workspace's projects
            const parentProjects = await tx.project.findMany({
              where: { workspaceId: createWorkspaceDto.parentWorkspaceId },
              select: { workflowId: true },
              distinct: ['workflowId'],
            });
            if (parentProjects.length > 0) {
              // Use the first (or most common) workflow as default
              inheritanceSettings.defaultWorkflowId = parentProjects[0].workflowId;
            }
          }
        }

        // Merge inheritance settings into workspace settings if any were collected
        if (Object.keys(inheritanceSettings).length > 0) {
          const currentSettings =
            typeof workspace.settings === 'object' && workspace.settings !== null
              ? (workspace.settings as Record<string, any>)
              : {};
          await tx.workspace.update({
            where: { id: workspace.id },
            data: {
              settings: { ...currentSettings, ...inheritanceSettings },
            },
          });
        }

        return workspace;
      });

      try {
        await this.activityLog.logActivity({
          type: ActivityType.WORKSPACE_CREATED,
          description: `Created workspace "${workspace.name}"`,
          entityType: 'Workspace',
          entityId: workspace.id,
          userId,
          organizationId: createWorkspaceDto.organizationId,
          newValue: {
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
          },
        });
      } catch (error) {
        console.error('Failed to log workspace creation activity:', error);
      }

      return workspace;
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new ConflictException('A workspace with this slug already exists. Please try again.');
      }
      throw error;
    }
  }

  private async generateUniqueSlug(baseSlug: string, organizationId: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.workspace.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
  async findAll(userId: string, organizationId?: string, search?: string): Promise<Workspace[]> {
    let isSuperAdmin = false;
    if (organizationId) {
      const access = await this.accessControl.getOrgAccess(organizationId, userId);
      isSuperAdmin = access.isSuperAdmin;
    }

    const whereClause: any = { archive: false, organizationId };
    if (userId && !isSuperAdmin) {
      whereClause.members = { some: { userId } };
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.workspace.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        parentWorkspace: {
          select: { id: true, name: true, slug: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: {
          select: {
            members: true,
            childWorkspaces: true,
            projects: userId
              ? {
                  where: {
                    archive: false,
                    OR: [
                      { visibility: 'PUBLIC' },
                      { visibility: 'INTERNAL' },
                      { members: { some: { userId } } },
                      {
                        workspace: {
                          members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
                        },
                      },
                      { workspace: { organization: { ownerId: userId } } },
                    ],
                  },
                }
              : true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findWithPagination(
    userId: string,
    organizationId?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    workspaces: Workspace[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    let isSuperAdmin = false;
    if (organizationId) {
      const access = await this.accessControl.getOrgAccess(organizationId, userId);
      isSuperAdmin = access.isSuperAdmin;
    }

    const whereClause: any = { archive: false, organizationId };
    if (userId && !isSuperAdmin) {
      whereClause.members = { some: { userId } };
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.workspace.count({
      where: whereClause,
    });
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const workspaces = await this.prisma.workspace.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: {
          select: {
            members: true,
            projects: userId
              ? {
                  where: {
                    archive: false,
                    OR: [
                      { visibility: 'PUBLIC' },
                      { visibility: 'INTERNAL' },
                      { members: { some: { userId } } },
                      {
                        workspace: {
                          members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
                        },
                      },
                      { workspace: { organization: { ownerId: userId } } },
                    ],
                  },
                }
              : true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      workspaces,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    await this.accessControl.getWorkspaceAccess(id, userId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        parentWorkspace: {
          select: { id: true, name: true, slug: true },
        },
        childWorkspaces: {
          where: { archive: false },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            color: true,
            path: true,
            _count: { select: { members: true, projects: true, childWorkspaces: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        projects: {
          where: {
            archive: false,
            OR: [
              { visibility: 'PUBLIC' },
              { visibility: 'INTERNAL' },
              { members: { some: { userId } } },
              {
                workspace: {
                  members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
                },
              },
              { workspace: { organization: { ownerId: userId } } },
            ],
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatar: true,
            color: true,
            status: true,
            priority: true,
            _count: { select: { tasks: true, members: true } },
          },
        },
        _count: {
          select: {
            members: true,
            childWorkspaces: true,
            projects: {
              where: {
                archive: false,
                OR: [
                  { visibility: 'PUBLIC' },
                  { visibility: 'INTERNAL' },
                  { members: { some: { userId } } },
                  {
                    workspace: {
                      members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
                    },
                  },
                  { workspace: { organization: { ownerId: userId } } },
                ],
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async findBySlug(organizationId: string, slug: string, userId: string): Promise<Workspace> {
    // Check organization access first
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        members: userId
          ? {
              where: { userId },
              select: { role: true },
            }
          : false,
        _count: {
          select: {
            members: true,
            projects: userId
              ? {
                  where: {
                    archive: false,
                    OR: [
                      { visibility: 'PUBLIC' },
                      { visibility: 'INTERNAL' },
                      { members: { some: { userId } } },
                      {
                        workspace: {
                          members: { some: { userId, role: { in: [Role.OWNER, Role.MANAGER] } } },
                        },
                      },
                      { workspace: { organization: { ownerId: userId } } },
                    ],
                  },
                }
              : true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const access = await this.accessControl.getWorkspaceAccess(workspace.id, userId);
    if (!access.isSuperAdmin) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      });
      if (!member) {
        throw new ForbiddenException('Not a member of this workspace');
      }
    }

    return workspace;
  }

  async update(
    id: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
    userId: string,
  ): Promise<Workspace> {
    await this.accessControl.getWorkspaceAccess(id, userId);

    try {
      // Fetch current workspace to get organizationId and current parent info
      const currentWorkspace = await this.prisma.workspace.findUnique({
        where: { id },
        select: { id: true, slug: true, organizationId: true, parentWorkspaceId: true, path: true },
      });

      if (!currentWorkspace) {
        throw new NotFoundException('Workspace not found');
      }

      // If slug is being updated, validate uniqueness in the organization
      if (updateWorkspaceDto.slug && updateWorkspaceDto.slug !== currentWorkspace.slug) {
        const existingWorkspace = await this.prisma.workspace.findUnique({
          where: {
            organizationId_slug: {
              organizationId: currentWorkspace.organizationId,
              slug: updateWorkspaceDto.slug,
            },
          },
          select: { id: true },
        });

        if (existingWorkspace) {
          throw new ConflictException(
            `A workspace with the slug "${updateWorkspaceDto.slug}" already exists in this organization. Please choose a different slug.`,
          );
        }
      }

      // Check if parentWorkspaceId is being changed
      const isParentChanging =
        updateWorkspaceDto.parentWorkspaceId !== undefined &&
        updateWorkspaceDto.parentWorkspaceId !== currentWorkspace.parentWorkspaceId;

      if (isParentChanging) {
        const newParentId = updateWorkspaceDto.parentWorkspaceId || null;

        // Cannot make a workspace its own parent
        if (newParentId === id) {
          throw new BadRequestException('A workspace cannot be its own parent');
        }

        let newParentPath = '';

        if (newParentId) {
          const parentWorkspace = await this.prisma.workspace.findUnique({
            where: { id: newParentId },
            select: { id: true, organizationId: true, path: true, archive: true },
          });

          if (!parentWorkspace) {
            throw new NotFoundException('Target parent workspace not found');
          }

          if (parentWorkspace.organizationId !== currentWorkspace.organizationId) {
            throw new BadRequestException('Parent workspace must belong to the same organization');
          }

          if (parentWorkspace.archive) {
            throw new BadRequestException('Cannot move to an archived workspace');
          }

          // Circular reference check: new parent must NOT be a descendant of this workspace
          if (parentWorkspace.path && parentWorkspace.path.includes(`/${id}/`)) {
            throw new BadRequestException(
              'Cannot move a workspace under one of its own descendants',
            );
          }
          if (parentWorkspace.path && parentWorkspace.path.endsWith(`/${id}`)) {
            throw new BadRequestException(
              'Cannot move a workspace under one of its own descendants',
            );
          }

          newParentPath = parentWorkspace.path || `/${parentWorkspace.id}`;
        }

        // Update parent and recalculate paths in a transaction
        const oldPath = currentWorkspace.path || `/${currentWorkspace.id}`;
        const newPath = newParentId ? `${newParentPath}/${id}` : `/${id}`;

        const otherUpdates = { ...updateWorkspaceDto };
        delete otherUpdates.parentWorkspaceId;

        const workspace = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.workspace.update({
            where: { id },
            data: {
              ...otherUpdates,
              parentWorkspaceId: newParentId,
              path: newPath,
              updatedBy: userId,
            },
            include: {
              organization: {
                select: { id: true, name: true, slug: true, avatar: true },
              },
              parentWorkspace: {
                select: { id: true, name: true, slug: true },
              },
              createdByUser: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
              updatedByUser: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
              _count: { select: { members: true, projects: true, childWorkspaces: true } },
            },
          });

          // Update all descendant paths
          const descendants = await tx.workspace.findMany({
            where: { path: { startsWith: `${oldPath}/` } },
            select: { id: true, path: true },
          });

          for (const descendant of descendants) {
            const updatedPath = (descendant.path || '').replace(oldPath, newPath);
            await tx.workspace.update({
              where: { id: descendant.id },
              data: { path: updatedPath, updatedBy: userId },
            });
          }

          return updated;
        });

        return workspace;
      }

      const safeUpdates = { ...updateWorkspaceDto };
      delete safeUpdates.parentWorkspaceId;

      const workspace = await this.prisma.workspace.update({
        where: { id },
        data: { ...safeUpdates, updatedBy: userId },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, avatar: true },
          },
          parentWorkspace: {
            select: { id: true, name: true, slug: true },
          },
          createdByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: { select: { members: true, projects: true, childWorkspaces: true } },
        },
      });

      return workspace;
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('Workspace with this slug already exists in this organization');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const { isElevated } = await this.accessControl.getWorkspaceAccess(id, userId);
    if (!isElevated) {
      throw new ForbiddenException('Insufficient permissions to delete workspace');
    }

    try {
      await this.prisma.workspace.delete({ where: { id } });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async archiveWorkspace(id: string, userId: string): Promise<void> {
    const { isElevated, isSuperAdmin } = await this.accessControl.getWorkspaceAccess(id, userId);

    if (!isElevated && !isSuperAdmin) {
      throw new ForbiddenException(
        'Insufficient permissions to archive workspace. Requires MANAGER or OWNER role.',
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: { organizationId: true, archive: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.archive) {
      throw new ConflictException('Workspace is already archived');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.project.updateMany({
          where: { workspaceId: id, archive: false },
          data: { archive: true },
        });

        await tx.task.updateMany({
          where: {
            project: { workspaceId: id },
            isArchived: false,
          },
          data: {
            isArchived: true,
            archivedBy: userId,
          },
        });

        await tx.workspace.update({
          where: { id },
          data: { archive: true },
        });
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async unarchiveWorkspace(id: string, userId: string): Promise<void> {
    const { isElevated, isSuperAdmin } = await this.accessControl.getWorkspaceAccess(id, userId);

    if (!isElevated && !isSuperAdmin) {
      throw new ForbiddenException(
        'Insufficient permissions to unarchive workspace. Requires MANAGER or OWNER role.',
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: { organizationId: true, archive: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!workspace.archive) {
      throw new ConflictException('Workspace is not archived');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.project.updateMany({
          where: { workspaceId: id, archive: true },
          data: { archive: false },
        });

        await tx.task.updateMany({
          where: {
            project: { workspaceId: id },
            isArchived: true,
          },
          data: {
            isArchived: false,
            archivedBy: null,
          },
        });

        await tx.workspace.update({
          where: { id },
          data: { archive: false },
        });
      });
    } catch (error) {
      console.error(error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  async findArchived(organizationId: string, userId: string): Promise<Workspace[]> {
    await this.accessControl.getOrgAccess(organizationId, userId);

    return this.prisma.workspace.findMany({
      where: { archive: true, organizationId },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, avatar: true },
        },
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Chart methods with role-based filtering
  async workspaceProjectStatusDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const projectWhere = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    return this.prisma.project.groupBy({
      by: ['status'],
      where: projectWhere,
      _count: { status: true },
    });
  }

  async workspaceTaskPriorityBreakdown(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      ...(isElevated
        ? {}
        : {
            OR: [
              { assignees: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
            ],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['priority'],
      where: taskWhere,
      _count: { priority: true },
    });
  }

  async workspaceKPIMetrics(organizationId: string, workspaceSlug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const projectBase = {
      workspace: { slug: workspaceSlug, archive: false },
      archive: false,
      ...(isElevated ? {} : { members: { some: { userId } } }),
    };

    const taskBase = {
      project: projectBase,
      ...(isElevated
        ? {}
        : {
            OR: [
              { assignees: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
            ],
          }),
    };

    const [totalProjects, activeProjects, completedProjects, totalTasks, overdueTasks] =
      await Promise.all([
        this.prisma.project.count({ where: projectBase }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'ACTIVE' },
        }),
        this.prisma.project.count({
          where: { ...projectBase, status: 'COMPLETED' },
        }),
        this.prisma.task.count({ where: taskBase }),
        this.prisma.task.count({
          where: { ...taskBase, dueDate: { lt: new Date() }, completedAt: null },
        }),
      ]);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      overdueTasks,
      completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0,
    };
  }

  async workspaceTaskTypeDistribution(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      ...(isElevated
        ? {}
        : {
            OR: [
              { assignees: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
            ],
          }),
    };

    return this.prisma.task.groupBy({
      by: ['type'],
      where: taskWhere,
      _count: { type: true },
    });
  }

  async workspaceSprintStatusOverview(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const sprintWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      archive: false,
    };

    return this.prisma.sprint.groupBy({
      by: ['status'],
      where: sprintWhere,
      _count: { status: true },
    });
  }

  async workspaceMonthlyTaskCompletion(
    organizationId: string,
    workspaceSlug: string,
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId, slug: workspaceSlug } },
      select: { id: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const { isElevated } = await this.accessControl.getWorkspaceAccess(workspace.id, userId);

    const taskWhere = {
      project: {
        workspace: { slug: workspaceSlug, archive: false },
        archive: false,
        ...(isElevated ? {} : { members: { some: { userId } } }),
      },
      completedAt: { not: null },
      ...(isElevated
        ? {}
        : {
            OR: [
              { assignees: { some: { userId: userId } } },
              { reporters: { some: { userId: userId } } },
            ],
          }),
    };

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    const monthlyData = tasks.reduce(
      (acc, task) => {
        if (task.completedAt) {
          const month = task.completedAt.toISOString().substring(0, 7);
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      count,
    }));
  }

  async findAllSlugs(organization_id: string): Promise<string[]> {
    if (organization_id === '' || organization_id === null || organization_id === undefined)
      return [];
    const workspaces = await this.prisma.workspace.findMany({
      where: { archive: false, organizationId: organization_id },
      select: { slug: true },
    });
    return workspaces.map((w) => w.slug);
  }

  async getIdBySlug(slug: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { slug },
      select: { id: true },
    });
    return workspace ? workspace.id : null;
  }
  async getWorkspaceTree(organizationId: string, userId: string) {
    const { isSuperAdmin } = await this.accessControl.getOrgAccess(organizationId, userId);

    const whereClause: any = { archive: false, organizationId };
    if (!isSuperAdmin) {
      whereClause.members = { some: { userId } };
    }

    const workspaces = await this.prisma.workspace.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        parentWorkspaceId: true,
        path: true,
        _count: { select: { members: true, projects: true, childWorkspaces: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return workspaces;
  }

  async getAncestors(id: string, userId: string) {
    await this.accessControl.getWorkspaceAccess(id, userId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: { id: true, path: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!workspace.path) {
      return [];
    }

    const ancestorIds = workspace.path.split('/').filter(Boolean);
    ancestorIds.pop();

    if (ancestorIds.length === 0) {
      return [];
    }

    const ancestors = await this.prisma.workspace.findMany({
      where: { id: { in: ancestorIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        path: true,
      },
    });

    return ancestors.sort((a, b) => (a.path?.length || 0) - (b.path?.length || 0));
  }

  async applyInheritance(
    workspaceId: string,
    userId: string,
    options: { inheritMembers?: boolean; inheritLabels?: boolean; inheritWorkflows?: boolean } = {},
  ): Promise<{
    membersAdded: number;
    labelsAdded: number;
    workflowsAdded: number;
  }> {
    const { isElevated, isSuperAdmin } = await this.accessControl.getWorkspaceAccess(
      workspaceId,
      userId,
    );
    if (!isElevated && !isSuperAdmin) {
      throw new ForbiddenException(
        'Insufficient permissions to apply inheritance. Requires MANAGER or OWNER role.',
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, parentWorkspaceId: true, settings: true, organizationId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    if (!workspace.parentWorkspaceId) {
      throw new BadRequestException(
        'This workspace has no parent workspace. Set a parent workspace first.',
      );
    }

    const parentWorkspaceId = workspace.parentWorkspaceId;
    const { inheritMembers = true, inheritLabels = true, inheritWorkflows = true } = options;

    const currentSettings: Record<string, any> =
      typeof workspace.settings === 'object' && workspace.settings !== null
        ? (workspace.settings as Record<string, any>)
        : {};

    let membersAdded = 0;
    let labelsAdded = 0;
    let workflowsAdded = 0;

    await this.prisma.$transaction(async (tx) => {
      // ── 1. MEMBERS ──────────────────────────────────────────────────────
      if (inheritMembers) {
        // Fetch all parent workspace members
        const parentMembers = await tx.workspaceMember.findMany({
          where: { workspaceId: parentWorkspaceId },
          select: { userId: true, role: true },
        });

        // Fetch existing members of this workspace (for comparison)
        const existingMemberIds = new Set(
          (
            await tx.workspaceMember.findMany({
              where: { workspaceId },
              select: { userId: true },
            })
          ).map((m) => m.userId),
        );

        // UPSERT: only add members that are missing
        const toAdd = parentMembers.filter((m) => !existingMemberIds.has(m.userId));
        if (toAdd.length > 0) {
          await tx.workspaceMember.createMany({
            data: toAdd.map((m) => ({
              userId: m.userId,
              workspaceId,
              role: m.role,
              createdBy: userId,
              updatedBy: userId,
            })),
            skipDuplicates: true,
          });
          membersAdded = toAdd.length;
        }
      }

      // ── 2. LABEL TEMPLATES ───────────────────────────────────────────────
      if (inheritLabels) {
        // Fetch all distinct used label definitions from parent workspace
        let parentLabels = await tx.label.findMany({
          where: {
            workspaceLabels: {
              some: { workspaceId: parentWorkspaceId },
            },
          },
          select: { id: true, name: true, color: true, description: true },
        });

        // Fallback: If no labels are found via WorkspaceLabel,
        // fetch labels directly from the projects within the parent workspace.
        if (parentLabels.length === 0) {
          parentLabels = await tx.label.findMany({
            where: {
              project: { workspaceId: parentWorkspaceId },
            },
            select: { id: true, name: true, color: true, description: true },
          });

          // Backfill the parent workspace with these labels
          if (parentLabels.length > 0) {
            await tx.workspaceLabel.createMany({
              data: parentLabels.map((l) => ({
                workspaceId: parentWorkspaceId,
                labelId: l.id,
              })),
              skipDuplicates: true,
            });
          }
        }

        if (parentLabels.length > 0) {
          // Current inherited label templates (keyed by name for O(1) lookup)
          const existingTemplates: Array<{ name: string; color: string; description?: string }> =
            Array.isArray(currentSettings.inheritedLabelTemplates)
              ? currentSettings.inheritedLabelTemplates
              : [];
          const existingNames = new Set(existingTemplates.map((l) => l.name));

          // UPSERT: add only missing labels (compare by name)
          const newLabels = parentLabels.filter((l) => !existingNames.has(l.name));
          if (newLabels.length > 0) {
            currentSettings.inheritedLabelTemplates = [
              ...existingTemplates,
              ...newLabels.map((l) => ({
                name: l.name,
                color: l.color,
                description: l.description,
              })),
            ];
            labelsAdded = newLabels.length;
          }

          // Physically link the labels to the child workspace
          await tx.workspaceLabel.createMany({
            data: parentLabels.map((l) => ({
              workspaceId,
              labelId: l.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      // ── 3. WORKFLOWS ─────────────────────────────────────────────────────
      if (inheritWorkflows) {
        // Fetch all distinct workflow IDs used by parent workspace's projects
        const parentWorkflowIds = (
          await tx.project.findMany({
            where: { workspaceId: parentWorkspaceId },
            select: { workflowId: true },
            distinct: ['workflowId'],
          })
        ).map((p) => p.workflowId);

        if (parentWorkflowIds.length > 0) {
          // Set defaultWorkflowId only if not already set
          const hasDefault = !!currentSettings.defaultWorkflowId;
          if (!hasDefault) {
            currentSettings.defaultWorkflowId = parentWorkflowIds[0];
            workflowsAdded++;
          }

          // UPSERT: merge any new workflow IDs into the tracked set
          const existingWorkflowIds: string[] = Array.isArray(currentSettings.knownWorkflowIds)
            ? currentSettings.knownWorkflowIds
            : hasDefault
              ? [currentSettings.defaultWorkflowId]
              : [];
          const existingWfSet = new Set(existingWorkflowIds);
          const newWorkflowIds = parentWorkflowIds.filter((id) => !existingWfSet.has(id));
          if (newWorkflowIds.length > 0) {
            currentSettings.knownWorkflowIds = [...existingWorkflowIds, ...newWorkflowIds];
            workflowsAdded += newWorkflowIds.length;
          }
        }
      }

      // Persist updated settings if anything changed
      if (membersAdded > 0 || labelsAdded > 0 || workflowsAdded > 0) {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { settings: currentSettings },
        });
      }
    });

    return { membersAdded, labelsAdded, workflowsAdded };
  }
}
