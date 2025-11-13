import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Scope } from 'src/common/decorator/scope.decorator';
import { OrganizationsService } from './organizations.service';
import { OrganizationChartsService } from './organizations-charts.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ChartDataResponse, ChartType, GetChartsQueryDto } from './dto/get-charts-query.dto';
import { UniversalSearchService } from './universal-search.service';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly orgChartsService: OrganizationChartsService,
    private readonly searchService: UniversalSearchService,
  ) {}

  // Creating an organization: only authenticated user; no existing org scope yet.
  @Post()
  @ApiOperation({ summary: 'Create organization' })
  create(@Body() createOrganizationDto: CreateOrganizationDto, @CurrentUser() user: any) {
    return this.organizationsService.create(createOrganizationDto, user.id as string);
  }

  // List organizations the user can see; rely on service-level filtering.
  @Get()
  @ApiOperation({ summary: 'List organizations' })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get('universal-search')
  @ApiOperation({
    summary: 'Universal search within organization',
    description:
      'Search across all entities within a specific organization with proper access control',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query string (minimum 2 characters)',
    required: true,
    type: String,
    example: 'user authentication',
  })
  @ApiQuery({
    name: 'organizationId',
    description: 'UUID of the organization to search within',
    required: true,
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination (starts from 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of results per page (max 100)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have access to the organization',
  })
  async search(
    @Query('q') query: string,
    @Query('organizationId') organizationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @CurrentUser() user?: any,
  ) {
    return this.searchService.search(query, organizationId, user.id as string, {
      page: Math.max(1, page || 1),
      limit: Math.min(100, Math.max(1, limit || 20)),
    });
  }
  // Owner-only operations
  @Patch('archive/:id')
  @Roles(Role.OWNER)
  @Scope('ORGANIZATION', 'id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.archiveOrganization(id);
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.OWNER)
  @Scope('ORGANIZATION', 'id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: any,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto, user.id as string);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @Scope('ORGANIZATION', 'id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.remove(id);
  }

  // Read endpoints (commonly MEMBER+); adjust if stricter is desired
  @Get(':id')
  @Scope('ORGANIZATION', 'id')
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findOne(id);
  }

  @Get('slug/:slug')
  @Scope('ORGANIZATION', 'id')
  findBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get organization statistics' })
  @Scope('ORGANIZATION', 'id')
  @Roles(Role.MEMBER, Role.MANAGER, Role.OWNER, Role.VIEWER)
  getOrganizationStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getOrganizationStats(id);
  }

  @Get(':id/charts')
  @ApiOperation({
    summary: 'Get organization charts data',
    description: 'Retrieve multiple chart data types for an organization in a single request',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'types',
    description: 'Chart types to retrieve (can specify multiple)',
    enum: ChartType,
    isArray: true,
    style: 'form',
    explode: true,
    example: [ChartType.KPI_METRICS, ChartType.PROJECT_PORTFOLIO],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization chart data retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        'kpi-metrics': {
          totalWorkspaces: 5,
          activeWorkspaces: 4,
          totalProjects: 12,
          projectCompletionRate: 75.5,
        },
        'project-portfolio': [
          { status: 'ACTIVE', _count: { status: 10 } },
          { status: 'COMPLETED', _count: { status: 5 } },
        ],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid chart type or missing parameters',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to access organization data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization not found',
  })
  @Scope('ORGANIZATION', 'id')
  @Roles(Role.VIEWER, Role.MEMBER, Role.MANAGER, Role.OWNER)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getOrganizationCharts(
    @Param('id', ParseUUIDPipe) organizationId: string,
    @Query() query: GetChartsQueryDto,
    @CurrentUser() user: any,
  ): Promise<ChartDataResponse> {
    try {
      const chartRes = await this.orgChartsService.getMultipleChartData(
        organizationId,
        user.id as string,
        query.types,
      );
      return chartRes;
    } catch (error) {
      console.error(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve chart data');
    }
  }
  // --- charts (read) ---
}
