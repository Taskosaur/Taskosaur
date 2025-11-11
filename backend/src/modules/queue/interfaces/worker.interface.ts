import { IJob } from './job.interface';

/**
 * Worker processor function type
 */
export type WorkerProcessor<T = any> = (job: IJob<T>) => Promise<any>;

/**
 * Generic worker interface that all queue adapters must implement
 */
export interface IWorker<T = any> {
  /**
   * Worker name
   */
  readonly name: string;

  /**
   * Process a job
   * @param job Job to process
   * @returns Processing result
   */
  process(job: IJob<T>): Promise<any>;

  /**
   * Close the worker
   */
  close(): Promise<void>;

  /**
   * Pause the worker
   */
  pause(): Promise<void>;

  /**
   * Resume the worker
   */
  resume(): Promise<void>;
}
