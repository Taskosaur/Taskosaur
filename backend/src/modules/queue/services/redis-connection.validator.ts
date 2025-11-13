import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfig } from '../interfaces/queue-options.interface';

/**
 * Service to validate Redis connectivity
 */
@Injectable()
export class RedisConnectionValidator {
  private readonly logger = new Logger(RedisConnectionValidator.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [100, 200, 300]; // Exponential backoff in ms
  private readonly CONNECTION_TIMEOUT = 1000; // 1 second

  /**
   * Check if Redis connection is available
   * @param config Redis configuration
   * @returns True if connection is successful, false otherwise
   */
  async checkConnection(config: RedisConfig): Promise<boolean> {
    let redisClient: Redis | null = null;

    try {
      this.logger.debug(`Checking Redis connection to ${config.host}:${config.port}...`);

      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          // Create Redis client with lazy connection
          redisClient = new Redis({
            ...config,
            lazyConnect: true,
            connectTimeout: this.CONNECTION_TIMEOUT,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Disable automatic retries
          });

          // Handle error events to prevent unhandled error event warnings
          redisClient.on('error', () => {
            // Suppress error to prevent unhandled error event warnings
          });

          // Attempt to connect
          await redisClient.connect();

          // Ping to verify connection
          await redisClient.ping();

          this.logger.debug(`✓ Redis connection successful on attempt ${attempt}`);
          return true;
        } catch (error) {
          this.logger.debug(`Redis connection attempt ${attempt} failed: ${error.message}`);

          // Wait before retry (except on last attempt)
          if (attempt < this.MAX_RETRIES) {
            await this.delay(this.RETRY_DELAYS[attempt - 1]);
          }
        } finally {
          // Clean up connection
          if (redisClient) {
            try {
              await redisClient.quit();
            } catch {
              // console.error('Error during Redis cleanup:', error);
              // Ignore cleanup errors
            }
            redisClient = null;
          }
        }
      }

      // All retries failed
      this.logger.debug(`✗ Redis connection failed after ${this.MAX_RETRIES} attempts`);
      return false;
    } catch (error) {
      this.logger.error(`Error checking Redis connection: ${error.message}`);
      return false;
    }
  }

  /**
   * Helper method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
