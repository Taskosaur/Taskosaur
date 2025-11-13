import { QueueProviderFactory } from '../providers/queue.provider';
import { RedisConnectionValidator } from '../services/redis-connection.validator';
import { QueueBackend } from '../enums/queue-backend.enum';
import { QueueModuleConfig } from '../config/queue-config.interface';

describe('Queue Fallback Integration', () => {
  let validator: RedisConnectionValidator;
  let factory: QueueProviderFactory;

  beforeEach(() => {
    validator = new RedisConnectionValidator();
  });

  afterEach(async () => {
    if (factory) {
      const adapter = factory.getAdapter();
      if (adapter) {
        await adapter.close();
      }
    }
  });

  describe('Redis Available Scenario', () => {
    it('should use BullMQ when Redis is available', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: true,
        bullmq: {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: 3,
          },
          prefix: 'test-queue',
        },
        betterQueue: {
          store: 'memory',
          concurrent: 5,
        },
        logging: {
          logBackendSelection: true,
          logFallback: true,
          logLevel: 'info',
        },
      };

      factory = new QueueProviderFactory(config, validator);

      try {
        const adapter = await factory.createAdapter();

        // Check if Redis is actually available
        const redisAvailable = factory.isRedisAvailable();

        if (redisAvailable) {
          expect(adapter.getBackendType()).toBe(QueueBackend.BULLMQ);
          expect(factory.getBackend()).toBe(QueueBackend.BULLMQ);
          expect(factory.isFallbackActive()).toBe(false);
        } else {
          // If Redis is not available, fallback should occur
          expect(adapter.getBackendType()).toBe(QueueBackend.BETTER_QUEUE);
          expect(factory.isFallbackActive()).toBe(true);
        }
      } catch (error) {
        console.error(error);
        // If error occurs and fallback is enabled, it should fallback
        if (config.enableFallback) {
          throw error; // This should not happen with fallback enabled
        }
      }
    });
  });

  describe('Redis Unavailable Scenario', () => {
    it('should fallback to better-queue when Redis is unavailable', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: true,
        bullmq: {
          connection: {
            host: 'invalid-redis-host',
            port: 9999, // Invalid port
            maxRetriesPerRequest: 1,
          },
          prefix: 'test-queue',
        },
        betterQueue: {
          store: 'memory',
          concurrent: 5,
        },
        logging: {
          logBackendSelection: true,
          logFallback: true,
          logLevel: 'info',
        },
      };

      factory = new QueueProviderFactory(config, validator);
      const adapter = await factory.createAdapter();

      expect(adapter.getBackendType()).toBe(QueueBackend.BETTER_QUEUE);
      expect(factory.getBackend()).toBe(QueueBackend.BETTER_QUEUE);
      expect(factory.isFallbackActive()).toBe(true);
      expect(factory.isRedisAvailable()).toBe(false);
    });

    it('should throw error when fallback is disabled and Redis unavailable', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: false, // Fallback disabled
        bullmq: {
          connection: {
            host: 'invalid-redis-host',
            port: 9999,
            maxRetriesPerRequest: 1,
          },
          prefix: 'test-queue',
        },
        logging: {
          logBackendSelection: true,
          logFallback: true,
          logLevel: 'info',
        },
      };

      factory = new QueueProviderFactory(config, validator);

      await expect(factory.createAdapter()).rejects.toThrow(
        /Redis is unavailable and fallback is disabled/,
      );
    });
  });

  describe('Explicit Backend Selection', () => {
    it('should use better-queue when explicitly requested', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BETTER_QUEUE,
        enableFallback: true,
        betterQueue: {
          store: 'memory',
          concurrent: 5,
        },
        logging: {
          logBackendSelection: true,
          logFallback: true,
          logLevel: 'info',
        },
      };

      factory = new QueueProviderFactory(config, validator);
      const adapter = await factory.createAdapter();

      expect(adapter.getBackendType()).toBe(QueueBackend.BETTER_QUEUE);
      expect(factory.getBackend()).toBe(QueueBackend.BETTER_QUEUE);
      expect(factory.isFallbackActive()).toBe(false); // Not a fallback, explicitly requested
    });
  });

  describe('Queue Functionality After Fallback', () => {
    it('should process jobs correctly with better-queue fallback', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: true,
        bullmq: {
          connection: {
            host: 'invalid-redis-host',
            port: 9999,
            maxRetriesPerRequest: 1,
          },
          prefix: 'test-queue',
        },
        betterQueue: {
          store: 'memory',
          concurrent: 5,
        },
        logging: {
          logBackendSelection: false,
          logFallback: false,
          logLevel: 'error',
        },
      };

      factory = new QueueProviderFactory(config, validator);
      const adapter = await factory.createAdapter();

      // Create queue and worker
      const queue = adapter.createQueue('test-queue');
      let processed = false;

      adapter.createWorker('test-queue', (job) => {
        processed = true;
        return { success: true, data: job.data };
      });

      // Add job
      const job = await queue.add('test-job', { test: 'data' });
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(processed).toBe(true);
    });

    it('should handle job failures correctly with fallback', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: true,
        bullmq: {
          connection: {
            host: 'invalid-redis-host',
            port: 9999,
            maxRetriesPerRequest: 1,
          },
          prefix: 'test-queue',
        },
        betterQueue: {
          store: 'memory',
          concurrent: 5,
          maxRetries: 1,
        },
        logging: {
          logBackendSelection: false,
          logFallback: false,
          logLevel: 'error',
        },
      };

      factory = new QueueProviderFactory(config, validator);
      const adapter = await factory.createAdapter();

      const queue = adapter.createQueue('test-queue');

      adapter.createWorker('test-queue', () => {
        throw new Error('Simulated failure');
      });

      // const _job = await queue.add('failing-job', { data: 'test' });

      // Wait for failure
      await new Promise((resolve) => setTimeout(resolve, 500));

      const failedJobs = await queue.getFailed();
      expect(failedJobs.length).toBeGreaterThan(0);
    });
  });

  describe('Adapter Health Check', () => {
    it('should report healthy when using better-queue fallback', async () => {
      const config: QueueModuleConfig = {
        backend: QueueBackend.BULLMQ,
        enableFallback: true,
        bullmq: {
          connection: {
            host: 'invalid-redis-host',
            port: 9999,
            maxRetriesPerRequest: 1,
          },
          prefix: 'test-queue',
        },
        betterQueue: {
          store: 'memory',
          concurrent: 5,
        },
        logging: {
          logBackendSelection: false,
          logFallback: false,
          logLevel: 'error',
        },
      };

      factory = new QueueProviderFactory(config, validator);
      const adapter = await factory.createAdapter();

      const healthy = await adapter.isHealthy();
      expect(healthy).toBe(true);
    });
  });
});
