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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { AssignLabelDto, AssignMultipleLabelsDto } from './dto/assign-label.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  create(@Body() createLabelDto: CreateLabelDto, @CurrentUser() user: any) {
    return this.labelsService.create(createLabelDto, user.id as string);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.labelsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.labelsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLabelDto: UpdateLabelDto,
    @CurrentUser() user: any,
  ) {
    return this.labelsService.update(id, updateLabelDto, user.id as string);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.labelsService.remove(id);
  }

  // Task Label Management Endpoints
  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  assignLabelToTask(@Body() assignLabelDto: AssignLabelDto) {
    return this.labelsService.assignLabelToTask(assignLabelDto);
  }

  @Delete('task/:taskId/label/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLabelFromTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.labelsService.removeLabelFromTask(taskId, labelId);
  }

  @Post('assign-multiple')
  @HttpCode(HttpStatus.CREATED)
  assignMultipleLabelsToTask(@Body() assignMultipleLabelsDto: AssignMultipleLabelsDto) {
    return this.labelsService.assignMultipleLabelsToTask(assignMultipleLabelsDto);
  }

  @Get('task/:taskId')
  getTaskLabels(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.labelsService.getTaskLabels(taskId);
  }
}
