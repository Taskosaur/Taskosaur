import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusCategory, TaskStatus, Workflow } from '@prisma/client';

@Injectable()
export class TaskStatusSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(workflows: Workflow[], users?: any[]) {
    console.log('🌱 Seeding task statuses...');

    if (!workflows || workflows.length === 0) {
      throw new Error('Workflows must be seeded before task statuses');
    }

    // Get default user if not provided
    if (!users || users.length === 0) {
      users = await this.prisma.user.findMany({ take: 1 });
    }

    const createdStatuses: TaskStatus[] = [];

    // Create task statuses for each workflow
    for (const workflow of workflows) {
      const statusesData = this.getStatusesDataForWorkflow(workflow);
      if (!statusesData || statusesData.length === 0) {
        console.log(`⚠ No statuses defined for workflow: ${workflow.name}`);
        continue;
      }
      for (const statusData of statusesData) {
        try {
          // Find workflow creator or use first user as default
          const workflowWithCreator = await this.prisma.workflow.findUnique({
            where: { id: workflow.id },
            include: { createdByUser: true },
          });
          const creatorUser = workflowWithCreator?.createdByUser || users[0];

          const status = await this.prisma.taskStatus.create({
            data: {
              ...statusData,
              workflowId: workflow.id,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });

          createdStatuses.push(status);
          console.log(
            `   ✓ Created status: ${status.name} [${status.category}] in ${workflow.name}`,
          );
        } catch (error) {
          console.error(error);
          console.log(
            `   ⚠ Status ${statusData.name} might already exist in ${workflow.name}, skipping...`,
          );
          // Try to find existing status
          const existingStatus = await this.prisma.taskStatus.findFirst({
            where: {
              name: statusData.name,
              workflowId: workflow.id,
            },
          });
          if (existingStatus) {
            createdStatuses.push(existingStatus);
          }
        }
      }
    }

    // Create status transitions after all statuses are created
    await this.createStatusTransitions(workflows, users);

    console.log(
      `✅ Task statuses seeding completed. Created/Found ${createdStatuses.length} statuses.`,
    );
    return createdStatuses;
  }

  private getStatusesDataForWorkflow(workflow: Workflow) {
    if (workflow.name.includes('Software Development')) {
      return [
        {
          name: 'Backlog',
          color: '#6b7280',
          category: StatusCategory.TODO,
          position: 1,
          isDefault: true, // ✅ Default status
        },
        {
          name: 'In Development',
          color: '#f59e0b',
          category: StatusCategory.IN_PROGRESS,
          position: 2,
          isDefault: false,
        },
        {
          name: 'Testing',
          color: '#ec4899',
          category: StatusCategory.IN_PROGRESS,
          position: 3,
          isDefault: false,
        },
        {
          name: 'Done',
          color: '#10b981',
          category: StatusCategory.DONE,
          position: 4,
          isDefault: false,
        },
      ];
    } else if (workflow.name.includes('Design & Creative')) {
      return [
        {
          name: 'Brief Received',
          color: '#6b7280',
          category: StatusCategory.TODO,
          position: 1,
          isDefault: true, // ✅ Default status
        },
        {
          name: 'In Design',
          color: '#8b5cf6',
          category: StatusCategory.IN_PROGRESS,
          position: 2,
          isDefault: false,
        },
        {
          name: 'Review',
          color: '#f59e0b',
          category: StatusCategory.IN_PROGRESS,
          position: 3,
          isDefault: false,
        },
        {
          name: 'Delivered',
          color: '#10b981',
          category: StatusCategory.DONE,
          position: 4,
          isDefault: false,
        },
      ];
    } else if (workflow.name.includes('Marketing Campaign')) {
      return [
        {
          name: 'Ideas',
          color: '#6b7280',
          category: StatusCategory.TODO,
          position: 1,
          isDefault: true, // ✅ Default status
        },
        {
          name: 'In Progress',
          color: '#f59e0b',
          category: StatusCategory.IN_PROGRESS,
          position: 2,
          isDefault: false,
        },
        {
          name: 'Published',
          color: '#10b981',
          category: StatusCategory.DONE,
          position: 3,
          isDefault: false,
        },
      ];
    } else if (workflow.name.includes('Client Project')) {
      return [
        {
          name: 'New Request',
          color: '#6b7280',
          category: StatusCategory.TODO,
          position: 1,
          isDefault: true, // ✅ Default status
        },
        {
          name: 'In Progress',
          color: '#f59e0b',
          category: StatusCategory.IN_PROGRESS,
          position: 2,
          isDefault: false,
        },
        {
          name: 'Completed',
          color: '#10b981',
          category: StatusCategory.DONE,
          position: 3,
          isDefault: false,
        },
      ];
    } else if (workflow.name.includes('Support & Maintenance')) {
      return [
        {
          name: 'Open',
          color: '#ef4444',
          category: StatusCategory.TODO,
          position: 1,
          isDefault: true, // ✅ Default status
        },
        {
          name: 'In Progress',
          color: '#f59e0b',
          category: StatusCategory.IN_PROGRESS,
          position: 2,
          isDefault: false,
        },
        {
          name: 'Resolved',
          color: '#10b981',
          category: StatusCategory.DONE,
          position: 3,
          isDefault: false,
        },
      ];
    }
  }

