import { Injectable, Logger } from '@nestjs/common';
import { IQueueAdapter } from '../interfaces/queue-adapter.interface';
import { QueueModuleConfig } from '../config/queue-config.interface';
import { BullMQAdapter } from '../adapters/bullmq/bullmq.adapter';
import { RedisConnectionValidator } from '../services/redis-connection.validator';
import { QueueBackend } from '../enums/queue-backend.enum';

/**
 * Factory for creating queue adapters with intelligent fallback support
 */
@Injectable()
export class QueueProviderFactory {
  private readonly logger = new Logger(QueueProviderFactory.name);

  private requestedBackend: string;
  private actualBackend: string;
  private fallbackOccurred = false;
  private redisAvailable = false;
  private adapter: IQueueAdapter | null = null;

  constructor(
    private readonly config: QueueModuleConfig,
    private readonly redisValidator: RedisConnectionValidator,
  ) {}

  /**
   * Create and configure the queue adapter
   * @returns Queue adapter instance
   */
  async createAdapter(): Promise<IQueueAdapter> {
    // Determine requested backend (default to bullmq)
    this.requestedBackend = this.config.backend || QueueBackend.BULLMQ;

    this.logger.log(
      `Queue initialization: Requested backend is "${this.requestedBackend}"${
        !this.config.backend ? ' (default)' : ''
      }`,
    );

    try {
      // Handle BullMQ backend
      if (this.requestedBackend === (QueueBackend.BULLMQ as string)) {
        return await this.createBullMQAdapter();
      }

      // Handle better-queue backend
      if (this.requestedBackend === (QueueBackend.BETTER_QUEUE as string)) {
        return await this.createBetterQueueAdapter();
      }

      // Handle in-memory backend
      if (this.requestedBackend === (QueueBackend.IN_MEMORY as string)) {
        return await this.createInMemoryAdapter();
      }

      // Unknown backend
      throw new Error(`Unknown queue backend: ${this.requestedBackend}`);
    } catch (error) {
      this.logger.error(`Failed to create queue adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create BullMQ adapter with Redis validation and fallback
   */
  private async createBullMQAdapter(): Promise<IQueueAdapter> {
    if (!this.config.bullmq?.connection) {
      throw new Error('BullMQ configuration is missing Redis connection details');
    }

    this.logger.log('Checking Redis connection...');

    // Validate Redis connection
    this.redisAvailable = await this.redisValidator.checkConnection(this.config.bullmq.connection);

    if (this.redisAvailable) {
      this.logger.log('✓ Redis connection successful');
      this.actualBackend = QueueBackend.BULLMQ;
      this.adapter = new BullMQAdapter(this.config.bullmq);
      this.logger.log(`✓ Queue backend: ${this.actualBackend}`);
      return this.adapter;
    }

    // Redis unavailable - check fallback
    this.logger.warn('✗ Redis connection failed - Redis is not available');

    const enableFallback = this.config.enableFallback ?? true;

    if (!enableFallback) {
      throw new Error(
        'Redis is unavailable and fallback is disabled. Cannot initialize queue module.',
      );
    }

    // Fallback to better-queue
    this.logger.warn('→ Falling back to better-queue (in-memory mode)');
    this.fallbackOccurred = true;

    return await this.createBetterQueueAdapter();
  }

  /**
   * Create better-queue adapter
   */
  private async createBetterQueueAdapter(): Promise<IQueueAdapter> {
    this.actualBackend = QueueBackend.BETTER_QUEUE;

    // Import better-queue adapter
    const { BetterQueueAdapter } = await import('../adapters/better-queue/better-queue.adapter');

    // Create adapter with config
    this.adapter = new BetterQueueAdapter(this.config.betterQueue);

    this.logger.log(
      `✓ Queue backend: ${this.actualBackend}${this.fallbackOccurred ? ' (fallback from BullMQ)' : ''}`,
    );

    return this.adapter;
  }

  /**
   * Create in-memory adapter
   */
  private createInMemoryAdapter(): Promise<IQueueAdapter> {
    this.actualBackend = QueueBackend.IN_MEMORY;

    // For now, we'll create a placeholder adapter
    // This will be implemented in a later step
    this.logger.log(`✓ Queue backend: ${this.actualBackend}`);

    return Promise.reject(
      new Error('In-memory adapter not yet implemented. Use BullMQ with Redis for now.'),
    );
  }

  /**
   * Get the actual backend in use
   */
  getBackend(): string {
    return this.actualBackend;
  }

  /**
   * Get the requested backend from configuration
   */
  getRequestedBackend(): string {
    return this.requestedBackend;
  }

  /**
   * Check if fallback occurred
   */
  isFallbackActive(): boolean {
    return this.fallbackOccurred;
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  /**
   * Get the adapter instance
   */
  getAdapter(): IQueueAdapter | null {
    return this.adapter;
  }
}
