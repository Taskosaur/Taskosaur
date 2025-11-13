import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskWatcher, Task, User } from '@prisma/client';

@Injectable()
export class TaskWatchersSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(tasks: Task[], users: User[]) {
    console.log('🌱 Seeding task watchers...');

    if (!tasks || tasks.length === 0) {
      throw new Error('Tasks must be seeded before task watchers');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before task watchers');
    }

    const createdWatchers: TaskWatcher[] = [];

    // Add watchers to selected tasks (not all tasks need watchers)
    const tasksWithWatchers = tasks.filter((_, index) => index % 3 === 0).slice(0, 15); // Every 3rd task, max 15

    for (const task of tasksWithWatchers) {
      // Get project members who might be interested in this task
      const projectMembers = await this.prisma.projectMember.findMany({
        where: { projectId: task.projectId },
        include: { user: true },
      });

      const availableUsers =
        projectMembers.length > 0 ? projectMembers.map((pm) => pm.user) : users.slice(0, 4); // fallback to first 4 users

      // Determine who should watch this task
      const watchersToAdd = this.determineWatchers(task, availableUsers);

      for (const watcher of watchersToAdd) {
        try {
          // Use the first available user as creator (in real scenario, users add themselves as watchers)
          const creatorUser = availableUsers[0] || users[0];

          const taskWatcher = await this.prisma.taskWatcher.create({
            data: {
              taskId: task.id,
              userId: watcher.id,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          createdWatchers.push(taskWatcher);
          console.log(
            `   ✓ Added ${watcher.firstName} ${watcher.lastName} as watcher for: ${task.title}`,
          );
        } catch (error) {
          console.error(error);
          // Skip if watcher already exists (unique constraint)
          console.log(
            `   ⚠ ${watcher.firstName} might already be watching this task, skipping...`,
          );
        }
      }
    }

    console.log(`✅ Task watchers seeding completed. Created ${createdWatchers.length} watchers.`);
    return createdWatchers;
  }

  private determineWatchers(task: Task, availableUsers: User[]): User[] {
    const watchers: User[] = [];
    const taskTitle = task.title.toLowerCase();
    const taskType = task.type;

    // Always add assignee and reporter as watchers (if they exist in available users)

    // Add role-based watchers based on task content
    const remainingUsers = availableUsers.filter((u) => !watchers.find((w) => w.id === u.id));

    // Frontend tasks - add designers and frontend developers
    if (
      taskTitle.includes('ui') ||
      taskTitle.includes('frontend') ||
      taskTitle.includes('dashboard') ||
      taskTitle.includes('component')
    ) {
      const frontendUsers = this.getUsersByRole(remainingUsers, ['designer', 'frontend', 'ui']);
      watchers.push(...frontendUsers.slice(0, 2));
    }

    // Backend/API tasks - add backend developers and architects
    if (
      taskTitle.includes('api') ||
      taskTitle.includes('backend') ||
      taskTitle.includes('database') ||
      taskTitle.includes('server')
    ) {
      const backendUsers = this.getUsersByRole(remainingUsers, ['backend', 'api', 'database']);
      watchers.push(...backendUsers.slice(0, 2));
    }

    // Security-related tasks - add security-focused team members
    if (
      taskTitle.includes('security') ||
      taskTitle.includes('authentication') ||
      taskTitle.includes('auth') ||
      taskTitle.includes('permission')
    ) {
      const securityUsers = this.getUsersByRole(remainingUsers, ['security', 'devops']);
      watchers.push(...securityUsers.slice(0, 1));
    }

    // Testing tasks - add QA team members
    if (taskTitle.includes('test') || taskTitle.includes('qa') || taskType === 'BUG') {
      const qaUsers = this.getUsersByRole(remainingUsers, ['qa', 'test']);
      watchers.push(...qaUsers.slice(0, 1));
    }

    // Design tasks - add design team members
    if (
      taskTitle.includes('design') ||
      taskTitle.includes('ux') ||
      taskTitle.includes('mockup') ||
      taskTitle.includes('wireframe')
    ) {
      const designUsers = this.getUsersByRole(remainingUsers, ['design', 'ux']);
      watchers.push(...designUsers.slice(0, 2));
    }

    // Marketing tasks - add marketing team members
    if (
      taskTitle.includes('marketing') ||
      taskTitle.includes('campaign') ||
      taskTitle.includes('content') ||
      taskTitle.includes('social')
    ) {
      const marketingUsers = this.getUsersByRole(remainingUsers, ['marketing', 'content']);
      watchers.push(...marketingUsers.slice(0, 1));
    }

    // High priority tasks - add managers/leads
    if (task.priority === 'HIGH' || task.priority === 'HIGHEST' || taskType === 'EPIC') {
      const managers = availableUsers
        .filter((u) => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN')
        .filter((u) => !watchers.find((w) => w.id === u.id));
      watchers.push(...managers.slice(0, 1));
    }

    // If we don't have enough watchers yet, add some random project members
    const currentWatcherIds = new Set(watchers.map((w) => w.id));
    const additionalUsers = remainingUsers.filter((u) => !currentWatcherIds.has(u.id));

    while (watchers.length < 3 && additionalUsers.length > 0) {
      const randomIndex = Math.floor(Math.random() * additionalUsers.length);
      watchers.push(additionalUsers.splice(randomIndex, 1)[0]);
    }

    // Remove duplicates and limit to reasonable number
    const uniqueWatchers = Array.from(new Map(watchers.map((w) => [w.id, w])).values());
    return uniqueWatchers.slice(0, 4); // Max 4 watchers per task
  }

  private getUsersByRole(users: User[], keywords: string[]): User[] {
    return users.filter((user) => {
      const userInfo =
        `${user.firstName} ${user.lastName} ${user.bio || ''} ${user.email}`.toLowerCase();
      return keywords.some((keyword) => userInfo.includes(keyword));
    });
  }

  async clear() {
    console.log('🧹 Clearing task watchers...');

    try {
      const deletedWatchers = await this.prisma.taskWatcher.deleteMany();
      console.log(`✅ Deleted ${deletedWatchers.count} task watchers`);
    } catch (_error) {
      console.error('❌ Error clearing task watchers:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.taskWatcher.findMany({
      select: {
        id: true,
        task: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            type: true,
            priority: true,
            project: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        createdAt: true,
      },
      orderBy: [
        { task: { project: { name: 'asc' } } },
        { task: { taskNumber: 'asc' } },
        { user: { firstName: 'asc' } },
      ],
    });
  }
}