  private async createStatusTransitions(workflows: Workflow[], users: any[]) {
    console.log('🌱 Creating status transitions...');

    for (const workflow of workflows) {
      const statuses = await this.prisma.taskStatus.findMany({
        where: { workflowId: workflow.id },
        orderBy: { position: 'asc' },
      });

      // Create linear transitions (each status can move to the next one)
      for (let i = 0; i < statuses.length - 1; i++) {
        try {
          // Find workflow creator or use first user as default
          const workflowWithCreator = await this.prisma.workflow.findUnique({
            where: { id: workflow.id },
            include: { createdByUser: true },
          });
          const creatorUser = workflowWithCreator?.createdByUser || users[0];

          await this.prisma.statusTransition.create({
            data: {
              workflowId: workflow.id,
              fromStatusId: statuses[i].id,
              toStatusId: statuses[i + 1].id,
              name: `${statuses[i].name} → ${statuses[i + 1].name}`,
              createdBy: creatorUser.id,
              updatedBy: creatorUser.id,
            },
          });
        } catch (error) {
          console.error(error);
          // Transition might already exist, skip
        }
      }

      // Allow moving back to previous status (except from DONE to TODO)
      for (let i = 1; i < statuses.length; i++) {
        if (
          statuses[i].category !== StatusCategory.DONE ||
          statuses[i - 1].category !== StatusCategory.TODO
        ) {
          try {
            // Find workflow creator or use first user as default
            const workflowWithCreator = await this.prisma.workflow.findUnique({
              where: { id: workflow.id },
              include: { createdByUser: true },
            });
            const creatorUser = workflowWithCreator?.createdByUser || users[0];

            await this.prisma.statusTransition.create({
              data: {
                workflowId: workflow.id,
                fromStatusId: statuses[i].id,
                toStatusId: statuses[i - 1].id,
                name: `${statuses[i].name} → ${statuses[i - 1].name}`,
                createdBy: creatorUser.id,
                updatedBy: creatorUser.id,
              },
            });
          } catch (error) {
            console.error(error);
            // Transition might already exist, skip
          }
        }
      }

      console.log(`   ✓ Created transitions for ${workflow.name}`);
    }
  }

  async clear() {
    console.log('🧹 Clearing task statuses...');

    try {
      // Delete status transitions first
      const deletedTransitions = await this.prisma.statusTransition.deleteMany();
      console.log(`   ✓ Deleted ${deletedTransitions.count} status transitions`);

      // Delete task statuses
      const deletedStatuses = await this.prisma.taskStatus.deleteMany();
      console.log(`✅ Deleted ${deletedStatuses.count} task statuses`);
    } catch (_error) {
      console.error('❌ Error clearing task statuses:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.taskStatus.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        category: true,
        position: true,
        workflow: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            fromTransitions: true,
            toTransitions: true,
          },
        },
        createdAt: true,
      },
      orderBy: [{ workflow: { name: 'asc' } }, { position: 'asc' }],
    });
  }
}
