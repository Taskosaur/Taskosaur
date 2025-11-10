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
  create(@Body() createProjectMemberDto: CreateProjectMemberDto) {
    return this.projectMembersService.create(createProjectMemberDto);
  }

  @Post('invite')
  inviteByEmail(@Body() inviteProjectMemberDto: InviteProjectMemberDto) {
    return this.projectMembersService.inviteByEmail(inviteProjectMemberDto);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    return this.projectMembersService.findAll(projectId, search, pageNumber, limitNumber);
  }

  @Get('workspace/:workspaceId')
  findAllByWorkspace(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.projectMembersService.findAllByWorkspace(workspaceId);
  }

  @Get('user/:userId/projects')
  getUserProjects(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.projectMembersService.getUserProjects(userId);
  }

  @Get('project/:projectId/stats')
  getProjectStats(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectMembersService.getProjectStats(projectId);
  }

  @Get('user/:userId/project/:projectId')
  findByUserAndProject(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectMembersService.findByUserAndProject(userId, projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectMembersService.findOne(id);
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
