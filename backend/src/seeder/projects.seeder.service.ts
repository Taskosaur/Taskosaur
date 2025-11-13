import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role as ProjectRole, ProjectStatus, ProjectPriority, Project } from '@prisma/client';
import slugify from 'slugify';
import { DEFAULT_SPRINT } from '../constants/defaultWorkflow';

@Injectable()
export class ProjectsSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(workspaces: any[], users: any[]) {
    console.log('🌱 Seeding projects...');

    if (!workspaces || workspaces.length === 0) {
      throw new Error('Workspaces must be seeded before projects');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before projects');
    }

    const createdProjects: Project[] = [];

    // Create projects for each workspace
    for (const workspace of workspaces) {
      const projectsData = this.getProjectsDataForWorkspace(workspace);

      // Get the organization's default workflow for this workspace
      const defaultWorkflow = await this.getDefaultWorkflowForWorkspace(workspace.id as string);

      if (!defaultWorkflow) {
        console.log(
          `   ⚠ No default workflow found for workspace ${workspace.name}, skipping projects...`,
        );
        continue;
      }

      for (const projectData of projectsData) {
        try {
          // Find a manager/admin user from workspace members to set as creator
          const workspaceMembers = await this.prisma.workspaceMember.findMany({
            where: { workspaceId: workspace.id },
            include: { user: true },
            orderBy: { role: 'asc' }, // Admin/Manager roles come first
          });
          const creatorUser = workspaceMembers[0]?.user || users[0];

          const project = await this.prisma.project.create({
            data: {
              ...projectData,
              workspaceId: workspace.id,
              workflowId: defaultWorkflow.id, // Assign the default workflow
              slug: slugify(projectData.name, { lower: true, strict: true }),
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
              sprints: {
                create: {
                  name: DEFAULT_SPRINT.name,
                  goal: DEFAULT_SPRINT.goal,
                  status: DEFAULT_SPRINT.status,
                  isDefault: DEFAULT_SPRINT.isDefault,
                  createdBy: creatorUser.id,
                  updatedBy: creatorUser.id,
                },
              },
            },
            include: {
              workflow: {
                select: {
                  id: true,
                  name: true,
                  isDefault: true,
                },
              },
            },
          });

          // Add project members
          await this.addMembersToProject(project.id, users, workspace.id as string);

          createdProjects.push(project);
          console.log(
            `   ✓ Created project: ${project.name} in ${workspace.name} with workflow: ${defaultWorkflow.name}`,
          );
        } catch (error) {
          console.error(error);
          console.log(
            `   ⚠ Project ${projectData.name} might already exist in ${workspace.name}, skipping...`,
          );
          // Try to find existing project
          const existingProject = await this.prisma.project.findFirst({
            where: {
              workspaceId: workspace.id,
              name: projectData.name,
            },
          });
          if (existingProject) {
            createdProjects.push(existingProject);
          }
        }
      }
    }

