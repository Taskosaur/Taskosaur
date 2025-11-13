import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProjectInboxService } from '../services/project-inbox.service';
import { EmailSyncService } from '../services/email-sync.service';
import { EmailReplyService } from '../services/email-reply.service';
import {
  CreateInboxDto,
  UpdateInboxDto,
  SetupEmailDto,
  MessageFiltersDto,
  CreateRuleDto,
} from '../dto';
import { EmailSyncQueueService } from '../services/email-sync-queue.service';

@ApiTags('Project Inbox')
@Controller('projects/:projectId/inbox')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProjectInboxController {
  constructor(
    private inboxService: ProjectInboxService,
    private emailSync: EmailSyncService,
    private emailReply: EmailReplyService,
    private emailSyncQueue: EmailSyncQueueService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create inbox for project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Inbox created successfully' })
  async createInbox(@Param('projectId') projectId: string, @Body() dto: CreateInboxDto) {
    return this.inboxService.createInbox(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get inbox configuration' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Inbox configuration retrieved',
  })
  async getInbox(@Param('projectId') projectId: string) {
    return this.inboxService.getInbox(projectId);
  }

  @Put()
  @ApiOperation({ summary: 'Update inbox configuration' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inbox updated successfully' })
  async updateInbox(@Param('projectId') projectId: string, @Body() dto: UpdateInboxDto) {
    return this.inboxService.updateInbox(projectId, dto);
  }

  @Put('email-account')
  @ApiOperation({ summary: 'Setup or update email account' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email account configured successfully' })
  async setupEmailAccount(@Param('projectId') projectId: string, @Body() dto: SetupEmailDto) {
    return this.inboxService.setupEmailAccount(projectId, dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger email sync' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email sync job queued successfully' })
  async syncInbox(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    const jobId = await this.emailSyncQueue.addManualSyncJob(
      projectId,
      user?.id as string | undefined,
    );

    return {
      message: 'Email sync job queued successfully',
      jobId,
      status: 'queued',
    };
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get inbox messages' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by message status' })
  @ApiQuery({ name: 'includeSpam', required: false, description: 'Include spam messages' })
  @ApiQuery({ name: 'fromEmail', required: false, description: 'Filter by sender email' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in subject and content' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Messages retrieved successfully' })
  async getMessages(@Param('projectId') projectId: string, @Query() filters: MessageFiltersDto) {
    return this.inboxService.getInboxMessages(projectId, filters);
  }

  @Get('messages/:messageId')
  @ApiOperation({ summary: 'Get specific inbox message' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message retrieved successfully',
  })
  async getMessage(@Param('messageId') messageId: string) {
    return this.inboxService.getInboxMessage(messageId);
  }

  @Post('messages/:messageId/convert')
  @ApiOperation({ summary: 'Convert message to task' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Message converted to task successfully' })
  async convertToTask(@Param('messageId') messageId: string, @CurrentUser() user: any) {
    return this.inboxService.convertToTask(messageId, user.id as string);
  }

  @Post('messages/:messageId/ignore')
  @ApiOperation({ summary: 'Mark message as ignored' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message marked as ignored',
  })
  ignoreMessage(@Param('messageId') messageId: string) {
    return this.inboxService.updateMessageStatus(messageId, 'IGNORED');
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get inbox rules' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rules retrieved successfully',
  })
  async getRules(@Param('projectId') projectId: string) {
    return this.inboxService.getInboxRules(projectId);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create inbox rule' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Rule created successfully' })
  async createRule(@Param('projectId') projectId: string, @Body() dto: CreateRuleDto) {
    return this.inboxService.createRule(projectId, dto);
  }

  @Put('rules/:ruleId')
  @ApiOperation({ summary: 'Update inbox rule' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'ruleId', description: 'Rule ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rule updated successfully' })
  updateRule(@Param('ruleId') ruleId: string, @Body() dto: CreateRuleDto) {
    return this.inboxService.updateRule(ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @ApiOperation({ summary: 'Delete inbox rule' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'ruleId', description: 'Rule ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rule deleted successfully',
  })
  async deleteRule(@Param('ruleId') ruleId: string) {
    await this.inboxService.deleteRule(ruleId);
    return { message: 'Rule deleted successfully' };
  }

  @Post('test-email/:accountId')
  @ApiOperation({ summary: 'Test email configuration' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'accountId', description: 'Email Account ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email configuration test result',
  })
  async testEmailConfiguration(@Param('accountId') accountId: string) {
    return this.emailReply.testEmailConfiguration(accountId);
  }
}
