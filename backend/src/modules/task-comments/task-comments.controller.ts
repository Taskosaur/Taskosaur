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
import { TaskCommentsService } from './task-comments.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-comments')
export class TaskCommentsController {
  constructor(private readonly taskCommentsService: TaskCommentsService) {}

  @Post()
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
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.findOne(id, user.id);
  }

  @Get(':id/replies')
  getReplies(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.getReplies(id, user.id);
  }

  @Get('task/:taskId/tree')
  getTaskCommentTree(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: User) {
    return this.taskCommentsService.getTaskCommentTree(taskId, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskCommentDto: UpdateTaskCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.taskCommentsService.update(id, updateTaskCommentDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.taskCommentsService.remove(id, user.id);
  }
}
