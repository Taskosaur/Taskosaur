import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { TaskWatcher } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskWatcherDto, WatchTaskDto, UnwatchTaskDto } from './dto/create-task-watcher.dto';

@Injectable()
export class TaskWatchersService {
  private readonly logger = new Logger(TaskWatchersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createTaskWatcherDto: CreateTaskWatcherDto): Promise<TaskWatcher> {
    const { taskId, userId } = createTaskWatcherDto;

    // Verify task exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      select: {
        id: true,
        title: true,
        slug: true,
        project: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: {
                id: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify user exists and has access to the task (through project membership)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        projectMembers: {
          where: { projectId: task.project.id },
          select: { id: true },
        },
        workspaceMembers: {
          where: { workspaceId: task.project.workspace.id },
          select: { id: true },
        },
        organizationMembers: {
          where: { organizationId: task.project.workspace.organizationId },
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has access to the task (project member, workspace member, or org member)
    const hasAccess =
      user.projectMembers.length > 0 ||
      user.workspaceMembers.length > 0 ||
      user.organizationMembers.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this task');
    }

    try {
      return await this.prisma.taskWatcher.create({
        data: {
          taskId: task.id,
          userId,
        },
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
          task: {
            select: {
              id: true,
              title: true,
              slug: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(error);
      if (error.code === 'P2002') {
        throw new ConflictException('User is already watching this task');
      }
      throw error;
    }
  }

  async watchTask(watchTaskDto: WatchTaskDto): Promise<TaskWatcher> {
    return this.create(watchTaskDto);
  }

  async unwatchTask(unwatchTaskDto: UnwatchTaskDto): Promise<void> {
    const { taskId, userId } = unwatchTaskDto;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    // Verify the watcher exists
    const watcher = await this.prisma.taskWatcher.findFirst({
      where: {
        userId,
        task: isUuid ? { id: taskId } : { slug: taskId },
      },
    });

    if (!watcher) {
      throw new NotFoundException('Task watcher not found');
    }

    await this.prisma.taskWatcher.delete({
      where: {
        taskId_userId: {
          taskId: watcher.taskId,
          userId,
        },
      },
    });
  }

  async findAll(taskId?: string, userId?: string): Promise<TaskWatcher[]> {
    const whereClause: any = {};
    if (taskId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
      const task = await this.prisma.task.findFirst({
        where: isUuid ? { id: taskId } : { slug: taskId },
        select: { id: true },
      });
      if (task) {
        whereClause.taskId = task.id;
      } else {
        return []; // Task not found, so no watchers
      }
    }
    if (userId) whereClause.userId = userId;

    return this.prisma.taskWatcher.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            priority: true,
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<TaskWatcher> {
    const watcher = await this.prisma.taskWatcher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            status: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            type: true,
            priority: true,
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
            assignees: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
            reporters: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!watcher) {
      throw new NotFoundException('Task watcher not found');
    }

    return watcher;
  }

  async getTaskWatchers(taskId: string): Promise<TaskWatcher[]> {
    // Verify task exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskWatcher.findMany({
      where: { taskId: task.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getUserWatchedTasks(userId: string): Promise<TaskWatcher[]> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.taskWatcher.findMany({
      where: { userId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            type: true,
            priority: true,
            dueDate: true,
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
            assignees: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    organization: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                comments: true,
                watchers: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async isUserWatchingTask(userId: string, taskId: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const watcher = await this.prisma.taskWatcher.findFirst({
      where: {
        userId,
        task: isUuid ? { id: taskId } : { slug: taskId },
      },
    });

    return !!watcher;
  }

  async remove(id: string, requestUserId: string): Promise<void> {
    // Get watcher info
    const watcher = await this.prisma.taskWatcher.findUnique({
      where: { id },
      select: { id: true, userId: true, taskId: true },
    });

    if (!watcher) {
      throw new NotFoundException('Task watcher not found');
    }

    // Only the watcher themselves can remove their watch (or admins can remove any)
    // For now, only allow self-removal
    if (watcher.userId !== requestUserId) {
      throw new ForbiddenException('You can only remove your own watch on tasks');
    }

    await this.prisma.taskWatcher.delete({
      where: { id },
    });
  }

  async toggleWatch(
    taskId: string,
    userId: string,
  ): Promise<{ isWatching: boolean; watcher?: TaskWatcher }> {
    const isWatching = await this.isUserWatchingTask(userId, taskId);

    if (isWatching) {
      await this.unwatchTask({ taskId, userId });
      return { isWatching: false };
    } else {
      const watcher = await this.watchTask({ taskId, userId });
      return { isWatching: true, watcher };
    }
  }

  async getWatcherStats(taskId?: string, userId?: string): Promise<any> {
    const whereClause: any = {};
    if (taskId) whereClause.taskId = taskId;
    if (userId) whereClause.userId = userId;

    const [totalWatchers, watchersByTask, recentWatches] = await Promise.all([
      // Total watchers count
      this.prisma.taskWatcher.count({
        where: whereClause,
      }),

      // Watchers grouped by task (if no specific task filter)
      !taskId
        ? this.prisma.taskWatcher.groupBy({
            by: ['taskId'],
            where: whereClause,
            _count: { taskId: true },
            orderBy: { _count: { taskId: 'desc' } },
            take: 10,
          })
        : Promise.resolve([]),

      // Recent watches (last 7 days)
      this.prisma.taskWatcher.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalWatchers,
      mostWatchedTasks: watchersByTask.length > 0 ? watchersByTask : undefined,
      recentWatches,
    };
  }
}
