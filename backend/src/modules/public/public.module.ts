import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PublicWorkspacesController } from './controllers/public-projects.controller';
import { PublicTasksController } from './controllers/public-tasks.controller';
import { PublicSprintsController } from './controllers/public-sprints.controller';
import { PublicCalendarController } from './controllers/public-calendar.controller';
import { PublicProjectsService } from './services/public-projects.service';
import { PublicTasksService } from './services/public-tasks.service';
import { PublicSprintsService } from './services/public-sprints.service';
import { PublicCalendarService } from './services/public-calendar.service';
import { PublicDataFilterService } from './services/public-data-filter.service';
import { ProjectChartsService } from './services/public-chat.service';

import { PublicSharedTasksController } from './controllers/public-shared-tasks.controller';
import { PublicSharedTasksService } from './services/public-shared-tasks.service';
import { S3Module } from '../storage/s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [
    PublicWorkspacesController,
    PublicTasksController,
    PublicSprintsController,
    PublicCalendarController,
    PublicSharedTasksController,
  ],
  providers: [
    PublicProjectsService,
    PublicTasksService,
    PublicSprintsService,
    PublicCalendarService,
    PublicDataFilterService,
    ProjectChartsService,
    PublicSharedTasksService,
  ],
  exports: [
    PublicProjectsService,
    PublicTasksService,
    PublicSprintsService,
    PublicCalendarService,
    PublicDataFilterService,
    PublicSharedTasksService,
  ],
})
export class PublicModule {}
