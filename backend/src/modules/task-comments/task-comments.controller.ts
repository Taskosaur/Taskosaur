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
import { TaskCommentsService } from './task-comments.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { RateLimit } from '../public/guards/public-rate-limit.guard';

@ApiTags('Task Comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-comments')
export class TaskCommentsController {
  constructor(private readonly taskCommentsService: TaskCommentsService) {}

  @Post()
  @RateLimit(20, 60000) // 20 comments per minute per user
  @ApiOperation({ summary: 'Create a new task comment' })
  @ApiBody({ type: CreateTaskCommentDto })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid comment data' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @LogActivity({
    type: 'TASK_COMMENTED',
    entityType: 'Task Comment',
    description: 'Added comment to task',
    includeNewValue: true,
  })
  create(@Body() createTaskCommentDto: CreateTaskCommentDto, @CurrentUser() user: User) {
    return this.taskCommentsService.create(createTaskCommentDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all comments for a task' })
  @ApiQuery({ name: 'taskId', required: true, description: 'Task ID to get comments for' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (default: 10)' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiResponse({ status: 200, description: 'List of task comments' })
  findAll(
    @Query('taskId') taskId: string,
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    return this.taskCommentsService.findAll(taskId, user.id, Number(page), Number(limit), sort);
  }

  @Get('middle-pagination')
  @ApiOperation({
    summary: 'Get comments with middle pagination',
    description: 'Returns oldest, middle, and newest comments in a single request',
  })
  @ApiQuery({ name: 'taskId', required: true, description: 'Task ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for middle section (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of middle comments per page (default: 5)',
  })
  @ApiQuery({
    name: 'oldestCount',
    required: false,
    description: 'Number of oldest comments to include (default: 2)',
  })
  @ApiQuery({
    name: 'newestCount',
    required: false,
    description: 'Number of newest comments to include (default: 2)',
  })
  @ApiResponse({ status: 200, description: 'Paginated comments with oldest and newest' })
  findWithMiddlePagination(
    @Query('taskId') taskId: string,
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('oldestCount') oldestCount = '2',
    @Query('newestCount') newestCount = '2',
  ) {
    return this.taskCommentsService.findWithMiddlePagination(
      taskId,
      user.id,
      Number(page),
      Number(limit),
      Number(oldestCount),
      Number(newestCount),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific comment by ID' })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Comment details' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.findOne(id, user.id);
  }

  @Get(':id/replies')
  @ApiOperation({ summary: 'Get replies to a comment' })
  @ApiParam({ name: 'id', description: 'Parent comment ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of reply comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  getReplies(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.getReplies(id, user.id);
  }

  @Get('task/:taskId/tree')
  @ApiOperation({
    summary: 'Get comment tree for a task',
    description: 'Returns hierarchical comment tree with nested replies',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Hierarchical comment tree' })
  getTaskCommentTree(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: User) {
    return this.taskCommentsService.getTaskCommentTree(taskId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)' })
  @ApiBody({ type: UpdateTaskCommentDto })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to update this comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskCommentDto: UpdateTaskCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.taskCommentsService.update(id, updateTaskCommentDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.remove(id, user.id);
  }
}
