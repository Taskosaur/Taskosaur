import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { JiraSyncService } from './jira-sync.service';

@Injectable()
export class JiraSyncScheduler {
  private readonly logger = new Logger(JiraSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jiraSyncService: JiraSyncService,
  ) {}

  /**
   * Runs every minute and processes any JiraSync record
   * that is enabled and due for a sync based on its individual syncInterval.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledSyncs() {
    this.logger.debug('Checking for due Jira syncs...');

    try {
      const now = new Date();

      // Find all enabled sync configs for projects (not workspace-level records)
      const dueSyncs = await this.prisma.jiraSync.findMany({
        where: {
          syncEnabled: true,
          projectId: { not: null },
          OR: [
            { lastSyncAt: null }, // Never synced
            {
              lastSyncAt: {
                // Broad filter; fine-grained interval check is done in JS below.
                lte: now,
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
        this.logger.debug('No Jira syncs due at this time');
        return;
      }

      this.logger.log(`Processing ${actuallyDue.length} scheduled Jira sync(s)`);

      for (const sync of actuallyDue) {
        try {
          await this.jiraSyncService.runSync(sync);
        } catch (err) {
          // Error is already logged + recorded in DB by runSync — continue
          this.logger.error(
            `Scheduled Jira sync failed for project ${sync.projectId}: ${err.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to process scheduled Jira syncs:', error);
    }
  }
}
