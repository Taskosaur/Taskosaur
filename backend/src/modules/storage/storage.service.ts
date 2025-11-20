// src/modules/storage/storage.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';

@Injectable()
export class StorageService {
  private useS3: boolean;
  private readonly uploadDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    const awsAccessKey = this.configService.get('AWS_ACCESS_KEY_ID');
    const awsSecretKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const awsBucket = this.configService.get('AWS_BUCKET_NAME');
    this.uploadDir = this.configService.get('UPLOAD_DEST', './uploads');
    this.useS3 = false;
    if (awsAccessKey && awsSecretKey && awsBucket) {
      this.checkS3Connection(awsBucket as string)
        .then((connected) => {
          this.useS3 = connected;
          if (!connected && !fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
          }
        })
        .catch(() => {
          this.useS3 = false;
          if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
          }
        });
    } else {
      // fallback to local storage
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    }
  }

  isUsingS3(): boolean {
    return this.useS3;
  }
  private async checkS3Connection(bucketName: string): Promise<boolean> {
    try {
      // Try a simple operation to test credentials
      await this.s3Service.headBucket(bucketName);
      return true;
    } catch {
      console.warn('S3 connection failed, falling back to local storage.');
      return false;
    }
  }

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

  async saveFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ url: string | null; key: string; size: number }> {
    // Sanitize folder and fileName to prevent path injection
    const safeFolder = this.sanitizePathComponent(folder);
    const fileName = file.originalname;
    const safeFileName = this.sanitizePathComponent(fileName);

    const key = `${safeFolder}/${safeFileName}`;
    if (this.useS3) {
      await this.s3Service.uploadFile(file, key);
      return {
        url: null,
        key,
        size: file.size,
      };
    } else {
      const localPath = path.join(this.uploadDir, safeFolder);

      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
      }

      const filePath = path.join(localPath, safeFileName);
      fs.writeFileSync(filePath, file.buffer);

      return {
        url: `/${safeFolder}/${safeFileName}`,
        key: `${safeFolder}/${safeFileName}`,
        size: file.size,
      };
    }
  }

  async deleteFile(key: string, inCloud: boolean): Promise<void> {
    if (inCloud) {
      await this.s3Service.deleteFile(key);
    } else {
      const filePath = path.join(this.uploadDir, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  async getFileUrl(key: string): Promise<string> {
    return await this.s3Service.getGetPresignedUrl(key);
  }
  async streamFromS3(storageKey: string, res: Response): Promise<void> {
    try {
      const stream = await this.s3Service.getFileStream(storageKey);

      // Pipe S3 stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error) => {
        console.error('S3 stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream file from S3' });
        }
      });
    } catch (error) {
      console.error('Failed to get S3 stream:', error);
      throw new NotFoundException('File not found in S3');
    }
  }
  streamFromLocal(filePath: string, res: Response): void {
    // Check if file exists
    const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const normalizedPath = path.normalize(relativePath);
    const localPath = path.resolve(this.uploadDir, normalizedPath);

    // Prevent path traversal attacks by ensuring the resolved path is within uploadDir
    const uploadDirResolved = path.resolve(this.uploadDir);
    if (!localPath.startsWith(uploadDirResolved + path.sep) && localPath !== uploadDirResolved) {
      throw new NotFoundException('Invalid file path');
    }

    if (!fs.existsSync(localPath)) {
      throw new NotFoundException('File not found on server');
    }

    try {
      const fileStream = fs.createReadStream(localPath);

      // Pipe local file stream to response
      fileStream.pipe(res);

      // Handle stream errors
      fileStream.on('error', (error) => {
        console.error('Local file stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream file from local storage' });
        }
      });
    } catch (error) {
      console.error('Failed to create local file stream:', error);
      throw new NotFoundException('Failed to read file');
    }
  }
}
