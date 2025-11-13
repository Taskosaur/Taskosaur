import { JobState } from './queue-options.interface';

/**
 * Generic job interface that all queue adapters must implement
 */
export interface IJob<T = any> {
  /**
   * Unique job identifier
   */
  readonly id: string;

  /**
   * Job name/type
   */
  readonly name: string;

  /**
   * Job data payload
   */
  readonly data: T;

  /**
   * Current job progress (0-100)
   */
  readonly progress: number;

  /**
   * Return value from job processing
   */
  readonly returnvalue: unknown;

  /**
   * Timestamp when job finished
   */
  readonly finishedOn?: number;

  /**
   * Timestamp when job processing started
   */
  readonly processedOn?: number;

  /**
   * Reason for job failure
   */
  readonly failedReason?: string;

  /**
   * Number of attempts made
   */
  readonly attemptsMade?: number;

  /**
   * Timestamp when job was created
   */
  readonly timestamp?: number;

  /**
   * Update job progress
   * @param progress Progress value (0-100)
   */
  updateProgress(progress: number): Promise<void>;

  /**
   * Get current job state
   * @returns Current job state
   */
  getState(): Promise<JobState>;

  /**
   * Remove job from queue
   */
  remove(): Promise<void>;

  /**
   * Retry failed job
   */
  retry(): Promise<void>;

  /**
   * Log a message for this job
   * @param message Message to log
   */
  log(message: string): void;
}
