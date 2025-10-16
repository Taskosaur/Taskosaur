import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TaskAttachmentsService } from './task-attachments.service';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LogActivity } from 'src/common/decorator/log-activity.decorator';

@ApiTags('Task Attachments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-attachments')
export class TaskAttachmentsController {
  constructor(
    private readonly taskAttachmentsService: TaskAttachmentsService,
  ) { }

  // @Post()
  // @ApiOperation({ summary: 'Create a task attachment record manually' })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Task attachment created successfully',
  // })
  // @ApiResponse({ status: 404, description: 'Task not found' })
  // @ApiResponse({ status: 400, description: 'Invalid file data' })
  // @ApiBody({ type: CreateTaskAttachmentDto })
  // create(
  //   @Body() createTaskAttachmentDto: CreateTaskAttachmentDto,
  //   @CurrentUser() user: any,
  // ) {
  //   return this.taskAttachmentsService.create(createTaskAttachmentDto, user.id);
  // }

  @Post('upload/:taskId')
  @ApiOperation({ summary: 'Upload a file attachment to a task' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'taskId', description: 'Task ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fileName: 'document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        url: '/uploads/tasks/123/document.pdf',
        storageKey: 'tasks/123/550e8400-e29b-41d4-a716-446655440000.pdf',
        createdBy: '223e4567-e89b-12d3-a456-426614174001',
        createdAt: '2025-10-16T06:38:00.000Z',
        task: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Implement authentication',
          slug: 'PROJECT-1',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'text/csv',
          'text/markdown',
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          'application/json',
          'application/xml',
          'text/html',
          'text/css',
          'text/javascript',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('File type not allowed'), false);
        }
      },
    }),
  )
  @LogActivity({
    type: 'TASK_ATTACHMENT_ADDED',
    entityType: 'TaskAttachment',
    description: 'Added attachment to task',
    includeNewValue: true,
    entityIdName: 'taskId',
  })
  async uploadFile(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.taskAttachmentsService.create(file, taskId, user.id);
  }

  @Get()
  findAll(@Query('taskId') taskId?: string) {
    return this.taskAttachmentsService.findAll(taskId);
  }

  @Get('stats')
  getAttachmentStats(@Query('taskId') taskId?: string) {
    return this.taskAttachmentsService.getAttachmentStats(taskId);
  }

  @Get('task/:taskId')
  getTaskAttachments(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskAttachmentsService.getTaskAttachments(taskId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskAttachmentsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'File download' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    try {
      await this.taskAttachmentsService.streamFile(id, res, true);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to download file');
    }
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview file' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 400, description: 'File type not previewable' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async previewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    try {
      await this.taskAttachmentsService.streamFile(id, res, false);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to stream file');
    }
  }

  @Delete(':id')
  @LogActivity({
    type: 'TASK_ATTACHMENT_REMOVED',
    entityType: 'Task Attchment',
    description: 'Added attachment to task',
    includeNewValue: true,
    entityIdName: 'taskId',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.taskAttachmentsService.remove(id, requestUserId);
  }
}
