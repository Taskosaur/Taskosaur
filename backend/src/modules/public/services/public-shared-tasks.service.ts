import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import {
  CreatePublicTaskShareDto,
  PublicTaskShareResponseDto,
  PublicSharedTaskDto,
} from '../dto/public-shared-task.dto';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class PublicSharedTasksService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {}

  /**
   * Create a new public share link for a task
   */
  async createShareLink(
    dto: CreatePublicTaskShareDto,
    userId: string,
  ): Promise<PublicTaskShareResponseDto> {
    // Verify user has access to the task
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
            workspace: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check if user has access (is project member or workspace member)
    const hasAccess =
      task.project.members.length > 0 ||
      task.project.workspace.members.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this task');
    }

    // Generate unique token
    const token = this.generateToken();

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);

    // Create share record
    const share = await this.prisma.publicTaskShare.create({
      data: {
        token,
        expiresAt,
        taskId: dto.taskId,
        createdBy: userId,
      },
    });

    // Generate share URL
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const shareUrl = `${frontendUrl}/public/task/${token}`;

    return {
      id: share.id,
      token: share.token,
      shareUrl,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    };
  }

  /**
   * Get task by public share token
   */
  async getTaskByToken(token: string): Promise<PublicSharedTaskDto> {
    // Find share record
    const share = await this.prisma.publicTaskShare.findUnique({
      where: { token },
      include: {
        task: {
          include: {
            status: {
              select: { name: true, color: true },
            },
            assignees: {
              select: { firstName: true, lastName: true },
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    // Check if revoked
    if (share.revokedAt) {
      throw new NotFoundException('Share link has been revoked');
    }

    // Check if expired
    if (new Date() > share.expiresAt) {
      throw new NotFoundException('Share link has expired');
    }

    // Return minimal task data
    return {
      title: share.task.title,
      description: share.task.description || undefined,
      status: {
        name: share.task.status.name,
        color: share.task.status.color,
      },
      priority: share.task.priority,
      dueDate: share.task.dueDate || undefined,
      assignees: share.task.assignees.map((a) => ({
        firstName: a.firstName,
        lastName: a.lastName,
      })),
      attachments: share.task.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
      })),
    };
  }

  /**
   * Get all active share links for a task
   */
  async getSharesForTask(
    taskId: string,
    userId: string,
  ): Promise<PublicTaskShareResponseDto[]> {
    // Verify user has access to the task
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
            workspace: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const hasAccess =
      task.project.members.length > 0 ||
      task.project.workspace.members.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this task');
    }

    // Get active shares (not revoked, not expired)
    const shares = await this.prisma.publicTaskShare.findMany({
      where: {
        taskId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    return shares.map((share) => ({
      id: share.id,
      token: share.token,
      shareUrl: `${frontendUrl}/public/task/${share.token}`,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    }));
  }

  /**
   * Revoke a share link
   */
  async revokeShare(shareId: string, userId: string): Promise<void> {
    const share = await this.prisma.publicTaskShare.findUnique({
      where: { id: shareId },
      include: {
        task: {
          include: {
            project: {
              include: {
                members: {
                  where: { userId },
                },
                workspace: {
                  include: {
                    members: {
                      where: { userId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const hasAccess =
      share.task.project.members.length > 0 ||
      share.task.project.workspace.members.length > 0;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this share');
    }

    // Set revokedAt timestamp
    await this.prisma.publicTaskShare.update({
      where: { id: shareId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Get presigned URL for attachment
   */
  async getAttachmentUrl(
    token: string,
    attachmentId: string,
  ): Promise<string> {
    // Verify share is valid
    const share = await this.prisma.publicTaskShare.findUnique({
      where: { token },
      include: {
        task: {
          include: {
            attachments: {
              where: { id: attachmentId },
            },
          },
        },
      },
    });

    if (!share || share.revokedAt || new Date() > share.expiresAt) {
      throw new NotFoundException('Share link not found or expired');
    }

    const attachment = share.task.attachments[0];
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Return the URL (assuming it's already a presigned URL or public URL)
    // If URL is not stored (S3 case), generate a presigned URL
    if (!attachment.url) {
      if (attachment.storageKey) {
        return await this.storageService.getFileUrl(attachment.storageKey);
      }
      throw new BadRequestException('Attachment URL not available');
    }

    return attachment.url;
  }

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
