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
import { TaskStatusesService } from './task-statuses.service';
import { CreateTaskStatusDto, CreateTaskStatusFromProjectDto } from './dto/create-task-status.dto';
import { UpdatePositionsDto, UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Task Statuses')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-statuses')
export class TaskStatusesController {
  constructor(private readonly taskStatusesService: TaskStatusesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task status' })
  @ApiBody({ type: CreateTaskStatusDto })
  @ApiResponse({ status: 201, description: 'Task status created successfully' })
  create(@Body() createTaskStatusDto: CreateTaskStatusDto, @CurrentUser() user: any) {
    return this.taskStatusesService.create(createTaskStatusDto, user.id as string);
  }
  @Post('from-project')
  @ApiOperation({ summary: 'Create task status from project configuration' })
  @ApiBody({ type: CreateTaskStatusFromProjectDto })
  @ApiResponse({ status: 201, description: 'Task status created from project' })
  createFromProject(
    @Body() createTaskStatusDto: CreateTaskStatusFromProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.taskStatusesService.createFromProject(createTaskStatusDto, user.id as string);
  }

  @ApiQuery({
    name: 'workflowId',
    required: false,
    type: String,
    description: 'Filter by workflow ID',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    type: String,
    description: 'Filter by organization ID (returns default workflow statuses)',
  })
  @Get()
  @ApiOperation({ summary: 'Get all task statuses' })
  @ApiResponse({ status: 200, description: 'List of task statuses' })
  async findAll(
    @Query('workflowId') workflowId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    if (workflowId) {
      return this.taskStatusesService.findAll(workflowId);
    }
    if (organizationId) {
      const defaultWorkflow =
        await this.taskStatusesService.findDefaultWorkflowByOrganizationId(organizationId);
      if (defaultWorkflow) {
        return this.taskStatusesService.findAll(defaultWorkflow.id);
      } else {
        return [];
      }
    }

    return this.taskStatusesService.findAll();
  }
  @Get('project')
  @ApiOperation({ summary: 'Get task statuses by project slug' })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project ID to get statuses for' })
  @ApiResponse({ status: 200, description: 'List of task statuses for the project' })
  findTaskStatusByProjectSlug(@Query('projectId') projectId: string) {
    return this.taskStatusesService.findTaskStatusByProjectSlug(projectId);
  }
  @Patch('positions')
  @ApiOperation({
    summary: 'Update task status positions',
    description: 'Reorder task statuses by updating their positions',
  })
  @ApiBody({ type: UpdatePositionsDto })
  @ApiResponse({ status: 200, description: 'Positions updated successfully' })
  updatePositions(@Body() updatePositionsDto: UpdatePositionsDto, @CurrentUser() user: any) {
    return this.taskStatusesService.updatePositions(
      updatePositionsDto.statusUpdates,
      user.id as string,
    );
  }

  @Get('deleted')
  @ApiQuery({
    name: 'workflowId',
    required: false,
    type: String,
    description: 'Filter by workflow ID',
  })
  @ApiOperation({ summary: 'Get deleted task statuses' })
  @ApiResponse({ status: 200, description: 'List of soft-deleted task statuses' })
  async findDeleted(@Query('workflowId') workflowId?: string) {
    return this.taskStatusesService.findDeleted(workflowId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task status by ID' })
  @ApiParam({ name: 'id', description: 'Task status ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task status details' })
  @ApiResponse({ status: 404, description: 'Task status not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskStatusesService.findOne(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted task status' })
  @ApiParam({ name: 'id', description: 'Task status ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task status restored successfully' })
  @ApiResponse({ status: 404, description: 'Task status not found' })
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.taskStatusesService.restore(id, user.id as string);
  }

  @Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a task status' })
  @ApiParam({ name: 'id', description: 'Task status ID (UUID)' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiResponse({ status: 200, description: 'Task status updated successfully' })
  @ApiResponse({ status: 404, description: 'Task status not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.taskStatusesService.update(id, updateTaskStatusDto, user.id as string);
  }

  @Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task status' })
  @ApiParam({ name: 'id', description: 'Task status ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task status deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task status not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.taskStatusesService.remove(id, user.id as string);
  }
}
