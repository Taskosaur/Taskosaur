/**
 * Queue module constants
 */

/**
 * Default queue configuration values
 */
export const QUEUE_DEFAULTS = {
  /**
   * Default backend when not specified
   */
  BACKEND: 'bullmq' as const,

  /**
   * Default fallback behavior
   */
  ENABLE_FALLBACK: true,

  /**
   * Default Redis configuration
   */
  REDIS: {
    HOST: 'localhost',
    PORT: 6379,
    DB: 0,
    MAX_RETRIES_PER_REQUEST: 3,
  },

  /**
   * Default queue prefix
   */
  PREFIX: 'taskosaur',

  /**
   * Default job options
   */
  JOB_OPTIONS: {
    REMOVE_ON_COMPLETE: 10,
    REMOVE_ON_FAIL: 5,
    ATTEMPTS: 3,
    BACKOFF_TYPE: 'exponential' as const,
    BACKOFF_DELAY: 2000,
  },

  /**
   * Redis connection validation settings
   */
  REDIS_VALIDATION: {
    MAX_RETRIES: 3,
    RETRY_DELAYS: [100, 200, 300], // ms
    CONNECTION_TIMEOUT: 1000, // ms
  },
} as const;

/**
 * Queue token prefix for dependency injection
 */
export const QUEUE_TOKEN_PREFIX = 'QUEUE_';

/**
 * Registered queue names
 */
export const REGISTERED_QUEUES = {
  EMAIL: 'email',
  AUTOMATION: 'automation',
  EMAIL_SYNC: 'email-sync',
} as const;

/**
 * Queue priorities
 */
export const QUEUE_PRIORITY = {
  CRITICAL: 1,
  HIGH: 3,
  NORMAL: 5,
  LOW: 7,
  BACKGROUND: 10,
} as const;
