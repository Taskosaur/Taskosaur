import { Job } from 'bullmq';
import { IJob } from '../../interfaces/job.interface';
import { JobState } from '../../interfaces/queue-options.interface';
import { JobStatus } from '../../enums/job-status.enum';

/**
 * BullMQ Job Adapter - Wraps BullMQ Job to implement IJob interface
 */
export class BullMQJobAdapter<T = any> implements IJob<T> {
  constructor(private readonly job: Job<T>) {}

  get id(): string {
    return this.job.id || '';
  }

  get name(): string {
    return this.job.name;
  }

  get data(): T {
    return this.job.data;
  }

  get progress(): number {
    return (this.job.progress as number) || 0;
  }

  get returnvalue(): unknown {
    return this.job.returnvalue as unknown;
  }

  get finishedOn(): number | undefined {
    return this.job.finishedOn;
  }

  get processedOn(): number | undefined {
    return this.job.processedOn;
  }

  get failedReason(): string | undefined {
    return this.job.failedReason;
  }

  get attemptsMade(): number | undefined {
    return this.job.attemptsMade;
  }

  get timestamp(): number | undefined {
    return this.job.timestamp;
  }

  async updateProgress(progress: number): Promise<void> {
    await this.job.updateProgress(progress);
  }

  async getState(): Promise<JobState> {
    const state = await this.job.getState();
    return this.mapBullMQStateToJobStatus(state);
  }

  async remove(): Promise<void> {
    await this.job.remove();
  }

  async retry(): Promise<void> {
    await this.job.retry();
  }

  log(message: string): void {
    void this.job.log(message);
  }

  /**
   * Map BullMQ job state to wrapper JobStatus
   */
  private mapBullMQStateToJobStatus(state: string): JobStatus {
    const stateMap: Record<string, JobStatus> = {
      waiting: JobStatus.WAITING,
      'waiting-children': JobStatus.WAITING,
      active: JobStatus.ACTIVE,
      completed: JobStatus.COMPLETED,
      failed: JobStatus.FAILED,
      delayed: JobStatus.DELAYED,
      paused: JobStatus.PAUSED,
    };

    return stateMap[state] || JobStatus.WAITING;
  }

  /**
   * Get the underlying BullMQ job (for advanced use cases)
   */
  getUnderlyingJob(): Job<T> {
    return this.job;
  }
}
