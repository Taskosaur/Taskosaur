import { IJob } from '../../interfaces/job.interface';
import { JobState } from '../../interfaces/queue-options.interface';
import { JobStatus } from '../../enums/job-status.enum';

/**
 * Better-Queue Job Adapter
 *
 * Note: better-queue has a simpler job model than BullMQ,
 * so some features are emulated or simplified.
 */
export class BetterQueueJobAdapter<T = any> implements IJob<T> {
  private _progress = 0;
  private _returnvalue: unknown;
  private _finishedOn?: number;
  private _processedOn?: number;
  private _failedReason?: string;
  private _attemptsMade = 0;
  private _status: JobStatus = JobStatus.WAITING;

  constructor(
    private readonly jobId: string,
    private readonly jobName: string,
    private readonly jobData: T,
    private readonly jobTimestamp: number,
  ) {}

  get id(): string {
    return this.jobId;
  }

  get name(): string {
    return this.jobName;
  }

  get data(): T {
    return this.jobData;
  }

  get progress(): number {
    return this._progress;
  }

  get returnvalue(): unknown {
    return this._returnvalue;
  }

  get finishedOn(): number | undefined {
    return this._finishedOn;
  }

  get processedOn(): number | undefined {
    return this._processedOn;
  }

  get failedReason(): string | undefined {
    return this._failedReason;
  }

  get attemptsMade(): number | undefined {
    return this._attemptsMade;
  }

  get timestamp(): number | undefined {
    return this.jobTimestamp;
  }

  updateProgress(progress: number): Promise<void> {
    this._progress = Math.min(100, Math.max(0, progress));
    // Emit progress event if needed
    return Promise.resolve();
  }

  getState(): Promise<JobState> {
    return Promise.resolve(this._status);
  }

  remove(): Promise<void> {
    // Mark for removal
    this._status = JobStatus.FAILED;
    return Promise.resolve();
  }

  retry(): Promise<void> {
    this._attemptsMade++;
    this._status = JobStatus.WAITING;
    this._failedReason = undefined;
    return Promise.resolve();
  }

  log(message: string): void {
    console.log(`[Job ${this.id}] ${message}`);
  }

  // Internal methods for adapter use
  _markProcessing(): void {
    this._status = JobStatus.ACTIVE;
    this._processedOn = Date.now();
  }

  _markCompleted(result: any): void {
    this._status = JobStatus.COMPLETED;
    this._returnvalue = result;
    this._finishedOn = Date.now();
    this._progress = 100;
  }

  _markFailed(error: Error): void {
    this._status = JobStatus.FAILED;
    this._failedReason = error.message;
    this._finishedOn = Date.now();
  }
}
