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

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('project-members')
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post()
  create(
    @Body() createProjectMemberDto: CreateProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.create(createProjectMemberDto, user.id);
  }

  @Post('invite')
  inviteByEmail(
    @Body() inviteProjectMemberDto: InviteProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.inviteByEmail(inviteProjectMemberDto, user.id);
  }

  @Get()
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
  findAllByWorkspace(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.findAllByWorkspace(workspaceId, user.id);
  }

  @Get('user/:userId/projects')
  getUserProjects(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.getUserProjects(userId, user.id);
  }

  @Get('project/:projectId/stats')
  getProjectStats(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.getProjectStats(projectId, user.id);
  }

  @Get('user/:userId/project/:projectId')
  findByUserAndProject(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectMembersService.findByUserAndProject(userId, projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectMembersService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.update(id, updateProjectMemberDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectMembersService.remove(id, user.id);
  }
}
