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
import { ProjectMembersService } from './project-members.service';
import { CreateProjectMemberDto, InviteProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  username: string;
}

@ApiTags('Project Members')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('project-members')
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to a project' })
  @ApiBody({ type: CreateProjectMemberDto })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  create(
    @Body() createProjectMemberDto: CreateProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.create(createProjectMemberDto, user.id);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a user to project by email' })
  @ApiBody({ type: InviteProjectMemberDto })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  inviteByEmail(
    @Body() inviteProjectMemberDto: InviteProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.inviteByEmail(inviteProjectMemberDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project members' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID (UUID)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search members by name or email' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page' })
  @ApiResponse({ status: 200, description: 'List of project members' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    return this.projectMembersService.findAll(user.id, projectId, search, pageNumber, limitNumber);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all project members in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of project members in workspace' })
  findAllByWorkspace(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.findAllByWorkspace(workspaceId, user.id);
  }

  @Get('user/:userId/projects')
  @ApiOperation({ summary: 'Get all projects for a user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of projects the user belongs to' })
  getUserProjects(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.getUserProjects(userId, user.id);
  }

  @Get('project/:projectId/stats')
  @ApiOperation({ summary: 'Get project member statistics' })
  @ApiParam({ name: 'projectId', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Project member statistics' })
  getProjectStats(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.getProjectStats(projectId, user.id);
  }

  @Get('user/:userId/project/:projectId')
  @ApiOperation({ summary: 'Get membership for a specific user and project' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiParam({ name: 'projectId', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Project membership details' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  findByUserAndProject(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.findByUserAndProject(userId, projectId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project member by ID' })
  @ApiParam({ name: 'id', description: 'Project member ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Project member details' })
  @ApiResponse({ status: 404, description: 'Project member not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectMembersService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project member role' })
  @ApiParam({ name: 'id', description: 'Project member ID (UUID)' })
  @ApiBody({ type: UpdateProjectMemberDto })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Project member not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.update(id, updateProjectMemberDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from project' })
  @ApiParam({ name: 'id', description: 'Project member ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Project member not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectMembersService.remove(id, user.id);
  }
}
