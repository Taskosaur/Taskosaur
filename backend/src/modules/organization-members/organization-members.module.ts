import { Module } from '@nestjs/common';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationMembersController } from './organization-members.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkspaceMembersService } from '../workspace-members/workspace-members.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationMembersController],
  providers: [OrganizationMembersService, WorkspaceMembersService],
  exports: [OrganizationMembersService],
})
export class OrganizationMembersModule {}
