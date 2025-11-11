/**
 * Queue event types
 */
export enum QueueEvent {
  /**
   * Emitted when a job is added to the queue
   */
  JOB_ADDED = 'job-added',

  /**
   * Emitted when a job processing starts
   */
  JOB_STARTED = 'job-started',

  /**
   * Emitted when a job completes successfully
   */
  JOB_COMPLETED = 'job-completed',

  /**
   * Emitted when a job fails
   */
  JOB_FAILED = 'job-failed',

  /**
   * Emitted when a job reports progress
   */
  JOB_PROGRESS = 'job-progress',

  /**
   * Emitted when the queue is paused
   */
  QUEUE_PAUSED = 'queue-paused',

  /**
   * Emitted when the queue is resumed
   */
  QUEUE_RESUMED = 'queue-resumed',

  /**
   * Emitted when a queue error occurs
   */
  QUEUE_ERROR = 'queue-error',
}