    console.log(`✅ Projects seeding completed. Created/Found ${createdProjects.length} projects.`);
    return createdProjects;
  }

  // Helper method to get default workflow for a workspace
  private async getDefaultWorkflowForWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      return null;
    }

    return await this.prisma.workflow.findFirst({
      where: {
        organizationId: workspace.organizationId,
        isDefault: true,
      },
      select: {
        id: true,
        name: true,
        isDefault: true,
      },
    });
  }

  private getProjectsDataForWorkspace(workspace: any) {
    // Different project configurations based on workspace
    if (workspace.slug === 'dev-team') {
      return [
        {
          name: 'Taskosaur Web Application',
          description:
            'Main web application built with React, TypeScript, and modern UI components. Includes user management, task tracking, and collaboration features.',
          color: '#3b82f6',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-08-30'),
          avatar: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: true,
            enableDependencies: true,
            defaultTaskType: 'STORY',
            estimationUnit: 'story_points',
            allowGuestAccess: false,
            requireApprovalForCompletion: true,
          },
        },
        {
          name: 'Backend API Services',
          description:
            'RESTful API backend services built with NestJS, PostgreSQL, and Redis. Handles authentication, data management, and third-party integrations.',
          color: '#10b981',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-07-15'),
          avatar: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: true,
            enableDependencies: true,
            defaultTaskType: 'TASK',
            estimationUnit: 'hours',
            allowGuestAccess: false,
            requireApprovalForCompletion: false,
          },
        },
        {
          name: 'DevOps Infrastructure',
          description:
            'Cloud infrastructure, CI/CD pipelines, monitoring, and deployment automation using AWS, Docker, and Kubernetes.',
          color: '#f59e0b',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.MEDIUM,
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-06-30'),
          avatar: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150',
          settings: {
            enableTimeTracking: false,
            enableSubtasks: false,
            enableDependencies: true,
            defaultTaskType: 'TASK',
            estimationUnit: 'hours',
            allowGuestAccess: false,
            requireApprovalForCompletion: true,
          },
        },
      ];
    } else if (workspace.slug === 'design-ux') {
      return [
        {
          name: 'UI Design System',
          description:
            'Comprehensive design system with components, patterns, and guidelines for consistent user experience across all products.',
          color: '#8b5cf6',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.MEDIUM,
          startDate: new Date('2024-01-20'),
          endDate: new Date('2024-05-15'),
          avatar: 'https://images.unsplash.com/photo-1545670723-196ed0954986?w=150',
          settings: {
            enableTimeTracking: false,
            enableSubtasks: true,
            enableDependencies: false,
            defaultTaskType: 'TASK',
            estimationUnit: 'story_points',
            allowGuestAccess: true,
            requireApprovalForCompletion: true,
          },
        },
        {
          name: 'User Research & Testing',
          description:
            'User research initiatives, usability testing, and feedback collection to inform product decisions.',
          color: '#ec4899',
          status: ProjectStatus.PLANNING,
          priority: ProjectPriority.LOW,
          startDate: new Date('2024-03-01'),
          endDate: new Date('2024-12-31'),
          avatar: 'https://images.unsplash.com/photo-1553028826-f4804151e2e2?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: false,
            enableDependencies: false,
            defaultTaskType: 'TASK',
            estimationUnit: 'hours',
            allowGuestAccess: true,
            requireApprovalForCompletion: false,
          },
        },
      ];
    } else if (workspace.slug === 'marketing') {
      return [
        {
          name: 'Product Launch Campaign',
          description:
            'Comprehensive marketing campaign for product launch including content creation, social media, and promotional activities.',
          color: '#f59e0b',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          startDate: new Date('2024-02-15'),
          endDate: new Date('2024-06-01'),
          avatar: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: true,
            enableDependencies: false,
            defaultTaskType: 'TASK',
            estimationUnit: 'hours',
            allowGuestAccess: true,
            requireApprovalForCompletion: true,
          },
        },
      ];
    } else if (workspace.slug === 'client-projects') {
      return [
        {
          name: 'E-commerce Platform - TechCorp',
          description:
            'Custom e-commerce platform development for TechCorp client with advanced inventory management and analytics.',
          color: '#059669',
          status: ProjectStatus.ACTIVE,
          priority: ProjectPriority.HIGH,
          startDate: new Date('2024-01-10'),
          endDate: new Date('2024-04-30'),
          avatar: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: true,
            enableDependencies: true,
            defaultTaskType: 'STORY',
            estimationUnit: 'hours',
            allowGuestAccess: true,
            requireApprovalForCompletion: true,
          },
        },
        {
          name: 'Mobile App - FinanceFlow',
          description:
            'React Native mobile application for personal finance management with real-time synchronization and reporting.',
          color: '#3730a3',
          status: ProjectStatus.PLANNING,
          priority: ProjectPriority.MEDIUM,
          startDate: new Date('2024-03-15'),
          endDate: new Date('2024-08-15'),
          avatar: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=150',
          settings: {
            enableTimeTracking: true,
            enableSubtasks: true,
            enableDependencies: true,
            defaultTaskType: 'STORY',
            estimationUnit: 'story_points',
            allowGuestAccess: true,
            requireApprovalForCompletion: false,
          },
        },
      ];
    } else if (workspace.slug === 'internal-ops') {
      return [
        {
          name: 'HR Process Automation',
          description:
            'Streamline HR processes including employee onboarding, performance reviews, and leave management.',
          color: '#6b7280',
          status: ProjectStatus.ON_HOLD,
          priority: ProjectPriority.LOW,
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-09-30'),
          avatar: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=150',
          settings: {
            enableTimeTracking: false,
            enableSubtasks: false,
            enableDependencies: false,
            defaultTaskType: 'TASK',
            estimationUnit: 'hours',
            allowGuestAccess: false,
            requireApprovalForCompletion: true,
          },
        },
      ];
    }

    // Default project for any other workspace
    return [
      {
        name: 'General Tasks',
        description: 'General project for miscellaneous tasks and activities',
        color: '#6b7280',
        status: ProjectStatus.ACTIVE,
        priority: ProjectPriority.MEDIUM,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        settings: {
          enableTimeTracking: true,
          enableSubtasks: false,
          enableDependencies: false,
          defaultTaskType: 'TASK',
          estimationUnit: 'hours',
          allowGuestAccess: false,
          requireApprovalForCompletion: false,
        },
      },
    ];
  }

  private async addMembersToProject(projectId: string, users: any[], workspaceId: string) {
    // Get workspace members to determine who can be added to project
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    });

    const memberRoles = [
      ProjectRole.OWNER, // First user
      ProjectRole.MANAGER, // Second user
      ProjectRole.MEMBER, // Third user
      ProjectRole.MEMBER, // Fourth user
      ProjectRole.MEMBER, // Fifth user
      ProjectRole.VIEWER, // Sixth user
      ProjectRole.MEMBER, // Seventh user (if exists)
    ];

    // Add workspace members to project (limit to avoid too many members)
    const maxMembers = Math.min(workspaceMembers.length, 6);
    for (let i = 0; i < maxMembers; i++) {
      try {
        await this.prisma.projectMember.create({
          data: {
            userId: workspaceMembers[i].userId,
            projectId,
            role: memberRoles[i],
          },
        });
        console.log(`   ✓ Added ${workspaceMembers[i].user.email} to project as ${memberRoles[i]}`);
      } catch (error) {
        console.error(error);
        console.log(
          `   ⚠ User ${workspaceMembers[i].user.email} might already be a project member, skipping...`,
        );
      }
    }
  }

  async clear() {
    console.log('🧹 Clearing projects...');

    try {
      // Delete project members first (foreign key constraint)
      const deletedMembers = await this.prisma.projectMember.deleteMany();
      console.log(`   ✓ Deleted ${deletedMembers.count} project members`);

      // Delete projects
      const deletedProjects = await this.prisma.project.deleteMany();
      console.log(`✅ Deleted ${deletedProjects.count} projects`);
    } catch (_error) {
      console.error('❌ Error clearing projects:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        workflow: {
          // Add workflow information
          select: {
            id: true,
            name: true,
            isDefault: true,
            statuses: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
                position: true,
              },
              orderBy: { position: 'asc' },
            },
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
            tasks: true,
            sprints: true,
          },
        },
        createdAt: true,
      },
    });
  }
}
