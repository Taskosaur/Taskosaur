import { IQueue } from './queue.interface';
import { IWorker, WorkerProcessor } from './worker.interface';

/**
 * Queue adapter interface that all backend implementations must follow
 */
export interface IQueueAdapter {
  /**
   * Create a queue instance
   * @param name Queue name
   * @param config Queue configuration (backend-specific)
   * @returns Queue instance
   */
  createQueue<T = any>(name: string, config?: any): IQueue<T>;

  /**
   * Create a worker instance
   * @param name Queue name
   * @param processor Job processor function
   * @param config Worker configuration (backend-specific)
   * @returns Worker instance
   */
  createWorker<T = any>(name: string, processor: WorkerProcessor<T>, config?: any): IWorker<T>;

  /**
   * Close all queues and workers managed by this adapter
   */
  close(): Promise<void>;

  /**
   * Check if the adapter is healthy and ready to process jobs
   * @returns True if healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the backend type
   */
  getBackendType(): string;
}
