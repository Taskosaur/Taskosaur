// src/modules/files/files.controller.ts
import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { join, resolve } from 'path';
import { createReadStream, existsSync } from 'fs';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@Controller('uploads')
export class FilesController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Sanitize path component to prevent path traversal attacks
   */
  private sanitizePathComponent(component: string): string {
    if (!component || typeof component !== 'string') {
      throw new BadRequestException('Invalid path component');
    }
    // Remove any path traversal attempts and directory separators
    const sanitized = component.replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '');
    if (sanitized !== component) {
      throw new BadRequestException('Invalid characters in path');
    }
    return sanitized;
  }

  @Get('tasks/:taskId/:filename')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Serve task attachment file' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiParam({ name: 'filename', description: 'Filename' })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  serveTaskFile(
    @Param('taskId') taskId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sanitize path components to prevent path injection
    const safeTaskId = this.sanitizePathComponent(taskId);
    const safeFilename = this.sanitizePathComponent(filename);

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = join(uploadDir, 'tasks', safeTaskId, safeFilename);

    // Prevent path traversal by ensuring the resolved path is within uploadDir
    const uploadDirResolved = resolve(uploadDir);
    const filePathResolved = resolve(filePath);
    if (!filePathResolved.startsWith(uploadDirResolved)) {
      throw new BadRequestException('Invalid file path');
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Stream the file
    const fileStream = createReadStream(filePath);

    // Set appropriate headers
    res.set({
      'Content-Type': this.getMimeType(safeFilename),
      'Content-Disposition': `inline; filename="${safeFilename}"`,
    });

    fileStream.pipe(res);
  }
  @Post('upload/:folder')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload and save a file to S3 or Local Storage' })
  @ApiParam({ name: 'folder', example: 'tasks', description: 'Target folder name' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload file',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Param('folder') folder: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Sanitize folder parameter to prevent path injection
    const safeFolder = this.sanitizePathComponent(folder);

    const savedFile = await this.storageService.saveFile(file, safeFolder);

    return {
      message: 'File uploaded successfully',
      ...savedFile,
      inCloud: this.storageService.isUsingS3(),
    };
  }
  @Public()
  @Get(':folder/:filename')
  @ApiOperation({ summary: 'Serve file from storage' })
  @ApiParam({ name: 'folder', description: 'Folder name (e.g., avatars, tasks)' })
  @ApiParam({ name: 'filename', description: 'Filename' })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sanitize path components to prevent path injection
    const safeFolder = this.sanitizePathComponent(folder);
    const safeFilename = this.sanitizePathComponent(filename);

    const key = `${safeFolder}/${safeFilename}`;
    // Check if using S3 or local storage
    if (this.storageService.isUsingS3()) {
      // For S3, stream the file directly
      await this.storageService.streamFromS3(key, res);
    } else {
      // For local storage, use the existing method
      this.storageService.streamFromLocal(key, res);
    }
  }
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
