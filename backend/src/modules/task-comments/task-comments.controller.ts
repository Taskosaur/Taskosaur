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
  create(@Body() createTaskCommentDto: CreateTaskCommentDto) {
    return this.taskCommentsService.create(createTaskCommentDto);
  }

  @Get()
  findAll(
    @Query('taskId') taskId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    return this.taskCommentsService.findAll(taskId, Number(page), Number(limit), sort);
  }

  @Get('middle-pagination')
  findWithMiddlePagination(
    @Query('taskId') taskId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('oldestCount') oldestCount = '2',
    @Query('newestCount') newestCount = '2',
  ) {
    return this.taskCommentsService.findWithMiddlePagination(
      taskId,
      Number(page),
      Number(limit),
      Number(oldestCount),
      Number(newestCount),
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskCommentsService.findOne(id);
  }

  @Get(':id/replies')
  getReplies(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskCommentsService.getReplies(id);
  }

  @Get('task/:taskId/tree')
  getTaskCommentTree(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskCommentsService.getTaskCommentTree(taskId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskCommentDto: UpdateTaskCommentDto,
    // TODO: Get userId from JWT token when authentication is implemented
    @Query('userId') userId: string,
  ) {
    return this.taskCommentsService.update(id, updateTaskCommentDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get userId from JWT token when authentication is implemented
    @Query('userId') userId: string,
  ) {
    return this.taskCommentsService.remove(id, userId);
  }
}
