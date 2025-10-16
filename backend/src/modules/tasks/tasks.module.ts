import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from 'src/common/access-control.utils';
import { StorageService } from '../storage/storage.service';
import { S3Service } from '../storage/s3.service';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, AccessControlService, StorageService, S3Service],
  exports: [TasksService],
})
export class TasksModule {}
