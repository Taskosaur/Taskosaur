import { Controller, Get } from '@nestjs/common';
import { QueueService } from '../services/queue.service';
import { QueueMetricsService } from '../services/queue-metrics.service';

/**
 * Health check response structure
 */
export interface QueueHealthResponse {
  /**
   * Current backend in use
   */
  backend: string;

  /**
   * Requested backend from configuration
   */
  requestedBackend: string;

  /**
   * Whether fallback occurred
   */
  fallbackOccurred: boolean;

  /**
   * Whether Redis is available
   */
  redisAvailable: boolean;

  /**
   * List of registered queues
   */
  queues: string[];

  /**
   * Aggregated statistics
   */
  stats: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    successRate: number;
  };

  /**
   * Response timestamp
   */
  timestamp: string;
}

/**
 * Controller for queue health checks
 */
@Controller('health/queue')
export class QueueHealthController {
  constructor(
    private readonly queueService: QueueService,
    private readonly metricsService: QueueMetricsService,
  ) {}

  /**
   * Get queue health status
   */
  @Get()
  getHealth(): QueueHealthResponse {
    // Get backend information
    const backend = this.queueService.getBackend();
    const requestedBackend = this.queueService.getRequestedBackend();
    const fallbackOccurred = this.queueService.isFallbackActive();
    const redisAvailable = this.queueService.isRedisAvailable();

    // Get registered queues
    const queues = this.queueService.getRegisteredQueues();

    // Get metrics summary
    const metricsSummary = this.metricsService.getGlobalSummary();

    return {
      backend,
      requestedBackend,
      fallbackOccurred,
      redisAvailable,
      queues,
      stats: {
        totalJobs: metricsSummary.totalJobsProcessed,
        completedJobs: metricsSummary.totalJobsSucceeded,
        failedJobs: metricsSummary.totalJobsFailed,
        activeJobs: metricsSummary.totalActiveJobs,
        successRate: metricsSummary.averageSuccessRate,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
