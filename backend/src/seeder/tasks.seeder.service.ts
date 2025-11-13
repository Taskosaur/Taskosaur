import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Task,
  TaskType,
  TaskPriority,
  Project,
  User,
  TaskStatus,
  StatusCategory,
} from '@prisma/client';
import slugify from 'slugify';

@Injectable()
export class TasksSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(projects: Project[], users: User[]) {
    console.log('🌱 Seeding tasks...');

    if (!projects || projects.length === 0) {
      throw new Error('Projects must be seeded before tasks');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before tasks');
    }

    const createdTasks: Task[] = [];

    // Create tasks for each project
    for (const project of projects) {
      console.log(`\n📋 Creating tasks for project: ${project.name}`);

      // Get all available statuses for this project
      const availableStatuses = await this.getStatusesForProject(project.id);

      if (!availableStatuses || availableStatuses.length === 0) {
        console.log(`⚠ No statuses found for project ${project.name}, skipping tasks...`);
        continue;
      }
      const defaultSprint = await this.prisma.sprint.findFirst({
        where: {
          projectId: project.id,
          isDefault: true,
        },
      });
      if (!defaultSprint) {
        console.log(`⚠ No default sprint found for project ${project.name}`);
      } else {
        console.log(`   📅 Found default sprint: ${defaultSprint.name}`);
      }

      // Get project members for assignment
      const projectMembers = await this.prisma.projectMember.findMany({
        where: { projectId: project.id },
        include: { user: true },
      });

      const availableUsers =
        projectMembers.length > 0 ? projectMembers.map((pm) => pm.user) : users.slice(0, 4); // fallback to first 4 users

      // Generate base tasks for the project type
      const baseTasksData = this.getBaseTasksForProject(project);

      // Create tasks distributed across all available statuses
      const tasksWithStatuses = this.distributeTasksAcrossStatuses(
        baseTasksData,
        availableStatuses,
      );

      let taskNumber = 1;
      for (const taskWithStatus of tasksWithStatuses) {
        try {
          const task = await this.prisma.task.create({
            data: {
              ...taskWithStatus.taskData,
              projectId: project.id,
              sprintId: defaultSprint?.id,
              taskNumber: taskNumber,
              slug: slugify(`${project.slug}-${taskNumber}`, {
                lower: true,
                strict: true,
              }),
              statusId: taskWithStatus.status.id,
              createdBy: availableUsers[0]?.id || users[0].id,
              updatedBy: availableUsers[0]?.id || users[0].id,
              // Set completedAt for DONE tasks
              completedAt:
                taskWithStatus.status.category === StatusCategory.DONE
                  ? this.getCompletedDate(
                      taskWithStatus.taskData.startDate as Date,
                      taskWithStatus.taskData.dueDate as Date,
                    )
                  : null,

              // Connect multiple reporters (instead of single reporterId)
              reporters: {
                connect: [
                  { id: availableUsers[0]?.id || users[0].id }, // You can add more reporters here
                ],
              },

              // Connect multiple assignees (instead of single assigneeId)
              assignees: {
                connect: this.getAssigneesForTask(taskWithStatus.taskData, availableUsers),
              },
            },
          });

          createdTasks.push(task);
          console.log(
            `   ✓ Created task #${taskNumber}: ${task.title} [${taskWithStatus.status.name}]`,
          );
          taskNumber++;
        } catch (_error) {
          console.error(_error);
          console.log(
            `   ⚠ Error creating task ${taskWithStatus.taskData.title}: ${_error.message}`,
          );
        }
      }
    }

