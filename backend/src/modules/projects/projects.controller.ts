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
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Scope } from 'src/common/decorator/scope.decorator';
import { ProjectChartsService } from './project-charts.service';
import {
  GetProjectChartsQueryDto,
  ProjectChartDataResponse,
  ProjectChartType,
} from './dto/get-project-charts-query.dto';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  username: string;
}

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectChartsService: ProjectChartsService,
  ) {}

  // Create project - requires MANAGER/OWNER at workspace level
  @Post()
  @Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
  @LogActivity({
    type: 'PROJECT_CREATED',
    entityType: 'Project',
    description: 'Created a new project',
    includeNewValue: true,
  })
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.create(createProjectDto, user.id);
  }

  // List all projects - filtered by user access
  @Get()
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    if (
      (status !== undefined && typeof status !== 'string') ||
      (priority !== undefined && typeof priority !== 'string')
    ) {
      throw new BadRequestException(
        'Invalid parameter: status and priority must be strings if provided.',
      );
    }
    return this.projectsService.findAll(workspaceId, user.id, {
      status,
      priority,
      search,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('/by-organization')
  @Scope('ORGANIZATION', 'organizationId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findByOrganizationId(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    if (
      (status !== undefined && typeof status !== 'string') ||
      (priority !== undefined && typeof priority !== 'string')
    ) {
      throw new BadRequestException(
        'Invalid parameter: status and priority must be strings if provided.',
      );
    }
    const filters = {
      organizationId,
      workspaceId,
      status,
      priority,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      search: search,
    };
    return this.projectsService.findByOrganizationId(filters, user.id);
  }

  // Search projects
  @Get('search')
  @ApiOperation({ summary: 'Search projects without pagination' })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  searchProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findBySearch(workspaceId, organizationId, search, user.id);
  }

  // Search with pagination
  @Get('search/paginated')
  @ApiOperation({ summary: 'Search projects with pagination' })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  searchProjectsWithPagination(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    return this.projectsService.findWithPagination(
      workspaceId,
      organizationId,
      search,
      pageNum,
      limitNum,
      user.id,
    );
  }

  // Find by workspace and key - requires workspace access
  @Get('workspace/:workspaceId/key/:key')
  @Scope('WORKSPACE', 'workspaceId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findByKey(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findByKey(workspaceId, key, user.id);
  }

  // Find project by ID - requires project access
  @Get(':id')
  @Scope('PROJECT', 'id')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findOne(id, user.id);
  }

  // Update project - requires MANAGER/OWNER
  @Patch(':id')
  @Scope('PROJECT', 'id')
  @Roles(Role.MANAGER, Role.OWNER)
  @LogActivity({
    type: 'PROJECT_UPDATED',
    entityType: 'Project',
    description: 'Updated project details',
    includeOldValue: true,
    includeNewValue: true,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, updateProjectDto, user.id);
  }

  // Delete project - OWNER only
  @Delete(':id')
  @Scope('PROJECT', 'id')
  @Roles(Role.OWNER)
  @LogActivity({
    type: 'PROJECT_DELETED',
    entityType: 'Project',
    description: 'Deleted a project',
    includeOldValue: true,
    includeNewValue: false,
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.remove(id, user.id);
  }

  // Archive project - MANAGER/OWNER
  @Patch('archive/:id')
  @Roles(Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.archiveProject(id, user.id);
  }

  // Chart endpoints - require project access
  @Get(':slug/charts')
  @ApiOperation({
    summary: 'Get project charts data',
    description: 'Retrieve multiple project chart data types in a single request',
  })
  @ApiParam({
    name: 'slug',
    description: 'Project slug',
    type: 'string',
  })
  @ApiQuery({
    name: 'types',
    description: 'Chart types to retrieve (can specify multiple)',
    enum: ProjectChartType,
    isArray: true,
    style: 'form',
    explode: true,
    example: [ProjectChartType.KPI_METRICS, ProjectChartType.TASK_STATUS],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project chart data retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        'kpi-metrics': {
          totalTasks: 45,
          completedTasks: 32,
          completionRate: 71.11,
        },
        'task-status': [
          { statusId: '1', count: 12, status: { name: 'To Do' } },
          { statusId: '2', count: 8, status: { name: 'In Progress' } },
        ],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid chart type or missing parameters',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @Scope('PROJECT', 'slug')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getProjectCharts(
    @Param('slug') projectSlug: string,
    @Query() query: GetProjectChartsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectChartDataResponse> {
    return this.projectChartsService.getMultipleProjectChartData(projectSlug, user.id, query.types);
  }

  // Keep sprint burndown separate due to sprintId parameter
  @Get(':slug/charts/sprint-burndown/:sprintId')
  @ApiOperation({ summary: 'Get sprint burndown data' })
  @ApiParam({ name: 'slug', description: 'Project slug' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  @Scope('PROJECT', 'slug')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getSprintBurndown(
    @Param('slug') slug: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectChartsService.projectSprintBurndown(sprintId, slug, user.id);
  }

  // Get project by slug
  @Get('by-slug/:slug')
  @Scope('PROJECT', 'slug')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getProjectBySlug(@Param('slug') slug: string) {
    return this.projectsService.getProjectBySlug(slug);
  }
}
