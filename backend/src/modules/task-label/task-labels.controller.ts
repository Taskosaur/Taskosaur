import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TaskLabelsService } from './task-labels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { AssignTaskLabelDto, AssignMultipleTaskLabelsDto } from './dto/create-task-labels.dto';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

@ApiTags('Task Labels')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-labels')
export class TaskLabelsController {
  constructor(private readonly taskLabelsService: TaskLabelsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @LogActivity({
    type: 'TASK_LABEL_ADDED',
    entityType: 'Task Label',
    description: 'Added label to task',
    includeNewValue: true,
    entityIdName: 'taskId',
  })
  @ApiOperation({ summary: 'Assign a label to a task' })
  @ApiResponse({
    status: 201,
    description: 'Label assigned to task successfully',
  })
  @ApiResponse({ status: 404, description: 'Task or label not found' })
  @ApiResponse({
    status: 409,
    description: 'Label is already assigned to this task',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission',
  })
  @ApiBody({ type: AssignTaskLabelDto })
  create(@Body() assignTaskLabelDto: AssignTaskLabelDto, @CurrentUser() user: User) {
    return this.taskLabelsService.assignLabel(assignTaskLabelDto, user.id);
  }

  @Post('assign-multiple')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @LogActivity({
    type: 'TASK_LABEL_ADDED',
    entityType: 'Task Label',
    description: 'Added multiple labels to task',
    includeNewValue: true,
    entityIdName: 'taskId',
  })
  @ApiOperation({ summary: 'Assign multiple labels to a task' })
  @ApiResponse({
    status: 201,
    description: 'Labels assigned to task successfully',
  })
  @ApiResponse({ status: 404, description: 'Task or one or more labels not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission',
  })
  @ApiBody({ type: AssignMultipleTaskLabelsDto })
  assignMultiple(
    @Body() assignMultipleTaskLabelsDto: AssignMultipleTaskLabelsDto,
    @CurrentUser() user: User,
  ) {
    return this.taskLabelsService.assignMultiple(assignMultipleTaskLabelsDto, user.id);
  }

  //
  @Get()
  @ApiOperation({ summary: 'Get all task labels' })
  @ApiResponse({ status: 200, description: 'List of task labels' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  findAll(@CurrentUser() user: User) {
    return this.taskLabelsService.findAll(user.id);
  }
  @Delete(':taskId/:labelId')
  @LogActivity({
    type: 'TASK_LABEL_REMOVED',
    entityType: 'Task Label',
    description: 'Removed label from task',
    entityIdName: 'taskId',
  })
  @ApiOperation({ summary: 'Remove a label from a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiParam({ name: 'labelId', description: 'Label ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Label removed from task successfully',
  })
  @ApiResponse({ status: 404, description: 'Task label assignment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission',
  })
  async remove(
    @Param('taskId') taskId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: User,
  ) {
    return this.taskLabelsService.remove(taskId, labelId, user.id);
  }
}
