import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TimeEntry, Role, ProjectVisibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { StartTimerDto, StopTimerDto } from './dto/time-tracking.dto';

// The authenticated principal, as populated on the request by JwtAuthGuard.
// Authorization must be derived from this, never from a client-supplied id.
export interface RequestingUser {
  id: string;
  role?: string;
}

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  // Whether the user may see a task (and therefore its time entries): the
  // owner of a project membership, a member of the workspace for an INTERNAL
  // project, anyone for a PUBLIC project, or a SUPER_ADMIN. This is the tenant
  // boundary for time tracking; without it any authenticated user could read
  // or mutate time entries in every other organization.
  private async canAccessTaskProject(taskId: string, user: RequestingUser): Promise<boolean> {
    if (user.role === Role.SUPER_ADMIN) return true;
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { project: { select: { id: true, visibility: true, workspaceId: true } } },
    });
    const project = task?.project;
    if (!project) return false;

    const projectMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      select: { role: true },
    });
    if (projectMember) return true;

    if (project.visibility === ProjectVisibility.PUBLIC) return true;

    if (project.visibility === ProjectVisibility.INTERNAL) {
      const workspaceMember = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId: project.workspaceId } },
        select: { role: true },
      });
      if (workspaceMember) return true;
    }

    return false;
  }

  async create(
    createTimeEntryDto: CreateTimeEntryDto,
    requestingUser: RequestingUser,
  ): Promise<TimeEntry> {
    const { taskId } = createTimeEntryDto;

    // The owner of a time entry is always the authenticated user. A
    // client-supplied userId is ignored so a caller cannot log or attribute
    // time on behalf of someone else.
    createTimeEntryDto.userId = requestingUser.id;

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, slug: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // The user may only log time against a task they can access.
    if (!(await this.canAccessTaskProject(taskId, requestingUser))) {
      throw new ForbiddenException('You do not have access to this task');
    }

    // Validate start/end time logic
    if (createTimeEntryDto.startTime && createTimeEntryDto.endTime) {
      const startTime = new Date(createTimeEntryDto.startTime);
      const endTime = new Date(createTimeEntryDto.endTime);

      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }

      // Calculate time spent from start/end times (in minutes)
      const calculatedTimeSpent = Math.round(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60),
      );
      createTimeEntryDto.timeSpent = calculatedTimeSpent;
    }

    return this.prisma.timeEntry.create({
      data: createTimeEntryDto,
      include: {
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
    });
  }

  async findAll(
    requestingUser: RequestingUser,
    taskId?: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TimeEntry[]> {
    const isSuperAdmin = requestingUser.role === Role.SUPER_ADMIN;
    const whereClause: any = {};

    if (taskId) {
      // Scoped to a task: the caller must be able to see that task, and may
      // then read every logger's entries on it.
      if (!(await this.canAccessTaskProject(taskId, requestingUser))) {
        throw new ForbiddenException('You do not have access to this task');
      }
      whereClause.taskId = taskId;
      if (userId) whereClause.userId = userId;
    } else {
      // No task scope: a caller may only list their own entries. A SUPER_ADMIN
      // may target another user explicitly. This closes the cross-tenant dump
      // that returned every organization's entries when no filter was given.
      whereClause.userId = isSuperAdmin && userId ? userId : requestingUser.id;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    return this.prisma.timeEntry.findMany({
      where: whereClause,
      include: {
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: string, requestingUser: RequestingUser): Promise<TimeEntry> {
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
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
    });

    if (!timeEntry) {
      throw new NotFoundException('Time entry not found');
    }

    // The caller may read the entry only if they own it or can access the
    // task's project. A cross-tenant read is reported as Not Found so the
    // endpoint does not confirm the existence of another tenant's entry.
    const isOwner = timeEntry.userId === requestingUser.id;
    if (!isOwner && !(await this.canAccessTaskProject(timeEntry.taskId, requestingUser))) {
      throw new NotFoundException('Time entry not found');
    }

    return timeEntry;
  }

  async update(
    id: string,
    updateTimeEntryDto: UpdateTimeEntryDto,
    requestUserId: string,
  ): Promise<TimeEntry> {
    // Verify time entry exists and user owns it
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!timeEntry) {
      throw new NotFoundException('Time entry not found');
    }

    if (timeEntry.userId !== requestUserId) {
      throw new ForbiddenException('You can only edit your own time entries');
    }

    // Validate start/end time logic if provided
    if (updateTimeEntryDto.startTime && updateTimeEntryDto.endTime) {
      const startTime = new Date(updateTimeEntryDto.startTime);
      const endTime = new Date(updateTimeEntryDto.endTime);

      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }

      // Calculate time spent from start/end times (in minutes)
      const calculatedTimeSpent = Math.round(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60),
      );
      updateTimeEntryDto.timeSpent = calculatedTimeSpent;
    }

    const updatedTimeEntry = await this.prisma.timeEntry.update({
      where: { id },
      data: updateTimeEntryDto,
      include: {
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return updatedTimeEntry;
  }

  async remove(id: string, requestUserId: string): Promise<void> {
    // Verify time entry exists and user owns it
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!timeEntry) {
      throw new NotFoundException('Time entry not found');
    }

    if (timeEntry.userId !== requestUserId) {
      throw new ForbiddenException('You can only delete your own time entries');
    }

    await this.prisma.timeEntry.delete({
      where: { id },
    });
  }

  // Time Tracking Methods
  async startTimer(
    startTimerDto: StartTimerDto,
    requestingUser: RequestingUser,
  ): Promise<{ message: string; activeTimer: any }> {
    const { taskId, description } = startTimerDto;
    // The timer always belongs to the authenticated user, never a supplied id.
    const userId = requestingUser.id;

    // Check if user already has an active timer
    const activeTimer = await this.getActiveTimer(userId);
    if (activeTimer) {
      throw new ConflictException('You already have an active timer running. Stop it first.');
    }

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, slug: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // The user may only start a timer on a task they can access.
    if (!(await this.canAccessTaskProject(taskId, requestingUser))) {
      throw new ForbiddenException('You do not have access to this task');
    }

    // Create a time entry with start time but no end time (active timer)
    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        description,
        startTime: new Date(),
        timeSpent: 0, // Will be calculated when timer is stopped
        date: new Date(),
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      message: 'Timer started successfully',
      activeTimer: timeEntry,
    };
  }

  async stopTimer(stopTimerDto: StopTimerDto, requestingUser: RequestingUser): Promise<TimeEntry> {
    const { description } = stopTimerDto;
    // Only the authenticated user's own timer may be stopped.
    const userId = requestingUser.id;

    // Find active timer for user
    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: {
        userId,
        startTime: { not: null },
        endTime: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!activeTimer) {
      throw new NotFoundException('No active timer found for this user');
    }

    const endTime = new Date();
    const timeSpent = Math.round(
      (endTime.getTime() - activeTimer.startTime!.getTime()) / (1000 * 60),
    );

    // Update the time entry with end time and calculated duration
    const stoppedTimer = await this.prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endTime,
        timeSpent,
        description: description || activeTimer.description,
      },
      include: {
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return stoppedTimer;
  }

  getActiveTimer(userId: string, requestingUser?: RequestingUser) {
    // When called on behalf of a request (not internally), a caller may only
    // inspect their own active timer unless they are a SUPER_ADMIN.
    if (
      requestingUser &&
      requestingUser.role !== Role.SUPER_ADMIN &&
      requestingUser.id !== userId
    ) {
      throw new ForbiddenException('You can only view your own active timer');
    }
    return this.prisma.timeEntry.findFirst({
      where: {
        userId,
        startTime: { not: null },
        endTime: null,
      },
      include: {
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });
  }

  // Reporting Methods
  async getTimeSpentSummary(
    requestingUser: RequestingUser,
    userId?: string,
    taskId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const isSuperAdmin = requestingUser.role === Role.SUPER_ADMIN;
    const whereClause: any = {};

    if (taskId) {
      if (!(await this.canAccessTaskProject(taskId, requestingUser))) {
        throw new ForbiddenException('You do not have access to this task');
      }
      whereClause.taskId = taskId;
      if (userId) whereClause.userId = userId;
    } else {
      // No task scope: summarise only the caller's own time (or a specific
      // user's, for a SUPER_ADMIN). Prevents a cross-tenant totals leak.
      whereClause.userId = isSuperAdmin && userId ? userId : requestingUser.id;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: whereClause,
      include: {
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const totalTimeSpent = timeEntries.reduce((sum, entry) => sum + entry.timeSpent, 0);
    const totalEntries = timeEntries.length;

    // Group by task
    type TaskSummaryAcc = Record<string, { task: any; totalTime: number; entries: number }>;
    const taskSummary = timeEntries.reduce((acc, entry): TaskSummaryAcc => {
      const taskKey = entry.task.slug;
      if (!acc[taskKey]) {
        acc[taskKey] = {
          task: entry.task,
          totalTime: 0,
          entries: 0,
        };
      }
      acc[taskKey].totalTime += entry.timeSpent;
      acc[taskKey].entries += 1;
      return acc;
    }, {} as TaskSummaryAcc);

    // Group by user
    type UserSummaryAcc = Record<string, { user: any; totalTime: number; entries: number }>;
    const userSummary = timeEntries.reduce((acc, entry): UserSummaryAcc => {
      const userKey = entry.user.id;
      if (!acc[userKey]) {
        acc[userKey] = {
          user: entry.user,
          totalTime: 0,
          entries: 0,
        };
      }
      acc[userKey].totalTime += entry.timeSpent;
      acc[userKey].entries += 1;
      return acc;
    }, {} as UserSummaryAcc);

    return {
      totalTimeSpent, // in minutes
      totalTimeSpentHours: Math.round((totalTimeSpent / 60) * 100) / 100, // in hours
      totalEntries,
      taskSummary: Object.values(taskSummary),
      userSummary: Object.values(userSummary),
      entries: timeEntries,
    };
  }
}
