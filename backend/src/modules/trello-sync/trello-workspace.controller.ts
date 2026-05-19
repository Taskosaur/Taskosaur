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
import { TrelloSyncService } from './trello-sync.service';
import { User } from '../users/entities/user.entity';
import { ConnectTrelloWorkspaceDto } from './dto/connect-trello-workspace.dto';
import { ImportTrelloBoardsDto } from './dto/import-trello-boards.dto';

@ApiTags('Trello Sync')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workspaces/:workspaceId/trello-sync')
export class TrelloWorkspaceController {
  constructor(private readonly trelloSyncService: TrelloSyncService) {}

  @Post('connect')
  @ApiOperation({
    summary: 'Connect a workspace to a Trello account',
    description: 'Provide Trello API Key and Token to link a workspace for bulk imports.',
  })
  @Roles(Role.MANAGER, Role.OWNER)
  connect(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ConnectTrelloWorkspaceDto,
    @CurrentUser() user: User,
  ) {
    return this.trelloSyncService.connectWorkspace(workspaceId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get Trello sync status for a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  getStatus(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.trelloSyncService.getWorkspaceStatus(workspaceId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update Trello sync configuration for a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  updateConfig(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ConnectTrelloWorkspaceDto,
    @CurrentUser() user: User,
  ) {
    return this.trelloSyncService.updateWorkspaceConfig(workspaceId, dto, user.id);
  }

  @Get('projects')
  @ApiOperation({ summary: 'Get all synced projects in this workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  getProjects(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.trelloSyncService.getWorkspaceSyncedProjects(workspaceId);
  }

  @Post('sync-all')
  @ApiOperation({ summary: 'Trigger sync for all connected projects in the workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  syncAll(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() user: User) {
    return this.trelloSyncService.syncAllWorkspaceProjects(workspaceId, user.id);
  }

  @Get('boards')
  @ApiOperation({ summary: 'List available Trello boards for this workspace connection' })
  @Roles(Role.MANAGER, Role.OWNER)
  listBoards(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.trelloSyncService.listWorkspaceBoards(workspaceId);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import selected Trello boards as projects in this workspace',
  })
  @Roles(Role.MANAGER, Role.OWNER)
  importBoards(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ImportTrelloBoardsDto,
    @CurrentUser() user: User,
  ) {
    return this.trelloSyncService.importBoardsToWorkspace(workspaceId, dto.boardIds, user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Disconnect Trello sync from a workspace' })
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.trelloSyncService.disconnectWorkspace(workspaceId);
  }
}
