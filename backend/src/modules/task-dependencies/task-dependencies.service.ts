import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTaskDependencyDto,
  BulkCreateDependenciesDto,
} from './dto/create-task-dependency.dto';
import { UpdateTaskDependencyDto } from './dto/update-task-dependency.dto';
import { TaskDependency, DependencyType } from '@prisma/client';

@Injectable()
export class TaskDependenciesService {
  private readonly logger = new Logger(TaskDependenciesService.name);

  constructor(private prisma: PrismaService) {}

  async create(createTaskDependencyDto: CreateTaskDependencyDto): Promise<TaskDependency> {
    const { dependentTaskId, blockingTaskId, createdBy, type } = createTaskDependencyDto;

    // Prevent self-dependency
    if (dependentTaskId === blockingTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // Check if tasks exist
    const isDepUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      dependentTaskId,
    );
    const isBlockUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      blockingTaskId,
    );

    const [dependentTask, blockingTask] = await Promise.all([
      this.prisma.task.findFirst({
        where: isDepUuid ? { id: dependentTaskId } : { slug: dependentTaskId },
      }),
      this.prisma.task.findFirst({
        where: isBlockUuid ? { id: blockingTaskId } : { slug: blockingTaskId },
      }),
    ]);

    if (!dependentTask) {
      throw new NotFoundException(`Dependent task ${dependentTaskId} not found`);
    }

    if (!blockingTask) {
      throw new NotFoundException(`Blocking task ${blockingTaskId} not found`);
    }

    // Update variables to use UUIDs
    const depTaskId = dependentTask.id;
    const blockTaskId = blockingTask.id;

    // Prevent self-dependency after resolution
    if (depTaskId === blockTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // Check if dependency already exists
    const existingDependency = await this.prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_blockingTaskId: {
          dependentTaskId: depTaskId,
          blockingTaskId: blockTaskId,
        },
      },
    });

    if (existingDependency) {
      throw new ConflictException('Dependency relationship already exists');
    }

    // Check for circular dependencies
    await this.validateNoCycles(depTaskId, blockTaskId);

    return this.prisma.taskDependency.create({
      data: {
        type: type || DependencyType.BLOCKS,
        dependentTaskId: depTaskId,
        blockingTaskId: blockTaskId,
        createdBy,
      },
      include: {
        dependentTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        blockingTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async createBulk(bulkCreateDto: BulkCreateDependenciesDto): Promise<TaskDependency[]> {
    const results: TaskDependency[] = [];

    for (const dependencyDto of bulkCreateDto.dependencies) {
      try {
        const dependency = await this.create(dependencyDto);
        results.push(dependency);
      } catch (error) {
        this.logger.error(error);
        // Continue with other dependencies if one fails
        this.logger.error(`Failed to create dependency: ${error.message}`);
      }
    }

    return results;
  }

  findAll(projectId?: string): Promise<TaskDependency[]> {
    const where = projectId
      ? {
          dependentTask: { projectId },
        }
      : {};

    return this.prisma.taskDependency.findMany({
      where,
      include: {
        dependentTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            projectId: true,
            status: { select: { name: true } },
          },
        },
        blockingTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            projectId: true,
            status: { select: { name: true } },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<TaskDependency> {
    const dependency = await this.prisma.taskDependency.findUnique({
      where: { id },
      include: {
        dependentTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        blockingTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Task dependency not found');
    }

    return dependency;
  }

  async getTaskDependencies(taskId: string): Promise<{
    dependsOn: TaskDependency[];
    blocks: TaskDependency[];
  }> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const resolvedTaskId = task.id;

    const [dependsOn, blocks] = await Promise.all([
      this.prisma.taskDependency.findMany({
        where: { dependentTaskId: resolvedTaskId },
        include: {
          blockingTask: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.taskDependency.findMany({
        where: { blockingTaskId: resolvedTaskId },
        include: {
          dependentTask: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return { dependsOn, blocks };
  }

  async getBlockedTasks(taskId: string): Promise<TaskDependency[]> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskDependency.findMany({
      where: { blockingTaskId: task.id },
      include: {
        dependentTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateTaskDependencyDto: UpdateTaskDependencyDto,
  ): Promise<TaskDependency> {
    const existingDependency = await this.findOne(id);

    if (updateTaskDependencyDto.dependentTaskId || updateTaskDependencyDto.blockingTaskId) {
      const newDependentId =
        updateTaskDependencyDto.dependentTaskId || existingDependency.dependentTaskId;
      const newBlockingId =
        updateTaskDependencyDto.blockingTaskId || existingDependency.blockingTaskId;

      // Prevent self-dependency
      if (newDependentId === newBlockingId) {
        throw new BadRequestException('A task cannot depend on itself');
      }

      // Check for circular dependencies
      await this.validateNoCycles(newDependentId, newBlockingId);
    }

    return this.prisma.taskDependency.update({
      where: { id },
      data: updateTaskDependencyDto,
      include: {
        dependentTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        blockingTask: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: { select: { name: true } },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Ensure it exists

    await this.prisma.taskDependency.delete({
      where: { id },
    });
  }

  async removeByTasks(dependentTaskId: string, blockingTaskId: string): Promise<void> {
    const isDepUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      dependentTaskId,
    );
    const isBlockUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      blockingTaskId,
    );

    const [dependentTask, blockingTask] = await Promise.all([
      this.prisma.task.findFirst({
        where: isDepUuid ? { id: dependentTaskId } : { slug: dependentTaskId },
        select: { id: true },
      }),
      this.prisma.task.findFirst({
        where: isBlockUuid ? { id: blockingTaskId } : { slug: blockingTaskId },
        select: { id: true },
      }),
    ]);

    if (!dependentTask || !blockingTask) {
      throw new NotFoundException('One or both tasks not found');
    }

    const dependency = await this.prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_blockingTaskId: {
          dependentTaskId: dependentTask.id,
          blockingTaskId: blockingTask.id,
        },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Task dependency not found');
    }

    await this.prisma.taskDependency.delete({
      where: { id: dependency.id },
    });
  }

  async validateNoCycles(dependentTaskId: string, blockingTaskId: string): Promise<void> {
    // To check if adding dependentTaskId -> blockingTaskId creates a cycle,
    // we check if blockingTaskId already depends on dependentTaskId (directly or indirectly).
    const visited = new Set<string>();

    const existsPath = async (currentId: string, targetId: string): Promise<boolean> => {
      if (currentId === targetId) return true;

      visited.add(currentId);

      // Get all tasks that currentId depends on
      const dependencies = await this.prisma.taskDependency.findMany({
        where: { dependentTaskId: currentId },
        select: { blockingTaskId: true },
      });

      for (const dep of dependencies) {
        if (!visited.has(dep.blockingTaskId)) {
          if (await existsPath(dep.blockingTaskId, targetId)) {
            return true;
          }
        }
      }

      return false;
    };

    if (await existsPath(blockingTaskId, dependentTaskId)) {
      throw new BadRequestException(
        'Creating this dependency would result in a circular dependency',
      );
    }
  }

  async getDependencyStats(projectId: string): Promise<{
    totalDependencies: number;
    blockedTasks: number;
    criticalPath: string[];
  }> {
    const dependencies = await this.findAll(projectId);

    const blockedTaskIds = new Set(dependencies.map((d) => d.dependentTaskId));

    return {
      totalDependencies: dependencies.length,
      blockedTasks: blockedTaskIds.size,
      criticalPath: [], // TODO: Implement critical path calculation
    };
  }
}
