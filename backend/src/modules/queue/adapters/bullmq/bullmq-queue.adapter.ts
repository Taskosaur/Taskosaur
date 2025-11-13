import { Queue, QueueOptions } from 'bullmq';
import { EventEmitter } from 'events';
import { IQueue } from '../../interfaces/queue.interface';
import { IJob } from '../../interfaces/job.interface';
import { JobOptions, BulkJobOptions, QueueStats } from '../../interfaces/queue-options.interface';
import { JobStatus } from '../../enums/job-status.enum';
import { QueueEvent } from '../../enums/queue-event.enum';
import { BullMQJobAdapter } from './bullmq-job.adapter';

/**
 * BullMQ Queue Adapter - Wraps BullMQ Queue to implement IQueue interface
 */
export class BullMQQueueAdapter<T = any> implements IQueue<T> {
  private readonly queue: Queue<T>;

  constructor(queueName: string, options: QueueOptions) {
    this.queue = new Queue<T>(queueName, options);
  }

  get name(): string {
    return this.queue.name;
  }

  // ===========================
  // Job Operations
  // ===========================

  async add(name: string, data: T, options?: JobOptions): Promise<IJob<T>> {
    // BullMQ has stricter type constraints, using type assertion for compatibility
    const job = await this.queue.add(name as never, data as never, options as never);
    return new BullMQJobAdapter(job) as IJob<T>;
  }

  async addBulk(jobs: BulkJobOptions<T>[]): Promise<IJob<T>[]> {
    // BullMQ has stricter type constraints, using type assertion for compatibility
    const bullmqJobs = await this.queue.addBulk(jobs as never);
    return bullmqJobs.map((job) => new BullMQJobAdapter(job)) as IJob<T>[];
  }

  // ===========================
  // Job Retrieval
  // ===========================

  async getJob(jobId: string): Promise<IJob<T> | null> {
    const job = await this.queue.getJob(jobId);
    return job ? new BullMQJobAdapter(job) : null;
  }

  async getJobs(statuses: JobStatus[]): Promise<IJob<T>[]> {
    const bullmqStatuses = statuses.map((status) => this.mapJobStatusToBullMQState(status));
    // BullMQ expects specific JobType values, using type assertion for compatibility
    const jobs = await this.queue.getJobs(bullmqStatuses as never);
    return jobs.map((job) => new BullMQJobAdapter(job));
  }

  async getWaiting(): Promise<IJob<T>[]> {
    const jobs = await this.queue.getWaiting();
    return jobs.map((job) => new BullMQJobAdapter(job));
  }

  async getActive(): Promise<IJob<T>[]> {
    const jobs = await this.queue.getActive();
    return jobs.map((job) => new BullMQJobAdapter(job));
  }

  async getCompleted(): Promise<IJob<T>[]> {
    const jobs = await this.queue.getCompleted();
    return jobs.map((job) => new BullMQJobAdapter(job));
  }

  async getFailed(): Promise<IJob<T>[]> {
    const jobs = await this.queue.getFailed();
    return jobs.map((job) => new BullMQJobAdapter(job));
  }

  // ===========================
  // Queue Control
  // ===========================

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  async isPaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  // ===========================
  // Maintenance
  // ===========================

  async clean(grace: number, limit: number, status: JobStatus): Promise<void> {
    const bullmqStatus = this.mapJobStatusToBullMQState(status);
    // BullMQ expects specific status string literal types, using type assertion for compatibility
    await this.queue.clean(grace, limit, bullmqStatus as never);
  }

  async obliterate(): Promise<void> {
    await this.queue.obliterate();
  }

  async drain(): Promise<void> {
    await this.queue.drain();
  }

  // ===========================
  // Stats
  // ===========================

  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: 0, // BullMQ doesn't have getPausedCount()
    };
  }

  // ===========================
  // Event Listeners
  // ===========================

  on(event: QueueEvent, handler: (...args: any[]) => void): void {
    const bullmqEvent = this.mapQueueEventToBullMQEvent(event);
    // BullMQ Queue extends EventEmitter but doesn't expose it in types
    (this.queue as unknown as EventEmitter).on(bullmqEvent, handler);
  }

  off(event: QueueEvent, handler: (...args: any[]) => void): void {
    const bullmqEvent = this.mapQueueEventToBullMQEvent(event);
    // BullMQ Queue extends EventEmitter but doesn't expose it in types
    (this.queue as unknown as EventEmitter).off(bullmqEvent, handler);
  }

  once(event: QueueEvent, handler: (...args: any[]) => void): void {
    const bullmqEvent = this.mapQueueEventToBullMQEvent(event);
    // BullMQ Queue extends EventEmitter but doesn't expose it in types
    (this.queue as unknown as EventEmitter).once(bullmqEvent, handler);
  }

  // ===========================
  // Helper Methods
  // ===========================

  /**
   * Map wrapper JobStatus to BullMQ state
   */
  private mapJobStatusToBullMQState(status: JobStatus): string {
    const statusMap: Record<JobStatus, string> = {
      [JobStatus.WAITING]: 'waiting',
      [JobStatus.ACTIVE]: 'active',
      [JobStatus.COMPLETED]: 'completed',
      [JobStatus.FAILED]: 'failed',
      [JobStatus.DELAYED]: 'delayed',
      [JobStatus.PAUSED]: 'paused',
    };

    return statusMap[status];
  }

  /**
   * Map wrapper QueueEvent to BullMQ event
   */
  private mapQueueEventToBullMQEvent(event: QueueEvent): string {
    const eventMap: Record<QueueEvent, string> = {
      [QueueEvent.JOB_ADDED]: 'added',
      [QueueEvent.JOB_STARTED]: 'active',
      [QueueEvent.JOB_COMPLETED]: 'completed',
      [QueueEvent.JOB_FAILED]: 'failed',
      [QueueEvent.JOB_PROGRESS]: 'progress',
      [QueueEvent.QUEUE_PAUSED]: 'paused',
      [QueueEvent.QUEUE_RESUMED]: 'resumed',
      [QueueEvent.QUEUE_ERROR]: 'error',
    };

    return eventMap[event];
  }

  /**
   * Get the underlying BullMQ queue (for advanced use cases)
   */
  getUnderlyingQueue(): Queue<T> {
    return this.queue;
  }
}
