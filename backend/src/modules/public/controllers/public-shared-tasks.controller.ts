import { Controller, Get, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PublicSharedTasksService } from '../services/public-shared-tasks.service';
import { PublicSharedTaskDto } from '../dto/public-shared-task.dto';
import { PublicRateLimitGuard, RateLimit } from '../guards/public-rate-limit.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Public Shared Tasks')
@Controller('public/tasks')
@UseGuards(PublicRateLimitGuard)
@Public()
export class PublicSharedTasksController {
  constructor(
    private readonly publicSharedTasksService: PublicSharedTasksService,
  ) {}

  @Get(':token')
  @RateLimit(10,60000)
  @ApiOperation({
    summary: 'Get shared task by token',
    description: 'Get public task details using share token (no auth required)',
  })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiResponse({ type: PublicSharedTaskDto })
  async getSharedTask(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<Response> {
    const task = await this.publicSharedTasksService.getTaskByToken(token);

    // Add security headers
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.json(task);
  }

  @Get(':token/attachments/:attachmentId')
  @RateLimit(5,60000)
  @ApiOperation({
    summary: 'Get attachment URL',
    description: 'Get presigned URL for task attachment',
  })
  @ApiParam({ name: 'token', description: 'Share token' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  async getAttachmentUrl(
    @Param('token') token: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ): Promise<Response> {
    const url =
      await this.publicSharedTasksService.getAttachmentUrl(
        token,
        attachmentId,
      );

    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    return res.json({ url });
  }
}
