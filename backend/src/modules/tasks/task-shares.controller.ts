import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreatePublicTaskShareDto,
  PublicTaskShareResponseDto,
} from '../public/dto/public-shared-task.dto';
import { PublicSharedTasksService } from '../public/services/public-shared-tasks.service';
import { getAuthUser } from 'src/common/request.utils';
import { Request } from 'express';

@ApiTags('Task Sharing')
@Controller('task-shares')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaskSharesController {
  constructor(private readonly publicSharedTasksService: PublicSharedTasksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create public share link',
    description: 'Create a public share link for a task with expiry',
  })
  @ApiResponse({ type: PublicTaskShareResponseDto })
  async createShare(
    @Body() dto: CreatePublicTaskShareDto,
    @Req() req: Request,
  ): Promise<PublicTaskShareResponseDto> {
    const user = getAuthUser(req);
    return this.publicSharedTasksService.createShareLink(dto, user.id);
  }

  @Get('task/:taskId')
  @ApiOperation({
    summary: 'Get share links for task',
    description: 'Get all active share links for a specific task',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ type: [PublicTaskShareResponseDto] })
  async getSharesForTask(
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ): Promise<PublicTaskShareResponseDto[]> {
    const user = getAuthUser(req);
    return this.publicSharedTasksService.getSharesForTask(taskId, user.id);
  }

  @Delete(':shareId')
  @ApiOperation({
    summary: 'Revoke share link',
    description: 'Revoke a public share link',
  })
  @ApiParam({ name: 'shareId', description: 'Share ID' })
  async revokeShare(
    @Param('shareId') shareId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const user = getAuthUser(req);
    await this.publicSharedTasksService.revokeShare(shareId, user.id);
    return { message: 'Share link revoked successfully' };
  }
}
