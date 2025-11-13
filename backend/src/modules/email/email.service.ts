import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '../queue/decorators/inject-queue.decorator';
import { IQueue } from '../queue/interfaces/queue.interface';
import {
  SendEmailDto,
  BulkEmailDto,
  EmailJobData,
  EmailTemplate,
  EmailPriority,
} from './dto/email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email') private emailQueue: IQueue<EmailJobData>,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendEmail(emailDto: SendEmailDto): Promise<void> {
    const jobData: EmailJobData = {
      to: emailDto.to,
      subject: emailDto.subject,
      template: emailDto.template,
      data: emailDto.data,
      priority: emailDto.priority || EmailPriority.NORMAL,
    };

    const priority = this.getPriorityNumber(emailDto.priority || EmailPriority.NORMAL);

    await this.emailQueue.add('send-email', jobData, {
      priority,
      delay: emailDto.delay || 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(`Email queued for ${emailDto.to} with template ${emailDto.template}`);
  }

  async sendBulkEmail(bulkEmailDto: BulkEmailDto): Promise<void> {
    const jobs = bulkEmailDto.recipients.map((recipient, index) => ({
      name: 'send-email',
      data: {
        to: recipient,
        subject: bulkEmailDto.subject,
        template: bulkEmailDto.template,
        data: bulkEmailDto.data,
        priority: bulkEmailDto.priority || EmailPriority.NORMAL,
      } as EmailJobData,
      opts: {
        priority: this.getPriorityNumber(bulkEmailDto.priority || EmailPriority.NORMAL),
        delay: index * 100, // Stagger emails by 100ms to avoid rate limiting
        attempts: 3,
      },
    }));

    await this.emailQueue.addBulk(jobs);
    this.logger.log(`Bulk email queued for ${bulkEmailDto.recipients.length} recipients`);
  }

  // Notification helpers
  async sendTaskAssignedEmail(
    taskId: string,
    assigneeIds: string[], // Changed from single assigneeId to array
    assignedById: string,
  ): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignees: true, // Changed from assignee to assignees
          reporters: true, // Changed from reporter to reporters
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

      if (!task?.assignees?.length) {
        this.logger.warn(`No assignees found for task ${taskId}`);
        return;
      }

      // Get the user who assigned the task
      const assignedByUser = await this.prisma.user.findUnique({
        where: { id: assignedById },
      });

      // Send email to each assignee
      for (const assignee of task.assignees) {
        if (!assignee.email) {
          this.logger.warn(`No email found for assignee ${assignee.id}`);
          continue;
        }

        await this.sendEmail({
          to: assignee.email,
          subject: `Task Assigned: ${task.title}`,
          template: EmailTemplate.TASK_ASSIGNED,
          data: {
            task: {
              id: task.id,
              key: task.slug,
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
            },
            assignee: {
              name: `${assignee.firstName} ${assignee.lastName}`,
              email: assignee.email,
            },
            assignedBy: {
              name: assignedByUser
                ? `${assignedByUser.firstName} ${assignedByUser.lastName}`
                : 'System',
              email: assignedByUser?.email,
            },
            project: {
              name: task.project.name,
              key: task.project.slug,
            },
            organization: {
              name: task.project.workspace.organization.name,
            },
            taskUrl: `${this.configService.get('FRONTEND_URL')}/tasks/${task.slug}`,
          },
          priority: EmailPriority.HIGH,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send task assigned email: ${error.message}`);
    }
  }

  async sendDueDateReminderEmail(taskId: string): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignees: true, // Changed from assignee to assignees
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

      if (!task?.assignees?.length || !task.dueDate) {
        return;
      }

      const hoursUntilDue = Math.round((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60));

      // Send reminder to all assignees
      const emailPromises = task.assignees
        .filter((assignee) => assignee.email) // Only assignees with email
        .map((assignee) =>
          this.sendEmail({
            to: assignee.email,
            subject: `Task Due Soon: ${task.title}`,
            template: EmailTemplate.DUE_DATE_REMINDER,
            data: {
              task: {
                id: task.id,
                key: task.slug,
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueDate: task.dueDate,
                hoursUntilDue,
              },
              assignee: {
                name: `${assignee.firstName} ${assignee.lastName}`,
              },
              project: {
                name: task.project.name,
                key: task.project.slug,
              },
              taskUrl: `${this.configService.get('FRONTEND_URL')}/tasks/${task.slug}`,
            },
            priority: hoursUntilDue <= 2 ? EmailPriority.HIGH : EmailPriority.NORMAL,
          }),
        );

      // Send all emails concurrently
      await Promise.all(emailPromises);
    } catch (error) {
      this.logger.error(`Failed to send due date reminder email: ${error.message}`);
    }
  }

  async sendTaskStatusChangedEmail(taskId: string, oldStatusId: string): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignees: true, // Changed from assignee to assignees
          reporters: true, // Changed from reporter to reporters
          status: true,
          project: {
            include: {
              workspace: {
                include: {
                  organization: true,
                },
              },
            },
          },
          watchers: {
            include: {
              user: true,
            },
          },
        },
      });

      const oldStatus = await this.prisma.taskStatus.findUnique({
        where: { id: oldStatusId },
      });

      if (!task || !oldStatus) {
        return;
      }

      // Collect all recipients (assignees, reporters, watchers)
      const recipients = new Set<string>();

      // Add all assignees' emails
      task.assignees?.forEach((assignee) => {
        if (assignee.email) {
          recipients.add(assignee.email);
        }
      });

      // Add all reporters' emails
      task.reporters?.forEach((reporter) => {
        if (reporter.email) {
          recipients.add(reporter.email);
        }
      });

      // Add watchers' emails
      task.watchers.forEach((watcher) => {
        if (watcher.user.email) {
          recipients.add(watcher.user.email);
        }
      });

      if (recipients.size === 0) {
        return;
      }

      await this.sendBulkEmail({
        recipients: Array.from(recipients),
        subject: `Task Status Changed: ${task.title}`,
        template: EmailTemplate.TASK_STATUS_CHANGED,
        data: {
          task: {
            id: task.id,
            key: task.slug,
            title: task.title,
            description: task.description,
          },
          oldStatus: {
            name: oldStatus.name,
            color: oldStatus.color,
          },
          newStatus: {
            name: task.status.name,
            color: task.status.color,
          },
          project: {
            name: task.project.name,
            key: task.project.slug,
          },
          taskUrl: `${this.configService.get('FRONTEND_URL')}/tasks/${task.slug}`,
        },
        priority: EmailPriority.NORMAL,
      });
    } catch (error) {
      this.logger.error(`Failed to send status changed email: ${error.message}`);
    }
  }

  async sendWeeklySummaryEmail(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user?.email) {
        return;
      }

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get user's tasks summary for the past week
      const [tasksCompleted, tasksAssigned, totalTimeSpent] = await Promise.all([
        this.prisma.task.count({
          where: {
            assignees: {
              // Changed from assigneeId to assignees relation
              some: { id: userId },
            },
          },
        }),
        this.prisma.task.count({
          where: {
            assignees: {
              // Changed from assigneeId to assignees relation
              some: { id: userId },
            },
            createdAt: {
              gte: oneWeekAgo,
            },
          },
        }),
        this.prisma.timeEntry.aggregate({
          where: {
            userId,
            date: {
              gte: oneWeekAgo,
            },
          },
          _sum: {
            timeSpent: true,
          },
        }),
      ]);

      const overdueTasks = await this.prisma.task.findMany({
        where: {
          assignees: {
            // Changed from assigneeId to assignees relation
            some: { id: userId },
          },
          dueDate: {
            lt: new Date(),
          },
          status: {
            category: {
              not: 'DONE',
            },
          },
        },
        include: {
          project: true,
        },
        take: 5,
      });

      await this.sendEmail({
        to: user.email,
        subject: 'Your Weekly Summary',
        template: EmailTemplate.WEEKLY_SUMMARY,
        data: {
          user: {
            name: `${user.firstName} ${user.lastName}`,
          },
          summary: {
            tasksCompleted,
            tasksAssigned,
            totalTimeSpent: Math.round((totalTimeSpent._sum.timeSpent || 0) / 60), // Convert to hours
            overdueTasks: overdueTasks.map((task) => ({
              key: task.slug,
              title: task.title,
              dueDate: task.dueDate,
              project: task.project.name,
              url: `${this.configService.get('FRONTEND_URL')}/tasks/${task.slug}`,
            })),
          },
        },
        priority: EmailPriority.LOW,
      });
    } catch (error) {
      this.logger.error(`Failed to send weekly summary email: ${error.message}`);
    }
  }

  private getPriorityNumber(priority: EmailPriority): number {
    switch (priority) {
      case EmailPriority.CRITICAL:
        return 1;
      case EmailPriority.HIGH:
        return 2;
      case EmailPriority.NORMAL:
        return 3;
      case EmailPriority.LOW:
        return 4;
      default:
        return 3;
    }
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.emailQueue.getWaiting(),
      this.emailQueue.getActive(),
      this.emailQueue.getCompleted(),
      this.emailQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
  async sendPasswordResetEmail(
    email: string,
    data: {
      userName: string;
      resetToken: string;
      resetUrl: string;
    },
  ): Promise<void> {
    try {
      await this.sendEmail({
        to: email,
        subject: 'Reset Your Password',
        template: EmailTemplate.PASSWORD_RESET, // Add this to your EmailTemplate enum if not exists
        data: {
          userName: data.userName,
          resetToken: data.resetToken,
          resetUrl: data.resetUrl,
          // Add any other data your email template needs
        },
        priority: EmailPriority.HIGH, // Password reset is high priority
      });

      this.logger.log(`Password reset email queued for ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw error; // Re-throw to handle at caller level
    }
  }
  // src/modules/email/email.service.ts
  async sendPasswordResetConfirmationEmail(
    email: string,
    data: {
      userName: string;
      resetTime: string;
    },
  ): Promise<void> {
    try {
      const emailData = {
        ...data,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@taskosaur.com'),
        companyName: 'Taskosaur',
      };

      await this.sendEmail({
        to: email,
        subject: 'Password Successfully Reset - Taskosaur',
        template: EmailTemplate.PASSWORD_RESET_CONFIRMATION,
        data: emailData,
        priority: EmailPriority.HIGH,
      });
    } catch (error) {
      console.error(`Failed to send password reset confirmation email to ${email}:`, error);
      // Don't throw error here as password was already reset successfully
    }
  }
  async sendInvitationEmail(
    email: string,
    data: {
      inviterName: string;
      entityName: string;
      entityType: string;
      role: string;
      invitationUrl: string;
      expiresAt: string;
    },
  ): Promise<void> {
    try {
      const emailData = {
        ...data,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@taskosaur.com'),
        companyName: 'Taskosaur',
      };

      await this.sendEmail({
        to: email,
        subject: `You're invited to join ${data.entityName} - Taskosaur`,
        template: EmailTemplate.SEND_INVITATION,
        data: emailData,
        priority: EmailPriority.NORMAL,
      });
    } catch (error) {
      console.error(
        `Failed to send invitation email to ${email} for ${data.entityType} ${data.entityName}:`,
        error,
      );
      throw error; // Throw error here as invitation sending failure should be handled
    }
  }
  async sendDirectAddNotificationEmail(
    email: string,
    data: {
      inviterName: string;
      entityName: string;
      entityType: 'workspace' | 'project';
      role: string;
      entityUrl: string;
      organizationName?: string;
    },
  ): Promise<void> {
    try {
      const emailData = {
        ...data,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@taskosaur.com'),
        companyName: 'Taskosaur',
      };

      // const _entityTypeLabel = data.entityType === 'workspace' ? 'workspace' : 'project';

      await this.sendEmail({
        to: email,
        subject: `You've been added to ${data.entityName} - Taskosaur`,
        template: EmailTemplate.DIRECT_ADD_NOTIFICATION,
        data: emailData,
        priority: EmailPriority.NORMAL,
      });
    } catch (error) {
      console.error(
        `Failed to send direct add notification email to ${email} for ${data.entityType} ${data.entityName}:`,
        error,
      );
      throw error;
    }
  }
}
