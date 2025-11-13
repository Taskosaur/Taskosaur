import { IQueueAdapter } from '../../interfaces/queue-adapter.interface';
import { IQueue } from '../../interfaces/queue.interface';
import { IWorker, WorkerProcessor } from '../../interfaces/worker.interface';
import { BetterQueueConfig } from '../../interfaces/queue-options.interface';
import { BetterQueueQueueAdapter } from './better-queue-queue.adapter';
import { BetterQueueWorkerAdapter } from './better-queue-worker.adapter';
import { QueueBackend } from '../../enums/queue-backend.enum';

/**
 * Better-Queue Adapter - Main adapter implementation
 * Factory for creating better-queue queues and workers
 */
export class BetterQueueAdapter implements IQueueAdapter {
  private readonly config: BetterQueueConfig;
  private readonly queues = new Map<string, BetterQueueQueueAdapter>();
  private readonly workers = new Map<string, IWorker>();

  constructor(config?: BetterQueueConfig) {
    this.config = config || {
      store: 'memory',
      concurrent: 5,
      maxRetries: 3,
      retryDelay: 1000,
    };
  }

  createQueue<T = any>(name: string, config?: any): IQueue<T> {
    const queueConfig = {
      ...this.config,
      ...config,
    };

    const queue = new BetterQueueQueueAdapter<T>(name, queueConfig);
    this.queues.set(name, queue as BetterQueueQueueAdapter<any>);
    return queue;
  }

  createWorker<T = any>(name: string, processor: WorkerProcessor<T>, config?: any): IWorker<T> {
    // Get or create queue
    let queue = this.queues.get(name) as BetterQueueQueueAdapter<T>;
    if (!queue) {
      queue = this.createQueue<T>(name, config) as BetterQueueQueueAdapter<T>;
    }

    const worker = new BetterQueueWorkerAdapter<T>(name, processor, queue);
    this.workers.set(name, worker);
    return worker;
  }

  async close(): Promise<void> {
    // Close all queues
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));

    // Close all workers
    await Promise.all(Array.from(this.workers.values()).map((worker) => worker.close()));

    this.queues.clear();
    this.workers.clear();
  }

  isHealthy(): Promise<boolean> {
    // Better-queue doesn't require external dependencies
    // Always healthy if instantiated
    return Promise.resolve(true);
  }

  getBackendType(): string {
    return QueueBackend.BETTER_QUEUE;
  }
}
