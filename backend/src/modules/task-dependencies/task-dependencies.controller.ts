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
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskDependenciesService } from './task-dependencies.service';
import {
  CreateTaskDependencyDto,
  BulkCreateDependenciesDto,
} from './dto/create-task-dependency.dto';
import { UpdateTaskDependencyDto } from './dto/update-task-dependency.dto';

@ApiTags('Task Dependencies')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-dependencies')
export class TaskDependenciesController {
  constructor(private readonly taskDependenciesService: TaskDependenciesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task dependency' })
  @ApiBody({ type: CreateTaskDependencyDto })
  @ApiResponse({
    status: 201,
    description: 'Task dependency created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid dependency (circular or self-dependency)',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Dependency already exists' })
  create(@Body() createTaskDependencyDto: CreateTaskDependencyDto) {
    return this.taskDependenciesService.create(createTaskDependencyDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple task dependencies at once' })
  @ApiBody({ type: BulkCreateDependenciesDto })
  @ApiResponse({
    status: 201,
    description: 'Dependencies created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Some dependencies failed to create',
  })
  createBulk(@Body() bulkCreateDto: BulkCreateDependenciesDto) {
    return this.taskDependenciesService.createBulk(bulkCreateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all task dependencies' })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter by project ID',
  })
  @ApiResponse({ status: 200, description: 'List of task dependencies' })
  findAll(@Query('projectId') projectId?: string) {
    return this.taskDependenciesService.findAll(projectId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dependency statistics for a project' })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Dependency statistics' })
  getDependencyStats(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.taskDependenciesService.getDependencyStats(projectId);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all dependencies for a specific task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Task dependencies (what it depends on and what it blocks)',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  getTaskDependencies(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskDependenciesService.getTaskDependencies(taskId);
  }

  @Get('task/:taskId/blocked')
  @ApiOperation({ summary: 'Get all tasks blocked by a specific task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'List of tasks blocked by this task',
  })
  getBlockedTasks(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskDependenciesService.getBlockedTasks(taskId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific task dependency by ID' })
  @ApiParam({ name: 'id', description: 'Task dependency ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task dependency details' })
  @ApiResponse({ status: 404, description: 'Task dependency not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskDependenciesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task dependency' })
  @ApiParam({ name: 'id', description: 'Task dependency ID (UUID)' })
  @ApiBody({ type: UpdateTaskDependencyDto })
  @ApiResponse({
    status: 200,
    description: 'Task dependency updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid dependency (circular or self-dependency)',
  })
  @ApiResponse({ status: 404, description: 'Task dependency not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDependencyDto: UpdateTaskDependencyDto,
  ) {
    return this.taskDependenciesService.update(id, updateTaskDependencyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a task dependency' })
  @ApiParam({ name: 'id', description: 'Task dependency ID (UUID)' })
  @ApiResponse({
    status: 204,
    description: 'Task dependency removed successfully',
  })
  @ApiResponse({ status: 404, description: 'Task dependency not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskDependenciesService.remove(id);
  }

  @Delete('tasks/:dependentTaskId/:blockingTaskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove dependency between two specific tasks' })
  @ApiParam({
    name: 'dependentTaskId',
    description: 'Dependent task ID (UUID)',
  })
  @ApiParam({ name: 'blockingTaskId', description: 'Blocking task ID (UUID)' })
  @ApiResponse({
    status: 204,
    description: 'Task dependency removed successfully',
  })
  @ApiResponse({ status: 404, description: 'Task dependency not found' })
  removeByTasks(
    @Param('dependentTaskId', ParseUUIDPipe) dependentTaskId: string,
    @Param('blockingTaskId', ParseUUIDPipe) blockingTaskId: string,
  ) {
    return this.taskDependenciesService.removeByTasks(dependentTaskId, blockingTaskId);
  }
}
