import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { JiraSyncService } from './jira-sync.service';
import { ConnectJiraDto } from './dto/connect-jira.dto';
import { UpdateJiraSyncDto } from './dto/update-jira-sync.dto';
import { ValidateJiraCredentialsDto } from './dto/validate-jira-credentials.dto';
import { ValidateJiraProjectStatusesDto } from './dto/validate-jira-project-statuses.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Jira Sync')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('jira-sync')
export class JiraSyncController {
  constructor(private readonly jiraSyncService: JiraSyncService) {}

  // ──────────────────────────────────────────────────
  //  Pre-connection helpers (no project required)
  // ──────────────────────────────────────────────────

  @Post('validate/projects')
  @ApiOperation({
    summary: 'Validate credentials and list Jira projects',
    description:
      'Validates Jira site URL, email, and API token, then returns all accessible Jira projects. ' +
      'Use this BEFORE connecting to discover the project key to use.',
  })
  @ApiResponse({ status: 200, description: 'List of accessible Jira projects' })
  @ApiResponse({ status: 400, description: 'Invalid Jira credentials' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  validateAndListProjects(@Body() dto: ValidateJiraCredentialsDto) {
    return this.jiraSyncService.validateAndListProjects(dto);
  }

  @Post('validate/statuses')
  @ApiOperation({
    summary: 'List Jira statuses for a project (pre-connection)',
    description: 'Returns all statuses for the given Jira project key using provided credentials.',
  })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  validateAndListStatuses(@Body() dto: ValidateJiraProjectStatusesDto) {
    return this.jiraSyncService.validateAndListStatuses(dto);
  }

  // ──────────────────────────────────────────────────
  //  Connect / Disconnect
  // ──────────────────────────────────────────────────

  @Post('connect')
  @ApiOperation({
    summary: 'Connect a project to a Jira project',
    description:
      'Credentials are encrypted (AES-256-GCM) before storage. ' +
      'Multiple projects can connect to different Jira accounts.',
  })
  @ApiResponse({ status: 201, description: 'Jira sync connected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid Jira credentials' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Project already connected to Jira' })
  @Roles(Role.MANAGER, Role.OWNER)
  connect(@Body() dto: ConnectJiraDto, @CurrentUser() user: User) {
    return this.jiraSyncService.connect(dto, user.id);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Disconnect Jira sync from a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Disconnected successfully' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.jiraSyncService.disconnect(projectId);
  }

  // ──────────────────────────────────────────────────
  //  Status & Configuration
  // ──────────────────────────────────────────────────

  @Get(':projectId')
  @ApiOperation({ summary: 'Get Jira sync status for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Sync configuration and status' })
  @ApiResponse({ status: 404, description: 'No Jira sync configured' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  getStatus(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.jiraSyncService.getStatus(projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update Jira sync configuration' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @Roles(Role.MANAGER, Role.OWNER)
  updateConfig(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateJiraSyncDto,
    @CurrentUser() user: User,
  ) {
    return this.jiraSyncService.updateConfig(projectId, dto, user.id);
  }

  // ──────────────────────────────────────────────────
  //  Discovery endpoints (using stored credentials)
  // ──────────────────────────────────────────────────

  @Get(':projectId/statuses')
  @ApiOperation({ summary: 'List Jira statuses using stored credentials' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  listStatuses(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.jiraSyncService.listProjectStatuses(projectId);
  }

  // ──────────────────────────────────────────────────
  //  Manual sync trigger
  // ──────────────────────────────────────────────────

  @Post(':projectId/sync')
  @ApiOperation({
    summary: 'Manually trigger a Jira sync',
    description: 'Immediately runs a full sync from the connected Jira project.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  triggerSync(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() user: User) {
    return this.jiraSyncService.triggerSync(projectId, user.id);
  }
}
