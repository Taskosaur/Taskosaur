// Updated S3Service with upload and delete methods
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.AWS_BUCKET_NAME!;
  }

  async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    const contentType = mime.getType(file.originalname) || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    // Return the public URL or generate a signed URL
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async getPutPresignedUrl(key: string): Promise<string> {
    const contentType = mime.getType(key) || 'application/octet-stream';
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: 30 * 60,
    });
    return url;
  }

  async getGetPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 30,
    });
    return url;
  }
  async headBucket(bucketName: string): Promise<void> {
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await this.s3Client.send(command);
  }
  async getFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // AWS SDK v3 returns Body as a readable stream
      return response.Body as Readable;
    } catch (error) {
      console.error('Failed to get S3 file stream:', error);
      throw new InternalServerErrorException('Failed to retrieve file from S3');
    }
  }
}