    console.log(
      `\n✅ Tasks seeding completed. Created ${createdTasks.length} tasks across all projects.`,
    );
    return createdTasks;
  }

  private async getStatusesForProject(projectId: string): Promise<TaskStatus[]> {
    // Get project with workspace and organization workflows
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            organization: {
              include: {
                workflows: {
                  include: {
                    statuses: {
                      orderBy: { position: 'asc' },
                    },
                  },
                  take: 1, // Get the first (default) workflow
                },
              },
            },
          },
        },
      },
    });

    return project?.workspace?.organization?.workflows?.[0]?.statuses || [];
  }

  private getBaseTasksForProject(project: Project) {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    // Different task sets based on project type/name
    if (project.name.includes('Web Application')) {
      return [
        {
          title: 'Set up development environment',
          description:
            'Configure local development environment with Node.js, React, and necessary dependencies. Include documentation for other developers.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 3,
          originalEstimate: 480,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 21 * oneDay),
          dueDate: new Date(now.getTime() - 14 * oneDay),
        },
        {
          title: 'Design user authentication flow',
          description:
            'Create wireframes and user flow diagrams for login, signup, and password reset functionality.',
          type: TaskType.STORY,
          priority: TaskPriority.HIGH,
          storyPoints: 5,
          originalEstimate: 720,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 18 * oneDay),
          dueDate: new Date(now.getTime() - 10 * oneDay),
        },
        {
          title: 'Implement JWT authentication',
          description:
            'Build secure JWT-based authentication system with refresh tokens and proper error handling.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 240,
          startDate: new Date(now.getTime() - 10 * oneDay),
          dueDate: new Date(now.getTime() + 4 * oneDay),
        },
        {
          title: 'Create responsive dashboard layout',
          description:
            'Build main dashboard with responsive grid layout, navigation sidebar, and header components.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 480,
          startDate: new Date(now.getTime() - 5 * oneDay),
          dueDate: new Date(now.getTime() + oneWeek),
        },
        {
          title: 'Fix authentication redirect bug',
          description:
            'Users are not being redirected to the correct page after login. Investigate and fix routing issue.',
          type: TaskType.BUG,
          priority: TaskPriority.HIGH,
          storyPoints: 2,
          originalEstimate: 240,
          remainingEstimate: 240,
          startDate: new Date(now.getTime()),
          dueDate: new Date(now.getTime() + 3 * oneDay),
        },
        {
          title: 'Add dark mode toggle',
          description: 'Implement theme switching functionality with user preference persistence.',
          type: TaskType.TASK,
          priority: TaskPriority.LOW,
          storyPoints: 3,
          originalEstimate: 360,
          remainingEstimate: 360,
          startDate: new Date(now.getTime() + 3 * oneDay),
          dueDate: new Date(now.getTime() + 2 * oneWeek),
        },
        {
          title: 'User management epic',
          description:
            'Epic for all user-related features including profiles, permissions, and account settings.',
          type: TaskType.EPIC,
          priority: TaskPriority.MEDIUM,
          storyPoints: 21,
          originalEstimate: 2400,
          remainingEstimate: 2400,
          startDate: new Date(now.getTime() + oneWeek),
          dueDate: new Date(now.getTime() + 6 * oneWeek),
        },
        {
          title: 'Implement user profile editing',
          description: 'Allow users to edit their profile information, avatar, and preferences.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 600,
          startDate: new Date(now.getTime() + 2 * oneWeek),
          dueDate: new Date(now.getTime() + 3 * oneWeek),
        },
        {
          title: 'Add email notification system',
          description:
            'Send email notifications for important events like password changes, account updates.',
          type: TaskType.TASK,
          priority: TaskPriority.MEDIUM,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 960,
          startDate: new Date(now.getTime() + 10 * oneDay),
          dueDate: new Date(now.getTime() + 3 * oneWeek),
        },
        {
          title: 'Performance optimization',
          description: 'Optimize bundle size, implement lazy loading, and improve page load times.',
          type: TaskType.TASK,
          priority: TaskPriority.LOW,
          storyPoints: 13,
          originalEstimate: 1440,
          remainingEstimate: 1440,
          startDate: new Date(now.getTime() + 4 * oneWeek),
          dueDate: new Date(now.getTime() + 8 * oneWeek),
        },
      ];
    } else if (project.name.includes('Backend API')) {
      return [
        {
          title: 'Set up NestJS project structure',
          description:
            'Initialize NestJS application with proper folder structure, modules, and configuration.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 3,
          originalEstimate: 480,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 20 * oneDay),
          dueDate: new Date(now.getTime() - 18 * oneDay),
        },
        {
          title: 'Design database schema',
          description:
            'Create comprehensive database schema with proper relationships and constraints.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 15 * oneDay),
          dueDate: new Date(now.getTime() - 10 * oneDay),
        },
        {
          title: 'Implement user CRUD operations',
          description:
            'Build complete user management API with create, read, update, delete operations.',
          type: TaskType.STORY,
          priority: TaskPriority.HIGH,
          storyPoints: 5,
          originalEstimate: 720,
          remainingEstimate: 120,
          startDate: new Date(now.getTime() - 8 * oneDay),
          dueDate: new Date(now.getTime() + 2 * oneDay),
        },
        {
          title: 'Add input validation middleware',
          description:
            'Implement comprehensive input validation using class-validator and transform pipes.',
          type: TaskType.TASK,
          priority: TaskPriority.MEDIUM,
          storyPoints: 3,
          originalEstimate: 360,
          remainingEstimate: 360,
          startDate: new Date(now.getTime() + oneDay),
          dueDate: new Date(now.getTime() + oneWeek),
        },
        {
          title: 'Fix database connection pool issue',
          description:
            'Database connections are not being properly released, causing pool exhaustion.',
          type: TaskType.BUG,
          priority: TaskPriority.HIGH,
          storyPoints: 5,
          originalEstimate: 480,
          remainingEstimate: 480,
          startDate: new Date(now.getTime()),
          dueDate: new Date(now.getTime() + 2 * oneDay),
        },
        {
          title: 'Implement rate limiting',
          description:
            'Add rate limiting middleware to prevent API abuse and ensure service stability.',
          type: TaskType.TASK,
          priority: TaskPriority.MEDIUM,
          storyPoints: 3,
          originalEstimate: 360,
          remainingEstimate: 360,
          startDate: new Date(now.getTime() + 3 * oneDay),
          dueDate: new Date(now.getTime() + oneWeek),
        },
        {
          title: 'API documentation with Swagger',
          description:
            'Generate comprehensive API documentation using Swagger/OpenAPI specifications.',
          type: TaskType.TASK,
          priority: TaskPriority.LOW,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 600,
          startDate: new Date(now.getTime() + oneWeek),
          dueDate: new Date(now.getTime() + 2 * oneWeek),
        },
        {
          title: 'Implement caching layer',
          description: 'Add Redis caching for frequently accessed data to improve API performance.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 960,
          startDate: new Date(now.getTime() + 2 * oneWeek),
          dueDate: new Date(now.getTime() + 4 * oneWeek),
        },
      ];
    } else if (project.name.includes('Design System')) {
      return [
        {
          title: 'Define color palette and typography',
          description:
            'Establish primary and secondary colors, typography scale, and spacing system.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 14 * oneDay),
          dueDate: new Date(now.getTime() - 10 * oneDay),
        },
        {
          title: 'Create button component variants',
          description:
            'Design and document all button states: primary, secondary, outline, ghost, with sizes.',
          type: TaskType.STORY,
          priority: TaskPriority.HIGH,
          storyPoints: 3,
          originalEstimate: 480,
          remainingEstimate: 120,
          startDate: new Date(now.getTime() - 7 * oneDay),
          dueDate: new Date(now.getTime() + oneDay),
        },
        {
          title: 'Build form input components',
          description:
            'Create text inputs, selects, checkboxes, and radio buttons with validation states.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 960,
          startDate: new Date(now.getTime() + 2 * oneDay),
          dueDate: new Date(now.getTime() + oneWeek),
        },
        {
          title: 'Document component usage guidelines',
          description: 'Write comprehensive documentation for when and how to use each component.',
          type: TaskType.TASK,
          priority: TaskPriority.MEDIUM,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 600,
          startDate: new Date(now.getTime() + oneWeek),
          dueDate: new Date(now.getTime() + 2 * oneWeek),
        },
        {
          title: 'Create navigation components',
          description:
            'Design and implement navigation bar, sidebar, breadcrumbs, and pagination components.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 960,
          startDate: new Date(now.getTime() + 10 * oneDay),
          dueDate: new Date(now.getTime() + 3 * oneWeek),
        },
        {
          title: 'Build modal and overlay components',
          description:
            'Create reusable modal, tooltip, popover, and drawer components with accessibility.',
          type: TaskType.TASK,
          priority: TaskPriority.LOW,
          storyPoints: 13,
          originalEstimate: 1440,
          remainingEstimate: 1440,
          startDate: new Date(now.getTime() + 3 * oneWeek),
          dueDate: new Date(now.getTime() + 6 * oneWeek),
        },
      ];
    } else if (project.name.includes('Marketing Campaign')) {
      return [
        {
          title: 'Research target audience',
          description: 'Conduct market research to identify key demographics and user personas.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 5,
          originalEstimate: 720,
          remainingEstimate: 0,
          startDate: new Date(now.getTime() - 12 * oneDay),
          dueDate: new Date(now.getTime() - 8 * oneDay),
        },
        {
          title: 'Create campaign messaging strategy',
          description: 'Develop key messages, value propositions, and communication guidelines.',
          type: TaskType.STORY,
          priority: TaskPriority.HIGH,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 240,
          startDate: new Date(now.getTime() - 6 * oneDay),
          dueDate: new Date(now.getTime() + 2 * oneDay),
        },
        {
          title: 'Design social media assets',
          description:
            'Create graphics, banners, and templates for various social media platforms.',
          type: TaskType.TASK,
          priority: TaskPriority.MEDIUM,
          storyPoints: 5,
          originalEstimate: 600,
          remainingEstimate: 600,
          startDate: new Date(now.getTime() + oneDay),
          dueDate: new Date(now.getTime() + oneWeek),
        },
        {
          title: 'Launch email campaign',
          description:
            'Set up automated email sequences and launch initial campaign to subscriber list.',
          type: TaskType.TASK,
          priority: TaskPriority.HIGH,
          storyPoints: 3,
          originalEstimate: 480,
          remainingEstimate: 480,
          startDate: new Date(now.getTime() + 5 * oneDay),
          dueDate: new Date(now.getTime() + 2 * oneWeek),
        },
        {
          title: 'Create landing page content',
          description: 'Write compelling copy and create visuals for campaign landing pages.',
          type: TaskType.STORY,
          priority: TaskPriority.MEDIUM,
          storyPoints: 8,
          originalEstimate: 960,
          remainingEstimate: 960,
          startDate: new Date(now.getTime() + oneWeek),
          dueDate: new Date(now.getTime() + 3 * oneWeek),
        },
      ];
    }

    // Default tasks for other projects
    const projectStartDate = project.startDate || new Date(now.getTime() - 30 * oneDay);
    return [
      {
        title: 'Project planning and requirements gathering',
        description: 'Define project scope, gather requirements, and create initial project plan.',
        type: TaskType.TASK,
        priority: TaskPriority.HIGH,
        storyPoints: 5,
        originalEstimate: 720,
        remainingEstimate: 0,
        startDate: projectStartDate,
        dueDate: new Date(projectStartDate.getTime() + 5 * oneDay),
      },
      {
        title: 'Set up project infrastructure',
        description: 'Initialize project repository, CI/CD pipeline, and development environment.',
        type: TaskType.TASK,
        priority: TaskPriority.HIGH,
        storyPoints: 3,
        originalEstimate: 480,
        remainingEstimate: 120,
        startDate: new Date(projectStartDate.getTime() + 3 * oneDay),
        dueDate: new Date(projectStartDate.getTime() + oneWeek),
      },
      {
        title: 'Implement core functionality',
        description: 'Build the main features and functionality as defined in requirements.',
        type: TaskType.STORY,
        priority: TaskPriority.MEDIUM,
        storyPoints: 13,
        originalEstimate: 1440,
        remainingEstimate: 1440,
        startDate: new Date(now.getTime() + oneDay),
        dueDate: new Date(now.getTime() + 3 * oneWeek),
      },
      {
        title: 'Testing and quality assurance',
        description: 'Write tests, perform manual testing, and ensure quality standards are met.',
        type: TaskType.TASK,
        priority: TaskPriority.MEDIUM,
        storyPoints: 8,
        originalEstimate: 960,
        remainingEstimate: 960,
        startDate: new Date(now.getTime() + 2 * oneWeek),
        dueDate: new Date(now.getTime() + 4 * oneWeek),
      },
      {
        title: 'Documentation and deployment',
        description: 'Create user documentation and deploy the application to production.',
        type: TaskType.TASK,
        priority: TaskPriority.LOW,
        storyPoints: 5,
        originalEstimate: 600,
        remainingEstimate: 600,
        startDate: new Date(now.getTime() + 3 * oneWeek),
        dueDate: new Date(now.getTime() + 5 * oneWeek),
      },
    ];
  }

  private distributeTasksAcrossStatuses(baseTasks: any[], availableStatuses: TaskStatus[]) {
    const tasksWithStatuses: Array<{ taskData: any; status: TaskStatus }> = [];

    // Sort statuses by position to maintain workflow order
    const sortedStatuses = [...availableStatuses].sort((a, b) => a.position - b.position);

    // Calculate how many tasks should be in each status category
    const todoStatuses = sortedStatuses.filter((s) => s.category === StatusCategory.TODO);
    const inProgressStatuses = sortedStatuses.filter(
      (s) => s.category === StatusCategory.IN_PROGRESS,
    );
    const doneStatuses = sortedStatuses.filter((s) => s.category === StatusCategory.DONE);

    // Distribution: ~40% TODO, ~35% IN_PROGRESS, ~25% DONE
    const totalTasks = baseTasks.length;
    const todoCount = Math.ceil(totalTasks * 0.4);
    const inProgressCount = Math.ceil(totalTasks * 0.35);
    const doneCount = totalTasks - todoCount - inProgressCount;

    let taskIndex = 0;

    // Assign DONE tasks first (oldest/completed tasks)
    for (let i = 0; i < doneCount && taskIndex < baseTasks.length; i++) {
      const status =
        doneStatuses[i % doneStatuses.length] ||
        sortedStatuses.find((s) => s.category === StatusCategory.DONE);
      if (status) {
        // Adjust remaining estimate for completed tasks
        const taskData = {
          ...baseTasks[taskIndex],
          remainingEstimate: 0,
        };
        tasksWithStatuses.push({ taskData, status });
        taskIndex++;
      }
    }

    // Assign IN_PROGRESS tasks (current work)
    for (let i = 0; i < inProgressCount && taskIndex < baseTasks.length; i++) {
      const status =
        inProgressStatuses[i % inProgressStatuses.length] ||
        sortedStatuses.find((s) => s.category === StatusCategory.IN_PROGRESS);
      if (status) {
        // Keep partial remaining estimates for in-progress tasks
        const taskData = {
          ...baseTasks[taskIndex],
          remainingEstimate: Math.floor(
            baseTasks[taskIndex].remainingEstimate * (0.3 + Math.random() * 0.6),
          ),
        };
        tasksWithStatuses.push({ taskData, status });
        taskIndex++;
      }
    }

    // Assign remaining tasks to TODO statuses
    while (taskIndex < baseTasks.length) {
      const status =
        todoStatuses[(taskIndex - doneCount - inProgressCount) % todoStatuses.length] ||
        sortedStatuses.find((s) => s.category === StatusCategory.TODO) ||
        sortedStatuses[0]; // fallback to first status

      if (status) {
        tasksWithStatuses.push({ taskData: baseTasks[taskIndex], status });
        taskIndex++;
      } else {
        break; // No status available
      }
    }

    return tasksWithStatuses;
  }

  private getAssigneesForTask(taskData: any, availableUsers: any[]): { id: string }[] {
    // Logic to determine multiple assignees
    const assignees: { id: string }[] = [];

    // Example logic - you can customize based on your needs
    if (taskData.complexity === 'HIGH') {
      // Assign multiple users for high complexity tasks
      assignees.push({ id: availableUsers[0]?.id }, { id: availableUsers[1]?.id });
    } else {
      // Single assignee for normal tasks
      assignees.push({ id: availableUsers[0]?.id });
    }

    return assignees.filter((assignee) => assignee.id); // Remove any null/undefined ids
  }

  private getCompletedDate(startDate: Date, dueDate: Date): Date {
    // Completed tasks should be completed between start and due date, or slightly after
    const timeDiff = dueDate.getTime() - startDate.getTime();
    const completionTime = startDate.getTime() + timeDiff * (0.8 + Math.random() * 0.4); // 80-120% of planned time
    return new Date(completionTime);
  }

  async clear() {
    console.log('🧹 Clearing tasks...');

    try {
      // Delete related data first to avoid foreign key constraints
      const deletedTimeEntries = await this.prisma.timeEntry.deleteMany();
      console.log(`   ✓ Deleted ${deletedTimeEntries.count} time entries`);

      const deletedTaskWatchers = await this.prisma.taskWatcher.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskWatchers.count} task watchers`);

      const deletedTaskLabels = await this.prisma.taskLabel.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskLabels.count} task labels`);

      const deletedTaskDependencies = await this.prisma.taskDependency.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskDependencies.count} task dependencies`);

      const deletedTaskAttachments = await this.prisma.taskAttachment.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskAttachments.count} task attachments`);

      const deletedTaskComments = await this.prisma.taskComment.deleteMany();
      console.log(`   ✓ Deleted ${deletedTaskComments.count} task comments`);

      // Finally delete tasks
      const deletedTasks = await this.prisma.task.deleteMany();
      console.log(`✅ Deleted ${deletedTasks.count} tasks`);
    } catch (_error) {
      console.error('❌ Error clearing tasks:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.task.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        taskNumber: true,
        slug: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        storyPoints: true,
        originalEstimate: true,
        remainingEstimate: true,
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
        assignees: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reporters: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        status: {
          select: {
            name: true,
            color: true,
            category: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            watchers: true,
            timeEntries: true,
          },
        },
        createdAt: true,
      },
      orderBy: [{ project: { name: 'asc' } }, { taskNumber: 'asc' }],
    });
  }
}
