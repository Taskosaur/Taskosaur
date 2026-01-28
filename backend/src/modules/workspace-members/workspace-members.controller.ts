import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMembersService } from './workspace-members.service';
import {
  CreateWorkspaceMemberDto,
  InviteWorkspaceMemberDto,
} from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly workspaceMembersService: WorkspaceMembersService) {}

  @Post()
  create(@Body() createWorkspaceMemberDto: CreateWorkspaceMemberDto, @CurrentUser() user: User) {
    return this.workspaceMembersService.create(createWorkspaceMemberDto, user.id);
  }

  @Post('invite')
  inviteByEmail(
    @Body() inviteWorkspaceMemberDto: InviteWorkspaceMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.inviteByEmail(inviteWorkspaceMemberDto, user.id);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('workspaceId') workspaceId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    return this.workspaceMembersService.findAll(workspaceId, search, pageNum, limitNum, user.id);
  }

  @Get('user/:userId/workspaces')
  getUserWorkspaces(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.getUserWorkspaces(userId, user.id);
  }

  @Get('workspace/:workspaceId/stats')
  getWorkspaceStats(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.getWorkspaceStats(workspaceId, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.findOne(id, user.id);
  }

  @Get('user/:userId/workspace/:workspaceId')
  findByUserAndWorkspace(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.findByUserAndWorkspace(userId, workspaceId, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkspaceMemberDto: UpdateWorkspaceMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.update(id, updateWorkspaceMemberDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.remove(id, user.id);
  }
}
