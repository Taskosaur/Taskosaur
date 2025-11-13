import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskDependency, Task, User, DependencyType } from '@prisma/client';

@Injectable()
export class TaskDependenciesSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(tasks: Task[], users: User[]) {
    console.log('🌱 Seeding task dependencies...');

    if (!tasks || tasks.length === 0) {
      throw new Error('Tasks must be seeded before task dependencies');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before task dependencies');
    }

    const createdDependencies: TaskDependency[] = [];

    // Group tasks by project to create logical dependencies
    const tasksByProject = tasks.reduce(
      (acc, task) => {
        if (!acc[task.projectId]) {
          acc[task.projectId] = [];
        }
        acc[task.projectId].push(task);
        return acc;
      },
      {} as Record<string, Task[]>,
    );

    // Create dependencies within each project
    for (const projectTasks of Object.values(tasksByProject)) {
      if (projectTasks.length < 2) continue; // Need at least 2 tasks for dependencies

      const dependenciesData = this.createLogicalDependencies(projectTasks);

      for (const dependencyData of dependenciesData) {
        try {
          // Use first user as creator (in real scenario, this would be the user creating the dependency)
          const creatorUser = users[0];

          const dependency = await this.prisma.taskDependency.create({
            data: {
              ...dependencyData,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          createdDependencies.push(dependency);

          // Get task titles for logging
          const dependentTask = projectTasks.find((t) => t.id === dependencyData.dependentTaskId);
          const blockingTask = projectTasks.find((t) => t.id === dependencyData.blockingTaskId);

          console.log(
            `   ✓ Created dependency: "${dependentTask?.title}" ${dependencyData.type} "${blockingTask?.title}"`,
          );
        } catch (error) {
          console.error(error);
          // Skip if dependency already exists or there's a constraint violation
          console.log(`   ⚠ Dependency creation skipped (might already exist)`);
        }
      }
    }

    console.log(
      `✅ Task dependencies seeding completed. Created ${createdDependencies.length} dependencies.`,
    );
    return createdDependencies;
  }

  private createLogicalDependencies(tasks: Task[]) {
    const dependencies: Array<{
      dependentTaskId: string;
      blockingTaskId: string;
      type: DependencyType;
    }> = [];

    // Sort tasks by creation date to establish logical order
    const sortedTasks = [...tasks].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Create logical dependencies based on task types and names
    for (let i = 0; i < sortedTasks.length; i++) {
      const currentTask = sortedTasks[i];

      // Look for logical predecessors
      for (let j = 0; j < i; j++) {
        const potentialBlocker = sortedTasks[j];

        if (this.shouldCreateDependency(currentTask, potentialBlocker)) {
          dependencies.push({
            dependentTaskId: currentTask.id,
            blockingTaskId: potentialBlocker.id,
            type: this.getDependencyType(currentTask, potentialBlocker),
          });
        }
      }
    }

    // Limit to reasonable number of dependencies (avoid over-complication)
    return dependencies.slice(0, Math.min(dependencies.length, Math.floor(tasks.length / 2)));
  }

  private shouldCreateDependency(dependentTask: Task, blockingTask: Task): boolean {
    const dependent = dependentTask.title.toLowerCase();
    const blocking = blockingTask.title.toLowerCase();

    // Authentication/Setup dependencies
    if (
      dependent.includes('authentication') ||
      dependent.includes('login') ||
      dependent.includes('auth')
    ) {
      if (
        blocking.includes('setup') ||
        blocking.includes('environment') ||
        blocking.includes('structure') ||
        blocking.includes('foundation')
      ) {
        return true;
      }
    }

    // UI depends on backend/API
    if (
      dependent.includes('dashboard') ||
      dependent.includes('ui') ||
      dependent.includes('frontend')
    ) {
      if (
        blocking.includes('api') ||
        blocking.includes('backend') ||
        blocking.includes('authentication') ||
        blocking.includes('database')
      ) {
        return true;
      }
    }

    // Testing depends on implementation
    if (dependent.includes('test') || dependent.includes('qa')) {
      if (
        blocking.includes('implement') ||
        blocking.includes('create') ||
        blocking.includes('build')
      ) {
        return true;
      }
    }

    // Design system dependencies
    if (dependent.includes('component') && !dependent.includes('button')) {
      if (
        blocking.includes('button') ||
        blocking.includes('color') ||
        blocking.includes('typography') ||
        blocking.includes('design system')
      ) {
        return true;
      }
    }

    // Deployment depends on implementation
    if (dependent.includes('deploy') || dependent.includes('release')) {
      if (blocking.includes('implement') || blocking.includes('test') || blocking.includes('bug')) {
        return true;
      }
    }

    // Database schema before CRUD operations
    if (dependent.includes('crud') || dependent.includes('management')) {
      if (
        blocking.includes('schema') ||
        blocking.includes('database') ||
        blocking.includes('model')
      ) {
        return true;
      }
    }

    // Epic breakdown - epics don't depend on other tasks typically
    if (dependentTask.type === 'EPIC') {
      return false;
    }

    // Subtasks depend on parent stories
    if (dependentTask.type === 'SUBTASK' && blockingTask.type === 'STORY') {
      return true;
    }

    // Bug fixes might depend on features being implemented
    if (dependentTask.type === 'BUG') {
      if (blocking.includes('implement') && dependent.includes('fix')) {
        return true;
      }
    }

    return false;
  }

  private getDependencyType(dependentTask: Task, blockingTask: Task): DependencyType {
    // Most dependencies in software development are BLOCKS (finish-to-start)
    // The blocking task must be completed before the dependent task can start

    if (dependentTask.type === 'SUBTASK' && blockingTask.type === 'STORY') {
      return DependencyType.FINISH_START; // Story must finish before subtask starts
    }

    // For parallel work that needs coordination
    if (
      dependentTask.title.toLowerCase().includes('integration') ||
      blockingTask.title.toLowerCase().includes('api')
    ) {
      return DependencyType.FINISH_START; // API must be ready before integration
    }

    // Testing usually starts when implementation finishes
    if (
      dependentTask.title.toLowerCase().includes('test') ||
      dependentTask.title.toLowerCase().includes('qa')
    ) {
      return DependencyType.FINISH_START;
    }

    // Default to BLOCKS which is most common
    return DependencyType.BLOCKS;
  }

  async clear() {
    console.log('🧹 Clearing task dependencies...');

    try {
      const deletedDependencies = await this.prisma.taskDependency.deleteMany();
      console.log(`✅ Deleted ${deletedDependencies.count} task dependencies`);
    } catch (_error) {
      console.error('❌ Error clearing task dependencies:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.taskDependency.findMany({
      select: {
        id: true,
        type: true,
        dependentTask: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            type: true,
            project: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        blockingTask: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            type: true,
            project: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
