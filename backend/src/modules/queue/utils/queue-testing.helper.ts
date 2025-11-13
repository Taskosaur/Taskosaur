/**
 * Testing utilities for queue module
 */

import { IJob } from '../interfaces/job.interface';
import { IQueue } from '../interfaces/queue.interface';
import { JobStatus } from '../enums/job-status.enum';

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

    updateProgress(progress: number): Promise<void> {
      this.progress = progress;
      return Promise.resolve();
    },

    getState(): Promise<JobStatus> {
      return Promise.resolve(JobStatus.WAITING);
    },

    async remove(): Promise<void> {
      // Mock implementation
    },

    async retry(): Promise<void> {
      // Mock implementation
    },

    log(): void {
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

  const addJob = (name: string, data: T): Promise<IJob<T>> => {
    const job = createMockJob<T>({
      id: `job-${jobCounter++}`,
      name,
      data,
    });
    jobs.set(job.id, job);
    return Promise.resolve(job);
  };

  const defaultQueue: IQueue<T> = {
    name: 'test-queue',

    add: addJob,

    async addBulk(bulkJobs: any[]): Promise<IJob<T>[]> {
      return Promise.all(bulkJobs.map(({ name, data }) => addJob(name as string, data as T)));
    },

    getJob(jobId: string): Promise<IJob<T> | null> {
      return Promise.resolve(jobs.get(jobId) || null);
    },

    getJobs(): Promise<IJob<T>[]> {
      return Promise.resolve(Array.from(jobs.values()));
    },

    getWaiting(): Promise<IJob<T>[]> {
      return Promise.resolve(Array.from(jobs.values()));
    },

    getActive(): Promise<IJob<T>[]> {
      return Promise.resolve([]);
    },

    getCompleted(): Promise<IJob<T>[]> {
      return Promise.resolve([]);
    },

    getFailed(): Promise<IJob<T>[]> {
      return Promise.resolve([]);
    },

    async pause(): Promise<void> {
      // Mock implementation
    },

    async resume(): Promise<void> {
      // Mock implementation
    },

    close(): Promise<void> {
      jobs.clear();
      return Promise.resolve();
    },

    isPaused(): Promise<boolean> {
      return Promise.resolve(false);
    },

    async clean(): Promise<void> {
      // Mock implementation
    },

    obliterate(): Promise<void> {
      jobs.clear();
      return Promise.resolve();
    },

    drain(): Promise<void> {
      jobs.clear();
      return Promise.resolve();
    },

    getStats() {
      return Promise.resolve({
        waiting: jobs.size,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      });
    },

    on(): void {
      // Mock implementation
    },

    off(): void {
      // Mock implementation
    },

    once(): void {
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
