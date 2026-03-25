import { Logger, OnModuleInit } from '@nestjs/common';
import { QueueProcessor } from '../queue/decorators/queue-processor.decorator';
import { IJob } from '../queue/interfaces/job.interface';
import { QueueService } from '../queue/services/queue.service';
import { QueueConfigService } from '../queue/config/queue-config.service';
import { TasksService } from './tasks.service';
import { BulkCreateTasksDto } from './dto/bulk-create-tasks.dto';

export interface BulkTaskImportJobData {
  dto: BulkCreateTasksDto;
  userId: string;
}

@QueueProcessor('bulk-task-import')
export class BulkTaskImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(BulkTaskImportProcessor.name);

  constructor(
    private queueService: QueueService,
    private queueConfigService: QueueConfigService,
    private tasksService: TasksService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing BulkTaskImportProcessor worker...');

      const adapter = await Promise.resolve(this.queueService.getAdapter());
      if (!adapter) {
        this.logger.error('Queue adapter not available. Bulk import jobs will not be processed.');
        return;
      }

      try {
        this.queueService.registerQueue('bulk-task-import');
        this.logger.log('Queue "bulk-task-import" registered successfully.');
      } catch (error) {
        this.logger.warn(
          `Queue "bulk-task-import" registration: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const bullMqConfig = this.queueConfigService.getBullMQConfig();
      const queuePrefix = bullMqConfig?.prefix || 'taskosaur';
      const queueConnection = bullMqConfig?.connection;

      if (!queueConnection) {
        this.logger.error('No Redis connection configuration found for bulk import worker');
      }

      const processor = async (job: IJob<BulkTaskImportJobData>) => {
        return await this.process(job);
      };

      adapter.createWorker('bulk-task-import', processor, {
        connection: queueConnection,
        prefix: queuePrefix,
      });

      this.logger.log(
        `Bulk task import worker registered on queue "${queuePrefix}:bulk-task-import"`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize BulkTaskImportProcessor: ${msg}`);
    }
  }

  async process(job: IJob<BulkTaskImportJobData>) {
    const { dto, userId } = job.data;

    this.logger.log(
      `Processing bulk import job ${job.id}: ${dto.tasks.length} tasks for project ${dto.projectId}`,
    );

    try {
      const result = await this.tasksService.bulkCreate(dto, userId);

      this.logger.log(
        `Bulk import job ${job.id} completed: ${result.created} created, ${result.failed} failed`,
      );

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bulk import job ${job.id} failed: ${msg}`);
      throw error;
    }
  }
}
