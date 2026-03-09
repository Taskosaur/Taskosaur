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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMembersService } from './workspace-members.service';
import {
  CreateWorkspaceMemberDto,
  InviteWorkspaceMemberDto,
} from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('Workspace Members')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly workspaceMembersService: WorkspaceMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to a workspace' })
  @ApiBody({ type: CreateWorkspaceMemberDto })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  create(@Body() createWorkspaceMemberDto: CreateWorkspaceMemberDto, @CurrentUser() user: User) {
    return this.workspaceMembersService.create(createWorkspaceMemberDto, user.id);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a user to workspace by email' })
  @ApiBody({ type: InviteWorkspaceMemberDto })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  inviteByEmail(
    @Body() inviteWorkspaceMemberDto: InviteWorkspaceMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.inviteByEmail(inviteWorkspaceMemberDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspace members' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID (UUID)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search members by name or email' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page' })
  @ApiResponse({ status: 200, description: 'List of workspace members' })
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
  @ApiOperation({ summary: 'Get all workspaces for a user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of workspaces the user belongs to' })
  getUserWorkspaces(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.getUserWorkspaces(userId, user.id);
  }

  @Get('workspace/:workspaceId/stats')
  @ApiOperation({ summary: 'Get workspace member statistics' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace member statistics' })
  getWorkspaceStats(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.getWorkspaceStats(workspaceId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace member by ID' })
  @ApiParam({ name: 'id', description: 'Workspace member ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace member details' })
  @ApiResponse({ status: 404, description: 'Workspace member not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.findOne(id, user.id);
  }

  @Get('user/:userId/workspace/:workspaceId')
  @ApiOperation({ summary: 'Get membership for a specific user and workspace' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace membership details' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  findByUserAndWorkspace(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.findByUserAndWorkspace(userId, workspaceId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace member role' })
  @ApiParam({ name: 'id', description: 'Workspace member ID (UUID)' })
  @ApiBody({ type: UpdateWorkspaceMemberDto })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Workspace member not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkspaceMemberDto: UpdateWorkspaceMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.workspaceMembersService.update(id, updateWorkspaceMemberDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from workspace' })
  @ApiParam({ name: 'id', description: 'Workspace member ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Workspace member not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.workspaceMembersService.remove(id, user.id);
  }
}
