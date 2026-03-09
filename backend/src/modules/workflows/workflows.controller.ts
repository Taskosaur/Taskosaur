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
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@ApiTags('Workflows')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiBody({ type: CreateWorkflowDto })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid workflow data' })
  create(@Body() createWorkflowDto: CreateWorkflowDto, @CurrentUser() user: any) {
    return this.workflowsService.create(createWorkflowDto, user.id as string);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization ID (UUID)',
  })
  @ApiResponse({ status: 200, description: 'List of workflows' })
  findAll(@Query('organizationId') organizationId?: string) {
    return this.workflowsService.findAll(organizationId);
  }
  @Get('slug')
  @ApiOperation({ summary: 'Get workflows by organization slug' })
  @ApiQuery({ name: 'slug', required: true, description: 'Organization slug' })
  @ApiResponse({ status: 200, description: 'List of workflows for the organization' })
  findAllByOrganizationSlug(@Query('slug') slug: string) {
    return this.workflowsService.findAllByOrganizationSlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  @ApiParam({ name: 'id', description: 'Workflow ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workflow details' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.findOne(id);
  }

  @Get('organization/:organizationId/default')
  @ApiOperation({ summary: 'Get default workflow for organization' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Default workflow details' })
  @ApiResponse({ status: 404, description: 'No default workflow found' })
  getDefaultWorkflow(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.workflowsService.getDefaultWorkflow(organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID (UUID)' })
  @ApiBody({ type: UpdateWorkflowDto })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
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
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.remove(id);
  }
}
