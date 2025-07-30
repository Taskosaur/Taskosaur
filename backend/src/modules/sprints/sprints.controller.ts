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
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintStatus } from '@prisma/client';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  create(
    @Body() createSprintDto: CreateSprintDto,
    @CurrentUser() user: any,
  ) {
    return this.sprintsService.create(createSprintDto, user.id);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: SprintStatus,
  ) {
    return this.sprintsService.findAll(projectId, status);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprintsService.findOne(id);
  }

  @Get('project/:projectId/active')
  getActiveSprint(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sprintsService.getActiveSprint(projectId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSprintDto: UpdateSprintDto,
    @CurrentUser() user: any,
  ) {
    return this.sprintsService.update(id, updateSprintDto, user.id);
  }

  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  startSprint(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprintsService.startSprint(id);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeSprint(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprintsService.completeSprint(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprintsService.remove(id);
  }
}
