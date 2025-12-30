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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskStatusesService } from './task-statuses.service';
import { CreateTaskStatusDto, CreateTaskStatusFromProjectDto } from './dto/create-task-status.dto';
import { UpdatePositionsDto, UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from '@prisma/client';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-statuses')
export class TaskStatusesController {
  constructor(private readonly taskStatusesService: TaskStatusesService) {}

  @Post()
  create(@Body() createTaskStatusDto: CreateTaskStatusDto, @CurrentUser() user: any) {
    return this.taskStatusesService.create(createTaskStatusDto, user.id as string);
  }
  @Post('from-project')
  createFromProject(
    @Body() createTaskStatusDto: CreateTaskStatusFromProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.taskStatusesService.createFromProject(createTaskStatusDto, user.id as string);
  }

  @ApiQuery({ name: 'workflowId', required: false, type: String })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @Get()
  async findAll(
    @Query('workflowId') workflowId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    if (workflowId) {
      return this.taskStatusesService.findAll(workflowId);
    }
    if (organizationId) {
      const defaultWorkflow =
        await this.taskStatusesService.findDefaultWorkflowByOrganizationId(organizationId);
      if (defaultWorkflow) {
        return this.taskStatusesService.findAll(defaultWorkflow.id);
      } else {
        return [];
      }
    }

    return this.taskStatusesService.findAll();
  }
  @Get('project')
  findTaskStatusByProjectSlug(@Query('projectId') projectId: string) {
    return this.taskStatusesService.findTaskStatusByProjectSlug(projectId);
  }
  @Patch('positions')
  updatePositions(@Body() updatePositionsDto: UpdatePositionsDto, @CurrentUser() user: any) {
    return this.taskStatusesService.updatePositions(
      updatePositionsDto.statusUpdates,
      user.id as string,
    );
  }

  @Get('deleted')
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  async findDeleted(@Query('workflowId') workflowId?: string) {
    return this.taskStatusesService.findDeleted(workflowId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskStatusesService.findOne(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.taskStatusesService.restore(id, user.id as string);
  }

  @Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.taskStatusesService.update(id, updateTaskStatusDto, user.id as string);
  }

  @Roles(Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.taskStatusesService.remove(id, user.id as string);
  }
}
