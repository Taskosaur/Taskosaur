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
      data: createTaskCommentDto,
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

  findAll(taskId?: string): Promise<TaskComment[]> {
    const whereClause: any = {};
    if (taskId) {
      whereClause.taskId = taskId;
      // Only get top-level comments (not replies)
      whereClause.parentCommentId = null;
    }

    return this.prisma.taskComment.findMany({
      where: whereClause,
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
        createdAt: 'desc',
      },
    });
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
      data: updateTaskCommentDto,
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
}
