import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for consistent startup logging
 */
@Injectable()
export class QueueStartupLoggerService {
  private readonly logger = new Logger('QueueModule');

  /**
   * Log queue module initialization start
   */
  logInitialization(): void {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('Queue Module Initialization');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Log requested backend
   */
  logRequestedBackend(backend: string, isDefault: boolean): void {
    this.logger.log(`Requested backend: ${backend}${isDefault ? ' (default)' : ''}`);
  }

  /**
   * Log Redis connection check start
   */
  logRedisCheck(): void {
    this.logger.log('Checking Redis connection...');
  }

  /**
   * Log successful Redis connection
   */
  logRedisSuccess(): void {
    this.logger.log('✓ Redis connection successful');
  }

  /**
   * Log failed Redis connection
   */
  logRedisFailure(error?: string): void {
    const message = error ? `✗ Redis connection failed: ${error}` : '✗ Redis connection failed';
    this.logger.warn(message);
  }

  /**
   * Log fallback to better-queue
   */
  logFallback(): void {
    this.logger.warn('→ Falling back to better-queue (in-memory mode)');
  }

  /**
   * Log final backend selection
   */
  logBackendSelected(backend: string, isFallback: boolean): void {
    const suffix = isFallback ? ' (fallback)' : '';
    this.logger.log(`✓ Queue backend: ${backend}${suffix}`);
  }

  /**
   * Log initialization complete
   */
  logComplete(backend: string): void {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`Queue module initialized with ${backend} backend`);
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Log error during initialization
   */
  logError(message: string, error?: Error): void {
    this.logger.error(`✗ ${message}`);
    if (error) {
      this.logger.error(error.stack || error.message);
    }
  }

  /**
   * Log warning
   */
  logWarning(message: string): void {
    this.logger.warn(message);
  }

  /**
   * Log debug information
   */
  logDebug(message: string): void {
    this.logger.debug(message);
  }
}
