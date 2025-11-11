/**
 * Job status types
 */
export enum JobStatus {
  /**
   * Job is waiting to be processed
   */
  WAITING = 'waiting',

  /**
   * Job is currently being processed
   */
  ACTIVE = 'active',

  /**
   * Job has completed successfully
   */
  COMPLETED = 'completed',

  /**
   * Job has failed
   */
  FAILED = 'failed',

  /**
   * Job is delayed and will be processed later
   */
  DELAYED = 'delayed',

  /**
   * Job is paused
   */
  PAUSED = 'paused',
}
