/**
 * Testing utilities for queue module
 */

import { IJob } from '../interfaces/job.interface';
import { IQueue } from '../interfaces/queue.interface';
import { JobStatus } from '../enums/job-status.enum';
import { QueueEvent } from '../enums/queue-event.enum';

/**
 * Create a mock job for testing
 */
export function createMockJob<T = any>(overrides?: Partial<IJob<T>>): IJob<T> {
  const defaultJob: IJob<T> = {
    id: 'test-job-id',
    name: 'test-job',
    data: {} as T,
    progress: 0,
    returnvalue: undefined,
    finishedOn: undefined,
    processedOn: undefined,
    failedReason: undefined,
    attemptsMade: 0,
    timestamp: Date.now(),

    async updateProgress(progress: number): Promise<void> {
      this.progress = progress;
    },

    async getState(): Promise<JobStatus> {
      return JobStatus.WAITING;
    },

    async remove(): Promise<void> {
      // Mock implementation
    },

    async retry(): Promise<void> {
      // Mock implementation
    },

    log(message: string): void {
      // Mock implementation
    },
  };

  return { ...defaultJob, ...overrides } as IJob<T>;
}

/**
 * Create a mock queue for testing
 */
export function createMockQueue<T = any>(overrides?: Partial<IQueue<T>>): IQueue<T> {
  const jobs: Map<string, IJob<T>> = new Map();
  let jobCounter = 1;

  const defaultQueue: IQueue<T> = {
    name: 'test-queue',

    async add(name: string, data: T, options?: any): Promise<IJob<T>> {
      const job = createMockJob<T>({
        id: `job-${jobCounter++}`,
        name,
        data,
      });
      jobs.set(job.id, job);
      return job;
    },

    async addBulk(bulkJobs: any[]): Promise<IJob<T>[]> {
      return Promise.all(bulkJobs.map(({ name, data, opts }) => this.add(name, data, opts)));
    },

    async getJob(jobId: string): Promise<IJob<T> | null> {
      return jobs.get(jobId) || null;
    },

    async getJobs(statuses: JobStatus[]): Promise<IJob<T>[]> {
      return Array.from(jobs.values());
    },

    async getWaiting(): Promise<IJob<T>[]> {
      return Array.from(jobs.values());
    },

    async getActive(): Promise<IJob<T>[]> {
      return [];
    },

    async getCompleted(): Promise<IJob<T>[]> {
      return [];
    },

    async getFailed(): Promise<IJob<T>[]> {
      return [];
    },

    async pause(): Promise<void> {
      // Mock implementation
    },

    async resume(): Promise<void> {
      // Mock implementation
    },

    async close(): Promise<void> {
      jobs.clear();
    },

    async isPaused(): Promise<boolean> {
      return false;
    },

    async clean(grace: number, limit: number, status: JobStatus): Promise<void> {
      // Mock implementation
    },

    async obliterate(): Promise<void> {
      jobs.clear();
    },

    async drain(): Promise<void> {
      jobs.clear();
    },

    async getStats() {
      return {
        waiting: jobs.size,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    },

    on(event: QueueEvent, handler: (...args: any[]) => void): void {
      // Mock implementation
    },

    off(event: QueueEvent, handler: (...args: any[]) => void): void {
      // Mock implementation
    },

    once(event: QueueEvent, handler: (...args: any[]) => void): void {
      // Mock implementation
    },
  };

  return { ...defaultQueue, ...overrides } as IQueue<T>;
}

/**
 * Create a simple mock queue provider for testing
 */
export const createMockQueueProvider = <T = any>(queueName: string) => ({
  provide: `QUEUE_${queueName}`,
  useValue: createMockQueue<T>(),
});
