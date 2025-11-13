import { BetterQueueAdapter } from '../better-queue.adapter';
import { JobStatus } from '../../../enums/job-status.enum';

describe('BetterQueueAdapter', () => {
  let adapter: BetterQueueAdapter;

  beforeEach(() => {
    adapter = new BetterQueueAdapter({
      store: 'memory',
      concurrent: 2,
      maxRetries: 0, // Disable retries for faster test execution
      retryDelay: 100,
    });
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Queue Operations', () => {
    it('should create a queue', () => {
      const queue = adapter.createQueue('test-queue');
      expect(queue).toBeDefined();
      expect(queue.name).toBe('test-queue');
    });

    it('should add jobs to queue', async () => {
      const queue = adapter.createQueue('test-queue');
      const job = await queue.add('test-job', { data: 'test' });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data).toEqual({ data: 'test' });
    });

    it('should process jobs', async () => {
      const queue = adapter.createQueue('test-queue');
      let processed = false;

      adapter.createWorker('test-queue', () => {
        processed = true;
        return { success: true };
      });

      await queue.add('test-job', { data: 'test' });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processed).toBe(true);
    });

    it('should handle job failures', async () => {
      const queue = adapter.createQueue('test-queue');

      adapter.createWorker('test-queue', () => {
        throw new Error('Job failed');
      });

      const job = await queue.add('test-job', { data: 'test' });

      // Wait for failure (longer to account for retries)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const state = await job.getState();
      expect(state).toBe(JobStatus.FAILED);
      expect(job.failedReason).toBeDefined();
      expect(job.failedReason).toContain('Job failed');
    });

    it('should retrieve job by id', async () => {
      const queue = adapter.createQueue('test-queue');
      const job = await queue.add('test-job', { data: 'test' });

      const retrievedJob = await queue.getJob(job.id);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(job.id);
    });

    it('should get waiting jobs', async () => {
      const queue = adapter.createQueue('test-queue');
      await queue.add('test-job-1', { data: 'test1' });
      await queue.add('test-job-2', { data: 'test2' });

      const waitingJobs = await queue.getWaiting();
      expect(waitingJobs.length).toBeGreaterThan(0);
    });

    it('should add bulk jobs', async () => {
      const queue = adapter.createQueue('test-queue');
      const jobs = await queue.addBulk([
        { name: 'job-1', data: { value: 1 } },
        { name: 'job-2', data: { value: 2 } },
        { name: 'job-3', data: { value: 3 } },
      ]);

      expect(jobs).toHaveLength(3);
      expect(jobs[0].name).toBe('job-1');
      expect(jobs[1].name).toBe('job-2');
      expect(jobs[2].name).toBe('job-3');
    });
  });

  describe('Worker Operations', () => {
    it('should create a worker', () => {
      const worker = // eslint-disable-next-line @typescript-eslint/no-unused-vars
        adapter.createWorker('test-queue', (_) => {
          return { success: true };
        });

      expect(worker).toBeDefined();
      expect(worker.name).toBe('test-queue');
    });

    it('should pause and resume worker', async () => {
      const queue = adapter.createQueue('test-queue');
      const worker = // eslint-disable-next-line @typescript-eslint/no-unused-vars
        adapter.createWorker('test-queue', (_) => {
          return { success: true };
        });

      await worker.pause();
      expect(await queue.isPaused()).toBe(true);

      await worker.resume();
      expect(await queue.isPaused()).toBe(false);
    });

    it('should process jobs with worker', async () => {
      const queue = adapter.createQueue('test-queue');
      const results: any[] = [];

      adapter.createWorker('test-queue', (job) => {
        results.push(job.data);
        return { processed: true };
      });

      await queue.add('job-1', { value: 1 });
      await queue.add('job-2', { value: 2 });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(results.length).toBe(2);
      expect(results).toContainEqual({ value: 1 });
      expect(results).toContainEqual({ value: 2 });
    });
  });

  describe('Queue Control', () => {
    it('should pause and resume queue', async () => {
      const queue = adapter.createQueue('test-queue');

      await queue.pause();
      expect(await queue.isPaused()).toBe(true);

      await queue.resume();
      expect(await queue.isPaused()).toBe(false);
    });

    it('should get queue stats', async () => {
      const queue = adapter.createQueue('test-queue');
      await queue.add('job-1', { data: 'test' });

      const stats = await queue.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('should close queue', async () => {
      const queue = adapter.createQueue('test-queue');
      await queue.add('job-1', { data: 'test' });

      await queue.close();
      // Queue should be closed without errors
    });
  });

  describe('Health Check', () => {
    it('should always be healthy', async () => {
      const healthy = await adapter.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should return correct backend type', () => {
      expect(adapter.getBackendType()).toBe('better-queue');
    });
  });

  describe('Adapter Lifecycle', () => {
    it('should close all queues and workers', async () => {
      // const _queue1 = adapter.createQueue('queue-1');
      // const _queue2 = adapter.createQueue('queue-2');

      adapter.createWorker('queue-1', () => ({ done: true }));

      adapter.createWorker('queue-2', () => ({ done: true }));

      await adapter.close();
      // All queues and workers should be closed without errors
    });
  });
});
