import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicProjectsService } from '../services/public-projects.service';
import { PublicProjectDto } from '../dto/public-project.dto';
import { PublicRateLimitGuard } from '../guards/public-rate-limit.guard';
import { Public } from '../decorators/public.decorator';
import {
  GetProjectChartsQueryDto,
  ProjectChartDataResponse,
  ProjectChartType,
} from 'src/modules/projects/dto/get-project-charts-query.dto';
import { ProjectChartsService } from '../services/public-chat.service';

@ApiTags('Public Workspaces')
@Controller('public/workspaces')
@UseGuards(PublicRateLimitGuard)
@Public()
export class PublicWorkspacesController {
  constructor(
    private readonly publicProjectsService: PublicProjectsService,
    private readonly projectChartsService: ProjectChartsService,
  ) {}

  @Get(':workspaceSlug/projects')
  @ApiOperation({
    summary: 'Get workspace public projects',
    description: 'Get all public projects in a specific workspace',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiResponse({ type: [PublicProjectDto] })
  async getWorkspaceProjects(
    @Param('workspaceSlug') workspaceSlug: string,
  ): Promise<PublicProjectDto[]> {
    return this.publicProjectsService.getWorkspacePublicProjects(workspaceSlug);
  }

  @Get(':workspaceSlug/projects/:projectSlug')
  @ApiOperation({
    summary: 'Get public project',
    description: 'Get detailed information about a specific public project',
  })
  @ApiParam({ name: 'workspaceSlug', description: 'Workspace slug' })
  @ApiParam({ name: 'projectSlug', description: 'Project slug' })
  @ApiResponse({ type: PublicProjectDto })
  async getProject(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param('projectSlug') projectSlug: string,
  ): Promise<PublicProjectDto> {
    return this.publicProjectsService.getPublicProject(
      workspaceSlug,
      projectSlug,
    );
  }

  @Get(':slug/charts')
  @ApiOperation({
    summary: 'Get project charts data',
    description:
      'Retrieve multiple project chart data types in a single request',
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
  async getProjectCharts(
    @Param('slug') projectSlug: string,
    @Query() query: GetProjectChartsQueryDto,
  ): Promise<ProjectChartDataResponse> {
    return this.projectChartsService.getMultipleProjectChartData(
      projectSlug,
      query.types,
    );
  }
  @Get(':slug/statuses')
  @ApiOperation({
    summary: 'Get project statuses',
    description: 'Retrieve the statuses of tasks within a project',
  })
  @ApiParam({
    name: 'slug',
    description: 'Project slug',
    type: 'string',
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
  async getPublicProjecTaskStatus(
    @Param('slug') projectSlug: string,
  ): Promise<ProjectChartDataResponse> {
    return this.publicProjectsService.publicProjectStatus(projectSlug);
  }
}
