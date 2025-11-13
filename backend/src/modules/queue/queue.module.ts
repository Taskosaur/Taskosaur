import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueConfigService } from './config/queue-config.service';
import { QueueProviderFactory } from './providers/queue.provider';
import { RedisConnectionValidator } from './services/redis-connection.validator';
import { QueueStartupLoggerService } from './services/queue-startup-logger.service';
import { QueueService } from './services/queue.service';
import { QueueMetricsService } from './services/queue-metrics.service';
import { QueueHealthController } from './controllers/queue-health.controller';
import { IQueueAdapter } from './interfaces/queue-adapter.interface';
import { getQueueToken } from './decorators/inject-queue.decorator';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD');

        return {
          connection: {
            host,
            port,
            password,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [QueueHealthController],
  providers: [
    QueueConfigService,
    RedisConnectionValidator,
    QueueStartupLoggerService,
    QueueMetricsService,
    {
      provide: QueueProviderFactory,
      useFactory: (configService: QueueConfigService, redisValidator: RedisConnectionValidator) => {
        return new QueueProviderFactory(configService.getConfig(), redisValidator);
      },
      inject: [QueueConfigService, RedisConnectionValidator],
    },
    {
      provide: QueueService,
      useFactory: (providerFactory: QueueProviderFactory) => {
        return new QueueService(providerFactory);
      },
      inject: [QueueProviderFactory],
    },
  ],
  exports: [
    BullModule,
    QueueConfigService,
    QueueProviderFactory,
    RedisConnectionValidator,
    QueueService,
    QueueMetricsService,
  ],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);
  private queueAdapter: IQueueAdapter | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly startupLogger: QueueStartupLoggerService,
  ) {}

  async onModuleInit() {
    try {
      this.startupLogger.logInitialization();

      // Initialize queue service
      await this.queueService.initialize();

      this.startupLogger.logComplete(this.queueService.getBackend());
    } catch (error) {
      console.error(error);
      this.startupLogger.logError('Failed to initialize queue module', error as Error);
      throw error;
    }
  }

  /**
   * Register a queue dynamically
   */
  static registerQueue(options: { name: string }): DynamicModule {
    const queueToken = getQueueToken(options.name);

    return {
      module: QueueModule,
      providers: [
        {
          provide: queueToken,
          useFactory: async (queueService: QueueService) => {
            // Ensure the queue service is initialized
            if (!queueService.getAdapter()) {
              await queueService.initialize();
            }
            queueService.registerQueue(options.name);
            return queueService.getQueue(options.name);
          },
          inject: [QueueService],
        },
      ],
      exports: [queueToken],
    };
  }
}
