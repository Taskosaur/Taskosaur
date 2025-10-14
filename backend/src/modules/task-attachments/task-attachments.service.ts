import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TaskAttachment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTaskAttachmentDto,
  UploadTaskAttachmentDto,
} from './dto/create-task-attachment.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TaskAttachmentsService {
  private readonly uploadPath = process.env.UPLOAD_DEST || './uploads';

  constructor(private prisma: PrismaService) {
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async create(
    createTaskAttachmentDto: CreateTaskAttachmentDto,
    userId: string,
  ): Promise<TaskAttachment> {
    const { taskId } = createTaskAttachmentDto;

    // Verify task exists and user has access
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
    if (createTaskAttachmentDto.fileSize > maxFileSize) {
      throw new BadRequestException('File size cannot exceed 50MB');
    }

    // Validate file type (basic security check)
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
      // Text files
      'text/plain',
      'text/csv',
      'text/markdown',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // Code files
      'application/json',
      'application/xml',
      'text/html',
      'text/css',
      'text/javascript',
    ];

    if (!allowedMimeTypes.includes(createTaskAttachmentDto.mimeType)) {
      throw new BadRequestException('File type not allowed');
    }

    return this.prisma.taskAttachment.create({
      data: { ...createTaskAttachmentDto, createdBy: userId },
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
  }

  async findAll(taskId?: string): Promise<TaskAttachment[]> {
    const whereClause = taskId ? { taskId } : {};

    return this.prisma.taskAttachment.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<TaskAttachment> {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
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
      },
    });

    if (!attachment) {
      throw new NotFoundException('Task attachment not found');
    }

    return attachment;
  }

  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
      throw new ForbiddenException(
        'You do not have permission to delete this attachment',
      );
    }

    // Delete the file from filesystem
    try {
      if (fs.existsSync(attachment.filePath)) {
        fs.unlinkSync(attachment.filePath);
      }
    } catch (error) {
      console.error('Error deleting file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await this.prisma.taskAttachment.delete({
      where: { id },
    });
    return attachment
  }

  async getAttachmentStats(taskId?: string): Promise<any> {
    const whereClause = taskId ? { taskId } : {};

    const [totalAttachments, totalSize, attachmentsByType, recentUploads] =
      await Promise.all([
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
      totalSizeMB:
        Math.round(((totalSize._sum.fileSize || 0) / (1024 * 1024)) * 100) /
        100,
      fileCategories,
      recentUploads,
    };
  }

  // Helper method to generate safe file path
  generateFilePath(originalName: string, taskId: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = path.extname(originalName);
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

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { isValid: false, error: 'File type not allowed' };
    }

    return { isValid: true };
  }
}
