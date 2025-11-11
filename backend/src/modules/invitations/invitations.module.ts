import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { EmailService } from '../email/email.service';
import { QueueModule } from '../queue/queue.module';
import { WorkspaceMembersService } from '../workspace-members/workspace-members.service';
import { OrganizationMembersService } from '../organization-members/organization-members.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    QueueModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    EmailService,
    WorkspaceMembersService,
    OrganizationMembersService,
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
