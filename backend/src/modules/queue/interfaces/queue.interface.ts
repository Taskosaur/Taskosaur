import { JobStatus } from '../enums/job-status.enum';
import { QueueEvent } from '../enums/queue-event.enum';
import { IJob } from './job.interface';
import { JobOptions, BulkJobOptions, QueueStats } from './queue-options.interface';

/**
 * Generic queue interface that all queue adapters must implement
 */
export interface IQueue<T = any> {
  /**
   * Queue name
   */
  readonly name: string;

  // ===========================
  // Job Operations
  // ===========================

  /**
   * Add a job to the queue
   * @param name Job name/type
   * @param data Job data
   * @param options Job options
   * @returns Created job
   */
  add(name: string, data: T, options?: JobOptions): Promise<IJob<T>>;

  /**
   * Add multiple jobs to the queue in bulk
   * @param jobs Array of jobs to add
   * @returns Array of created jobs
   */
  addBulk(jobs: BulkJobOptions<T>[]): Promise<IJob<T>[]>;

  // ===========================
  // Job Retrieval
  // ===========================

  /**
   * Get a specific job by ID
   * @param jobId Job identifier
   * @returns Job or null if not found
   */
  getJob(jobId: string): Promise<IJob<T> | null>;

  /**
   * Get jobs by status
   * @param statuses Array of statuses to filter by
   * @returns Array of jobs
   */
  getJobs(statuses: JobStatus[]): Promise<IJob<T>[]>;

  /**
   * Get all waiting jobs
   * @returns Array of waiting jobs
   */
  getWaiting(): Promise<IJob<T>[]>;

  /**
   * Get all active jobs
   * @returns Array of active jobs
   */
  getActive(): Promise<IJob<T>[]>;

  /**
   * Get all completed jobs
   * @returns Array of completed jobs
   */
  getCompleted(): Promise<IJob<T>[]>;

  /**
   * Get all failed jobs
   * @returns Array of failed jobs
   */
  getFailed(): Promise<IJob<T>[]>;

  // ===========================
  // Queue Control
  // ===========================

  /**
   * Pause the queue
   */
  pause(): Promise<void>;

  /**
   * Resume the queue
   */
  resume(): Promise<void>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;

  /**
   * Check if queue is paused
   * @returns True if paused
   */
  isPaused(): Promise<boolean>;

  // ===========================
  // Maintenance
  // ===========================

  /**
   * Clean old jobs from the queue
   * @param grace Grace period in milliseconds
   * @param limit Maximum number of jobs to clean
   * @param status Status of jobs to clean
   */
  clean(grace: number, limit: number, status: JobStatus): Promise<void>;

  /**
   * Completely remove the queue and all its data
   */
  obliterate(): Promise<void>;

  /**
   * Remove all jobs from the queue
   */
  drain(): Promise<void>;

  // ===========================
  // Stats
  // ===========================

  /**
   * Get queue statistics
   * @returns Queue stats
   */
  getStats(): Promise<QueueStats>;

  // ===========================
  // Event Listeners
  // ===========================

  /**
   * Register an event listener
   * @param event Event type
   * @param handler Event handler
   */
  on(event: QueueEvent, handler: (...args: any[]) => void): void;

  /**
   * Remove an event listener
   * @param event Event type
   * @param handler Event handler
   */
  off(event: QueueEvent, handler: (...args: any[]) => void): void;

  /**
   * Register a one-time event listener
   * @param event Event type
   * @param handler Event handler
   */
  once(event: QueueEvent, handler: (...args: any[]) => void): void;
}
