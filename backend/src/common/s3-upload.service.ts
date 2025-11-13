import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { lookup } from 'mime-types';

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.AWS_BUCKET_NAME!;
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    filename?: string,
    contentType?: string,
  ): Promise<{ url: string; key: string }> {
    try {
      // Determine content type
      const mimeType =
        contentType || (filename ? lookup(filename) || null : null) || 'application/octet-stream';

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

      this.logger.log(`File uploaded successfully: ${key}`);
      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3:`, error.message);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async uploadEmailAttachment(
    messageId: string,
    attachment: any,
  ): Promise<{ url: string; key: string; size: number }> {
    try {
      // Generate unique key for the attachment
      const timestamp = Date.now();
      const sanitizedFilename = this.sanitizeFilename(
        (attachment.filename || 'attachment') as string,
      );
      const key = `inbox-attachments/${messageId}/${timestamp}-${sanitizedFilename}`;

      // Get buffer from attachment
      const buffer: Buffer = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content);

      const result = await this.uploadBuffer(
        buffer,
        key,
        attachment.filename as string | undefined,
        attachment.contentType as string | undefined,
      );

      return {
        ...result,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload email attachment:`, error.message);
      throw error;
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL:`, error.message);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[^\w\s.-]/g, '') // Keep only word chars, spaces, dots, hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .toLowerCase();
  }

  generateAttachmentKey(messageId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `inbox-attachments/${messageId}/${timestamp}-${sanitizedFilename}`;
  }
}
