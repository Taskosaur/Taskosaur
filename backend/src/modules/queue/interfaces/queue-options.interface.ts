import { JobStatus } from '../enums/job-status.enum';

/**
 * Backoff options for job retries
 */
export interface BackoffOptions {
  /**
   * Type of backoff strategy
   */
  type: 'exponential' | 'fixed';

  /**
   * Delay in milliseconds
   */
  delay: number;
}

/**
 * Options for individual job
 */
export interface JobOptions {
  /**
   * Job priority (higher number = higher priority)
   */
  priority?: number;

  /**
   * Delay before job processing in milliseconds
   */
  delay?: number;

  /**
   * Number of retry attempts
   */
  attempts?: number;

  /**
   * Backoff strategy for retries
   */
  backoff?: BackoffOptions;

  /**
   * Remove job when completed (true/false or number of jobs to keep)
   */
  removeOnComplete?: boolean | number;

  /**
   * Remove job when failed (true/false or number of jobs to keep)
   */
  removeOnFail?: boolean | number;

  /**
   * Job timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Bulk job options
 */
export interface BulkJobOptions<T = any> {
  /**
   * Job name
   */
  name: string;

  /**
   * Job data
   */
  data: T;

  /**
   * Job options
   */
  opts?: JobOptions;
}

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: any;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number | void;
}

/**
 * SQLite configuration for better-queue
 */
export interface SQLiteConfig {
  type: 'sqlite';
  path: string;
}

/**
 * SQL configuration for better-queue
 */
export interface SQLConfig {
  type: 'sql';
  dialect: 'postgres' | 'mysql' | 'mssql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * BullMQ specific configuration
 */
export interface BullMQConfig {
  /**
   * Redis connection configuration
   */
  connection: RedisConfig;

  /**
   * Default job options
   */
  defaultJobOptions?: JobOptions;

  /**
   * Prefix for all queue keys in Redis
   */
  prefix?: string;
}

/**
 * Better Queue specific configuration
 */
export interface BetterQueueConfig {
  /**
   * Store configuration (memory, sqlite, or sql)
   */
  store?: 'memory' | SQLiteConfig | SQLConfig;

  /**
   * Number of concurrent jobs to process
   */
  concurrent?: number;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;
}

/**
 * Main queue configuration
 */
export interface QueueConfig {
  /**
   * Queue backend to use (defaults to 'bullmq')
   */
  backend?: 'bullmq' | 'better-queue' | 'in-memory';

  /**
   * Enable automatic fallback to better-queue if BullMQ fails
   */
  enableFallback?: boolean;

  /**
   * BullMQ specific configuration
   */
  bullmq?: BullMQConfig;

  /**
   * Better Queue specific configuration
   */
  betterQueue?: BetterQueueConfig;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /**
   * Number of waiting jobs
   */
  waiting: number;

  /**
   * Number of active jobs
   */
  active: number;

  /**
   * Number of completed jobs
   */
  completed: number;

  /**
   * Number of failed jobs
   */
  failed: number;

  /**
   * Number of delayed jobs
   */
  delayed?: number;

  /**
   * Number of paused jobs
   */
  paused?: number;
}

/**
 * Job state information
 */
export type JobState = JobStatus;
