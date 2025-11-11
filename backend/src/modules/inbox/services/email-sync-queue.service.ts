// services/email-sync-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '../../queue/decorators/inject-queue.decorator';
import { IQueue } from '../../queue/interfaces/queue.interface';
import { JobStatus } from '../../queue/enums/job-status.enum';

export interface EmailSyncJobData {
  projectId: string;
  userId?: string;
  type: 'manual' | 'scheduled';
}

@Injectable()
export class EmailSyncQueueService {
  private readonly logger = new Logger(EmailSyncQueueService.name);

  constructor(@InjectQueue('email-sync') private emailSyncQueue: IQueue<EmailSyncJobData>) {}

  async addManualSyncJob(projectId: string, userId?: string): Promise<string> {
    const job = await this.emailSyncQueue.add(
      'sync-inbox',
      {
        projectId,
        userId,
        type: 'manual',
      },
      {
        priority: 1, // Higher priority for manual syncs
        delay: 0,
      },
    );

    this.logger.log(`Manual sync job ${job.id} queued for project ${projectId}`);
    return job.id;
  }

  async addScheduledSyncJob(projectId: string): Promise<string> {
    const job = await this.emailSyncQueue.add(
      'sync-inbox',
      {
        projectId,
        type: 'scheduled',
      },
      {
        priority: 5, // Lower priority for scheduled syncs
        delay: 0,
      },
    );

    this.logger.log(`Scheduled sync job ${job.id} queued for project ${projectId}`);
    return job.id;
  }

  async getJobStatus(jobId: string) {
    const job = await this.emailSyncQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      id: job.id,
      data: job.data,
      state,
      progress: job.progress,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }

  async getQueueStats() {
    const waiting = await this.emailSyncQueue.getWaiting();
    const active = await this.emailSyncQueue.getActive();
    const completed = await this.emailSyncQueue.getCompleted();
    const failed = await this.emailSyncQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  async pauseQueue() {
    await this.emailSyncQueue.pause();
    this.logger.log('Email sync queue paused');
  }

  async resumeQueue() {
    await this.emailSyncQueue.resume();
    this.logger.log('Email sync queue resumed');
  }

  async cleanQueue() {
    await this.emailSyncQueue.clean(0, 100, JobStatus.COMPLETED);
    await this.emailSyncQueue.clean(0, 50, JobStatus.FAILED);
    this.logger.log('Email sync queue cleaned');
  }
}
