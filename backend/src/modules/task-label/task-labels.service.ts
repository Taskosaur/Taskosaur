import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TaskLabel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignTaskLabelDto, AssignMultipleTaskLabelsDto } from './dto/create-task-labels.dto';
@Injectable()
export class TaskLabelsService {
  constructor(private prisma: PrismaService) {}

  async assignLabel(assignTaskLabelDto: AssignTaskLabelDto, userId: string): Promise<TaskLabel> {
    const { taskId, labelId } = assignTaskLabelDto;

    // Verify task exists and user has access to it
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
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

    // Check if user has access to the project's workspace
    const workspaceAccess = task.project.workspace.members;
    if (workspaceAccess.length === 0) {
      throw new ForbiddenException('You do not have permission to modify labels in this project');
    }

    if (task.project.archive) {
      throw new BadRequestException('Cannot assign label to task in archived project');
    }

    // Verify label exists and belongs to the same workspace or is inherited
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
      include: {
        project: { select: { workspaceId: true } },
        workspaceLabels: { where: { workspaceId: task.project.workspaceId } },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (
      task.project.workspaceId !== label.project.workspaceId &&
      label.workspaceLabels.length === 0
    ) {
      throw new BadRequestException('Label does not belong to the same workspace as the task');
    }

    // Check if label is already assigned to the task
    const existingAssignment = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId: task.id,
          labelId,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Label is already assigned to this task');
    }

    return this.prisma.$transaction(async (tx) => {
      const taskLabel = await tx.taskLabel.create({
        data: {
          taskId: task.id,
          labelId,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          label: {
            select: {
              id: true,
              name: true,
              color: true,
              description: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      });

      // Track label at workspace level
      await tx.workspaceLabel.upsert({
        where: {
          workspaceId_labelId: {
            workspaceId: task.project.workspaceId,
            labelId,
          },
        },
        update: {},
        create: {
          workspaceId: task.project.workspaceId,
          labelId,
        },
      });

      return taskLabel;
    });
  }

  async assignMultiple(
    assignMultipleTaskLabelsDto: AssignMultipleTaskLabelsDto,
    userId: string,
  ): Promise<TaskLabel[]> {
    const { taskId, labelIds } = assignMultipleTaskLabelsDto;

    if (!labelIds || labelIds.length === 0) {
      throw new BadRequestException('labelIds array cannot be empty');
    }

    // Verify task exists and user has access to it
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
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

    // Check if user has access to the project's workspace
    const workspaceAccess = task.project.workspace.members;
    if (workspaceAccess.length === 0) {
      throw new ForbiddenException('You do not have permission to modify labels in this project');
    }

    if (task.project.archive) {
      throw new BadRequestException('Cannot assign labels to task in archived project');
    }

    // Verify all labels exist and belong to the same workspace or are inherited
    const labels = await this.prisma.label.findMany({
      where: {
        id: { in: labelIds },
        OR: [
          { project: { workspaceId: task.project.workspaceId } },
          { workspaceLabels: { some: { workspaceId: task.project.workspaceId } } },
        ],
      },
      select: { id: true },
    });

    if (labels.length !== labelIds.length) {
      throw new NotFoundException(
        'One or more labels not found or do not belong to the same workspace',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Remove existing labels
      await tx.taskLabel.deleteMany({
        where: { taskId: task.id },
      });

      // Add new labels
      const taskLabels = await Promise.all(
        labelIds.map((labelId) =>
          tx.taskLabel.create({
            data: {
              taskId: task.id,
              labelId,
              createdBy: userId,
              updatedBy: userId,
            },
            include: {
              label: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  description: true,
                },
              },
              task: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          }),
        ),
      );

      // Track used labels at the workspace level
      await tx.workspaceLabel.createMany({
        data: labelIds.map((labelId) => ({
          workspaceId: task.project.workspaceId,
          labelId,
        })),
        skipDuplicates: true,
      });

      return taskLabels;
    });
  }

  async findAll(userId: string): Promise<TaskLabel[]> {
    // Get all task labels from projects user has access to
    const accessibleProjects = await this.prisma.project.findMany({
      where: {
        workspace: {
          members: {
            some: { userId },
          },
        },
      },
      select: { id: true },
    });

    if (accessibleProjects.length === 0) {
      throw new ForbiddenException('You do not have permission to view task labels');
    }

    const whereClause: any = {};
    whereClause.task = {
      projectId: { in: accessibleProjects.map((p) => p.id) },
    };

    return this.prisma.taskLabel.findMany({
      where: whereClause,
      include: {
        label: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(taskId: string, labelId: string, userId: string): Promise<TaskLabel> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    // Verify task label assignment exists and user has access
    const taskLabel = await this.prisma.taskLabel.findFirst({
      where: {
        labelId,
        task: isUuid ? { id: taskId } : { slug: taskId },
      },
      include: {
        task: {
          include: {
            project: {
              include: {
                workspace: {
                  include: {
                    members: {
                      where: { userId },
                      select: { role: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundException('Task label assignment not found');
    }

    // Check if user has access to the project's workspace
    const workspaceAccess = taskLabel.task.project.workspace.members;
    if (workspaceAccess.length === 0) {
      throw new ForbiddenException('You do not have permission to modify labels in this project');
    }

    // Check if project is archived
    if (taskLabel.task.project.archive) {
      throw new BadRequestException('Cannot update label assignment in archived project');
    }

    const updatedTaskLabel = await this.prisma.taskLabel.update({
      where: {
        taskId_labelId: {
          taskId: taskLabel.taskId,
          labelId,
        },
      },
      data: {
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: {
        label: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return updatedTaskLabel;
  }

  async remove(taskId: string, labelId: string, userId: string): Promise<TaskLabel> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    // Verify task label assignment exists and user has access
    const taskLabel = await this.prisma.taskLabel.findFirst({
      where: {
        labelId,
        task: isUuid ? { id: taskId } : { slug: taskId },
      },
      include: {
        task: {
          include: {
            project: {
              include: {
                workspace: {
                  include: {
                    members: {
                      where: { userId },
                      select: { role: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundException('Task label assignment not found');
    }

    // Check if user has access to the project's workspace
    const workspaceAccess = taskLabel.task.project.workspace.members;
    if (workspaceAccess.length === 0) {
      throw new ForbiddenException('You do not have permission to modify labels in this project');
    }

    // Check if project is archived
    if (taskLabel.task.project.archive) {
      throw new BadRequestException('Cannot remove label from task in archived project');
    }

    // Remove the assignment
    await this.prisma.taskLabel.delete({
      where: {
        taskId_labelId: {
          taskId: taskLabel.taskId,
          labelId,
        },
      },
    });

    return taskLabel;
  }
}
