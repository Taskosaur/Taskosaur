import { BullMQConfig, BetterQueueConfig } from '../interfaces/queue-options.interface';

/**
 * Logging configuration for queue module
 */
export interface LoggingConfig {
  /**
   * Log backend selection process
   * @default true
   */
  logBackendSelection?: boolean;

  /**
   * Log fallback events
   * @default true
   */
  logFallback?: boolean;

  /**
   * Log level for queue operations
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Main queue module configuration
 */
export interface QueueModuleConfig {
  /**
   * Queue backend to use
   * @default 'bullmq'
   */
  backend?: 'bullmq' | 'better-queue' | 'in-memory';

  /**
   * Enable automatic fallback to better-queue when BullMQ fails
   * @default true
   */
  enableFallback?: boolean;

  /**
   * BullMQ-specific configuration
   */
  bullmq?: BullMQConfig;

  /**
   * Better Queue-specific configuration
   */
  betterQueue?: BetterQueueConfig;

  /**
   * Logging configuration
   */
  logging?: LoggingConfig;
}
