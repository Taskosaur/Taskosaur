import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TrelloSyncController } from './trello-sync.controller';
import { TrelloSyncService } from './trello-sync.service';
import { TrelloApiService } from './trello-api.service';
import { TrelloSyncScheduler } from './trello-sync.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';
import { CryptoService } from '../../common/crypto.service';

import { TrelloWorkspaceController } from './trello-workspace.controller';

import { TaskRanksModule } from '../task-ranks/task-ranks.module';

@Module({
  imports: [PrismaModule, TaskRanksModule, ScheduleModule.forRoot()],
  controllers: [TrelloSyncController, TrelloWorkspaceController],
  providers: [TrelloSyncService, TrelloApiService, TrelloSyncScheduler, CryptoService],
  exports: [TrelloSyncService],
})
export class TrelloSyncModule {}
