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

@ApiTags('Task Attachments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('task-attachments')
export class TaskAttachmentsController {
  constructor(
    private readonly taskAttachmentsService: TaskAttachmentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a task attachment record manually' })
  @ApiResponse({
    status: 201,
    description: 'Task attachment created successfully',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid file data' })
  @ApiBody({ type: CreateTaskAttachmentDto })
  create(
    @Body() createTaskAttachmentDto: CreateTaskAttachmentDto,
    @CurrentUser() user: any,
  ) {
    return this.taskAttachmentsService.create(createTaskAttachmentDto, user.id);
  }

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
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const taskId = req.params.taskId;
          const uploadPath = process.env.UPLOAD_DEST || './uploads';
          const taskDir = path.join(uploadPath, taskId);

          // Create directory if it doesn't exist
          if (!fs.existsSync(taskDir)) {
            fs.mkdirSync(taskDir, { recursive: true });
          }

          cb(null, taskDir);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 15);
          const fileExtension = path.extname(file.originalname);
          const sanitizedName = file.originalname.replace(
            /[^a-zA-Z0-9.-]/g,
            '_',
          );
          const fileName = `${timestamp}_${randomString}_${sanitizedName}`;
          cb(null, fileName);
        },
      }),
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
  async uploadFile(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const createTaskAttachmentDto: CreateTaskAttachmentDto = {
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      taskId,
    };

    return this.taskAttachmentsService.create(createTaskAttachmentDto, user.id);
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
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.taskAttachmentsService.findOne(id);

    if (!fs.existsSync(attachment.filePath)) {
      throw new BadRequestException('File not found on server');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.fileName}"`,
    );
    res.setHeader('Content-Length', attachment.fileSize);

    const fileStream = fs.createReadStream(attachment.filePath);
    fileStream.pipe(res);
  }

  @Get(':id/preview')
  async previewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.taskAttachmentsService.findOne(id);

    if (!fs.existsSync(attachment.filePath)) {
      throw new BadRequestException('File not found on server');
    }

    // Only allow preview for certain file types
    const previewableMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/html',
      'text/markdown',
      'application/json',
      'application/xml',
      'text/css',
      'text/javascript',
    ];

    if (!previewableMimeTypes.includes(attachment.mimeType)) {
      throw new BadRequestException('File type not previewable');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.fileName}"`,
    );

    const fileStream = fs.createReadStream(attachment.filePath);
    fileStream.pipe(res);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.taskAttachmentsService.remove(id, requestUserId);
  }
}
