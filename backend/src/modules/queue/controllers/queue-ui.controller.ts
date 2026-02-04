import { Controller, Get, All, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { QueueService } from '../services/queue.service';
import { BullMQQueueAdapter } from '../adapters/bullmq/bullmq-queue.adapter';
import { Public } from '../../auth/decorators/public.decorator';

@Public()
@Controller('queues')
export class QueueUIController {
  private readonly logger = new Logger(QueueUIController.name);
  private boardInitialized = false;
  private readonly serverAdapter: ExpressAdapter;

  constructor(private readonly queueService: QueueService) {
    this.logger.log('QueueUIController instantiated');
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/api/queues');
  }

  @Get('test')
  test() {
    return { status: 'ok', message: 'Queue UI Controller is reachable' };
  }

  @All(['/', '/*'])
  handle(@Req() req: Request, @Res() res: Response) {
    this.logger.debug(`QueueUI handle request: ${req.method} ${req.url}`);

    // Always check for new queues if we're on the main dashboard page
    // or if the board hasn't been initialized yet.
    if (!this.boardInitialized || req.path === '/' || req.path === '') {
      this.initializeBoard();
    }

    // Bull Board needs to see paths relative to its mount point.
    const entryPath = '/api/queues';
    if (req.url.startsWith(entryPath)) {
      req.url = req.url.substring(entryPath.length) || '/';
    }

    const router = this.serverAdapter.getRouter() as unknown as (
      req: Request,
      res: Response,
    ) => void;
    if (router) {
      router(req, res);
      return;
    }

    res.status(404).send('Queue board not initialized');
  }

  private readonly registeredQueueNames = new Set<string>();
  private readonly queueAdapters: BullMQAdapter[] = [];

  private initializeBoard() {
    try {
      const queueNames = this.queueService.getRegisteredQueues();
      let hasNewQueues = false;

      for (const name of queueNames) {
        if (!this.registeredQueueNames.has(name)) {
          try {
            const wrapper = this.queueService.getQueue(name);
            if (wrapper instanceof BullMQQueueAdapter) {
              const bullQueue = wrapper.getUnderlyingQueue();
              this.queueAdapters.push(new BullMQAdapter(bullQueue));
              this.registeredQueueNames.add(name);
              hasNewQueues = true;
              this.logger.log(`Added queue "${name}" to Bull Board`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to add queue "${name}" to Bull Board: ${message}`);
          }
        }
      }

      if (hasNewQueues || !this.boardInitialized) {
        if (this.queueAdapters.length > 0) {
          createBullBoard({
            queues: this.queueAdapters,
            serverAdapter: this.serverAdapter,
          });
          this.boardInitialized = true;
          this.logger.log(
            `Bull Board ${hasNewQueues ? 'updated' : 'initialized'} with ${this.queueAdapters.length} queues`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error initializing Bull Board: ${message}`);
    }
  }
}
