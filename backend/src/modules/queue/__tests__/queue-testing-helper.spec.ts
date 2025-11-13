/**
 * Example test using queue testing utilities
 */

import { createMockQueue, createMockJob } from '../utils/queue-testing.helper';

describe('Queue Testing Utilities', () => {
  describe('createMockJob', () => {
    it('should create a mock job with default values', () => {
      const job = createMockJob();

      expect(job.id).toBe('test-job-id');
      expect(job.name).toBe('test-job');
      expect(job.progress).toBe(0);
    });

    it('should allow overriding default values', () => {
      const job = createMockJob({
        id: 'custom-id',
        name: 'custom-job',
        data: { userId: '123' },
      });

      expect(job.id).toBe('custom-id');
      expect(job.name).toBe('custom-job');
      expect(job.data).toEqual({ userId: '123' });
    });

    it('should update progress', async () => {
      const job = createMockJob();
      await job.updateProgress(50);
      expect(job.progress).toBe(50);
    });
  });

  describe('createMockQueue', () => {
    it('should create a mock queue with default values', () => {
      const queue = createMockQueue();
      expect(queue.name).toBe('test-queue');
    });

    it('should add jobs to the queue', async () => {
      const queue = createMockQueue();
      const job = await queue.add('test-job', { userId: '123' });

      expect(job.id).toContain('job-');
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ userId: '123' });
    });

    it('should retrieve added jobs', async () => {
      const queue = createMockQueue();
      const addedJob = await queue.add('test-job', { userId: '123' });
      const retrievedJob = await queue.getJob(addedJob.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
    });

    it('should add jobs in bulk', async () => {
      const queue = createMockQueue();
      const jobs = await queue.addBulk([
        { name: 'job1', data: { userId: '1' } },
        { name: 'job2', data: { userId: '2' } },
      ]);

      expect(jobs).toHaveLength(2);
      expect(jobs[0].data).toEqual({ userId: '1' });
      expect(jobs[1].data).toEqual({ userId: '2' });
    });

    it('should get queue stats', async () => {
      const queue = createMockQueue();
      await queue.add('test-job', { userId: '123' });
      await queue.add('test-job', { userId: '456' });

      const stats = await queue.getStats();
      expect(stats.waiting).toBe(2);
    });

    it('should clear jobs on drain', async () => {
      const queue = createMockQueue();
      await queue.add('test-job', { userId: '123' });
      await queue.drain();

      const stats = await queue.getStats();
      expect(stats.waiting).toBe(0);
    });
  });
});
