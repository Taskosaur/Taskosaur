import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto.service';
import { S3UploadService } from '../../common/s3-upload.service';

// Services
import { ProjectInboxService } from './services/project-inbox.service';
import { EmailSyncService } from './services/email-sync.service';
import { EmailReplyService } from './services/email-reply.service';
import { EmailTemplatesService } from '../../seeder/email-templates.service';

// Controllers
import { ProjectInboxController } from './controllers/project-inbox.controller';
import { TaskCommentEmailController } from './controllers/task-comment-email.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';
import { BullModule } from '@nestjs/bullmq';
import { EmailSyncProcessor } from './processors/email-sync.processor';
import { EmailSyncQueueService } from './services/email-sync-queue.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable scheduled tasks
    BullModule.registerQueue({
      name: 'email-sync',
    }),
  ],
  controllers: [
    ProjectInboxController,
    TaskCommentEmailController,
    EmailTemplatesController,
  ],
  providers: [
    PrismaService,
    CryptoService,
    S3UploadService,
    ProjectInboxService,
    EmailSyncService,
    EmailReplyService,
    EmailTemplatesService,
    EmailSyncProcessor,
    EmailSyncQueueService,
  ],
  exports: [
    ProjectInboxService,
    EmailSyncService,
    EmailReplyService,
    EmailTemplatesService,
  ],
})
export class InboxModule { }