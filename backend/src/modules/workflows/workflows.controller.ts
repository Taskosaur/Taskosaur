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
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  create(@Body() createWorkflowDto: CreateWorkflowDto, @CurrentUser() user: any) {
    return this.workflowsService.create(createWorkflowDto, user.id as string);
  }

  @Get()
  findAll(@Query('organizationId') organizationId?: string) {
    return this.workflowsService.findAll(organizationId);
  }
  @Get('slug')
  findAllByOrganizationSlug(@Query('slug') slug: string) {
    return this.workflowsService.findAllByOrganizationSlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.findOne(id);
  }

  @Get('organization/:organizationId/default')
  getDefaultWorkflow(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.workflowsService.getDefaultWorkflow(organizationId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.update(id, updateWorkflowDto, user.id as string);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Make workflow default for organization' })
  @ApiResponse({
    status: 200,
    description: 'Workflow successfully set as default',
  })
  @ApiResponse({
    status: 404,
    description: 'Workflow not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Workflow does not belong to organization',
  })
  async makeDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { organizationId: string; userId: string },
  ) {
    return this.workflowsService.makeWorkflowDefault(id, body.organizationId, body.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.remove(id);
  }
}
