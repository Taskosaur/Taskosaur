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
  findAll(@Query('projectId') projectId?: string) {
    return this.labelsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get label by ID' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Label details' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.labelsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a label' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiBody({ type: UpdateLabelDto })
  @ApiResponse({ status: 200, description: 'Label updated successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLabelDto: UpdateLabelDto,
    @CurrentUser() user: any,
  ) {
    return this.labelsService.update(id, updateLabelDto, user.id as string);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a label' })
  @ApiParam({ name: 'id', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Label deleted successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.labelsService.remove(id);
  }

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a label to a task' })
  @ApiBody({ type: AssignLabelDto })
  @ApiResponse({ status: 201, description: 'Label assigned to task successfully' })
  assignLabelToTask(@Body() assignLabelDto: AssignLabelDto) {
    return this.labelsService.assignLabelToTask(assignLabelDto);
  }

  @Delete('task/:taskId/label/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a label from a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiParam({ name: 'labelId', description: 'Label ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Label removed from task successfully' })
  removeLabelFromTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.labelsService.removeLabelFromTask(taskId, labelId);
  }

  @Post('assign-multiple')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign multiple labels to a task' })
  @ApiBody({ type: AssignMultipleLabelsDto })
  @ApiResponse({ status: 201, description: 'Labels assigned to task successfully' })
  assignMultipleLabelsToTask(@Body() assignMultipleLabelsDto: AssignMultipleLabelsDto) {
    return this.labelsService.assignMultipleLabelsToTask(assignMultipleLabelsDto);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all labels for a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of labels assigned to the task' })
  getTaskLabels(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.labelsService.getTaskLabels(taskId);
  }
}
