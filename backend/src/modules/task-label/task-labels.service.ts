import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskLabel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignTaskLabelDto } from './dto/create-task-labels.dto';
import { UpdateTaskLabelDto } from './dto/update-task-lables.dto';

@Injectable()
export class TaskLabelsService {
  constructor(private prisma: PrismaService) {}

  async assignLabel(assignTaskLabelDto: AssignTaskLabelDto): Promise<TaskLabel> {
    const { taskId, labelId, userId } = assignTaskLabelDto;

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.archive) {
      throw new BadRequestException('Cannot assign label to task in archived project');
    }

    // Verify label exists and belongs to the same project
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (label.projectId !== task.projectId) {
      throw new BadRequestException('Label does not belong to the same project as the task');
    }

    // Check if label is already assigned to the task
    const existingAssignment = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Label is already assigned to this task');
    }

    return this.prisma.taskLabel.create({
      data: {
        taskId,
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
  }

  findAll(taskId?: string): Promise<TaskLabel[]> {
    const whereClause: any = {};
    if (taskId) {
      whereClause.taskId = taskId;
    }

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

  async update(
    taskId: string,
    labelId: string,
    updateTaskLabelDto: UpdateTaskLabelDto,
  ): Promise<TaskLabel> {
    const { userId } = updateTaskLabelDto;

    // Verify task label assignment exists
    const taskLabel = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundException('Task label assignment not found');
    }

    const updatedTaskLabel = await this.prisma.taskLabel.update({
      where: {
        taskId_labelId: {
          taskId,
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

  async remove(taskId: string, labelId: string): Promise<TaskLabel> {
    // Verify task label assignment exists
    const taskLabel = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundException('Task label assignment not found');
    }

    // Remove the assignment
    await this.prisma.taskLabel.delete({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });
    return taskLabel;
  }
}
