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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { Scope } from 'src/common/decorator/scope.decorator';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  GetWorkspaceChartsQueryDto,
  WorkspaceChartDataResponse,
  WorkspaceChartType,
} from './dto/get-workspace-charts-query.dto';
import { WorkspaceChartsService } from './workspace-charts.service';
@ApiTags('Workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workspaces')
@Scope('ORGANIZATION', 'organizationId')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly activityLogService: ActivityLogService,
    private readonly workspaceChartsService: WorkspaceChartsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid workspace data' })
  @Roles(Role.MANAGER, Role.OWNER)
  create(@Body() createWorkspaceDto: CreateWorkspaceDto, @CurrentUser() user: any) {
    return this.workspacesService.create(createWorkspaceDto, user.id as string);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all workspaces',
    description: 'Returns workspaces filtered by user membership',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization ID (UUID)',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search workspaces by name' })
  @ApiResponse({ status: 200, description: 'List of workspaces' })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  @Scope('ORGANIZATION', 'organizationId')
  findAll(
    @CurrentUser() user: any,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
  ) {
    return this.workspacesService.findAll(user.id as string, organizationId, search);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search workspaces without pagination' })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  searchWorkspaces(
    @CurrentUser() user: any,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
  ) {
    return this.workspacesService.findAll(user.id as string, organizationId, search);
  }

  @Get('search/paginated')
  @ApiOperation({ summary: 'Search workspaces with pagination' })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  searchWorkspacesWithPagination(
    @CurrentUser() user: any,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100);

    return this.workspacesService.findWithPagination(
      user.id as string,
      organizationId,
      search,
      validatedPage,
      validatedLimit,
    );
  }

  @Get('archived')
  @ApiOperation({ summary: 'Get archived workspaces for an organization' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'Organization ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of archived workspaces' })
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  getArchivedWorkspaces(@Query('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.workspacesService.findArchived(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('WORKSPACE', 'id')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.workspacesService.findOne(id, user.id as string);
  }

  @Get('recent/:workspaceId')
  @ApiOperation({ summary: 'Get recent activity for workspace' })
  @Scope('WORKSPACE', 'workspaceId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  getWorkspaceRecentActivity(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('limit') limit: string = '10',
    @Query('page') page: string = '1',
  ) {
    const limitNum = parseInt(limit, 10) || 10;
    const pageNum = parseInt(page, 10) || 1;
    const validatedLimit = Math.min(Math.max(1, limitNum), 50);
    const validatedPage = Math.max(1, pageNum);

    return this.activityLogService.getRecentActivityByWorkspaceOptimized(
      workspaceId,
      validatedLimit,
      validatedPage,
    );
  }

  @Get('organization/:organizationId/slug/:slug')
  @ApiOperation({ summary: 'Get workspace by organization ID and slug' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID (UUID)' })
  @ApiParam({ name: 'slug', description: 'Workspace slug' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('ORGANIZATION', 'organizationId')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  findBySlug(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    return this.workspacesService.findBySlug(organizationId, slug, user.id as string);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('WORKSPACE', 'id')
  @Roles(Role.MANAGER, Role.OWNER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @CurrentUser() user: any,
  ) {
    return this.workspacesService.update(id, updateWorkspaceDto, user.id as string);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('WORKSPACE', 'id')
  @Roles(Role.OWNER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspacesService.remove(id);
  }

  @Patch('archive/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Workspace archived successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('WORKSPACE', 'id')
  @Roles(Role.MANAGER, Role.OWNER)
  archiveWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.workspacesService.archiveWorkspace(id, user.id, user.role);
  }

  @Patch('unarchive/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unarchive a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Workspace unarchived successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @Scope('WORKSPACE', 'id')
  @Roles(Role.MANAGER, Role.OWNER)
  unarchiveWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.workspacesService.unarchiveWorkspace(id, user.id, user.role);
  }

  // Chart endpoints - require workspace membership
  @Get('organization/:organizationId/workspace/:slug/charts')
  @ApiOperation({
    summary: 'Get workspace charts data',
    description: 'Retrieve multiple workspace chart data types in a single request',
  })
  @ApiParam({
    name: 'organizationId',
    description: 'Organization UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'slug',
    description: 'Workspace slug',
    type: 'string',
  })
  @ApiQuery({
    name: 'types',
    description: 'Chart types to retrieve (can specify multiple)',
    enum: WorkspaceChartType,
    isArray: true,
    style: 'form',
    explode: true,
    example: [WorkspaceChartType.KPI_METRICS, WorkspaceChartType.PROJECT_STATUS],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workspace chart data retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        'kpi-metrics': {
          totalProjects: 8,
          activeProjects: 5,
          completionRate: 37.5,
        },
        'project-status': [
          { status: 'ACTIVE', _count: { status: 5 } },
          { status: 'COMPLETED', _count: { status: 3 } },
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
    description: 'Workspace not found',
  })
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getWorkspaceCharts(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('slug') workspaceSlug: string,
    @Query() query: GetWorkspaceChartsQueryDto,
    @CurrentUser() user: any,
  ): Promise<WorkspaceChartDataResponse> {
    return this.workspaceChartsService.getMultipleWorkspaceChartData(
      organizationId,
      workspaceSlug,
      user.id as string,
      query.types,
    );
  }
}
