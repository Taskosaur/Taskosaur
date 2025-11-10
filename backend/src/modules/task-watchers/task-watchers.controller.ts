import {
  Controller,
  Get,
  Post,
  Body,
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
import { TaskWatchersService } from './task-watchers.service';
import { CreateTaskWatcherDto, WatchTaskDto, UnwatchTaskDto } from './dto/create-task-watcher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Task Watchers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-watchers')
export class TaskWatchersController {
  constructor(private readonly taskWatchersService: TaskWatchersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task watcher' })
  @ApiResponse({
    status: 201,
    description: 'Task watcher created successfully',
  })
  @ApiResponse({ status: 404, description: 'Task or user not found' })
  @ApiResponse({
    status: 409,
    description: 'User is already watching this task',
  })
  @ApiBody({ type: CreateTaskWatcherDto })
  create(@Body() createTaskWatcherDto: CreateTaskWatcherDto) {
    return this.taskWatchersService.create(createTaskWatcherDto);
  }

  @Post('watch')
  @ApiOperation({ summary: 'Watch a task for updates' })
  @ApiResponse({
    status: 201,
    description: 'Successfully started watching task',
  })
  @ApiResponse({ status: 404, description: 'Task or user not found' })
  @ApiResponse({
    status: 409,
    description: 'User is already watching this task',
  })
  @ApiBody({ type: WatchTaskDto })
  watchTask(@Body() watchTaskDto: WatchTaskDto) {
    return this.taskWatchersService.watchTask(watchTaskDto);
  }

  @Post('unwatch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop watching a task' })
  @ApiResponse({
    status: 204,
    description: 'Successfully stopped watching task',
  })
  @ApiResponse({ status: 404, description: 'Task watcher not found' })
  @ApiBody({ type: UnwatchTaskDto })
  unwatchTask(@Body() unwatchTaskDto: UnwatchTaskDto) {
    return this.taskWatchersService.unwatchTask(unwatchTaskDto);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle watch status for a task' })
  @ApiResponse({
    status: 200,
    description: 'Watch status toggled successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
      },
    },
  })
  toggleWatch(@Body() body: { taskId: string; userId: string }) {
    return this.taskWatchersService.toggleWatch(body.taskId, body.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all task watchers with optional filters' })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Filter by task ID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiResponse({ status: 200, description: 'List of task watchers' })
  findAll(@Query('taskId') taskId?: string, @Query('userId') userId?: string) {
    return this.taskWatchersService.findAll(taskId, userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task watcher statistics' })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Filter stats by task ID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter stats by user ID',
  })
  @ApiResponse({ status: 200, description: 'Task watcher statistics' })
  getWatcherStats(@Query('taskId') taskId?: string, @Query('userId') userId?: string) {
    return this.taskWatchersService.getWatcherStats(taskId, userId);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all watchers for a specific task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of users watching the task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  getTaskWatchers(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskWatchersService.getTaskWatchers(taskId);
  }

  @Get('user/:userId/watched-tasks')
  @ApiOperation({ summary: 'Get all tasks watched by a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'List of tasks the user is watching',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserWatchedTasks(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.taskWatchersService.getUserWatchedTasks(userId);
  }

  @Get('check/:taskId/:userId')
  @ApiOperation({ summary: 'Check if a user is watching a specific task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Returns true if user is watching the task',
  })
  isUserWatchingTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.taskWatchersService.isUserWatchingTask(userId, taskId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific task watcher by ID' })
  @ApiParam({ name: 'id', description: 'Task watcher ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task watcher details' })
  @ApiResponse({ status: 404, description: 'Task watcher not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskWatchersService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a task watcher' })
  @ApiParam({ name: 'id', description: 'Task watcher ID (UUID)' })
  @ApiQuery({
    name: 'requestUserId',
    description: 'ID of user making the request',
  })
  @ApiResponse({
    status: 204,
    description: 'Task watcher removed successfully',
  })
  @ApiResponse({ status: 404, description: 'Task watcher not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to remove this watcher',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.taskWatchersService.remove(id, requestUserId);
  }
}
