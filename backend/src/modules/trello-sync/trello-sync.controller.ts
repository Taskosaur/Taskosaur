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
import { TrelloSyncService } from './trello-sync.service';
import { ConnectTrelloDto } from './dto/connect-trello.dto';
import { UpdateTrelloSyncDto } from './dto/update-trello-sync.dto';
import { ValidateTrelloBoardsDto } from './dto/validate-trello-boards.dto';
import { ValidateTrelloListsDto } from './dto/validate-trello-lists.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Trello Sync')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trello-sync')
export class TrelloSyncController {
  constructor(private readonly trelloSyncService: TrelloSyncService) {}

  // ──────────────────────────────────────────────────
  //  Pre-connection helpers (no project required)
  // ──────────────────────────────────────────────────

  @Post('validate/boards')
  @ApiOperation({
    summary: 'Validate credentials and list Trello boards',
    description:
      'Validates a user-supplied API Key + Token and returns all accessible Trello boards. ' +
      'Use this BEFORE connecting to discover the Board ID to use.',
  })
  @ApiResponse({ status: 201, description: 'List of accessible Trello boards' })
  @ApiResponse({ status: 400, description: 'Invalid Trello credentials' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  validateAndListBoards(@Body() dto: ValidateTrelloBoardsDto) {
    return this.trelloSyncService.validateAndListBoards(dto.apiKey, dto.token);
  }

  @Post('validate/lists')
  @ApiOperation({
    summary: 'List Trello lists for a board (pre-connection)',
    description:
      'Returns lists for the given boardId using provided credentials. Use to configure status mappings.',
  })
  @ApiResponse({ status: 201, description: 'List of Trello lists for the board' })
  @ApiResponse({ status: 400, description: 'Invalid credentials or board ID' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  validateAndListLists(@Body() dto: ValidateTrelloListsDto) {
    return this.trelloSyncService.validateAndListLists(dto.boardId, dto.apiKey, dto.token);
  }

  // ──────────────────────────────────────────────────
  //  Connect / Disconnect
  // ──────────────────────────────────────────────────

  @Post('connect')
  @ApiOperation({
    summary: 'Connect a project to a Trello board',
    description:
      'Each user provides their own Trello API Key and Token. ' +
      'Credentials are encrypted (AES-256-GCM) before storage. ' +
      'Multiple projects can connect to different Trello accounts.',
  })
  @ApiResponse({ status: 201, description: 'Trello sync connected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid Trello credentials' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Project already connected to Trello' })
  @Roles(Role.MANAGER, Role.OWNER)
  connect(@Body() dto: ConnectTrelloDto, @CurrentUser() user: User) {
    return this.trelloSyncService.connect(dto, user.id);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Disconnect Trello sync from a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Disconnected successfully' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.trelloSyncService.disconnect(projectId);
  }

  // ──────────────────────────────────────────────────
  //  Status & Configuration
  // ──────────────────────────────────────────────────

  @Get(':projectId')
  @ApiOperation({ summary: 'Get Trello sync status for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Sync configuration and status' })
  @ApiResponse({ status: 404, description: 'No Trello sync configured' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  getStatus(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.trelloSyncService.getStatus(projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update Trello sync configuration' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @Roles(Role.MANAGER, Role.OWNER)
  updateConfig(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateTrelloSyncDto,
    @CurrentUser() user: User,
  ) {
    return this.trelloSyncService.updateConfig(projectId, dto, user.id);
  }

  // ──────────────────────────────────────────────────
  //  Discovery endpoints (using stored credentials)
  // ──────────────────────────────────────────────────

  @Get(':projectId/boards')
  @ApiOperation({ summary: 'List Trello boards using stored credentials' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  listBoards(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.trelloSyncService.listBoards(projectId);
  }

  @Get(':projectId/lists')
  @ApiOperation({ summary: 'List Trello lists on the connected board' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  listLists(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.trelloSyncService.listTrelloLists(projectId);
  }

  // ──────────────────────────────────────────────────
  //  Manual sync trigger
  // ──────────────────────────────────────────────────

  @Post(':projectId/sync')
  @ApiOperation({
    summary: 'Manually trigger a Trello sync',
    description: 'Immediately runs a full sync from the connected Trello board to this project.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  triggerSync(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() user: User) {
    return this.trelloSyncService.triggerSync(projectId, user.id);
  }
}
