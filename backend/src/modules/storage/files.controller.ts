// src/modules/files/files.controller.ts
import { Controller, Get, Param, Res, NotFoundException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class FilesController {
  @Get('tasks/:taskId/:filename')
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
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = join(uploadDir, 'tasks', taskId, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Stream the file
    const fileStream = createReadStream(filePath);

    // Set appropriate headers
    res.set({
      'Content-Type': this.getMimeType(filename),
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    fileStream.pipe(res);
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
