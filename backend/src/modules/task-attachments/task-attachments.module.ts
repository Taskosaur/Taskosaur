import { Module } from '@nestjs/common';
import { TaskAttachmentsService } from './task-attachments.service';
import { TaskAttachmentsController } from './task-attachments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { S3Service } from '../storage/s3.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskAttachmentsController],
  providers: [TaskAttachmentsService, StorageService, S3Service],
  exports: [TaskAttachmentsService],
})
export class TaskAttachmentsModule {}
