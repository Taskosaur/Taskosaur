// src/modules/s3/s3.module.ts
import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { StorageService } from './storage.service';
import { FilesController } from './files.controller';

@Module({
  providers: [S3Service, StorageService],
  controllers: [S3Controller, FilesController],
  exports: [S3Service, StorageService],
})
export class S3Module {}
