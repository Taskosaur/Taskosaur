import { Injectable, Logger } from '@nestjs/common';
import { IQueue } from '../interfaces/queue.interface';
import { QueueProviderFactory } from '../providers/queue.provider';
import { IQueueAdapter } from '../interfaces/queue-adapter.interface';

/**
 * Aggregated statistics across all queues
 */
export interface AggregatedStats {
  totalQueues: number;
  totalWaiting: number;
  totalActive: number;
  totalCompleted: number;
  totalFailed: number;
  totalDelayed: number;
  totalPaused: number;
}

/**
 * Main service for queue management
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, IQueue>();
  private adapter: IQueueAdapter | null = null;

  constructor(private readonly providerFactory: QueueProviderFactory) {}

  /**
   * Initialize the queue service with adapter
   */
  async initialize(): Promise<void> {
    this.adapter = await this.providerFactory.createAdapter();
  }

  /**
   * Register a queue
   */
  registerQueue(name: string): void {
    if (this.queues.has(name)) {
      this.logger.warn(`Queue "${name}" is already registered`);
      return;
    }

    if (!this.adapter) {
      throw new Error('Queue adapter not initialized. Call initialize() first.');
    }

    const queue = this.adapter.createQueue(name);
    this.queues.set(name, queue);
    this.logger.log(`Queue "${name}" registered successfully`);
  }

  /**
   * Get a queue by name
   */
  getQueue<T = any>(name: string): IQueue<T> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue "${name}" not found. Did you register it?`);
    }
    return queue as IQueue<T>;
  }

  /**
   * Get all registered queue names
   */
  getRegisteredQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get the actual backend in use
   */
  getBackend(): string {
    return this.providerFactory.getBackend();
  }

  /**
   * Get the requested backend from configuration
   */
  getRequestedBackend(): string {
    return this.providerFactory.getRequestedBackend();
  }

  /**
   * Check if fallback occurred
   */
  isFallbackActive(): boolean {
    return this.providerFactory.isFallbackActive();
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.providerFactory.isRedisAvailable();
  }

  /**
   * Get aggregated statistics across all queues
   */
  async getGlobalStats(): Promise<AggregatedStats> {
    const queueNames = this.getRegisteredQueues();
    const stats: AggregatedStats = {
      totalQueues: queueNames.length,
      totalWaiting: 0,
      totalActive: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDelayed: 0,
      totalPaused: 0,
    };

    // Aggregate stats from all queues
    await Promise.all(
      queueNames.map(async (name) => {
        const queue = this.getQueue(name);
        const queueStats = await queue.getStats();

        stats.totalWaiting += queueStats.waiting;
        stats.totalActive += queueStats.active;
        stats.totalCompleted += queueStats.completed;
        stats.totalFailed += queueStats.failed;
        stats.totalDelayed += queueStats.delayed || 0;
        stats.totalPaused += queueStats.paused || 0;
      }),
    );

    return stats;
  }

  /**
   * Close all queues and cleanup
   */
  async closeAll(): Promise<void> {
    this.logger.log('Closing all queues...');

    await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => {
        try {
          await queue.close();
        } catch (error) {
          this.logger.error(`Error closing queue: ${error.message}`);
        }
      }),
    );

    this.queues.clear();

    if (this.adapter) {
      await this.adapter.close();
    }

    this.logger.log('All queues closed');
  }

  /**
   * Get the adapter instance
   */
  getAdapter(): IQueueAdapter | null {
    return this.adapter;
  }
}
