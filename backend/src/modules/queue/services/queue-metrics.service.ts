import { Injectable, Logger } from '@nestjs/common';

/**
 * Metrics for a specific queue
 */
export interface QueueMetrics {
  queueName: string;
  totalJobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
  activeJobs: Set<string>;
}

/**
 * Job tracking information
 */
interface JobTracker {
  jobId: string;
  queueName: string;
  startTime: number;
}

/**
 * Service to track queue performance metrics
 */
@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);
  private readonly metrics = new Map<string, QueueMetrics>();
  private readonly activeJobs = new Map<string, JobTracker>();

  /**
   * Record when a job starts processing
   */
  recordJobStart(queueName: string, jobId: string): void {
    // Ensure queue metrics exist
    this.ensureQueueMetrics(queueName);

    // Track active job
    this.activeJobs.set(jobId, {
      jobId,
      queueName,
      startTime: Date.now(),
    });

    const metrics = this.metrics.get(queueName)!;
    metrics.activeJobs.add(jobId);

    this.logger.debug(`Job ${jobId} started in queue ${queueName}`);
  }

  /**
   * Record when a job completes successfully
   */
  recordJobComplete(queueName: string, jobId: string, duration?: number): void {
    const metrics = this.ensureQueueMetrics(queueName);
    const tracker = this.activeJobs.get(jobId);

    // Calculate duration if not provided
    let actualDuration = duration;
    if (!actualDuration && tracker) {
      actualDuration = Date.now() - tracker.startTime;
    }

    // Update metrics
    metrics.totalJobsProcessed++;
    metrics.jobsSucceeded++;
    metrics.lastProcessedAt = new Date();

    // Update average processing time
    if (actualDuration) {
      const totalTime = metrics.averageProcessingTime * (metrics.totalJobsProcessed - 1);
      metrics.averageProcessingTime = (totalTime + actualDuration) / metrics.totalJobsProcessed;
    }

    // Cleanup
    metrics.activeJobs.delete(jobId);
    this.activeJobs.delete(jobId);

    this.logger.debug(`Job ${jobId} completed in queue ${queueName} (${actualDuration}ms)`);
  }

  /**
   * Record when a job fails
   */
  recordJobFailed(queueName: string, jobId: string, error: Error): void {
    const metrics = this.ensureQueueMetrics(queueName);
    // const _tracker = this.activeJobs.get(jobId);

    // Update metrics
    metrics.totalJobsProcessed++;
    metrics.jobsFailed++;
    metrics.lastProcessedAt = new Date();

    // Cleanup
    metrics.activeJobs.delete(jobId);
    this.activeJobs.delete(jobId);

    this.logger.debug(`Job ${jobId} failed in queue ${queueName}: ${error.message}`);
  }

  /**
   * Get metrics for a specific queue or all queues
   */
  getMetrics(queueName?: string): QueueMetrics | QueueMetrics[] {
    if (queueName) {
      const metrics = this.metrics.get(queueName);
      if (!metrics) {
        return this.createEmptyMetrics(queueName);
      }
      return metrics;
    }

    // Return all metrics
    return Array.from(this.metrics.values());
  }

  /**
   * Reset metrics for a specific queue or all queues
   */
  resetMetrics(queueName?: string): void {
    if (queueName) {
      const metrics = this.metrics.get(queueName);
      if (metrics) {
        this.resetQueueMetrics(metrics);
        this.logger.log(`Metrics reset for queue ${queueName}`);
      }
    } else {
      // Reset all metrics
      this.metrics.forEach((metrics) => this.resetQueueMetrics(metrics));
      this.activeJobs.clear();
      this.logger.log('All metrics reset');
    }
  }

  /**
   * Get summary statistics across all queues
   */
  getGlobalSummary(): {
    totalQueues: number;
    totalJobsProcessed: number;
    totalJobsSucceeded: number;
    totalJobsFailed: number;
    averageSuccessRate: number;
    totalActiveJobs: number;
  } {
    const allMetrics = Array.from(this.metrics.values());

    const totalJobsProcessed = allMetrics.reduce((sum, m) => sum + m.totalJobsProcessed, 0);
    const totalJobsSucceeded = allMetrics.reduce((sum, m) => sum + m.jobsSucceeded, 0);
    const totalJobsFailed = allMetrics.reduce((sum, m) => sum + m.jobsFailed, 0);
    const totalActiveJobs = this.activeJobs.size;

    const averageSuccessRate =
      totalJobsProcessed > 0 ? (totalJobsSucceeded / totalJobsProcessed) * 100 : 0;

    return {
      totalQueues: this.metrics.size,
      totalJobsProcessed,
      totalJobsSucceeded,
      totalJobsFailed,
      averageSuccessRate,
      totalActiveJobs,
    };
  }

  /**
   * Ensure metrics exist for a queue
   */
  private ensureQueueMetrics(queueName: string): QueueMetrics {
    if (!this.metrics.has(queueName)) {
      this.metrics.set(queueName, this.createEmptyMetrics(queueName));
    }
    return this.metrics.get(queueName)!;
  }

  /**
   * Create empty metrics for a queue
   */
  private createEmptyMetrics(queueName: string): QueueMetrics {
    return {
      queueName,
      totalJobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      averageProcessingTime: 0,
      activeJobs: new Set<string>(),
    };
  }

  /**
   * Reset metrics for a queue
   */
  private resetQueueMetrics(metrics: QueueMetrics): void {
    metrics.totalJobsProcessed = 0;
    metrics.jobsSucceeded = 0;
    metrics.jobsFailed = 0;
    metrics.averageProcessingTime = 0;
    metrics.lastProcessedAt = undefined;
    metrics.activeJobs.clear();
  }
}
