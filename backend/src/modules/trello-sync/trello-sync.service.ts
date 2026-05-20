import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrelloApiService } from './trello-api.service';
import { ConnectTrelloDto } from './dto/connect-trello.dto';
import { ConnectTrelloWorkspaceDto } from './dto/connect-trello-workspace.dto';
import { UpdateTrelloSyncDto } from './dto/update-trello-sync.dto';
import { CryptoService } from '../../common/crypto.service';
import { SyncStatus, TaskPriority, TrelloSync, Prisma } from '@prisma/client';
import { TaskRanksService } from '../task-ranks/task-ranks.service';

@Injectable()
export class TrelloSyncService {
  private readonly logger = new Logger(TrelloSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trelloApi: TrelloApiService,
    private readonly crypto: CryptoService,
    private readonly taskRanks: TaskRanksService,
  ) {}

  // ─────────────────────────────────────────────────────
  //  Connect a project to a Trello board
  // ─────────────────────────────────────────────────────
  async connect(dto: ConnectTrelloDto, userId: string) {
    // Verify the project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Check for existing connection
    const existing = await this.prisma.trelloSync.findUnique({
      where: { projectId: dto.projectId },
    });
    if (existing) {
      throw new ConflictException(
        'This project is already connected to a Trello board. Disconnect it first.',
      );
    }

    // Validate Trello credentials
    const valid = await this.trelloApi.validateCredentials(dto.trelloApiKey, dto.trelloToken);
    if (!valid) {
      throw new BadRequestException(
        'Invalid Trello API Key or Token. Please verify your credentials.',
      );
    }

    // Encrypt credentials before storing
    const encryptedKey = this.crypto.encrypt(dto.trelloApiKey);
    const encryptedToken = this.crypto.encrypt(dto.trelloToken);

    const sync = await this.prisma.trelloSync.create({
      data: {
        projectId: dto.projectId,
        trelloBoardId: dto.trelloBoardId,
        trelloApiKey: encryptedKey,
        trelloToken: encryptedToken,
        syncInterval: dto.syncInterval ?? 15,
        statusMappings: dto.statusMappings ? (dto.statusMappings as any) : undefined,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    this.logger.log(`Trello board ${dto.trelloBoardId} connected to project ${dto.projectId}`);
    return this.safeResponse(sync);
  }

  // ─────────────────────────────────────────────────────
  //  Get sync status for a project
  // ─────────────────────────────────────────────────────
  async getStatus(projectId: string) {
    const sync = await this.prisma.trelloSync.findUnique({
      where: { projectId },
    });
    if (!sync) throw new NotFoundException('No Trello sync configured for this project');
    return this.safeResponse(sync);
  }

  // ─────────────────────────────────────────────────────
  //  List available Trello boards for the stored credentials
  // ─────────────────────────────────────────────────────
  async listBoards(projectId: string) {
    const sync = await this.findSyncOrFail(projectId);
    const { apiKey, token } = this.decryptCredentials(sync);
    return this.trelloApi.getBoards(apiKey, token);
  }

  // ─────────────────────────────────────────────────────
  //  List Trello lists for the connected board
  // ─────────────────────────────────────────────────────
  async listTrelloLists(projectId: string) {
    const sync = await this.findSyncOrFail(projectId);
    if (!sync.trelloBoardId)
      throw new BadRequestException('Project is not connected to a Trello board');
    const { apiKey, token } = this.decryptCredentials(sync);
    return this.trelloApi.getLists(sync.trelloBoardId, apiKey, token);
  }

  // ─────────────────────────────────────────────────────
  //  Also validate credentials on-demand without a project
  //  (used during connection setup before saving)
  // ─────────────────────────────────────────────────────
  async validateAndListBoards(apiKey: string, token: string) {
    const valid = await this.trelloApi.validateCredentials(apiKey, token);
    if (!valid) {
      throw new BadRequestException(
        'Invalid Trello API Key or Token. Please verify your credentials.',
      );
    }
    return this.trelloApi.getBoards(apiKey, token);
  }

  async validateAndListLists(boardId: string, apiKey: string, token: string) {
    const valid = await this.trelloApi.validateCredentials(apiKey, token);
    if (!valid) {
      throw new BadRequestException('Invalid Trello credentials');
    }
    return this.trelloApi.getLists(boardId, apiKey, token);
  }

  // ─────────────────────────────────────────────────────
  //  Manually trigger a sync
  // ─────────────────────────────────────────────────────
  async triggerSync(projectId: string, userId: string) {
    const sync = await this.findSyncOrFail(projectId);
    return this.runSync(sync, userId);
  }

  // ─────────────────────────────────────────────────────
  //  Core sync logic — called by scheduler and manual trigger
  // ─────────────────────────────────────────────────────
  async runSync(sync: TrelloSync, userId?: string) {
    const startTime = Date.now();
    if (!sync.projectId || !sync.trelloBoardId) {
      throw new Error('Sync record is not properly configured for a project');
    }

    try {
      const { apiKey, token } = this.decryptCredentials(sync);

      const project = await this.prisma.project.findUnique({
        where: { id: sync.projectId },
        select: {
          workflowId: true,
          workspaceId: true,
          taskPrefix: true,
          slug: true,
          workspace: { select: { organizationId: true } },
          sprints: {
            where: { isDefault: true },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!project) throw new Error('Project not found');

      const defaultStatus = await this.prisma.taskStatus.findFirst({
        where: { workflowId: project.workflowId, deletedAt: null },
        orderBy: { position: 'asc' },
      });

      if (!defaultStatus) {
        throw new Error('No task statuses found for this project');
      }

      const defaultSprintId = project.sprints[0]?.id;
      const statusMappings = (sync.statusMappings as Record<string, string>) || {};

      let imported = 0;
      let updated = 0;

      const lastTask = await this.prisma.task.findFirst({
        where: { projectId: sync.projectId },
        orderBy: { taskNumber: 'desc' },
        select: { taskNumber: true },
      });
      let currentTaskNumber = lastTask?.taskNumber || 0;

      const projectInfo = {
        workspaceId: project.workspaceId,
        orgId: project.workspace.organizationId,
        taskPrefix: project.taskPrefix || project.slug.toUpperCase().substring(0, 8) || 'TASK',
      };

      const cardsGenerator = this.trelloApi.getCardsBatch(sync.trelloBoardId, apiKey, token);

      for await (const batch of cardsGenerator) {
        if (batch.length === 0) continue;

        try {
          const cardIds = batch.map((c) => c.id);
          const existingTasks = await this.prisma.task.findMany({
            where: { trelloCardId: { in: cardIds } },
            select: { id: true, trelloCardId: true },
          });
          const existingMap = new Map(existingTasks.map((t) => [t.trelloCardId, t]));

          const toCreate: Prisma.TaskCreateManyInput[] = [];
          const toUpdate: { id: string; data: Record<string, any> }[] = [];

          for (const card of batch) {
            const statusId = statusMappings[card.idList] || defaultStatus.id;
            const existing = existingMap.get(card.id);

            if (existing) {
              toUpdate.push({
                id: existing.id,
                data: {
                  title: card.name,
                  description: card.desc || undefined,
                  dueDate: card.due ? new Date(card.due) : undefined,
                  statusId,
                  isArchived: card.closed,
                  updatedBy: userId,
                },
              });
              updated++;
            } else if (!card.closed) {
              currentTaskNumber++;
              toCreate.push({
                title: card.name,
                description: card.desc || undefined,
                dueDate: card.due ? new Date(card.due) : undefined,
                trelloCardId: card.id,
                projectId: sync.projectId,
                statusId,
                taskNumber: currentTaskNumber,
                slug: `${projectInfo.taskPrefix}-${currentTaskNumber}`,
                priority: TaskPriority.MEDIUM,
                sprintId: defaultSprintId || null,
                createdBy: userId,
                updatedBy: userId,
              });
              imported++;
              updated++;
            }
          }

          await this.prisma.$transaction(async (tx) => {
            if (toUpdate.length > 0) {
              await Promise.all(
                toUpdate.map((u) => tx.task.update({ where: { id: u.id }, data: u.data })),
              );
            }
            if (toCreate.length > 0) {
              await tx.task.createMany({ data: toCreate as any[] });

              const createdTasks = await tx.task.findMany({
                where: { trelloCardId: { in: toCreate.map((c) => c.trelloCardId as string) } },
                select: { id: true },
              });

              await this.taskRanks.seedForTasksBatch(
                createdTasks.map((t) => t.id),
                sync.projectId!,
                projectInfo.workspaceId,
                projectInfo.orgId,
                tx,
              );
            }
          });
        } catch (batchErr) {
          this.logger.error(
            `Failed to process batch for project ${sync.projectId}: ${batchErr.message}`,
          );
        }
      }

      await this.prisma.trelloSync.update({
        where: { id: sync.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: SyncStatus.SUCCESS,
          lastSyncError: null,
          cardsImported: imported,
          updatedBy: userId,
        },
      });

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `Trello sync complete for project ${sync.projectId}: ${updated} cards processed in ${elapsed}ms`,
      );

      return { success: true, cardsProcessed: updated, durationMs: elapsed };
    } catch (error) {
      this.logger.error(
        `Trello sync failed for project ${sync.projectId}: ${error.message}`,
        error.stack,
      );

      await this.prisma.trelloSync.update({
        where: { id: sync.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: SyncStatus.FAILED,
          lastSyncError: error.message,
        },
      });

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────
  //  Update sync configuration
  // ─────────────────────────────────────────────────────
  async updateConfig(projectId: string, dto: UpdateTrelloSyncDto, userId: string) {
    await this.findSyncOrFail(projectId);

    const updated = await this.prisma.trelloSync.update({
      where: { projectId },
      data: {
        ...(dto.syncEnabled !== undefined && { syncEnabled: dto.syncEnabled }),
        ...(dto.syncInterval !== undefined && { syncInterval: dto.syncInterval }),
        ...(dto.statusMappings !== undefined && { statusMappings: dto.statusMappings as any }),
        updatedBy: userId,
      },
    });

    return this.safeResponse(updated);
  }

  // ─────────────────────────────────────────────────────
  //  Disconnect / remove sync
  // ─────────────────────────────────────────────────────
  async disconnect(projectId: string) {
    await this.findSyncOrFail(projectId);
    await this.prisma.trelloSync.delete({ where: { projectId } });
    this.logger.log(`Trello sync disconnected for project ${projectId}`);
    return { message: 'Trello sync disconnected successfully' };
  }

  // ─────────────────────────────────────────────────────
  //  Internal: Upsert a task from a Trello card
  // ─────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────
  //  Workspace Level Operations
  // ─────────────────────────────────────────────────────
  async connectWorkspace(workspaceId: string, dto: ConnectTrelloWorkspaceDto, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const existing = await this.prisma.trelloSync.findUnique({
      where: { workspaceId },
    });
    if (existing) {
      throw new ConflictException('This workspace is already connected to a Trello account.');
    }

    const valid = await this.trelloApi.validateCredentials(dto.trelloApiKey, dto.trelloToken);
    if (!valid) {
      throw new BadRequestException('Invalid Trello API Key or Token.');
    }

    const encryptedKey = this.crypto.encrypt(dto.trelloApiKey);
    const encryptedToken = this.crypto.encrypt(dto.trelloToken);

    const sync = await this.prisma.trelloSync.create({
      data: {
        workspaceId,
        trelloWorkspaceId: dto.trelloWorkspaceId,
        trelloApiKey: encryptedKey,
        trelloToken: encryptedToken,
        syncEnabled: false,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    this.logger.log(`Trello workspace connected to Taskosaur workspace ${workspaceId}`);
    return this.safeResponse(sync);
  }

  async getWorkspaceStatus(workspaceId: string) {
    const sync = await this.prisma.trelloSync.findUnique({
      where: { workspaceId },
    });
    if (!sync) throw new NotFoundException('No Trello sync configured for this workspace');
    return this.safeResponse(sync);
  }

  async listWorkspaceBoards(workspaceId: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);
    const { apiKey, token } = this.decryptCredentials(sync);
    return this.trelloApi.getBoards(apiKey, token);
  }

  async importBoardsToWorkspace(workspaceId: string, boardIds: string[], userId: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);
    const { apiKey, token } = this.decryptCredentials(sync);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const importedProjects: string[] = [];

    // Fetch board info once
    const boardInfo = await this.trelloApi.getBoards(apiKey, token);

    // Process each board
    for (const boardId of boardIds) {
      try {
        const board = boardInfo.find((b) => b.id === boardId);
        if (!board) continue;

        // Create Workflow first (Project needs workflowId)
        const workflow = await this.prisma.workflow.create({
          data: {
            name: `Trello Workflow - ${board.name}`,
            organizationId: workspace.organizationId,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        // Create Project
        const projectSlug =
          board.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .substring(0, 20) +
          '-' +
          Math.floor(Math.random() * 1000);
        const project = await this.prisma.project.create({
          data: {
            name: board.name,
            slug: projectSlug,
            description: `Imported from Trello Board: ${board.name}`,
            workspaceId,
            workflowId: workflow.id,
            color: '#0079bf',
            createdBy: userId,
            updatedBy: userId,
          },
        });

        importedProjects.push(project.id);

        // Fetch lists & create task statuses
        const lists = await this.trelloApi.getLists(boardId, apiKey, token);

        const statusMappings: Record<string, string> = {};
        for (let i = 0; i < lists.length; i++) {
          const list = lists[i];
          const status = await this.prisma.taskStatus.create({
            data: {
              name: list.name,
              position: i,
              workflowId: workflow.id,
              category: 'TODO',
              color: '#0079bf',
              createdBy: userId,
              updatedBy: userId,
            },
          });
          statusMappings[list.id] = status.id;
        }

        const syncRecord = await this.prisma.trelloSync.create({
          data: {
            projectId: project.id,
            trelloBoardId: boardId,
            trelloApiKey: sync.trelloApiKey,
            trelloToken: sync.trelloToken,
            syncEnabled: true,
            syncInterval: 15,
            statusMappings: statusMappings as any,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        // Delegate to the optimized batch sync logic
        const result = await this.runSync(syncRecord, userId);
        this.logger.log(
          `Imported ${result.cardsProcessed} cards from board ${board.name} to project ${project.id}`,
        );
      } catch (error) {
        this.logger.error(`Failed to import board ${boardId}: ${error.message}`, error.stack);
        // Continue with next board
      }
    }

    return {
      success: true,
      importedProjectsCount: importedProjects.length,
      projectIds: importedProjects,
    };
  }

  async updateWorkspaceConfig(workspaceId: string, dto: ConnectTrelloWorkspaceDto, userId: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);

    const valid = await this.trelloApi.validateCredentials(dto.trelloApiKey, dto.trelloToken);
    if (!valid) {
      throw new BadRequestException('Invalid Trello API Key or Token.');
    }

    const encryptedKey = this.crypto.encrypt(dto.trelloApiKey);
    const encryptedToken = this.crypto.encrypt(dto.trelloToken);

    const updated = await this.prisma.trelloSync.update({
      where: { id: sync.id },
      data: {
        trelloApiKey: encryptedKey,
        trelloToken: encryptedToken,
        updatedBy: userId,
      },
    });

    return this.safeResponse(updated);
  }

  async getWorkspaceSyncedProjects(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        trelloSync: true,
      },
      orderBy: { name: 'asc' },
    });

    return projects
      .filter((p) => p.trelloSync)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        trelloBoardId: p.trelloSync?.trelloBoardId,
        lastSyncAt: p.trelloSync?.lastSyncAt,
        lastSyncStatus: p.trelloSync?.lastSyncStatus,
        syncEnabled: p.trelloSync?.syncEnabled,
        cardsImported: p.trelloSync?.cardsImported,
      }));
  }

  async syncAllWorkspaceProjects(workspaceId: string, userId: string) {
    const projects = await this.getWorkspaceSyncedProjects(workspaceId);
    const results: any[] = [];

    for (const project of projects) {
      try {
        const result = await this.triggerSync(project.id, userId);
        results.push({ projectId: project.id, success: true, result });
      } catch (error) {
        results.push({ projectId: project.id, success: false, error: error.message });
      }
    }

    return {
      total: projects.length,
      successCount: results.filter((r) => r.success).length,
      results,
    };
  }

  async disconnectWorkspace(workspaceId: string) {
    await this.findWorkspaceSyncOrFail(workspaceId);
    await this.prisma.trelloSync.delete({ where: { workspaceId } });
    this.logger.log(`Trello sync disconnected for workspace ${workspaceId}`);
    return { message: 'Trello workspace sync disconnected successfully' };
  }
  // ─────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────
  private async findWorkspaceSyncOrFail(workspaceId: string) {
    const sync = await this.prisma.trelloSync.findUnique({ where: { workspaceId } });
    if (!sync) throw new NotFoundException('No Trello sync configured for this workspace');
    return sync;
  }

  private async findSyncOrFail(projectId: string) {
    const sync = await this.prisma.trelloSync.findUnique({ where: { projectId } });
    if (!sync) throw new NotFoundException('No Trello sync configured for this project');
    return sync;
  }

  private decryptCredentials(sync: TrelloSync): { apiKey: string; token: string } {
    return {
      apiKey: this.crypto.decrypt(sync.trelloApiKey),
      token: this.crypto.decrypt(sync.trelloToken),
    };
  }

  /** Strip encrypted fields from the response */
  private safeResponse(sync: TrelloSync) {
    const { trelloApiKey, trelloToken, ...safe } = sync;
    return {
      ...safe,
      // Indicate connection is present but don't expose credentials
      hasApiKey: !!trelloApiKey,
      hasToken: !!trelloToken,
    };
  }
}
