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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintStatus } from '@prisma/client';

@ApiTags('Sprints')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiBody({ type: CreateSprintDto })
  @ApiResponse({ status: 201, description: 'Sprint created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid sprint data' })
  create(@Body() createSprintDto: CreateSprintDto, @CurrentUser() user: any) {
    return this.sprintsService.create(createSprintDto, user.id as string);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sprints' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID (UUID)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    description: 'Filter by sprint status',
  })
  @ApiResponse({ status: 200, description: 'List of sprints' })
  findAll(
    @Query('projectId') projectId: string,
    @CurrentUser() user: any,
    @Query('status') status?: SprintStatus,
  ) {
    return this.sprintsService.findAll(user.id as string, projectId, status);
  }

  @Get('slug')
  @ApiOperation({ summary: 'Get sprints by project slug' })
  @ApiQuery({ name: 'slug', required: false, description: 'Project slug' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    description: 'Filter by sprint status',
  })
  @ApiResponse({ status: 200, description: 'List of sprints for the project' })
  findAllByProjectSlug(
    @Query('slug') slug: string,
    @CurrentUser() user: any,
    @Query('status') status?: SprintStatus,
  ) {
    return this.sprintsService.findAllByProjectSlug(user.id as string, slug, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sprint by ID' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Sprint details' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.sprintsService.findOne(id, user.id as string);
  }

  @Get('project/:projectId/active')
  @ApiOperation({ summary: 'Get active sprint for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Active sprint details' })
  @ApiResponse({ status: 404, description: 'No active sprint found' })
  getActiveSprint(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() user: any) {
    return this.sprintsService.getActiveSprint(projectId, user.id as string);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiBody({ type: UpdateSprintDto })
  @ApiResponse({ status: 200, description: 'Sprint updated successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSprintDto: UpdateSprintDto,
    @CurrentUser() user: any,
  ) {
    return this.sprintsService.update(id, updateSprintDto, user.id as string);
  }

  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Sprint started successfully' })
  @ApiResponse({ status: 400, description: 'Sprint cannot be started' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  startSprint(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.sprintsService.startSprint(id, user.id as string);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Sprint completed successfully' })
  @ApiResponse({ status: 400, description: 'Sprint cannot be completed' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  completeSprint(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.sprintsService.completeSprint(id, user.id as string);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Sprint deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.sprintsService.remove(id, user.id as string);
  }

  @Patch('archive/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Sprint archived successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  archiveSprint(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.sprintsService.archiveSprint(id, user.id as string);
  }
}
