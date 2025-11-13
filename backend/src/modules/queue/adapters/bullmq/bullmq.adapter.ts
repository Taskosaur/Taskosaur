import { QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';
import { IQueueAdapter } from '../../interfaces/queue-adapter.interface';
import { IQueue } from '../../interfaces/queue.interface';
import { IWorker, WorkerProcessor } from '../../interfaces/worker.interface';
import { BullMQConfig } from '../../interfaces/queue-options.interface';
import { BullMQQueueAdapter } from './bullmq-queue.adapter';
import { BullMQWorkerAdapter } from './bullmq-worker.adapter';
import { QueueBackend } from '../../enums/queue-backend.enum';

/**
 * BullMQ Adapter - Main adapter that implements IQueueAdapter
 * Factory for creating BullMQ queues and workers
 */
export class BullMQAdapter implements IQueueAdapter {
  private readonly config: BullMQConfig;
  private readonly queues: Map<string, IQueue> = new Map();
  private readonly workers: Map<string, IWorker> = new Map();
  private redisClient?: Redis;

  constructor(config: BullMQConfig) {
    this.config = config;
  }

  createQueue<T = any>(name: string, config?: any): IQueue<T> {
    const queueOptions: QueueOptions = {
      connection: this.config.connection,
      defaultJobOptions: this.config.defaultJobOptions,
      prefix: this.config.prefix,
      ...config,
    };

    const queue = new BullMQQueueAdapter<T>(name, queueOptions);
    this.queues.set(name, queue);
    return queue;
  }

  createWorker<T = any>(name: string, processor: WorkerProcessor<T>, config?: any): IWorker<T> {
    const workerOptions: WorkerOptions = {
      connection: this.config.connection,
      ...config,
    };

    const worker = new BullMQWorkerAdapter<T>(name, processor, workerOptions);
    this.workers.set(name, worker);
    return worker;
  }

  async close(): Promise<void> {
    // Close all queues
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));

    // Close all workers
    await Promise.all(Array.from(this.workers.values()).map((worker) => worker.close()));

    // Close Redis connection if exists
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = undefined;
    }

    this.queues.clear();
    this.workers.clear();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Create a test Redis connection if we don't have one
      if (!this.redisClient) {
        this.redisClient = new Redis({
          ...this.config.connection,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // Don't retry on connection failure
        });
      }

      // Ping Redis to check connection
      await this.redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  getBackendType(): string {
    return QueueBackend.BULLMQ;
  }
}
