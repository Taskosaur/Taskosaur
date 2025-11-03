// processors/email-sync.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailSyncService } from '../services/email-sync.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface EmailSyncJobData {
  projectId: string;
  userId?: string;
  type: 'manual' | 'scheduled';
}

@Processor('email-sync', {
  concurrency: 3, // Process up to 3 jobs concurrently
})
export class EmailSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailSyncProcessor.name);

  constructor(
    private emailSync: EmailSyncService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmailSyncJobData>): Promise<any> {
    const { projectId, userId, type } = job.data;

    this.logger.log(`Processing ${type} email sync for project ${projectId} (Job: ${job.id})`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Get project inbox details
      const inbox = await this.prisma.projectInbox.findUnique({
        where: { projectId },
        include: {
          emailAccount: true,
          project: true,
        },
      });

      if (!inbox) {
        throw new Error(`Project inbox not found for project ${projectId}`);
      }

      if (!inbox.emailAccount) {
        throw new Error(`Email account not configured for project ${projectId}`);
      }

      if (!inbox.emailAccount.syncEnabled) {
        throw new Error(`Email sync is disabled for project ${projectId}`);
      }

      await job.updateProgress(20);

      // Mark sync start time
      const syncStartTime = new Date();

      // Perform the actual sync
      const result = await this.emailSync.triggerSync(projectId);

      await job.updateProgress(90);

      // Update email account with success
      await this.prisma.emailAccount.update({
        where: { id: inbox.emailAccount.id },
        data: {
          lastSyncAt: syncStartTime,
          lastSyncError: null,
        },
      });

      await job.updateProgress(100);

      // Log success
      this.logger.log(
        `Successfully completed ${type} sync for project ${projectId} (${inbox.project.name}) - Job: ${job.id}`,
      );

      return {
        success: true,
        projectId,
        projectName: inbox.project.name,
        syncStartTime,
        completedAt: new Date(),
        type,
        userId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync project ${projectId} (Job: ${job.id}): ${error.message}`,
        error.stack,
      );

      // Update email account with error
      try {
        await this.prisma.emailAccount.updateMany({
          where: {
            projectInbox: {
              projectId,
            },
          },
          data: {
            lastSyncError: error.message,
            lastSyncAt: new Date(),
          },
        });
      } catch (updateError) {
        this.logger.error('Failed to update sync error:', updateError);
      }

      throw error;
    }
  }
}
