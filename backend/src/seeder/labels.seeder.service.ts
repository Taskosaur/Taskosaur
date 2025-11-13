import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Label, Project, User } from '@prisma/client';

@Injectable()
export class LabelsSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(projects: Project[], users: User[]) {
    console.log('🌱 Seeding labels...');

    if (!projects || projects.length === 0) {
      throw new Error('Projects must be seeded before labels');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before labels');
    }

    const createdLabels: Label[] = [];

    // Create labels for each project
    for (const project of projects) {
      const labelsData = this.getLabelsDataForProject(project);

      // Find project members to set as creators
      const projectMembers = await this.prisma.projectMember.findMany({
        where: { projectId: project.id },
        include: { user: true },
        orderBy: { role: 'asc' },
      });

      const creatorUser = projectMembers[0]?.user || users[0];

      for (const labelData of labelsData) {
        try {
          const label = await this.prisma.label.create({
            data: {
              ...labelData,
              projectId: project.id,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          createdLabels.push(label);
          console.log(`   ✓ Created label: ${label.name} in ${project.name}`);
        } catch (error) {
          console.error(error);
          console.log(
            `   ⚠ Label ${labelData.name} might already exist in ${project.name}, skipping...`,
            error instanceof Error ? error.message : String(error),
          );
          // Try to find existing label
          const existingLabel = await this.prisma.label.findFirst({
            where: {
              name: labelData.name,
              projectId: project.id,
            },
          });
          if (existingLabel) {
            createdLabels.push(existingLabel);
          }
        }
      }
    }

    console.log(`✅ Labels seeding completed. Created/Found ${createdLabels.length} labels.`);
    return createdLabels;
  }

  private getLabelsDataForProject(project: Project) {
    // Common labels across all projects
    const commonLabels = [
      {
        name: 'urgent',
        color: '#ef4444',
        description: 'Requires immediate attention',
      },
      {
        name: 'blocked',
        color: '#dc2626',
        description: 'Cannot proceed due to external dependencies',
      },
      {
        name: 'needs-review',
        color: '#f59e0b',
        description: 'Ready for code or design review',
      },
      {
        name: 'documentation',
        color: '#6366f1',
        description: 'Documentation related tasks',
      },
      {
        name: 'enhancement',
        color: '#10b981',
        description: 'Feature enhancement or improvement',
      },
    ];

    // Project-specific labels based on project type
    if (project.name.includes('Web Application') || project.name.includes('Backend API')) {
      return [
        ...commonLabels,
        {
          name: 'frontend',
          color: '#3b82f6',
          description: 'Frontend development tasks',
        },
        {
          name: 'backend',
          color: '#8b5cf6',
          description: 'Backend development tasks',
        },
        {
          name: 'api',
          color: '#06b6d4',
          description: 'API related development',
        },
        {
          name: 'database',
          color: '#84cc16',
          description: 'Database schema or query related',
        },
        {
          name: 'security',
          color: '#ef4444',
          description: 'Security related tasks',
        },
        {
          name: 'performance',
          color: '#f97316',
          description: 'Performance optimization tasks',
        },
        {
          name: 'testing',
          color: '#8b5cf6',
          description: 'Testing and QA tasks',
        },
        {
          name: 'deployment',
          color: '#059669',
          description: 'Deployment and DevOps tasks',
        },
      ];
    } else if (project.name.includes('Design') || project.name.includes('UI')) {
      return [
        ...commonLabels,
        {
          name: 'ui-component',
          color: '#ec4899',
          description: 'UI component design tasks',
        },
        {
          name: 'ux-research',
          color: '#8b5cf6',
          description: 'User experience research',
        },
        {
          name: 'prototyping',
          color: '#06b6d4',
          description: 'Prototyping and wireframing',
        },
        {
          name: 'accessibility',
          color: '#10b981',
          description: 'Accessibility improvements',
        },
        {
          name: 'design-system',
          color: '#f59e0b',
          description: 'Design system related tasks',
        },
        {
          name: 'branding',
          color: '#ef4444',
          description: 'Brand and visual identity tasks',
        },
      ];
    } else if (project.name.includes('Marketing')) {
      return [
        ...commonLabels,
        {
          name: 'content',
          color: '#8b5cf6',
          description: 'Content creation and marketing materials',
        },
        {
          name: 'social-media',
          color: '#06b6d4',
          description: 'Social media campaigns and posts',
        },
        {
          name: 'email-campaign',
          color: '#10b981',
          description: 'Email marketing campaigns',
        },
        {
          name: 'analytics',
          color: '#f59e0b',
          description: 'Marketing analytics and reporting',
        },
        {
          name: 'seo',
          color: '#84cc16',
          description: 'Search engine optimization',
        },
        {
          name: 'paid-ads',
          color: '#ef4444',
          description: 'Paid advertising campaigns',
        },
      ];
    } else if (project.name.includes('E-commerce') || project.name.includes('Mobile App')) {
      return [
        ...commonLabels,
        {
          name: 'mobile',
          color: '#06b6d4',
          description: 'Mobile-specific features and fixes',
        },
        {
          name: 'payment',
          color: '#10b981',
          description: 'Payment processing and integration',
        },
        {
          name: 'inventory',
          color: '#f59e0b',
          description: 'Inventory management features',
        },
        {
          name: 'user-experience',
          color: '#ec4899',
          description: 'User experience improvements',
        },
        {
          name: 'integration',
          color: '#8b5cf6',
          description: 'Third-party service integrations',
        },
      ];
    }

    // Default labels for other project types
    return [
      ...commonLabels,
      {
        name: 'feature',
        color: '#3b82f6',
        description: 'New feature development',
      },
      {
        name: 'bugfix',
        color: '#ef4444',
        description: 'Bug fix tasks',
      },
      {
        name: 'refactoring',
        color: '#8b5cf6',
        description: 'Code refactoring and cleanup',
      },
      {
        name: 'research',
        color: '#06b6d4',
        description: 'Research and investigation tasks',
      },
    ];
  }

  async clear() {
    console.log('🧹 Clearing labels...');

    try {
      // Delete task label associations first
      const deletedTaskLabels = await this.prisma.taskLabel.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskLabels.count} task label associations`);

      // Delete labels
      const deletedLabels = await this.prisma.label.deleteMany();
      console.log(`✅ Deleted ${deletedLabels.count} labels`);
    } catch (_error) {
      console.error('❌ Error clearing labels:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.label.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: {
                name: true,
                organization: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            taskLabels: true,
          },
        },
        createdAt: true,
      },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    });
  }
}
