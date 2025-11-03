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
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { StartTimerDto, StopTimerDto } from './dto/time-tracking.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  create(@Body() createTimeEntryDto: CreateTimeEntryDto) {
    return this.timeEntriesService.create(createTimeEntryDto);
  }

  @Get()
  findAll(
    @Query('taskId') taskId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeEntriesService.findAll(taskId, userId, startDate, endDate);
  }

  @Get('summary')
  getTimeSpentSummary(
    @Query('userId') userId?: string,
    @Query('taskId') taskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeEntriesService.getTimeSpentSummary(userId, taskId, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeEntriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    // TODO: Get userId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.timeEntriesService.update(id, updateTimeEntryDto, requestUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get userId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.timeEntriesService.remove(id, requestUserId);
  }

  // Time Tracking Endpoints
  @Post('timer/start')
  startTimer(@Body() startTimerDto: StartTimerDto) {
    return this.timeEntriesService.startTimer(startTimerDto);
  }

  @Post('timer/stop')
  @HttpCode(HttpStatus.OK)
  stopTimer(@Body() stopTimerDto: StopTimerDto) {
    return this.timeEntriesService.stopTimer(stopTimerDto);
  }

  @Get('timer/active/:userId')
  getActiveTimer(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.timeEntriesService.getActiveTimer(userId);
  }
}
