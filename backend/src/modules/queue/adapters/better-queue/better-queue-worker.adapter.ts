import { IWorker, WorkerProcessor } from '../../interfaces/worker.interface';
import { IJob } from '../../interfaces/job.interface';
import { BetterQueueQueueAdapter } from './better-queue-queue.adapter';

/**
 * Better-Queue Worker Adapter
 *
 * Note: better-queue doesn't have separate workers like BullMQ.
 * The queue itself processes jobs. This adapter connects the processor
 * to the queue.
 */
export class BetterQueueWorkerAdapter<T = any> implements IWorker<T> {
  constructor(
    public readonly name: string,
    private readonly processor: WorkerProcessor<T>,
    private readonly queue: BetterQueueQueueAdapter<T>,
  ) {
    // Connect processor to queue
    this.queue.setProcessor(processor);
  }

  async process(job: IJob<T>): Promise<any> {
    return await this.processor(job);
  }

  async close(): Promise<void> {
    // Worker cleanup is handled by queue
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }
}
