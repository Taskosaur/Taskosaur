import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TaskAttachment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import { Response } from 'express';

@Injectable()
export class TaskAttachmentsService {
  private readonly uploadPath = process.env.UPLOAD_DEST || '../uploads';

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async create(file: Express.Multer.File, taskId: string, userId: string): Promise<TaskAttachment> {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        slug: true,
        project: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: {
                id: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Validate file size (limit to 50MB)
    const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxFileSize) {
      throw new BadRequestException('File size cannot exceed 50MB');
    }

    try {
      // Use StorageService to save file (handles both S3 and local storage)
      const { url, key, size } = await this.storageService.saveFile(file, `tasks/${taskId}`);

      // Create attachment record in database
      const attachment = await this.prisma.taskAttachment.create({
        data: {
          taskId: taskId,
          fileName: file.originalname,
          fileSize: size,
          mimeType: file.mimetype,
          url: url, // Will be null for S3, static path for local
          storageKey: key, // Store key for both S3 and local
          createdBy: userId,
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              slug: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      return attachment;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async findAll(taskId?: string): Promise<any[]> {
    const whereClause = taskId ? { taskId } : {};

    const attachments = await this.prisma.taskAttachment.findMany({
      where: whereClause,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate presigned URLs for S3 attachments
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        // If URL is null (S3), generate presigned URL; otherwise use stored URL
        const viewUrl = attachment.url
          ? attachment.url
          : attachment.storageKey && (await this.storageService.getFileUrl(attachment.storageKey));

        return {
          ...attachment,
          viewUrl, // Add presigned/static URL for viewing
        };
      }),
    );

    return attachmentsWithUrls;
  }

  async findOne(id: string): Promise<any> {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            taskNumber: true,
            priority: true,
            type: true,
            status: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    organization: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Task attachment not found');
    }

    // Generate presigned URL for viewing
    const viewUrl = attachment.url
      ? attachment.url
      : attachment.storageKey && (await this.storageService.getFileUrl(attachment.storageKey));

    return {
      ...attachment,
      viewUrl,
    };
  }
  async streamFile(
    attachmentId: string,
    res: Response,
    isDownload: boolean = false,
  ): Promise<void> {
    // Get attachment details
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        url: true,
        storageKey: true,
      },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // For preview, only allow certain file types
    if (!isDownload) {
      const previewableMimeTypes = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',

        // Videos
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime', // .mov

        // Documents / Text
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
    }

    // Set response headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize);
    res.setHeader(
      'Content-Disposition',
      isDownload
        ? `attachment; filename="${attachment.fileName}"`
        : `inline; filename="${attachment.fileName}"`,
    );

    // Check if using S3 or local storage
    if (!attachment.url && attachment.storageKey) {
      // Stream from S3
      await this.storageService.streamFromS3(attachment.storageKey, res);
    } else if (attachment.url) {
      // Stream from local storage
      this.storageService.streamFromLocal(attachment.url, res);
    } else {
      throw new NotFoundException('Attachment not found');
    }
  }

  async getTaskAttachments(taskId: string): Promise<any[]> {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate presigned URLs for S3 attachments or return static URLs for local
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        // If URL is null (S3), generate presigned URL; otherwise use stored URL
        const viewUrl = attachment.url
          ? attachment.url
          : attachment.storageKey && (await this.storageService.getFileUrl(attachment.storageKey));

        return {
          ...attachment,
          viewUrl, // Add viewUrl for frontend consumption
        };
      }),
    );

    return attachmentsWithUrls;
  }

  async remove(id: string, requestUserId: string): Promise<TaskAttachment> {
    // Get attachment info
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            project: {
              select: {
                id: true,
                workspace: {
                  select: {
                    id: true,
                    organizationId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Task attachment not found');
    }

    // Check if user has permission to delete (project member, workspace member, or org member)
    const user = await this.prisma.user.findUnique({
      where: { id: requestUserId },
      select: {
        id: true,
        projectMembers: {
          where: { projectId: attachment.task.project.id },
          select: { role: true },
        },
        workspaceMembers: {
          where: { workspaceId: attachment.task.project.workspace.id },
          select: { role: true },
        },
        organizationMembers: {
          where: {
            organizationId: attachment.task.project.workspace.organizationId,
          },
          select: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasAccess =
      user.projectMembers.length > 0 ||
      user.workspaceMembers.length > 0 ||
      user.organizationMembers.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to delete this attachment');
    }

    // Delete the file from filesystem
    try {
      if (fs.existsSync(attachment.filePath || '')) {
        fs.unlinkSync(attachment.filePath || '');
      }
    } catch (error) {
      console.error('Error deleting file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await this.prisma.taskAttachment.delete({
      where: { id },
    });
    return attachment;
  }

  async getAttachmentStats(taskId?: string): Promise<any> {
    const whereClause = taskId ? { taskId } : {};

    const [totalAttachments, totalSize, attachmentsByType, recentUploads] = await Promise.all([
      // Total attachments count
      this.prisma.taskAttachment.count({
        where: whereClause,
      }),

      // Total file size
      this.prisma.taskAttachment.aggregate({
        where: whereClause,
        _sum: { fileSize: true },
      }),

      // Attachments by MIME type
      this.prisma.taskAttachment.groupBy({
        by: ['mimeType'],
        where: whereClause,
        _count: { mimeType: true },
        _sum: { fileSize: true },
      }),

      // Recent uploads (last 7 days)
      this.prisma.taskAttachment.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Group by file category
    const fileCategories = attachmentsByType.reduce(
      (acc, item) => {
        let category = 'Other';

        if (item.mimeType.startsWith('image/')) {
          category = 'Images';
        } else if (
          item.mimeType.includes('pdf') ||
          item.mimeType.includes('document') ||
          item.mimeType.includes('word')
        ) {
          category = 'Documents';
        } else if (item.mimeType.startsWith('text/')) {
          category = 'Text Files';
        } else if (
          item.mimeType.includes('zip') ||
          item.mimeType.includes('rar') ||
          item.mimeType.includes('compressed')
        ) {
          category = 'Archives';
        }

        if (!acc[category]) {
          acc[category] = { count: 0, totalSize: 0 };
        }

        acc[category].count += item._count.mimeType;
        acc[category].totalSize += item._sum.fileSize || 0;

        return acc;
      },
      {} as Record<string, { count: number; totalSize: number }>,
    );

    return {
      totalAttachments,
      totalSizeBytes: totalSize._sum.fileSize || 0,
      totalSizeMB: Math.round(((totalSize._sum.fileSize || 0) / (1024 * 1024)) * 100) / 100,
      fileCategories,
      recentUploads,
    };
  }

  // Helper method to generate safe file path
  generateFilePath(originalName: string, taskId: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    // const _fileExtension = path.extname(originalName);
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${randomString}_${sanitizedName}`;

    // Create task-specific directory
    const taskDir = path.join(this.uploadPath, taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    return path.join(taskDir, fileName);
  }

  // Helper method to validate and get file info
  validateFile(file: Express.Multer.File): {
    isValid: boolean;
    error?: string;
  } {
    // File size validation (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return { isValid: false, error: 'File size exceeds 50MB limit' };
    }

    // File type validation
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',

      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Text & Data
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/json',
      'application/xml',
      'text/html',
      'text/css',
      'text/javascript',

      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',

      // Videos
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { isValid: false, error: 'File type not allowed' };
    }

    return { isValid: true };
  }
}
