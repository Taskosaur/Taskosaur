import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Sprint, SprintStatus, Project, User } from '@prisma/client';

@Injectable()
export class SprintsSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(projects: Project[], users: User[]) {
    console.log('🌱 Seeding sprints...');

    if (!projects || projects.length === 0) {
      throw new Error('Projects must be seeded before sprints');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before sprints');
    }

    const createdSprints: Sprint[] = [];

    // Create sprints only for projects that use Scrum workflow
    const scrumProjects = projects.filter(
      (project) =>
        project.name.includes('Web Application') ||
        project.name.includes('Backend API') ||
        project.name.includes('E-commerce Platform') ||
        project.name.includes('Mobile App'),
    );

    for (const project of scrumProjects) {
      const sprintsData = this.getSprintsDataForProject(project);

      // Find project members to set as creators
      const projectMembers = await this.prisma.projectMember.findMany({
        where: { projectId: project.id },
        include: { user: true },
        orderBy: { role: 'asc' }, // Admin/Manager roles first
      });

      const creatorUser = projectMembers[0]?.user || users[0];

      for (const sprintData of sprintsData) {
        try {
          const sprint = await this.prisma.sprint.create({
            data: {
              ...sprintData,
              projectId: project.id,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          createdSprints.push(sprint);
          console.log(`   ✓ Created sprint: ${sprint.name} [${sprint.status}] in ${project.name}`);
        } catch (error) {
          console.error(error);
          console.log(
            `   ⚠ Sprint ${sprintData.name} might already exist in ${project.name}, skipping...`,
          );
          // Try to find existing sprint
          const existingSprint = await this.prisma.sprint.findFirst({
            where: {
              name: sprintData.name,
              projectId: project.id,
            },
          });
          if (existingSprint) {
            createdSprints.push(existingSprint);
          }
        }
      }
    }

    console.log(`✅ Sprints seeding completed. Created/Found ${createdSprints.length} sprints.`);
    return createdSprints;
  }

  private getSprintsDataForProject(project: Project) {
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;

    if (project.name.includes('Web Application')) {
      return [
        {
          name: 'Sprint 1: Foundation Setup',
          goal: 'Set up development environment, authentication, and basic project structure',
          status: SprintStatus.COMPLETED,
          startDate: new Date(now.getTime() - 4 * twoWeeks), // 8 weeks ago
          endDate: new Date(now.getTime() - 3 * twoWeeks), // 6 weeks ago
        },
        {
          name: 'Sprint 2: User Management',
          goal: 'Implement user registration, profile management, and authorization',
          status: SprintStatus.COMPLETED,
          startDate: new Date(now.getTime() - 3 * twoWeeks), // 6 weeks ago
          endDate: new Date(now.getTime() - 2 * twoWeeks), // 4 weeks ago
        },
        {
          name: 'Sprint 3: Dashboard & Navigation',
          goal: 'Build responsive dashboard layout and navigation components',
          status: SprintStatus.ACTIVE,
          startDate: new Date(now.getTime() - twoWeeks), // 2 weeks ago
          endDate: new Date(now.getTime()), // now
        },
        {
          name: 'Sprint 4: Task Management Core',
          goal: 'Implement task creation, editing, and basic task management features',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime()),
          endDate: new Date(now.getTime() + twoWeeks),
        },
        {
          name: 'Sprint 5: Advanced Features',
          goal: 'Add task dependencies, attachments, and advanced filtering',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime() + twoWeeks),
          endDate: new Date(now.getTime() + 2 * twoWeeks),
        },
      ];
    } else if (project.name.includes('Backend API')) {
      return [
        {
          name: 'Sprint 1: API Foundation',
          goal: 'Set up NestJS structure, database connection, and basic CRUD operations',
          status: SprintStatus.COMPLETED,
          startDate: new Date(now.getTime() - 3 * twoWeeks),
          endDate: new Date(now.getTime() - 2 * twoWeeks),
        },
        {
          name: 'Sprint 2: Authentication & Security',
          goal: 'Implement JWT authentication, rate limiting, and security middleware',
          status: SprintStatus.ACTIVE,
          startDate: new Date(now.getTime() - twoWeeks),
          endDate: new Date(now.getTime()),
        },
        {
          name: 'Sprint 3: Task API Endpoints',
          goal: 'Build comprehensive task management API with all CRUD operations',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime()),
          endDate: new Date(now.getTime() + twoWeeks),
        },
      ];
    } else if (project.name.includes('E-commerce Platform')) {
      return [
        {
          name: 'Sprint 1: Project Setup',
          goal: 'Initialize project, set up development environment and basic structure',
          status: SprintStatus.COMPLETED,
          startDate: new Date(now.getTime() - 2 * twoWeeks),
          endDate: new Date(now.getTime() - twoWeeks),
        },
        {
          name: 'Sprint 2: Product Catalog',
          goal: 'Build product listing, search, and filtering functionality',
          status: SprintStatus.ACTIVE,
          startDate: new Date(now.getTime() - twoWeeks),
          endDate: new Date(now.getTime()),
        },
        {
          name: 'Sprint 3: Shopping Cart & Checkout',
          goal: 'Implement shopping cart functionality and checkout process',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime()),
          endDate: new Date(now.getTime() + twoWeeks),
        },
      ];
    } else if (project.name.includes('Mobile App')) {
      return [
        {
          name: 'Sprint 1: App Foundation',
          goal: 'Set up React Native project, navigation, and basic screens',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime() + oneWeek),
          endDate: new Date(now.getTime() + oneWeek + twoWeeks),
        },
        {
          name: 'Sprint 2: Core Features',
          goal: 'Implement main app functionality and user authentication',
          status: SprintStatus.PLANNING,
          startDate: new Date(now.getTime() + oneWeek + twoWeeks),
          endDate: new Date(now.getTime() + oneWeek + 2 * twoWeeks),
        },
      ];
    }

    // Default sprints for other projects
    return [
      {
        name: 'Sprint 1: Planning & Setup',
        goal: 'Project planning, requirement analysis, and initial setup',
        status: SprintStatus.COMPLETED,
        startDate: new Date(now.getTime() - twoWeeks),
        endDate: new Date(now.getTime()),
      },
      {
        name: 'Sprint 2: Core Development',
        goal: 'Implement core functionality and features',
        status: SprintStatus.PLANNING,
        startDate: new Date(now.getTime()),
        endDate: new Date(now.getTime() + twoWeeks),
      },
    ];
  }

  async clear() {
    console.log('🧹 Clearing sprints...');

    try {
      // Update tasks to remove sprint associations first
      await this.prisma.task.updateMany({
        where: { sprintId: { not: null } },
        data: { sprintId: null },
      });
      console.log('   ✓ Removed sprint associations from tasks');

      // Delete sprints
      const deletedSprints = await this.prisma.sprint.deleteMany();
      console.log(`✅ Deleted ${deletedSprints.count} sprints`);
    } catch (_error) {
      console.error('❌ Error clearing sprints:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.sprint.findMany({
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
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
            tasks: true,
          },
        },
        createdAt: true,
      },
      orderBy: [{ project: { name: 'asc' } }, { startDate: 'desc' }],
    });
  }
}
