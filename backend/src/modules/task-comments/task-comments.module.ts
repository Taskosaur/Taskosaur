import { Module } from '@nestjs/common';
import { TaskCommentsService } from './task-comments.service';
import { TaskCommentsController } from './task-comments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailReplyService } from '../inbox/services/email-reply.service';
import { CryptoService } from 'src/common/crypto.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskCommentsController],
  providers: [TaskCommentsService, EmailReplyService, CryptoService],
  exports: [TaskCommentsService],
})
export class TaskCommentsModule {}
