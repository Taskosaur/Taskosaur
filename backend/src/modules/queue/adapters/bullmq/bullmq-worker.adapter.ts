import { Worker, WorkerOptions, Job } from 'bullmq';
import { IWorker, WorkerProcessor } from '../../interfaces/worker.interface';
import { BullMQJobAdapter } from './bullmq-job.adapter';
import { IJob } from '../../interfaces/job.interface';

/**
 * BullMQ Worker Adapter - Wraps BullMQ Worker to implement IWorker interface
 */
export class BullMQWorkerAdapter<T = any> implements IWorker<T> {
  private readonly worker: Worker<T>;
  private readonly processor: WorkerProcessor<T>;

  constructor(queueName: string, processor: WorkerProcessor<T>, options: WorkerOptions) {
    this.processor = processor;

    // Wrap the processor to convert BullMQ Job to IJob
    this.worker = new Worker<T>(
      queueName,
      async (job: Job<T>): Promise<any> => {
        const wrappedJob = new BullMQJobAdapter(job);
        return await this.processor(wrappedJob);
      },
      options,
    );
  }

  get name(): string {
    return this.worker.name;
  }

  async process(job: IJob<T>): Promise<any> {
    // This method is not directly called - BullMQ handles processing internally
    // Included for interface compliance
    return await this.processor(job);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  resume(): Promise<void> {
    this.worker.resume();
    return Promise.resolve();
  }

  /**
   * Get the underlying BullMQ worker (for advanced use cases)
   */
  getUnderlyingWorker(): Worker<T> {
    return this.worker;
  }
}
