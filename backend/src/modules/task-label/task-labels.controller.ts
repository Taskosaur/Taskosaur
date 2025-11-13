import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
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
import { AssignTaskLabelDto } from './dto/create-task-labels.dto';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

@ApiTags('Task Labels')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-labels')
export class TaskLabelsController {
  constructor(private readonly taskLabelsService: TaskLabelsService) {}

  @Post()
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
  @ApiBody({ type: AssignTaskLabelDto })
  create(@Body() assignTaskLabelDto: AssignTaskLabelDto) {
    return this.taskLabelsService.assignLabel(assignTaskLabelDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all task labels' })
  @ApiResponse({ status: 200, description: 'List of task labels' })
  findAll() {
    return this.taskLabelsService.findAll();
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
  async remove(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.taskLabelsService.remove(taskId, labelId);
  }
}
