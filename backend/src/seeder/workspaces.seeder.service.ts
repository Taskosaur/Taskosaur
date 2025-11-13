import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role as WorkspaceRole, Workspace } from '@prisma/client';

@Injectable()
export class WorkspacesSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(organizations: any[], users: any[]) {
    console.log('🌱 Seeding workspaces...');

    if (!organizations || organizations.length === 0) {
      throw new Error('Organizations must be seeded before workspaces');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before workspaces');
    }

    const createdWorkspaces: Workspace[] = [];

    // Create workspaces for each organization
    for (const organization of organizations) {
      const workspacesData = this.getWorkspacesDataForOrganization(organization);

      for (const workspaceData of workspacesData) {
        try {
          // Find an admin user for this organization to set as creator
          const orgMembers = await this.prisma.organizationMember.findMany({
            where: { organizationId: organization.id },
            include: { user: true },
            orderBy: { role: 'asc' }, // Admin roles come first
          });
          const creatorUser = orgMembers[0]?.user || users[0];

          const workspace = await this.prisma.workspace.create({
            data: {
              ...workspaceData,
              organizationId: organization.id,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          // Add workspace members
          await this.addMembersToWorkspace(workspace.id, users, organization.id as string);

          createdWorkspaces.push(workspace);
          console.log(`   ✓ Created workspace: ${workspace.name} in ${organization.name}`);
        } catch (error) {
          console.error(error);
          console.log(
            `   ⚠ Workspace ${workspaceData.slug} might already exist in ${organization.name}, skipping...`,
          );
          // Try to find existing workspace
          const existingWorkspace = await this.prisma.workspace.findFirst({
            where: {
              slug: workspaceData.slug,
              organizationId: organization.id,
            },
          });
          if (existingWorkspace) {
            createdWorkspaces.push(existingWorkspace);
          }
        }
      }
    }

    console.log(
      `✅ Workspaces seeding completed. Created/Found ${createdWorkspaces.length} workspaces.`,
    );
    return createdWorkspaces;
  }

  private getWorkspacesDataForOrganization(organization: any) {
    // Different workspace configurations based on organization
    if (organization.slug === 'taskosaur-inc') {
      return [
        {
          name: 'Development Team',
          slug: 'dev-team',
          description: 'Main development workspace for product engineering',
          color: '#3b82f6',
          avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
          settings: {
            allowExternalGuests: false,
            defaultProjectVisibility: 'private',
            enableTimeTracking: true,
            enableGitIntegration: true,
            workflowType: 'scrum',
            sprintDuration: 14,
          },
        },
        {
          name: 'Design & UX',
          slug: 'design-ux',
          description: 'Creative workspace for design and user experience teams',
          color: '#8b5cf6',
          avatar: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=150',
          settings: {
            allowExternalGuests: true,
            defaultProjectVisibility: 'internal',
            enableTimeTracking: false,
            enableGitIntegration: false,
            workflowType: 'kanban',
            sprintDuration: null,
          },
        },
        {
          name: 'Marketing',
          slug: 'marketing',
          description: 'Marketing campaigns and content creation workspace',
          color: '#f59e0b',
          avatar: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150',
          settings: {
            allowExternalGuests: true,
            defaultProjectVisibility: 'internal',
            enableTimeTracking: true,
            enableGitIntegration: false,
            workflowType: 'kanban',
            sprintDuration: null,
          },
        },
      ];
    } else if (organization.slug === 'tech-innovators') {
      return [
        {
          name: 'Client Projects',
          slug: 'client-projects',
          description: 'Workspace for managing client deliverables and projects',
          color: '#10b981',
          avatar: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=150',
          settings: {
            allowExternalGuests: true,
            defaultProjectVisibility: 'private',
            enableTimeTracking: true,
            enableGitIntegration: true,
            workflowType: 'scrum',
            sprintDuration: 7,
          },
        },
        {
          name: 'Internal Operations',
          slug: 'internal-ops',
          description: 'Internal processes, HR, and administrative tasks',
          color: '#6b7280',
          avatar: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=150',
          settings: {
            allowExternalGuests: false,
            defaultProjectVisibility: 'internal',
            enableTimeTracking: false,
            enableGitIntegration: false,
            workflowType: 'kanban',
            sprintDuration: null,
          },
        },
      ];
    }

    // Default workspace for any other organization
    return [
      {
        name: 'General',
        slug: 'general',
        description: 'Default workspace for general project management',
        color: '#6b7280',
        settings: {
          allowExternalGuests: false,
          defaultProjectVisibility: 'private',
          enableTimeTracking: true,
          enableGitIntegration: false,
          workflowType: 'kanban',
          sprintDuration: null,
        },
      },
    ];
  }

  private async addMembersToWorkspace(workspaceId: string, users: any[], organizationId: string) {
    // Get organization members to determine who can be added to workspace
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
    });

    const memberRoles = [
      WorkspaceRole.OWNER, // First user
      WorkspaceRole.MANAGER, // Second user
      WorkspaceRole.MEMBER, // Third user
      WorkspaceRole.MEMBER, // Fourth user
      WorkspaceRole.MEMBER, // Fifth user
      WorkspaceRole.VIEWER, // Sixth user
      WorkspaceRole.MEMBER, // Seventh user (if exists)
    ];

    // Add organization members to workspace
    for (let i = 0; i < orgMembers.length && i < memberRoles.length; i++) {
      try {
        await this.prisma.workspaceMember.create({
          data: {
            userId: orgMembers[i].userId,
            workspaceId,
            role: memberRoles[i],
          },
        });
        console.log(`   ✓ Added ${orgMembers[i].user.email} to workspace as ${memberRoles[i]}`);
      } catch (error) {
        console.error(error);
        console.log(
          `   ⚠ User ${orgMembers[i].user.email} might already be a workspace member, skipping...`,
        );
      }
    }
  }

  async clear() {
    console.log('🧹 Clearing workspaces...');

    try {
      // Delete workspace members first (foreign key constraint)
      const deletedMembers = await this.prisma.workspaceMember.deleteMany();
      console.log(`   ✓ Deleted ${deletedMembers.count} workspace members`);

      // Delete workspaces
      const deletedWorkspaces = await this.prisma.workspace.deleteMany();
      console.log(`✅ Deleted ${deletedWorkspaces.count} workspaces`);
    } catch (_error) {
      console.error('❌ Error clearing workspaces:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        members: {
          select: {
            role: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
        createdAt: true,
      },
    });
  }
}
