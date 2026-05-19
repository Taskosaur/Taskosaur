import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JiraSyncController } from './jira-sync.controller';
import { JiraSyncService } from './jira-sync.service';
import { JiraApiService } from './jira-api.service';
import { JiraSyncScheduler } from './jira-sync.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';
import { CryptoService } from '../../common/crypto.service';
import { JiraWorkspaceController } from './jira-workspace.controller';
import { TaskRanksModule } from '../task-ranks/task-ranks.module';

@Module({
  imports: [PrismaModule, TaskRanksModule, ScheduleModule.forRoot()],
  controllers: [JiraSyncController, JiraWorkspaceController],
  providers: [JiraSyncService, JiraApiService, JiraSyncScheduler, CryptoService],
  exports: [JiraSyncService],
})
export class JiraSyncModule {}
