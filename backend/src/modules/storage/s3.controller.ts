// src/modules/s3/s3.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('s3')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Get('presigned-put-url')
  @ApiOperation({ summary: 'Get presigned PUT URL to upload a file' })
  @ApiQuery({
    name: 'key',
    description: 'S3 object key (path/filename)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned PUT URL',
    schema: { example: { url: 'https://...' } },
  })
  async getPresignedPutUrl(@Query('key') key: string) {
    const url = await this.s3Service.getPutPresignedUrl(key);
    return { url };
  }

  @Get('presigned-get-url')
  @ApiOperation({
    summary: 'Get presigned GET URL to download or access a file',
  })
  @ApiQuery({
    name: 'key',
    description: 'S3 object key (path/filename)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned GET URL',
    schema: { example: { url: 'https://...' } },
  })
  async getPresignedGetUrl(@Query('key') key: string) {
    const url = await this.s3Service.getGetPresignedUrl(key);
    return { url };
  }
}
