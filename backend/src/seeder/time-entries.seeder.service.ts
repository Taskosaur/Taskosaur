import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimeEntry, Task, User } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TimeEntriesSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(tasks: Task[], users: User[]) {
    console.log('🌱 Seeding time entries...');

    if (!tasks || tasks.length === 0) {
      throw new Error('Tasks must be seeded before time entries');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before time entries');
    }

    const createdTimeEntries: TimeEntry[] = [];

    // Add time entries to tasks that have been worked on (about 60% of tasks)
    const tasksWithTime = tasks.filter(() => Math.random() < 0.6);

    for (const task of tasksWithTime) {
      // Get users who might log time on this task
      const projectMembers = await this.prisma.projectMember.findMany({
        where: { projectId: task.projectId },
        include: { user: true },
      });

      const availableUsers =
        projectMembers.length > 0 ? projectMembers.map((pm) => pm.user) : users.slice(0, 4); // fallback to first 4 users

      // Generate realistic time entries for this task
      const timeEntriesData = this.generateTimeEntriesForTask(task, availableUsers);

      for (const timeEntryData of timeEntriesData) {
        try {
          const timeEntry = await this.prisma.timeEntry.create({
            data: {
              ...timeEntryData,
              taskId: task.id,
              createdBy: timeEntryData.userId,
              updatedBy: timeEntryData.userId,
            },
          });

          createdTimeEntries.push(timeEntry);

          const user = availableUsers.find((u) => u.id === timeEntryData.userId);
          const hours = Math.floor(timeEntryData.timeSpent / 60);
          const minutes = timeEntryData.timeSpent % 60;

          console.log(`   ✓ Logged ${hours}h ${minutes}m by ${user?.firstName} on: ${task.title}`);
        } catch (_error) {
          console.error(_error);
          console.log(`   ⚠ Error creating time entry for task ${task.title}: ${_error.message}`);
        }
      }
    }

    console.log(
      `✅ Time entries seeding completed. Created ${createdTimeEntries.length} time entries.`,
    );
    return createdTimeEntries;
  }

  private generateTimeEntriesForTask(task: Task, availableUsers: User[]) {
    const timeEntries: Array<{
      description: string;
      timeSpent: number;
      startTime?: Date;
      endTime?: Date;
      date: Date;
      userId: string;
    }> = [];

    // Determine how much total time should be logged based on task estimates
    const estimatedTime = task.originalEstimate || this.getDefaultEstimate(task);
    const actualTimeSpent = Math.floor(
      estimatedTime * (0.7 + (crypto.randomInt(0, 100000) / 100000) * 0.6),
    ); // 70-130% of estimate

    let remainingTime = actualTimeSpent;
    const workDays = this.generateWorkDays(7); // Last 7 days

    // Distribute work across multiple days and users
    while (remainingTime > 0 && workDays.length > 0) {
      const workDay = workDays.shift()!;
      const workingUsers = this.selectWorkingUsers(task, availableUsers);

      for (const user of workingUsers) {
        if (remainingTime <= 0) break;

        // Generate 1-3 time entries per user per day
        const entriesCount = Math.min(
          crypto.randomInt(1, 4), // randomInt is [min, max), so 1-3 inclusive
          Math.ceil(remainingTime / 120),
        ); // Max 3 entries, or enough to cover remaining time

        for (let i = 0; i < entriesCount && remainingTime > 0; i++) {
          const sessionTime = this.generateSessionTime(remainingTime, task.type);
          const { startTime, endTime } = this.generateWorkingHours(workDay);

          timeEntries.push({
            description: this.generateTimeEntryDescription(task, i),
            timeSpent: sessionTime,
            startTime,
            endTime,
            date: workDay,
            userId: user.id,
          });

          remainingTime -= sessionTime;
        }
      }
    }

    return timeEntries;
  }

  private getDefaultEstimate(task: Task): number {
    // Default estimates based on task type (in minutes)
    switch (task.type) {
      case 'EPIC':
        return 2400; // 40 hours
      case 'STORY':
        return 480; // 8 hours
      case 'BUG':
        return 180; // 3 hours
      case 'SUBTASK':
        return 120; // 2 hours
      default:
        return 360; // 6 hours for regular tasks
    }
  }

  private generateWorkDays(count: number): Date[] {
    const days: Date[] = [];
    const today = new Date();

    for (let i = count - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);

      // Skip weekends (basic implementation)
      if (day.getDay() !== 0 && day.getDay() !== 6) {
        days.push(day);
      }
    }

    return days;
  }

  private selectWorkingUsers(task: Task, availableUsers: User[]): User[] {
    const workingUsers: User[] = [];

    // Always include assignee if available
    // if (task.assigneeId) {
    //   const assignee = availableUsers.find((u) => u.id === task.assigneeId);
    //   if (assignee) workingUsers.push(assignee);
    // }

    // 30% chance to include additional collaborators
    // if (Math.random() < 0.3 && availableUsers.length > 1) {
    //   const otherUsers = availableUsers.filter((u) => u.id !== task.assigneeId);
    //   if (otherUsers.length > 0) {
    //     const randomUser =
    //       otherUsers[Math.floor(Math.random() * otherUsers.length)];
    //     workingUsers.push(randomUser);
    //   }
    // }

    // Fallback to random user if no assignee
    if (workingUsers.length === 0) {
      workingUsers.push(availableUsers[crypto.randomInt(availableUsers.length)]);
    }

    return workingUsers;
  }

  private generateSessionTime(remainingTime: number, taskType: string): number {
    // Generate realistic work sessions based on task type
    const minSession = 30; // 30 minutes minimum
    let maxSession = 240; // 4 hours maximum

    if (taskType === 'BUG') {
      maxSession = 120; // Bugs usually take shorter focused sessions
    } else if (taskType === 'EPIC') {
      maxSession = 480; // Epics can have longer sessions
    }

    const sessionTime = Math.min(remainingTime, crypto.randomInt(minSession, maxSession));

    return sessionTime;
  }

  private generateWorkingHours(date: Date): { startTime: Date; endTime: Date } {
    // Generate realistic working hours (9 AM to 6 PM)
    const startHour = 9 + Math.floor(Math.random() * 8); // 9 AM to 4 PM start
    const sessionLength = 1 + Math.floor(Math.random() * 4); // 1-4 hour sessions

    const startTime = new Date(date);
    startTime.setHours(startHour, Math.floor(Math.random() * 60), 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + sessionLength);

    return { startTime, endTime };
  }

  private generateTimeEntryDescription(task: Task, sessionIndex: number): string {
    const taskTitle = task.title.toLowerCase();
    const descriptions = [
      // General development activities
      'Initial research and planning',
      'Implementation work',
      'Code review and refactoring',
      'Testing and debugging',
      'Documentation updates',
      'Final testing and cleanup',

      // Bug-specific activities
      'Investigating the issue',
      'Reproducing the bug',
      'Implementing the fix',
      'Testing the fix',

      // Feature-specific activities
      'Designing the solution',
      'Implementing core functionality',
      'Adding error handling',
      'Integration with existing code',
      'User interface adjustments',

      // Task-specific descriptions
      taskTitle.includes('auth') ? 'Working on authentication logic' : null,
      taskTitle.includes('ui') || taskTitle.includes('dashboard')
        ? 'UI development and styling'
        : null,
      taskTitle.includes('api') ? 'API endpoint development' : null,
      taskTitle.includes('database') ? 'Database schema and queries' : null,
      taskTitle.includes('test') ? 'Writing and running tests' : null,
    ].filter(Boolean) as string[];

    // Select appropriate description based on session index and task content
    if (sessionIndex === 0) {
      return descriptions[0] || 'Started working on the task';
    } else if (sessionIndex < descriptions.length) {
      return descriptions[sessionIndex];
    } else {
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    }
  }

  async clear() {
    console.log('🧹 Clearing time entries...');

    try {
      const deletedEntries = await this.prisma.timeEntry.deleteMany();
      console.log(`✅ Deleted ${deletedEntries.count} time entries`);
    } catch (_error) {
      console.error('❌ Error clearing time entries:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.timeEntry.findMany({
      select: {
        id: true,
        description: true,
        timeSpent: true,
        startTime: true,
        endTime: true,
        date: true,
        task: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
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
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 100, // Limit to recent entries
    });
  }
}
