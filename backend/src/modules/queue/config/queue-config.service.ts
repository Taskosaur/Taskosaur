import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueModuleConfig } from './queue-config.interface';
import { BullMQConfig, BetterQueueConfig } from '../interfaces/queue-options.interface';
import { QueueBackend } from '../enums/queue-backend.enum';

/**
 * Service to manage queue module configuration
 */
@Injectable()
export class QueueConfigService {
  private readonly logger = new Logger(QueueConfigService.name);
  private readonly config: QueueModuleConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): QueueModuleConfig {
    const backend = this.configService.get<string>('QUEUE_BACKEND', QueueBackend.BULLMQ);
    const enableFallback =
      this.configService.get<string>('QUEUE_ENABLE_FALLBACK', 'true') === 'true';

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    return {
      backend: backend as 'bullmq' | 'better-queue' | 'in-memory',
      enableFallback,
      bullmq: {
        connection: {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
          maxRetriesPerRequest: 3,
        },
        prefix: this.configService.get<string>('QUEUE_PREFIX', 'taskosaur'),
      },
      betterQueue: {
        store: this.configService.get<string>('BETTER_QUEUE_STORE', 'memory') as 'memory',
        concurrent: this.configService.get<number>('BETTER_QUEUE_CONCURRENT', 5),
        maxRetries: this.configService.get<number>('BETTER_QUEUE_MAX_RETRIES', 3),
        retryDelay: this.configService.get<number>('BETTER_QUEUE_RETRY_DELAY', 1000),
      },
      logging: {
        logBackendSelection: true,
        logFallback: true,
        logLevel: 'info',
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    const validBackends = [QueueBackend.BULLMQ, QueueBackend.BETTER_QUEUE, QueueBackend.IN_MEMORY];

    if (!validBackends.includes(this.config.backend as QueueBackend)) {
      this.logger.warn(
        `Invalid QUEUE_BACKEND value: "${this.config.backend}". Valid values are: ${validBackends.join(', ')}. Defaulting to "${QueueBackend.BULLMQ}".`,
      );
      this.config.backend = QueueBackend.BULLMQ;
    }

    // Validate BullMQ config if BullMQ is selected
    if (this.config.backend === QueueBackend.BULLMQ) {
      if (!this.config.bullmq?.connection?.host || !this.config.bullmq?.connection?.port) {
        this.logger.warn(
          'BullMQ backend selected but Redis configuration is incomplete. Using defaults.',
        );
      }
    }
  }

  /**
   * Get the full configuration
   */
  getConfig(): QueueModuleConfig {
    return this.config;
  }

  /**
   * Get the configured backend
   */
  getBackend(): string {
    return this.config.backend || QueueBackend.BULLMQ;
  }

  /**
   * Check if fallback is enabled
   */
  isFallbackEnabled(): boolean {
    return this.config.enableFallback ?? true;
  }

  /**
   * Get BullMQ configuration
   */
  getBullMQConfig(): BullMQConfig | undefined {
    return this.config.bullmq;
  }

  /**
   * Get Better Queue configuration
   */
  getBetterQueueConfig(): BetterQueueConfig | undefined {
    return this.config.betterQueue;
  }

  /**
   * Get Redis connection string for logging
   */
  getRedisConnectionString(): string {
    const bullmq = this.config.bullmq;
    if (!bullmq?.connection) {
      return 'Not configured';
    }

    const { host, port, password } = bullmq.connection;
    const auth = password ? '***@' : '';
    return `redis://${auth}${host}:${port}`;
  }
}
