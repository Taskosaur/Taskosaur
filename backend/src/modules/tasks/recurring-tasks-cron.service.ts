import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurrenceService } from './recurrence.service';

@Injectable()
export class RecurringTasksCronService {
  private readonly logger = new Logger(RecurringTasksCronService.name);

  constructor(
    private prisma: PrismaService,
    private recurrenceService: RecurrenceService,
  ) {}

  /**
   * Runs daily at midnight to generate upcoming recurring task instances
   * Lead time: 1 day (generates tasks that are due within the next day)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateUpcomingRecurringTasks() {
    this.logger.log('Starting recurring task generation cron job...');

    try {
      // Find all active recurring tasks
      const recurringTasks = await this.prisma.recurringTask.findMany({
        where: {
          isActive: true,
        },
        include: {
          task: {
            include: {
              assignees: { select: { id: true } },
              reporters: { select: { id: true } },
            },
          },
        },
      });

      this.logger.log(`Found ${recurringTasks.length} active recurring tasks`);

      let generated = 0;
      let skipped = 0;
      let errors = 0;

      for (const recurringTask of recurringTasks) {
        try {
          // Check if recurrence has ended
          if (this.recurrenceService.isRecurrenceComplete(recurringTask)) {
            // Deactivate the recurrence
            await this.prisma.recurringTask.update({
              where: { id: recurringTask.id },
              data: { isActive: false },
            });
            await this.prisma.task.update({
              where: { id: recurringTask.taskId },
              data: { isRecurring: false },
            });
            this.logger.log(
              `Deactivated completed recurrence for task ${recurringTask.task.title}`,
            );
            continue;
          }

          // Check if we should generate the next instance
          const shouldGenerate = this.recurrenceService.shouldGenerateNextInstance(
            recurringTask.nextOccurrence,
            1, // 1 day lead time
          );

          if (!shouldGenerate) {
            skipped++;
            continue;
          }

          // Check if a task instance already exists for this occurrence
          const existingTask = await this.prisma.task.findFirst({
            where: {
              projectId: recurringTask.task.projectId,
              title: recurringTask.task.title,
              dueDate: recurringTask.nextOccurrence,
            },
          });

          if (existingTask) {
            skipped++;
            continue; // Already generated
          }

          let retries = 3;
          let taskCreated = false;

          while (retries > 0 && !taskCreated) {
            try {
              const project = await this.prisma.project.findUnique({
                where: { id: recurringTask.task.projectId },
                select: { slug: true },
              });

              const newTask = await this.prisma.$transaction(async (tx) => {
                const lastTask = await tx.task.findFirst({
                  where: { projectId: recurringTask.task.projectId },
                  orderBy: { taskNumber: 'desc' },
                  select: { taskNumber: true },
                });

                const taskNumber = lastTask ? lastTask.taskNumber + 1 : 1;
                const slug = `${project?.slug}-${taskNumber}`;

                return await tx.task.create({
                  data: {
                    title: recurringTask.task.title,
                    description: recurringTask.task.description,
                    type: recurringTask.task.type,
                    priority: recurringTask.task.priority,
                    projectId: recurringTask.task.projectId,
                    statusId: recurringTask.task.statusId,
                    sprintId: recurringTask.task.sprintId,
                    dueDate: recurringTask.nextOccurrence,
                    taskNumber,
                    slug,
                    createdBy: recurringTask.task.createdBy,
                    assignees: {
                      connect: recurringTask.task.assignees.map((a) => ({ id: a.id })),
                    },
                    reporters: {
                      connect: recurringTask.task.reporters.map((r) => ({ id: r.id })),
                    },
                    isRecurring: false,
                  },
                });
              });

              taskCreated = true;

              const nextNextOccurrence = this.recurrenceService.calculateNextOccurrence(
                recurringTask.nextOccurrence,
                recurringTask,
              );

              await this.prisma.recurringTask.update({
                where: { id: recurringTask.id },
                data: {
                  currentOccurrence: recurringTask.currentOccurrence + 1,
                  nextOccurrence: nextNextOccurrence,
                },
              });

              generated++;
              this.logger.log(
                `Generated task instance: ${newTask.slug} for ${new Date(recurringTask.nextOccurrence).toISOString()}`,
              );
            } catch (error) {
              if (error.code === 'P2002' && retries > 1) {
                retries--;
                this.logger.warn(
                  `Unique constraint conflict for recurring task ${recurringTask.id}, retrying... (${retries} attempts left)`,
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
              } else {
                throw error;
              }
            }
          }

          if (!taskCreated) {
            errors++;
            this.logger.error(
              `Failed to create task instance for recurring task ${recurringTask.id} after retries`,
            );
          }
        } catch (error) {
          errors++;
          this.logger.error(
            `Error generating task for recurring config ${recurringTask.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Recurring task generation completed. Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`,
      );
    } catch (error) {
      this.logger.error(`Failed to run recurring task generation: ${error.message}`, error.stack);
    }
  }
}
