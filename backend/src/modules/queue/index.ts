/**
 * Queue Module - Central export point
 *
 * This module provides a flexible queue abstraction layer over BullMQ
 * with automatic fallback support when Redis is unavailable.
 */

// Module
export * from './queue.module';

// Decorators
export * from './decorators';

// Interfaces
export * from './interfaces';

// Enums
export * from './enums';

// Services
export { QueueService } from './services/queue.service';
export { QueueMetricsService } from './services/queue-metrics.service';
export type { QueueMetrics } from './services/queue-metrics.service';

// Config
export type { QueueModuleConfig, LoggingConfig } from './config/queue-config.interface';
export { QueueConfigService } from './config/queue-config.service';

// Constants
export * from './constants/queue.constants';

// Testing utilities
export * from './utils/queue-testing.helper';
