// src/modules/invitations/invitations.controller.ts
import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getAuthUser } from 'src/common/request.utils';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

@ApiTags('Invitations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Send invitation' })
  @LogActivity({
    type: 'INVITATION_SENT',
    entityType: 'Invitation',
    description: 'Sent invitation to join organization/workspace/project',
    includeNewValue: true,
    entityIdName: ['organizationId', 'workspaceId', 'projectId'],
  })
  async createInvitation(@Body() createInvitationDto: CreateInvitationDto, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.invitationsService.createInvitation(createInvitationDto, user.id);
  }

  @Patch(':token/accept')
  @ApiOperation({ summary: 'Accept invitation' })
  async acceptInvitation(@Param('token') token: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.invitationsService.acceptInvitation(token, user.id);
  }

  @Patch(':token/decline')
  @ApiOperation({ summary: 'Decline invitation' })
  async declineInvitation(@Param('token') token: string) {
    return this.invitationsService.declineInvitation(token);
  }

  @Get('user')
  @ApiOperation({ summary: 'Get user invitations' })
  getUserInvitations(@Req() req: Request) {
    const user = getAuthUser(req);
    return this.invitationsService.getUserInvitations(user.email);
  }
  @Get('entity/:entityType/:entityId')
  @ApiOperation({
    summary: 'Get pending and rejected invitations for an entity',
  })
  async getEntityInvitations(
    @Param('entityType') entityType: 'organization' | 'workspace' | 'project',
    @Param('entityId') entityId: string,
  ) {
    return this.invitationsService.getEntityInvitations({
      entityType,
      entityId,
    });
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend invitation' })
  @LogActivity({
    type: 'INVITATION_RESENT',
    entityType: 'Invitation',
    description: 'Resent invitation',
    includeNewValue: true,
    entityIdName: ['organizationId', 'workspaceId', 'projectId'],
  })
  async resendInvitation(@Param('id') id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.invitationsService.resendInvitation(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete invitation' })
  @LogActivity({
    type: 'INVITATION_DELETED',
    entityType: 'Invitation',
    description: 'Deleted invitation',
    includeNewValue: true,
    entityIdName: ['organizationId', 'workspaceId', 'projectId'],
  })
  async deleteInvitation(@Param('id') id: string) {
    return this.invitationsService.deleteInvitation(id);
  }

  @Public()
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify invitation token' })
  async verifyInvitation(@Param('token') token: string) {
    return this.invitationsService.verifyInvitation(token);
  }
}
