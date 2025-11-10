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

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly workspaceMembersService: WorkspaceMembersService) {}

  @Post()
  create(@Body() createWorkspaceMemberDto: CreateWorkspaceMemberDto) {
    return this.workspaceMembersService.create(createWorkspaceMemberDto);
  }

  @Post('invite')
  inviteByEmail(@Body() inviteWorkspaceMemberDto: InviteWorkspaceMemberDto) {
    return this.workspaceMembersService.inviteByEmail(inviteWorkspaceMemberDto);
  }

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    return this.workspaceMembersService.findAll(workspaceId, search, pageNum, limitNum);
  }

  @Get('user/:userId/workspaces')
  getUserWorkspaces(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.workspaceMembersService.getUserWorkspaces(userId);
  }

  @Get('workspace/:workspaceId/stats')
  getWorkspaceStats(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaceMembersService.getWorkspaceStats(workspaceId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspaceMembersService.findOne(id);
  }

  @Get('user/:userId/workspace/:workspaceId')
  findByUserAndWorkspace(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaceMembersService.findByUserAndWorkspace(userId, workspaceId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkspaceMemberDto: UpdateWorkspaceMemberDto,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.workspaceMembersService.update(id, updateWorkspaceMemberDto, requestUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.workspaceMembersService.remove(id, requestUserId);
  }
}
