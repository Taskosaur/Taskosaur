import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { JiraSyncService } from './jira-sync.service';
import { User } from '../users/entities/user.entity';
import { ConnectJiraWorkspaceDto } from './dto/connect-jira-workspace.dto';
import { ImportJiraProjectsDto } from './dto/import-jira-projects.dto';

@ApiTags('Jira Sync')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workspaces/:workspaceId/jira-sync')
export class JiraWorkspaceController {
  constructor(private readonly jiraSyncService: JiraSyncService) {}

  @Post('connect')
  @ApiOperation({
    summary: 'Connect a workspace to a Jira account',
    description:
      'Provide Jira site URL, email, and API token to link a workspace for bulk imports.',
  })
  @Roles(Role.MANAGER, Role.OWNER)
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ConnectJiraWorkspaceDto,
    @CurrentUser() user: User,
  ) {
    return this.jiraSyncService.connectWorkspace(workspaceId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get Jira sync status for a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  getStatus(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.jiraSyncService.getWorkspaceStatus(workspaceId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update Jira sync credentials for a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  updateConfig(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ConnectJiraWorkspaceDto,
    @CurrentUser() user: User,
  ) {
    return this.jiraSyncService.updateWorkspaceConfig(workspaceId, dto, user.id);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List available Jira projects for this workspace connection' })
  @Roles(Role.MANAGER, Role.OWNER)
  listProjects(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.jiraSyncService.listWorkspaceProjects(workspaceId);
  }

  @Get('synced-projects')
  @ApiOperation({ summary: 'Get all synced projects in this workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  getSyncedProjects(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.jiraSyncService.getWorkspaceSyncedProjects(workspaceId);
  }

  @Get('projects/:projectKey/statuses')
  @ApiOperation({ summary: 'List statuses for a Jira project using workspace connection' })
  @Roles(Role.MANAGER, Role.OWNER)
  listProjectStatuses(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectKey') projectKey: string,
  ) {
    return this.jiraSyncService.listWorkspaceProjectStatuses(workspaceId, projectKey);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import selected Jira projects as Taskosaur projects',
  })
  @Roles(Role.MANAGER, Role.OWNER)
  importProjects(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ImportJiraProjectsDto,
    @CurrentUser() user: User,
  ) {
    return this.jiraSyncService.importProjectsToWorkspace(workspaceId, dto.projects, user.id);
  }

  @Post('sync-all')
  @ApiOperation({ summary: 'Trigger sync for all connected projects in the workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  syncAll(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() user: User) {
    return this.jiraSyncService.syncAllWorkspaceProjects(workspaceId, user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Disconnect Jira sync from a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.jiraSyncService.disconnectWorkspace(workspaceId);
  }
}
