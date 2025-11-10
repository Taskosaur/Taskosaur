import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkDueDateReminders() {
    this.logger.log('Checking for due date reminders...');

    try {
      const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

      // Find tasks due within 24 hours
      const tasksDueSoon = await this.prisma.task.findMany({
        where: {
          dueDate: {
            gte: new Date(),
            lte: oneDayFromNow,
          },
          assignees: {
            some: {}, // At least one assignee
          },
          status: {
            category: {
              not: 'DONE',
            },
          },
        },
        include: {
          assignees: true,
        },
      });

      // Find tasks due within 1 hour (urgent)
      const urgentTasks = await this.prisma.task.findMany({
        where: {
          dueDate: {
            gte: new Date(),
            lte: oneHourFromNow,
          },
          assignees: {
            some: {}, // At least one assignee
          },
          status: {
            category: {
              not: 'DONE',
            },
          },
        },
        include: {
          assignees: true,
        },
      });

      // Send reminders
      for (const task of tasksDueSoon) {
        await this.emailService.sendDueDateReminderEmail(task.id);
      }

      // Log results
      this.logger.log(
        `Sent ${tasksDueSoon.length} due date reminders (${urgentTasks.length} urgent)`,
      );
    } catch (error) {
      this.logger.error('Failed to check due date reminders:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkOverdueTasks() {
    this.logger.log('Checking for overdue tasks...');

    try {
      const overdueTasks = await this.prisma.task.findMany({
        where: {
          dueDate: {
            lt: new Date(),
          },
          assignees: {
            some: {}, // At least one assignee
          },
          status: {
            category: {
              not: 'DONE',
            },
          },
        },
        include: {
          assignees: true, // Multiple assignees instead of single assignee
          project: {
            include: {
              workspace: {
                include: {
                  organization: true,
                },
              },
            },
          },
        },
      });

      // Define types for better type safety
      type TaskAssignee = {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };

      type OverdueTask = (typeof overdueTasks)[number];

      // Group overdue tasks by assignee using Map
      const tasksByAssignee = new Map<string, { assignee: TaskAssignee; tasks: OverdueTask[] }>();

      // Process each task and its assignees
      for (const task of overdueTasks) {
        // Iterate through all assignees for each task
        for (const assignee of task.assignees) {
          if (!assignee?.email) continue;

          const assigneeId = assignee.id;

          // Initialize assignee entry if not exists
          if (!tasksByAssignee.has(assigneeId)) {
            tasksByAssignee.set(assigneeId, {
              assignee: assignee,
              tasks: [],
            });
          }

          // Add task to this assignee's list
          tasksByAssignee.get(assigneeId)!.tasks.push(task);
        }
      }

      // Send overdue notifications to each assignee
      const emailPromises: Promise<void>[] = [];

      for (const [, { assignee, tasks }] of tasksByAssignee) {
        const emailPromise = this.emailService.sendEmail({
          to: assignee.email,
          subject: `Overdue Tasks (${tasks.length})`,
          template: 'task-overdue' as any,
          data: {
            assignee: {
              name: `${assignee.firstName} ${assignee.lastName}`,
            },
            tasks: tasks.map((task) => ({
              id: task.id,
              key: task.slug, // Changed from task.key to task.slug based on schema
              title: task.title,
              dueDate: task.dueDate,
              project: task.project.name,
              organization: task.project.workspace.organization.name,
              daysOverdue: task.dueDate
                ? Math.ceil((Date.now() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0,
              // Additional info for shared tasks
              isShared: task.assignees.length > 1,
              coAssignees: task.assignees
                .filter((a) => a.id !== assignee.id)
                .map((a) => `${a.firstName} ${a.lastName}`)
                .join(', '),
            })),
          },
          priority: 'high' as any,
        });

        emailPromises.push(emailPromise);
      }

      // Send all emails concurrently
      await Promise.all(emailPromises);

      this.logger.log(
        `Sent overdue notifications to ${tasksByAssignee.size} users for ${overdueTasks.length} tasks`,
      );
    } catch (error) {
      this.logger.error('Failed to check overdue tasks:', error);
    }
  }

  @Cron('0 9 * * 1') // Monday at 9 AM
  async sendWeeklySummaries() {
    this.logger.log('Sending weekly summaries...');

    try {
      // Get all active users who have been assigned tasks
      const activeUsers = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          assignedTasks: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Active in last 30 days
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      // Send weekly summary to each user
      for (const user of activeUsers) {
        await this.emailService.sendWeeklySummaryEmail(user.id);
      }

      this.logger.log(`Sent weekly summaries to ${activeUsers.length} users`);
    } catch (error) {
      this.logger.error('Failed to send weekly summaries:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldData() {
    this.logger.log('Cleaning up old data...');

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // Cleanup old notifications
      const deletedNotifications = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
          // read: true, // Remove until we add read field
        },
      });

      // Cleanup old activity logs (keep for 90 days)
      const deletedActivityLogs = await this.prisma.activityLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      // Cleanup old rule executions (keep for 30 days)
      const deletedRuleExecutions = await this.prisma.ruleExecution.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cleanup completed: ${deletedNotifications.count} notifications, ` +
          `${deletedActivityLogs.count} activity logs, ` +
          `${deletedRuleExecutions.count} rule executions`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old data:', error);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async updateSprintStatuses() {
    this.logger.log('Updating sprint statuses...');

    try {
      const now = new Date();

      // Mark sprints as active if they've started
      const sprintsToActivate = await this.prisma.sprint.updateMany({
        where: {
          status: 'PLANNING',
          startDate: {
            lte: now,
          },
        },
        data: {
          status: 'ACTIVE',
        },
      });

      // Mark sprints as completed if they've ended
      const sprintsToComplete = await this.prisma.sprint.updateMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            lte: now,
          },
        },
        data: {
          status: 'COMPLETED',
        },
      });

      this.logger.log(
        `Sprint status updates: ${sprintsToActivate.count} activated, ` +
          `${sprintsToComplete.count} completed`,
      );
    } catch (error) {
      this.logger.error('Failed to update sprint statuses:', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generateAnalytics() {
    this.logger.log('Generating weekly analytics...');

    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Generate organization-level analytics
      const organizations = await this.prisma.organization.findMany({
        select: { id: true },
      });

      for (const org of organizations) {
        const [tasksCreated, tasksCompleted, totalTimeSpent, activeUsers] = await Promise.all([
          this.prisma.task.count({
            where: {
              project: {
                workspace: {
                  organizationId: org.id,
                },
              },
              createdAt: {
                gte: oneWeekAgo,
              },
            },
          }),
          this.prisma.task.count({
            where: {
              project: {
                workspace: {
                  organizationId: org.id,
                },
              },
              status: {
                category: 'DONE',
              },
              updatedAt: {
                gte: oneWeekAgo,
              },
            },
          }),
          this.prisma.timeEntry.aggregate({
            where: {
              task: {
                project: {
                  workspace: {
                    organizationId: org.id,
                  },
                },
              },
              date: {
                gte: oneWeekAgo,
              },
            },
            _sum: {
              timeSpent: true,
            },
          }),
          this.prisma.user.count({
            where: {
              organizationMembers: {
                some: {
                  organizationId: org.id,
                },
              },
              // lastActiveAt: { gte: oneWeekAgo }, // Remove until we add lastActiveAt field
              updatedAt: {
                gte: oneWeekAgo,
              },
            },
          }),
        ]);

        // Store analytics data (you could create an Analytics model for this)
        this.logger.debug(
          `Org ${org.id} weekly stats: ${tasksCreated} created, ${tasksCompleted} completed, ${totalTimeSpent._sum.timeSpent || 0} mins tracked, ${activeUsers} active users`,
        );
      }

      this.logger.log(`Generated analytics for ${organizations.length} organizations`);
    } catch (error) {
      this.logger.error('Failed to generate analytics:', error);
    }
  }
}
