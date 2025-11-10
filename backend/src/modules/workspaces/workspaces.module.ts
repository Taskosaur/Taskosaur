import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AccessControlService } from 'src/common/access-control.utils';
import { WorkspaceChartsService } from './workspace-charts.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, ActivityLogService, AccessControlService, WorkspaceChartsService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
