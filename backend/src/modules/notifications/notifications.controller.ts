// src/modules/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { getAuthUser } from 'src/common/request.utils';
import { Request } from 'express';
import { NotificationPriority, NotificationType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({
    name: 'isRead',
    required: false,
    description: 'Filter by read status',
    example: false,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 20,
  })
  async getUserNotifications(
    @Req() req: Request,
    @Query('isRead') isRead?: string,
    @Query('type') type?: NotificationType,
    @Query('organizationId') organizationId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const user = getAuthUser(req);
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    // Validate pagination
    if (pageNum < 1) {
      throw new BadRequestException('Page must be a positive number');
    }

    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100); // Max 100 items per page

    const filters: any = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }
    if (type) filters.type = type;
    if (organizationId) filters.organizationId = organizationId;

    return this.notificationsService.getUserNotifications(
      user.id,
      filters as { isRead?: boolean; type?: NotificationType; organizationId?: string },
      validatedPage,
      validatedLimit,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization',
  })
  getUnreadCount(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    const user = getAuthUser(req);
    return this.notificationsService.getUnreadCount(user.id, organizationId);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent notifications',
    description: 'Get the most recent notifications for the user (last 7 days)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of notifications to return',
    example: 10,
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization',
  })
  async getRecentNotifications(
    @Req() req: Request,
    @Query('limit') limit: string = '10',
    @Query('organizationId') organizationId?: string,
  ) {
    const user = getAuthUser(req);
    const limitNum = parseInt(limit, 10) || 10;
    const validatedLimit = Math.min(Math.max(1, limitNum), 50);

    // Get notifications from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filters: any = {
      createdAt: { gte: sevenDaysAgo },
    };

    if (organizationId) {
      filters.organizationId = organizationId;
    }

    const result = await this.notificationsService.getUserNotifications(
      user.id,
      filters as { isRead?: boolean; type?: NotificationType; organizationId?: string },
      1,
      validatedLimit,
    );

    return {
      notifications: result.notifications,
      count: result.notifications.length,
    };
  }

  @Get('by-type/:type')
  @ApiOperation({ summary: 'Get notifications by type' })
  async getNotificationsByType(
    @Req() req: Request,
    @Param('type') type: NotificationType,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('organizationId') organizationId?: string,
  ) {
    const user = getAuthUser(req);
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100);

    const filters: any = { type };
    if (organizationId) filters.organizationId = organizationId;

    return this.notificationsService.getUserNotifications(
      user.id,
      filters as { isRead?: boolean; type?: NotificationType; organizationId?: string },
      validatedPage,
      validatedLimit,
    );
  }
  @Get('user/:userId/organization/:organizationId')
  @ApiOperation({
    summary: 'Get notifications by user and organization',
    description: 'Get all notifications for a specific user within a specific organization',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    description: 'Filter by read status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    description: 'Filter by priority level',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter from date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter to date (ISO string)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 20,
  })
  async getNotificationsByUserAndOrganization(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: NotificationType,
    @Query('priority') priority?: NotificationPriority,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    if (pageNum < 1) {
      throw new BadRequestException('Page must be a positive number');
    }

    const validatedPage = Math.max(1, pageNum);
    const validatedLimit = Math.min(Math.max(1, limitNum), 100);

    // Build filters
    const filters: any = {};

    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }

    if (type) filters.type = type;
    if (priority) filters.priority = priority;

    if (startDate) {
      const date = new Date(startDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
      filters.startDate = date;
    }

    if (endDate) {
      const date = new Date(endDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
      filters.endDate = date;
    }

    return this.notificationsService.getNotificationsByUserAndOrganization(
      userId,
      organizationId,
      filters as {
        isRead?: boolean;
        type?: NotificationType;
        priority?: NotificationPriority;
        startDate?: Date;
        endDate?: Date;
      },
      validatedPage,
      validatedLimit,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  async getNotificationById(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    return this.notificationsService.getNotificationById(id, user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    await this.notificationsService.markAsRead(id, user.id);
    return { message: 'Notification marked as read' };
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    const user = getAuthUser(req);
    await this.notificationsService.markAllAsRead(user.id, organizationId);
    return { message: 'All notifications marked as read' };
  }

  @Patch('mark-all-unread-read')
  @ApiOperation({
    summary: 'Mark all unread notifications as read',
    description: 'Marks only unread notifications as read, useful for clearing notification badges',
  })
  @HttpCode(HttpStatus.OK)
  async markAllUnreadAsRead(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    const user = getAuthUser(req);
    const filters: any = { isRead: false };
    if (organizationId) filters.organizationId = organizationId;

    await this.notificationsService.markAllAsRead(user.id, organizationId);
    return { message: 'All unread notifications marked as read' };
  }
  @Delete('bulk')
  @ApiOperation({
    summary: 'Delete multiple notifications',
    description: 'Delete multiple notifications by providing an array of IDs',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMultipleNotifications(
    @Req() req: Request,
    @Body('notificationIds') notificationIds: string[],
    @CurrentUser() user: any,
  ) {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestException('notificationIds must be a non-empty array');
    }
    await this.notificationsService.deleteMultipleNotifications(notificationIds, user.id as string);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = getAuthUser(req);
    await this.notificationsService.deleteNotification(id, user.id);
  }

  @Get('stats/summary')
  @ApiOperation({
    summary: 'Get notification statistics',
    description: 'Get counts by type, read/unread status, and recent activity',
  })
  async getNotificationStats(
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    const user = getAuthUser(req);
    return this.notificationsService.getUserNotificationStats(user.id, organizationId);
  }
}
