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
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Automation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create a new automation rule' })
  @ApiBody({ type: CreateAutomationRuleDto })
  @ApiResponse({
    status: 201,
    description: 'Automation rule created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid rule configuration' })
  create(@Body() createAutomationRuleDto: CreateAutomationRuleDto) {
    return this.automationService.create(createAutomationRuleDto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all automation rules' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization',
  })
  @ApiQuery({
    name: 'workspaceId',
    required: false,
    description: 'Filter by workspace',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter by project',
  })
  @ApiResponse({ status: 200, description: 'List of automation rules' })
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.automationService.findAll(organizationId, workspaceId, projectId);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get automation rule by ID' })
  @ApiParam({ name: 'id', description: 'Rule ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Automation rule details with execution history',
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.findOne(id);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update automation rule' })
  @ApiParam({ name: 'id', description: 'Rule ID (UUID)' })
  @ApiBody({ type: CreateAutomationRuleDto })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateAutomationRuleDto>,
  ) {
    return this.automationService.update(id, updateData);
  }

  @Patch('rules/:id/toggle')
  @ApiOperation({ summary: 'Toggle rule active/inactive status' })
  @ApiParam({ name: 'id', description: 'Rule ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Rule status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.toggleStatus(id);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete automation rule' })
  @ApiParam({ name: 'id', description: 'Rule ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.remove(id);
  }

  @Get('rules/:id/stats')
  @ApiOperation({ summary: 'Get rule execution statistics' })
  @ApiParam({ name: 'id', description: 'Rule ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Rule execution statistics',
    schema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string' },
        ruleName: { type: 'string' },
        totalExecutions: { type: 'number' },
        successCount: { type: 'number' },
        failureCount: { type: 'number' },
        successRate: { type: 'number' },
        avgExecutionTime: { type: 'number' },
        lastExecuted: { type: 'string', format: 'date-time' },
      },
    },
  })
  getExecutionStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.getExecutionStats(id);
  }
}
