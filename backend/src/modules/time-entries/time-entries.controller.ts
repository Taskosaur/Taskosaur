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
import { TimeEntriesService, RequestingUser } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { StartTimerDto, StopTimerDto } from './dto/time-tracking.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  create(@Body() createTimeEntryDto: CreateTimeEntryDto, @CurrentUser() user: RequestingUser) {
    return this.timeEntriesService.create(createTimeEntryDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('taskId') taskId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeEntriesService.findAll(user, taskId, userId, startDate, endDate);
  }

  @Get('summary')
  getTimeSpentSummary(
    @CurrentUser() user: RequestingUser,
    @Query('userId') userId?: string,
    @Query('taskId') taskId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeEntriesService.getTimeSpentSummary(user, userId, taskId, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    return this.timeEntriesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @CurrentUser() user: RequestingUser,
  ) {
    // The owning-user check is made against the authenticated principal, not a
    // client-supplied requestUserId.
    return this.timeEntriesService.update(id, updateTimeEntryDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestingUser) {
    return this.timeEntriesService.remove(id, user.id);
  }

  // Time Tracking Endpoints
  @Post('timer/start')
  startTimer(@Body() startTimerDto: StartTimerDto, @CurrentUser() user: RequestingUser) {
    return this.timeEntriesService.startTimer(startTimerDto, user);
  }

  @Post('timer/stop')
  @HttpCode(HttpStatus.OK)
  stopTimer(@Body() stopTimerDto: StopTimerDto, @CurrentUser() user: RequestingUser) {
    return this.timeEntriesService.stopTimer(stopTimerDto, user);
  }

  @Get('timer/active/:userId')
  getActiveTimer(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.timeEntriesService.getActiveTimer(userId, user);
  }
}
