import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TimeEntry } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { StartTimerDto, StopTimerDto } from './dto/time-tracking.dto';

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  async create(createTimeEntryDto: CreateTimeEntryDto): Promise<TimeEntry> {
    const { taskId, userId } = createTimeEntryDto;

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, slug: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
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

  findAll(
    taskId?: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TimeEntry[]> {
    const whereClause: any = {};

    if (taskId) whereClause.taskId = taskId;
    if (userId) whereClause.userId = userId;

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

  async findOne(id: string): Promise<TimeEntry> {
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
  async startTimer(startTimerDto: StartTimerDto): Promise<{ message: string; activeTimer: any }> {
    const { taskId, userId, description } = startTimerDto;

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

  async stopTimer(stopTimerDto: StopTimerDto): Promise<TimeEntry> {
    const { userId, description } = stopTimerDto;

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

  getActiveTimer(userId: string) {
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
    userId?: string,
    taskId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const whereClause: any = {};

    if (userId) whereClause.userId = userId;
    if (taskId) whereClause.taskId = taskId;

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
