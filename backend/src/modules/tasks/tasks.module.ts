import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from 'src/common/access-control.utils';
import { StorageService } from '../storage/storage.service';
import { S3Service } from '../storage/s3.service';
import { RecurrenceService } from './recurrence.service';
import { RecurringTasksCronService } from './recurring-tasks-cron.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [TasksController],
  providers: [
    TasksService,
    AccessControlService,
    StorageService,
    S3Service,
    RecurrenceService,
    RecurringTasksCronService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
