import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TrelloSyncService } from './trello-sync.service';

@Injectable()
export class TrelloSyncScheduler {
  private readonly logger = new Logger(TrelloSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trelloSyncService: TrelloSyncService,
  ) {}

  /**
   * Runs every minute and processes any TrelloSync record
   * that is enabled and due for a sync based on its individual syncInterval.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledSyncs() {
    this.logger.debug('Checking for due Trello syncs...');

    try {
      const now = new Date();

      // Find all enabled sync configs that are due
      const dueSyncs = await this.prisma.trelloSync.findMany({
        where: {
          syncEnabled: true,
          projectId: { not: null },
          OR: [
            { lastSyncAt: null }, // Never synced
            {
              // lastSyncAt + syncInterval minutes <= now
              lastSyncAt: {
                lte: new Date(now.getTime() - 0), // computed below via raw filter
              },
            },
          ],
        },
      });

      // Filter in JS because Prisma doesn't support column-based interval arithmetic
      const actuallyDue = dueSyncs.filter((sync) => {
        if (!sync.lastSyncAt) return true;
        const nextSyncAt = new Date(sync.lastSyncAt.getTime() + sync.syncInterval * 60 * 1000);
        return now >= nextSyncAt;
      });

      if (actuallyDue.length === 0) {
        this.logger.debug('No Trello syncs due at this time');
        return;
      }

      this.logger.log(`Processing ${actuallyDue.length} scheduled Trello sync(s)`);

      // Process each sync sequentially (to avoid hammering Trello API)
      for (const sync of actuallyDue) {
        try {
          await this.trelloSyncService.runSync(sync);
        } catch (err) {
          // Error is already logged + recorded in DB by runSync — continue
          this.logger.error(`Scheduled sync failed for project ${sync.projectId}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process scheduled Trello syncs:', error);
    }
  }
}
