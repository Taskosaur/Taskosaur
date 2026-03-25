import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from 'src/common/access-control.utils';
import { ProjectChartsService } from './project-charts.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, AccessControlService, ProjectChartsService, ActivityLogService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
