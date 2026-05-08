import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TaskComment, NotificationType, NotificationPriority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { EmailReplyService } from '../inbox/services/email-reply.service';
import { sanitizeHtml, sanitizeText } from 'src/common/utils/sanitizer.util';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { EmailTemplate, EmailPriority } from '../email/dto/email.dto';
import { ConfigService } from '@nestjs/config';

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const;

const AUTHOR_SELECT_WITH_EMAIL = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const;

@Injectable()
export class TaskCommentsService {
  constructor(
    private prisma: PrismaService,
    private emailReply: EmailReplyService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private getCommentIncludeClause(includeEmail = false) {
    const authorSelect = includeEmail ? AUTHOR_SELECT_WITH_EMAIL : AUTHOR_SELECT;
    return {
      author: {
        select: authorSelect,
      },
      task: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      replies: {
        include: {
          author: {
            select: AUTHOR_SELECT,
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
        orderBy: {
          createdAt: Prisma.SortOrder.asc,
        },
      },
      _count: {
        select: {
          replies: true,
        },
      },
    };
  }

  private async checkAccess(userId: string, taskId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);

    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            workspaceId: true,
            workspace: {
              select: {
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

    const org = await this.prisma.organization.findUnique({
      where: { id: task.project.workspace.organizationId },
      select: { id: true, archive: true },
    });
    if (org?.archive) {
      throw new ForbiddenException('Operation not allowed in an archived organization');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        projectMembers: {
          where: { projectId: task.projectId },
          select: { role: true },
        },
        workspaceMembers: {
          where: { workspaceId: task.project.workspaceId },
          select: { role: true },
        },
        organizationMembers: {
          where: {
            organizationId: task.project.workspace.organizationId,
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
      throw new ForbiddenException('You do not have access to this task');
    }

    return {
      taskId: task.id,
      projectRole: user.projectMembers[0]?.role,
      workspaceRole: user.workspaceMembers[0]?.role,
      organizationRole: user.organizationMembers[0]?.role,
    };
  }

  private async handleNotifications(
    comment: {
      content: string;
      taskId: string;
      author: { firstName: string; lastName?: string | null };
    },
    authorId: string,
    oldContent?: string,
  ) {
    // 1. Fetch Task Details with Participants and Context
    const task = await this.prisma.task.findUnique({
      where: { id: comment.taskId },
      include: {
        assignees: true,
        reporters: true,
        watchers: { include: { user: true } },
        project: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!task) return;

    const organizationId = task.project.workspace.organizationId;
    const notifiedUserIds = new Set<string>();
    notifiedUserIds.add(authorId); // Don't notify author

    // 2. Handle Mentions
    const mentionRegex = /(?:^|\s|>|\[)@([\w.-]+)\b/g;
    const matches = [...comment.content.matchAll(mentionRegex)];
    let usernames = [...new Set(matches.map((m) => m[1]))];

    // Extract UUIDs from mentions in links like [@username](/members/UUID) or <a href="/members/UUID">
    const uuidRegex = /\/members\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
    const uuidMatches = [...comment.content.matchAll(uuidRegex)];
    let userIdsFromMentions = [...new Set(uuidMatches.map((m) => m[1]))];

    // Extract UUIDs from new mention format @[mention:UUID]
    const newMentionRegex =
      /@\[mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;
    const newMentionMatches = [...comment.content.matchAll(newMentionRegex)];
    const newUserIds = [...new Set(newMentionMatches.map((m) => m[1]))];
    userIdsFromMentions = [...new Set([...userIdsFromMentions, ...newUserIds])];

    if (oldContent) {
      const oldMatches = [...oldContent.matchAll(mentionRegex)];
      const oldUsernames = [...new Set(oldMatches.map((m) => m[1]))];
      usernames = usernames.filter((u) => !oldUsernames.includes(u));

      const oldUuidMatches = [...oldContent.matchAll(uuidRegex)];
      const oldNewMentionMatches = [...oldContent.matchAll(newMentionRegex)];
      const oldUserIds = [
        ...new Set([...oldUuidMatches.map((m) => m[1]), ...oldNewMentionMatches.map((m) => m[1])]),
      ];
      // Only keep new user IDs that weren't in the old content
      userIdsFromMentions = userIdsFromMentions.filter((id) => !oldUserIds.includes(id));
    }

    if (usernames.length > 0 || userIdsFromMentions.length > 0) {
      const mentionedUsers = await this.prisma.user.findMany({
        where: {
          OR: [{ username: { in: usernames } }, { id: { in: userIdsFromMentions } }],
        },
        select: { id: true, username: true, email: true, firstName: true, lastName: true },
      });

      const mentionNotifications = mentionedUsers
        .filter((user) => !notifiedUserIds.has(user.id))
        .map((user) => {
          notifiedUserIds.add(user.id);
          const notificationPromise = this.notificationsService.createNotification({
            title: 'You were mentioned',
            message: `${comment.author.firstName} mentioned you in a comment on "${task.title}"`,
            type: NotificationType.MENTION,
            userId: user.id,
            organizationId,
            entityType: 'Task',
            entityId: task.id,
            actionUrl: `/tasks/${task.slug}`,
            priority: NotificationPriority.HIGH,
            createdBy: authorId,
          });
          // 2. Send email notification if user has an email
          let emailPromise = Promise.resolve();
          if (user.email) {
            emailPromise = this.emailService
              .sendEmail({
                to: user.email,
                subject: `You were mentioned in task: ${sanitizeHtml(task.title)}`,
                template: EmailTemplate.MENTION,
                data: {
                  mentioner: {
                    name: `${comment.author.firstName} ${comment.author.lastName || ''}`.trim(),
                  },
                  mentionedUser: {
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                  },
                  entityType: 'comment',
                  entity: {
                    title: sanitizeHtml(task.title),
                    key: task.slug,
                  },
                  content: comment.content
                    .replace(
                      /\[@([\w.-]+)\]\(([^)]+)\)/g,
                      (match: string, username: string, path: string) => {
                        const absoluteUrl = path.startsWith('http')
                          ? path
                          : `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001')}${path.startsWith('/') ? '' : '/'}${path}`;
                        return `[${username}](${absoluteUrl})`;
                      },
                    )
                    .replace(
                      /<a([^>]+href="([^"]+)")([^>]*)>@([\w.-]+)<\/a>/g,
                      (
                        match: string,
                        prefix: string,
                        path: string,
                        suffix: string,
                        username: string,
                      ) => {
                        const absoluteUrl = path.startsWith('http')
                          ? path
                          : `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001')}${path.startsWith('/') ? '' : '/'}${path}`;
                        return `<a href="${absoluteUrl}"${suffix}>${username}</a>`;
                      },
                    ),
                  textContent: sanitizeText(comment.content)
                    .replace(/\[@?([\w.-]+)\]\([^)]+\)/g, '$1')
                    .replace(/&nbsp;/g, ' '),
                  entityUrl: `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/tasks/${task.slug}`,
                },
                priority: EmailPriority.HIGH,
              })
              .catch((error) => {
                console.error(`Failed to send mention email to ${user.email}:`, error);
              });
          }

          return Promise.all([notificationPromise, emailPromise]);
        });

      if (mentionNotifications.length > 0) {
        await Promise.all(mentionNotifications);
      }
    }

    // 3. Notify Assignees, Reporters, Watchers (Task Commented)
    if (!oldContent) {
      const participants = [
        ...task.assignees.map((a) => ({ id: a.userId })),
        ...task.reporters.map((r) => ({ id: r.userId })),
        ...task.watchers.map((w) => ({ id: w.user.id })),
      ];
      for (const participant of participants) {
        if (!notifiedUserIds.has(participant.id)) {
          await this.notificationsService.createNotification({
            title: 'New Comment',
            message: `${comment.author.firstName} commented on "${task.title}"`,
            type: NotificationType.TASK_COMMENTED,
            userId: participant.id,
            organizationId,
            entityType: 'Task',
            entityId: task.id,
            actionUrl: `/tasks/${task.slug}`,
            priority: NotificationPriority.MEDIUM,
            createdBy: authorId,
          });
          notifiedUserIds.add(participant.id);
        }
      }
    }
  }

  async create(createTaskCommentDto: CreateTaskCommentDto, userId: string): Promise<TaskComment> {
    const { taskId, parentCommentId } = createTaskCommentDto;
    const { taskId: resolvedTaskId } = await this.checkAccess(userId, taskId);

    // Verify task exists and is not archived
    const task = await this.prisma.task.findUnique({
      where: { id: resolvedTaskId },
      select: { id: true, title: true, isArchived: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.isArchived) {
      throw new ForbiddenException('Cannot add comments to an archived task');
    }

    // Verify author exists
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: AUTHOR_SELECT,
    });

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    // If replying to a comment, verify parent comment exists and belongs to the same task
    if (parentCommentId) {
      const parentComment = await this.prisma.taskComment.findUnique({
        where: { id: parentCommentId },
        select: { id: true, taskId: true },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.taskId !== resolvedTaskId) {
        throw new BadRequestException('Parent comment must belong to the same task');
      }
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        ...createTaskCommentDto,
        taskId: resolvedTaskId,
        authorId: userId,
        content: sanitizeHtml(createTaskCommentDto.content),
      },
      include: {
        author: {
          select: AUTHOR_SELECT_WITH_EMAIL,
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
            allowEmailReplies: true,
          },
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            author: {
              select: AUTHOR_SELECT,
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Handle mentions and notifications
    await this.handleNotifications(comment, userId);

    if (comment.task.allowEmailReplies) {
      await this.emailReply.sendCommentAsEmail(comment.id);
    }

    return comment;
  }

  async findAll(
    taskId: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
    sort: 'asc' | 'desc' = 'desc',
  ): Promise<{
    data: TaskComment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    const { taskId: resolvedTaskId } = await this.checkAccess(userId, taskId);

    const whereClause: any = {};
    if (resolvedTaskId) {
      whereClause.taskId = resolvedTaskId;
      // Only get top-level comments (not replies)
      whereClause.parentCommentId = null;
    }

    // Get total count for pagination
    const total = await this.prisma.taskComment.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const data = await this.prisma.taskComment.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: this.getCommentIncludeClause(true), // includeEmail=true for email in author
      orderBy: {
        createdAt: sort,
      },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async findOne(id: string, userId: string): Promise<TaskComment> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      include: {
        author: {
          select: AUTHOR_SELECT_WITH_EMAIL,
        },
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
        parentComment: {
          select: {
            id: true,
            content: true,
            author: {
              select: AUTHOR_SELECT,
            },
            createdAt: true,
          },
        },
        replies: {
          include: {
            author: {
              select: AUTHOR_SELECT,
            },
          },
          orderBy: {
            createdAt: Prisma.SortOrder.asc,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.checkAccess(userId, comment.taskId);

    return comment;
  }

  async getReplies(commentId: string, userId: string): Promise<TaskComment[]> {
    // Verify parent comment exists
    const parentComment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      select: { id: true, taskId: true },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

    await this.checkAccess(userId, parentComment.taskId);

    return this.prisma.taskComment.findMany({
      where: { parentCommentId: commentId },
      include: {
        author: {
          select: AUTHOR_SELECT,
        },
        replies: {
          include: {
            author: {
              select: AUTHOR_SELECT,
            },
          },
          orderBy: {
            createdAt: Prisma.SortOrder.asc,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: Prisma.SortOrder.asc,
      },
    });
  }

  async update(
    id: string,
    updateTaskCommentDto: UpdateTaskCommentDto,
    userId: string,
  ): Promise<TaskComment> {
    // Verify comment exists and user is the author
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      select: { id: true, authorId: true, taskId: true, content: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user has access to the project
    await this.checkAccess(userId, comment.taskId);

    // Verify task is not archived
    const task = await this.prisma.task.findUnique({
      where: { id: comment.taskId },
      select: { isArchived: true },
    });

    if (task && task.isArchived) {
      throw new ForbiddenException('Cannot update comments on an archived task');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updatedComment = await this.prisma.taskComment.update({
      where: { id },
      data: {
        ...updateTaskCommentDto,
        content: sanitizeHtml(updateTaskCommentDto.content),
      },
      include: {
        author: {
          select: AUTHOR_SELECT,
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Handle any newly added mentions during the edit
    await this.handleNotifications(updatedComment, userId, comment.content);

    return updatedComment;
  }

  async remove(id: string, userId: string): Promise<void> {
    // Verify comment exists and user is the author
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      select: { id: true, authorId: true, taskId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user has access to the project
    const { projectRole, workspaceRole, organizationRole } = await this.checkAccess(
      userId,
      comment.taskId,
    );

    const isAdmin =
      ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(projectRole) ||
      ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(workspaceRole) ||
      ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(organizationRole);

    if (comment.authorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Delete comment and all its replies (cascade delete is handled by Prisma schema)
    await this.prisma.taskComment.delete({
      where: { id },
    });
  }

  async getTaskCommentTree(taskId: string, userId: string): Promise<TaskComment[]> {
    const { taskId: resolvedTaskId } = await this.checkAccess(userId, taskId);

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: resolvedTaskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Get all comments for the task in a hierarchical structure
    return this.prisma.taskComment.findMany({
      where: {
        taskId: resolvedTaskId,
        parentCommentId: null, // Only top-level comments
      },
      include: {
        author: {
          select: AUTHOR_SELECT,
        },
        replies: {
          include: {
            author: {
              select: AUTHOR_SELECT,
            },
          },
          orderBy: {
            createdAt: Prisma.SortOrder.asc,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: Prisma.SortOrder.desc,
      },
    });
  }

  /**
   * GitHub-style pagination
   */
  async findWithMiddlePagination(
    taskId: string,
    userId: string,
    page: number = 1,
    limit: number = 5,
    oldestCount: number = 2,
    newestCount: number = 2,
  ): Promise<{
    data: TaskComment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    loadedCount: number; // How many middle comments have been loaded so far
  }> {
    const { taskId: resolvedTaskId } = await this.checkAccess(userId, taskId);

    const whereClause: any = {
      taskId: resolvedTaskId,
      parentCommentId: null, // Only top-level comments
    };

    // Get total count
    const total = await this.prisma.taskComment.count({
      where: whereClause,
    });

    const includeClause = this.getCommentIncludeClause(true);

    let data: TaskComment[] = [];
    let loadedCount = 0;

    if (page === 1) {
      // Initial load: Get oldest + newest comments
      if (total <= oldestCount + newestCount) {
        // If total comments fit in oldest + newest, just return all
        data = await this.prisma.taskComment.findMany({
          where: whereClause,
          include: includeClause,
          orderBy: { createdAt: 'asc' as const },
        });
      } else {
        // Get oldest comments
        const oldest = await this.prisma.taskComment.findMany({
          where: whereClause,
          take: oldestCount,
          include: includeClause,
          orderBy: { createdAt: 'asc' as const },
        });

        // Get newest comments
        const newest = await this.prisma.taskComment.findMany({
          where: whereClause,
          take: newestCount,
          include: includeClause,
          orderBy: { createdAt: 'desc' as const },
        });

        // Combine: oldest first, then newest (reversed to maintain chronological order)
        data = [...oldest, ...newest.reverse()];
      }
    } else {
      // Subsequent loads: Get middle comments
      // Ensure we don't accidentally fetch into the "newest" section
      const middleCount = total - oldestCount - newestCount;
      const endIndex = total - newestCount;
      const skip = oldestCount + (page - 2) * limit;
      const remainingMiddle = Math.max(0, endIndex - skip);
      const take = Math.min(limit, remainingMiddle);

      if (take > 0) {
        data = await this.prisma.taskComment.findMany({
          where: whereClause,
          skip,
          take,
          include: includeClause,
          orderBy: { createdAt: 'asc' as const },
        });
      }

      loadedCount = Math.min((page - 1) * limit, middleCount);
    }

    const middleCount = Math.max(0, total - oldestCount - newestCount);
    const middlePages = Math.ceil(middleCount / limit);
    const totalPages = middlePages + 1; // +1 for the initial page
    const hasMore = page < totalPages;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasMore,
      loadedCount,
    };
  }
}
