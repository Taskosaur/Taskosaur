import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TaskComment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { EmailReplyService } from '../inbox/services/email-reply.service';
import { sanitizeHtml } from 'src/common/utils/sanitizer.util';

@Injectable()
export class TaskCommentsService {
  constructor(
    private prisma: PrismaService,
    private emailReply: EmailReplyService,
  ) {}

  async create(createTaskCommentDto: CreateTaskCommentDto): Promise<TaskComment> {
    const { taskId, authorId, parentCommentId } = createTaskCommentDto;

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify author exists
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, firstName: true, lastName: true },
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

      if (parentComment.taskId !== taskId) {
        throw new BadRequestException('Parent comment must belong to the same task');
      }
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        ...createTaskCommentDto,
        content: sanitizeHtml(createTaskCommentDto.content),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
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
    if (comment.task.allowEmailReplies) {
      await this.emailReply.sendCommentAsEmail(comment.id);
    }

    return comment;
  }

  async findAll(
    taskId?: string,
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
    const whereClause: any = {};
    if (taskId) {
      whereClause.taskId = taskId;
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
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
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

  async findOne(id: string): Promise<TaskComment> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            createdAt: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
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

    return comment;
  }

  async getReplies(commentId: string): Promise<TaskComment[]> {
    // Verify parent comment exists
    const parentComment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.taskComment.findMany({
      where: { parentCommentId: commentId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
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
      select: { id: true, authorId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
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

    return updatedComment;
  }

  async remove(id: string, userId: string): Promise<void> {
    // Verify comment exists and user is the author
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Delete comment and all its replies (cascade delete is handled by Prisma schema)
    await this.prisma.taskComment.delete({
      where: { id },
    });
  }

  async getTaskCommentTree(taskId: string): Promise<TaskComment[]> {
    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Get all comments for the task in a hierarchical structure
    return this.prisma.taskComment.findMany({
      where: {
        taskId,
        parentCommentId: null, // Only top-level comments
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * GitHub-style pagination
   */
  async findWithMiddlePagination(
    taskId: string,
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
    const whereClause: any = {
      taskId,
      parentCommentId: null, // Only top-level comments
    };

    // Get total count
    const total = await this.prisma.taskComment.count({
      where: whereClause,
    });

    const includeClause = {
      author: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc' as const,
        },
      },
      _count: {
        select: {
          replies: true,
        },
      },
    };

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
