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

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('project-members')
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post()
  create(
    @Body() createProjectMemberDto: CreateProjectMemberDto,
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.create(createProjectMemberDto, requestUserId);
  }

  @Post('invite')
  inviteByEmail(
    @Body() inviteProjectMemberDto: InviteProjectMemberDto,
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.inviteByEmail(inviteProjectMemberDto, requestUserId);
  }

  @Get()
  findAll(
    @Query('requestUserId') requestUserId: string,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    return this.projectMembersService.findAll(
      requestUserId,
      projectId,
      search,
      pageNumber,
      limitNumber,
    );
  }

  @Get('workspace/:workspaceId')
  findAllByWorkspace(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.findAllByWorkspace(workspaceId, requestUserId);
  }

  @Get('user/:userId/projects')
  getUserProjects(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.getUserProjects(userId, requestUserId);
  }

  @Get('project/:projectId/stats')
  getProjectStats(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.getProjectStats(projectId, requestUserId);
  }

  @Get('user/:userId/project/:projectId')
  findByUserAndProject(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectMembersService.findByUserAndProject(userId, projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query('requestUserId') requestUserId: string) {
    return this.projectMembersService.findOne(id, requestUserId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.update(id, updateProjectMemberDto, requestUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.projectMembersService.remove(id, requestUserId);
  }
}
