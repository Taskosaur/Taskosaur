// src/modules/activity-log/activity-log.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityLogService } from './activity-log.service';

@ApiTags('Activity Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('organization/:organizationId/recent')
  @ApiOperation({
    summary: 'Get recent activity for organization',
    description: 'Retrieves paginated recent activities for a specific organization',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of activities per page (max 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (starts from 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    description: 'Filter by entity type (Task, Project, Workspace)',
    example: 'Task',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user who performed the activity',
  })
  async getOrganizationRecentActivity(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('limit') limit: string = '10',
    @Query('page') page: string = '1',
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
  ) {
    // Validate and sanitize query parameters
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);

    if (isNaN(limitNum) || limitNum < 1) {
      throw new BadRequestException('Limit must be a positive number');
    }

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Page must be a positive number');
    }

    const validatedLimit = Math.min(Math.max(1, limitNum), 50); // Max 50 items per page
    const validatedPage = Math.max(1, pageNum);

    // Build filters object
    const filters: any = {};
    if (entityType) {
      // Validate entityType if needed
      const validEntityTypes = ['Task', 'Project', 'Workspace', 'Organization', 'User'];
      if (!validEntityTypes.includes(entityType)) {
        throw new BadRequestException(
          `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`,
        );
      }
      filters.entityType = entityType;
    }

    if (userId) {
      filters.userId = userId;
    }

    return this.activityLogService.getRecentActivityByOrganizationComprehensive(
      organizationId,
      validatedLimit,
      validatedPage,
      filters as { entityType?: string; userId?: string; startDate?: Date; endDate?: Date },
    );
  }

  @Get('organization/:organizationId/stats')
  @ApiOperation({
    summary: 'Get activity statistics for organization',
    description: 'Get activity counts by type, user, and date range',
  })
  async getOrganizationActivityStats(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('days') days: string = '30',
  ) {
    const daysNum = parseInt(days, 10) || 30;
    const validatedDays = Math.min(Math.max(1, daysNum), 365); // Max 1 year

    return this.activityLogService.getOrganizationActivityStats(organizationId, validatedDays);
  }

  @Get('task/:taskId/activities')
  @ApiOperation({
    summary: 'Get task activities',
    description: 'Get activity logs for a specific task with pagination',
  })
  async getTaskActivities(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('limit') limit: string = '50',
    @Query('page') page: string = '1',
  ) {
    const limitNum = parseInt(limit, 10) || 50;
    const pageNum = parseInt(page, 10) || 1;

    const validatedLimit = Math.min(Math.max(1, limitNum), 50);
    const validatedPage = Math.max(1, pageNum);

    return this.activityLogService.getTaskActivities(taskId, validatedPage, validatedLimit);
  }
}
