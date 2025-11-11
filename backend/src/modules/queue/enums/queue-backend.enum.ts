/**
 * Queue backend types supported by the queue wrapper
 */
export enum QueueBackend {
  /**
   * BullMQ - Redis-based queue (requires Redis connection)
   */
  BULLMQ = 'bullmq',

  /**
   * Better Queue - Fallback queue implementation (works without Redis)
   */
  BETTER_QUEUE = 'better-queue',

  /**
   * In-memory queue - For testing purposes only
   */
  IN_MEMORY = 'in-memory',
}
