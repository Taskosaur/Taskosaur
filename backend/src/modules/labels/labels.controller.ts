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
  UsePipes,
  ValidationPipe,
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
import { User } from '@prisma/client';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { AssignLabelDto, AssignMultipleLabelsDto } from './dto/assign-label.dto';

@ApiTags('Labels')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Create a new label' })
  @ApiBody({ type: CreateLabelDto })
  @ApiResponse({ status: 201, description: 'Label created successfully' })
  create(@Body() createLabelDto: CreateLabelDto, @CurrentUser() user: any) {
    return this.labelsService.create(createLabelDto, user.id as string);
  }

  @Get()
  @ApiOperation({ summary: 'Get all labels' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of labels' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  findAll(@CurrentUser() user: User, @Query('projectId') projectId?: string) {
    return this.labelsService.findAll(projectId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get label by ID' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Label details' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.labelsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a label' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiBody({ type: UpdateLabelDto })
  @ApiResponse({ status: 200, description: 'Label updated successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLabelDto: UpdateLabelDto,
    @CurrentUser() user: User,
  ) {
    return this.labelsService.update(id, updateLabelDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a label' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Label deleted successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.labelsService.remove(id, user.id);
  }

  @Post('assign')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a label to a task' })
  @ApiBody({ type: AssignLabelDto })
  @ApiResponse({ status: 201, description: 'Label assigned to task successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  @ApiResponse({ status: 404, description: 'Task or label not found' })
  @ApiResponse({ status: 409, description: 'Label already assigned to this task' })
  assignLabelToTask(@Body() assignLabelDto: AssignLabelDto, @CurrentUser() user: User) {
    return this.labelsService.assignLabelToTask(assignLabelDto, user.id);
  }

  @Delete('task/:taskId/label/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a label from a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiParam({ name: 'labelId', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Label removed from task successfully' })
  @ApiResponse({ status: 404, description: 'Label assignment not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  removeLabelFromTask(
    @Param('taskId') taskId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: User,
  ) {
    return this.labelsService.removeLabelFromTask(taskId, labelId, user.id);
  }

  @Post('assign-multiple')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign multiple labels to a task' })
  @ApiBody({ type: AssignMultipleLabelsDto })
  @ApiResponse({ status: 201, description: 'Labels assigned to task successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  @ApiResponse({ status: 404, description: 'Task or labels not found' })
  assignMultipleLabelsToTask(
    @Body() assignMultipleLabelsDto: AssignMultipleLabelsDto,
    @CurrentUser() user: User,
  ) {
    return this.labelsService.assignMultipleLabelsToTask(assignMultipleLabelsDto, user.id);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all labels for a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of labels assigned to the task' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have permission' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  getTaskLabels(@Param('taskId') taskId: string, @CurrentUser() user: User) {
    return this.labelsService.getTaskLabels(taskId, user.id);
  }
}
