import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JiraApiService } from './jira-api.service';
import { ConnectJiraDto } from './dto/connect-jira.dto';
import { ConnectJiraWorkspaceDto } from './dto/connect-jira-workspace.dto';
import { UpdateJiraSyncDto } from './dto/update-jira-sync.dto';
import { CryptoService } from '../../common/crypto.service';
import { JiraSync, SyncStatus, TaskPriority } from '@prisma/client';
import { TaskRanksService } from '../task-ranks/task-ranks.service';

@Injectable()
export class JiraSyncService {
  private readonly logger = new Logger(JiraSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jiraApi: JiraApiService,
    private readonly crypto: CryptoService,
    private readonly taskRanks: TaskRanksService,
  ) {}

  // ─────────────────────────────────────────────────────
  //  Connect a project to a Jira project
  // ─────────────────────────────────────────────────────
  async connect(dto: ConnectJiraDto, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.jiraSync.findUnique({
      where: { projectId: dto.projectId },
    });
    if (existing) {
      throw new ConflictException(
        'This project is already connected to a Jira project. Disconnect it first.',
      );
    }

    const valid = await this.jiraApi.validateCredentials(
      dto.jiraSiteUrl,
      dto.jiraEmail,
      dto.jiraApiToken,
    );
    if (!valid) {
      throw new BadRequestException(
        'Invalid Jira credentials. Please verify your site URL, email, and API token.',
      );
    }

    const encryptedEmail = this.crypto.encrypt(dto.jiraEmail);
    const encryptedToken = this.crypto.encrypt(dto.jiraApiToken);

    const sync = await this.prisma.jiraSync.create({
      data: {
        projectId: dto.projectId,
        jiraSiteUrl: dto.jiraSiteUrl,
        jiraProjectKey: dto.jiraProjectKey,
        jiraEmail: encryptedEmail,
        jiraApiToken: encryptedToken,
        syncInterval: dto.syncInterval ?? 15,
        statusMappings: dto.statusMappings ? (dto.statusMappings as any) : undefined,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    this.logger.log(`Jira project ${dto.jiraProjectKey} connected to project ${dto.projectId}`);
    return this.safeResponse(sync);
  }

  // ─────────────────────────────────────────────────────
  //  Get sync status for a project
  // ─────────────────────────────────────────────────────
  async getStatus(projectId: string) {
    const sync = await this.prisma.jiraSync.findUnique({ where: { projectId } });
    if (!sync) throw new NotFoundException('No Jira sync configured for this project');
    return this.safeResponse(sync);
  }

  // ─────────────────────────────────────────────────────
  //  Validate credentials and list Jira projects
  // ─────────────────────────────────────────────────────
  async validateAndListProjects(siteUrl: string, email: string, apiToken: string) {
    const valid = await this.jiraApi.validateCredentials(siteUrl, email, apiToken);
    if (!valid) {
      throw new BadRequestException(
        'Invalid Jira credentials. Please verify your site URL, email, and API token.',
      );
    }
    return this.jiraApi.getProjects(siteUrl, email, apiToken);
  }

  // ─────────────────────────────────────────────────────
  //  Validate credentials and list statuses for a project
  // ─────────────────────────────────────────────────────
  async validateAndListStatuses(
    siteUrl: string,
    projectKey: string,
    email: string,
    apiToken: string,
  ) {
    const valid = await this.jiraApi.validateCredentials(siteUrl, email, apiToken);
    if (!valid) throw new BadRequestException('Invalid Jira credentials');
    return this.jiraApi.getProjectStatuses(siteUrl, projectKey, email, apiToken);
  }

  // ─────────────────────────────────────────────────────
  //  List statuses using stored credentials
  // ─────────────────────────────────────────────────────
  async listProjectStatuses(projectId: string) {
    const sync = await this.findSyncOrFail(projectId);
    if (!sync.jiraProjectKey) {
      throw new BadRequestException('Project is not connected to a Jira project');
    }
    const { email, apiToken } = this.decryptCredentials(sync);
    return this.jiraApi.getProjectStatuses(sync.jiraSiteUrl, sync.jiraProjectKey, email, apiToken);
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
  async runSync(sync: JiraSync, userId?: string) {
    const startTime = Date.now();
    if (!sync.projectId || !sync.jiraProjectKey) {
      throw new Error('Sync record is not properly configured for a project');
    }

    try {
      const { email, apiToken } = this.decryptCredentials(sync);

      // Get project's info, workflowId, and default sprint
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

      let imported = 0;
      let failed = 0;

      const statusMappings = (sync.statusMappings as Record<string, string>) || {};

      // Pre-compute task number
      const lastTask = await this.prisma.task.findFirst({
        where: { projectId: sync.projectId },
        orderBy: { taskNumber: 'desc' },
        select: { taskNumber: true },
      });
      let currentTaskNumber = lastTask?.taskNumber || 0;

      // Map Jira priority to Taskosaur priority
      const priorityMap: Record<string, TaskPriority> = {
        Highest: TaskPriority.HIGHEST,
        High: TaskPriority.HIGH,
        Medium: TaskPriority.MEDIUM,
        Low: TaskPriority.LOW,
        Lowest: TaskPriority.LOWEST,
      };

      const projectInfo = {
        workspaceId: project.workspaceId,
        orgId: project.workspace.organizationId,
        taskPrefix: project.taskPrefix || project.slug.toUpperCase().substring(0, 8) || 'TASK',
        slug: project.slug,
        workflowId: project.workflowId,
        defaultSprintId,
      };

      const issuesGenerator = this.jiraApi.getIssuesBatch(
        sync.jiraSiteUrl,
        sync.jiraProjectKey,
        email,
        apiToken,
        sync.lastSyncAt ?? undefined,
      );

      for await (const batch of issuesGenerator) {
        if (batch.length === 0) continue;

        try {
          const issueIds = batch.map((i) => i.id);
          const existingTasks = await this.prisma.task.findMany({
            where: { jiraIssueId: { in: issueIds } },
            select: { id: true, jiraIssueId: true, projectId: true, slug: true, taskNumber: true },
          });
          const existingMap = new Map(existingTasks.map((t) => [t.jiraIssueId, t]));

          const toCreate: Record<string, any>[] = [];
          const toUpdate: { id: string; data: Record<string, any> }[] = [];

          for (const issue of batch) {
            if (!issue || !issue.fields || !issue.fields.status) continue;
            let statusId = statusMappings[issue.fields.status.id];
            if (!statusId) {
              const existingStatus = await this.prisma.taskStatus.findFirst({
                where: {
                  workflowId: project.workflowId,
                  name: { equals: issue.fields.status.name, mode: 'insensitive' },
                  deletedAt: null,
                },
              });

              if (existingStatus) {
                statusId = existingStatus.id;
              } else {
                const categoryKey = issue.fields.status.statusCategory?.key;
                const category = this.jiraStatusToCategory(categoryKey);
                const newStatus = await this.prisma.taskStatus.upsert({
                  where: {
                    workflowId_name: {
                      workflowId: project.workflowId,
                      name: issue.fields.status.name,
                    },
                  },
                  update: { updatedBy: userId },
                  create: {
                    name: issue.fields.status.name,
                    workflowId: project.workflowId,
                    category,
                    color:
                      category === 'DONE'
                        ? '#00875A'
                        : category === 'IN_PROGRESS'
                          ? '#0052CC'
                          : '#DFE1E6',
                    position: 999,
                    createdBy: userId,
                    updatedBy: userId,
                  },
                });
                statusId = newStatus.id;
              }
              statusMappings[issue.fields.status.id] = statusId;
            }
            const finalStatusId = statusId || defaultStatus.id;
            const priority = priorityMap[issue.fields.priority?.name] || TaskPriority.MEDIUM;
            const description = this.extractDescription(issue.fields.description);

            const existing = existingMap.get(issue.id);
            if (existing) {
              const updateData: any = {
                title: issue.fields.summary,
                description: description || undefined,
                dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : undefined,
                statusId: finalStatusId,
                priority,
                updatedBy: userId,
              };
              if (existing.projectId !== sync.projectId) {
                currentTaskNumber++;
                updateData.projectId = sync.projectId;
                updateData.taskNumber = currentTaskNumber;
                updateData.slug = `${projectInfo.taskPrefix}-${currentTaskNumber}`;
                updateData.sprintId = defaultSprintId || null;
                updateData.parentTaskId = null;
              }
              toUpdate.push({ id: existing.id, data: updateData });
            } else {
              currentTaskNumber++;
              toCreate.push({
                title: issue.fields.summary,
                description: description || undefined,
                dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : undefined,
                jiraIssueId: issue.id,
                projectId: sync.projectId,
                statusId: finalStatusId,
                taskNumber: currentTaskNumber,
                slug: `${projectInfo.taskPrefix}-${currentTaskNumber}`,
                priority,
                sprintId: defaultSprintId || null,
                createdBy: userId,
                updatedBy: userId,
              });
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
                where: { jiraIssueId: { in: toCreate.map((c) => c.jiraIssueId as string) } },
                select: { id: true },
              });

              await this.taskRanks.seedForTasksBatch(
                createdTasks.map((t) => t.id),
                sync.projectId,
                projectInfo.workspaceId,
                projectInfo.orgId,
                tx,
              );
            }
          });

          imported += batch.length;
        } catch (batchErr) {
          failed += batch.length;
          this.logger.error(
            `Failed to process batch for project ${sync.projectId}: ${batchErr.message}`,
          );
        }
      }

      this.logger.log(
        `Jira sync completed for project ${sync.projectId}: ${imported} imported/updated, ${failed} failed`,
      );

      await this.prisma.jiraSync.update({
        where: { id: sync.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: SyncStatus.SUCCESS,
          lastSyncError: null,
          issuesImported: imported,
          updatedBy: userId,
          statusMappings,
        },
      });

      const elapsed = Date.now() - startTime;
      const message =
        failed > 0
          ? `${imported} synced, ${failed} skipped (check logs)`
          : `${imported} issues processed`;

      this.logger.log(
        `Jira sync complete for project ${sync.projectId}: ${message} in ${elapsed}ms`,
      );

      return { success: true, issuesProcessed: imported, failedCount: failed, durationMs: elapsed };
    } catch (error) {
      this.logger.error(
        `Jira sync failed for project ${sync.projectId}: ${error.message}`,
        error.stack,
      );

      await this.prisma.jiraSync.update({
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
  async updateConfig(projectId: string, dto: UpdateJiraSyncDto, userId: string) {
    await this.findSyncOrFail(projectId);

    const updated = await this.prisma.jiraSync.update({
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
    await this.prisma.jiraSync.delete({ where: { projectId } });
    this.logger.log(`Jira sync disconnected for project ${projectId}`);
    return { message: 'Jira sync disconnected successfully' };
  }

  /**
   * Map Jira statusCategory.key to Taskosaur StatusCategory enum.
   * Jira keys: 'new' (To Do), 'indeterminate' (In Progress), 'done' (Done)
   */
  private jiraStatusToCategory(
    statusCategoryKey: string | undefined,
  ): 'TODO' | 'IN_PROGRESS' | 'DONE' {
    switch (statusCategoryKey?.toLowerCase()) {
      case 'done':
        return 'DONE';
      case 'indeterminate':
        return 'IN_PROGRESS';
      default:
        return 'TODO';
    }
  }

  // ─────────────────────────────────────────────────────
  //  Internal: Upsert a task from a Jira issue
  // ─────────────────────────────────────────────────────

  /** Extract plain text from Jira ADF document or plain string */
  private extractDescription(description: any): string | null {
    if (!description) return null;
    if (typeof description === 'string') return description;

    // Jira ADF format: { type: 'doc', content: [...] }
    if (description?.type === 'doc' && Array.isArray(description.content)) {
      const texts: string[] = [];
      const walk = (nodes: Record<string, unknown>[]) => {
        for (const node of nodes) {
          if (node['type'] === 'text' && node['text']) texts.push(node['text'] as string);
          if (node['content']) walk(node['content'] as Record<string, unknown>[]);
        }
      };
      walk(description.content as Record<string, unknown>[]);
      return texts.join(' ') || null;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────
  //  Workspace Level Operations
  // ─────────────────────────────────────────────────────
  async connectWorkspace(workspaceId: string, dto: ConnectJiraWorkspaceDto, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const existing = await this.prisma.jiraSync.findUnique({ where: { workspaceId } });
    if (existing) {
      throw new ConflictException('This workspace is already connected to a Jira account.');
    }

    const valid = await this.jiraApi.validateCredentials(
      dto.jiraSiteUrl,
      dto.jiraEmail,
      dto.jiraApiToken,
    );
    if (!valid) throw new BadRequestException('Invalid Jira credentials.');

    const encryptedEmail = this.crypto.encrypt(dto.jiraEmail);
    const encryptedToken = this.crypto.encrypt(dto.jiraApiToken);

    const sync = await this.prisma.jiraSync.create({
      data: {
        workspaceId,
        jiraSiteUrl: dto.jiraSiteUrl,
        jiraEmail: encryptedEmail,
        jiraApiToken: encryptedToken,
        syncEnabled: false,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    this.logger.log(`Jira account connected to Taskosaur workspace ${workspaceId}`);
    return this.safeResponse(sync);
  }

  async getWorkspaceStatus(workspaceId: string) {
    const sync = await this.prisma.jiraSync.findUnique({ where: { workspaceId } });
    if (!sync) throw new NotFoundException('No Jira sync configured for this workspace');
    return this.safeResponse(sync);
  }

  async listWorkspaceProjects(workspaceId: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);
    const { email, apiToken } = this.decryptCredentials(sync);
    return this.jiraApi.getProjects(sync.jiraSiteUrl, email, apiToken);
  }

  async listWorkspaceProjectStatuses(workspaceId: string, projectKey: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);
    const { email, apiToken } = this.decryptCredentials(sync);
    return this.jiraApi.getProjectStatuses(sync.jiraSiteUrl, projectKey, email, apiToken);
  }

  async importProjectsToWorkspace(
    workspaceId: string,
    projectsToImport: (string | { key: string; statusMappings?: Record<string, string> })[],
    userId: string,
  ) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);
    const { email, apiToken } = this.decryptCredentials(sync);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const importedProjects: string[] = [];

    // Fetch all project info at once
    const jiraProjects = await this.jiraApi.getProjects(sync.jiraSiteUrl, email, apiToken);

    for (const projectInput of projectsToImport) {
      const projectKey = typeof projectInput === 'string' ? projectInput : projectInput.key;
      const providedMappings =
        typeof projectInput === 'string' ? {} : projectInput.statusMappings || {};

      const jiraProject = jiraProjects.find((p) => p.key === projectKey);
      if (!jiraProject) {
        this.logger.warn(`Jira project ${projectKey} not found during workspace import`);
        continue;
      }

      try {
        // Use default workflow if available, otherwise create a new one
        let workflow = await this.prisma.workflow.findFirst({
          where: { organizationId: workspace.organizationId, isDefault: true },
        });

        if (!workflow) {
          workflow = await this.prisma.workflow.create({
            data: {
              name: `Jira Workflow - ${jiraProject.name}`,
              organizationId: workspace.organizationId,
              isDefault: true,
              createdBy: userId,
              updatedBy: userId,
            },
          });
        }

        // Create Project
        const projectSlug =
          jiraProject.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .substring(0, 20) +
          '-' +
          Math.floor(Math.random() * 1000);

        const project = await this.prisma.project.create({
          data: {
            name: jiraProject.name,
            slug: projectSlug,
            description: `Imported from Jira: ${jiraProject.name} (${jiraProject.key})`,
            workspaceId,
            workflowId: workflow.id,
            color: '#0052CC', // Jira blue
            taskPrefix: jiraProject.key.substring(0, 8),
            visibility: 'INTERNAL', // All workspace members can view imported projects
            createdBy: userId,
            updatedBy: userId,
            members: {
              create: {
                userId,
                role: 'MANAGER',
                createdBy: userId,
                updatedBy: userId,
              },
            },
            sprints: {
              create: {
                name: 'Backlog',
                goal: 'Initial import from Jira',
                status: 'ACTIVE',
                isDefault: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                createdBy: userId,
                updatedBy: userId,
              },
            },
          },
          include: {
            sprints: {
              where: { isDefault: true },
              select: { id: true },
            },
            members: true,
          },
        });

        importedProjects.push(project.id);

        // Fetch Jira statuses and create task statuses
        const jiraStatuses = await this.jiraApi.getProjectStatuses(
          sync.jiraSiteUrl,
          projectKey,
          email,
          apiToken,
        );

        const statusMappings: Record<string, string> = { ...providedMappings };

        if (jiraStatuses.length > 0) {
          // Re-fetch existing statuses fresh per project so statuses created
          // during earlier iterations of this loop are visible here.
          const existingWorkflowStatuses = await this.prisma.taskStatus.findMany({
            where: { workflowId: workflow.id, deletedAt: null },
          });

          // Map each Jira status to a Taskosaur TaskStatus
          for (let i = 0; i < jiraStatuses.length; i++) {
            const jiraStatus = jiraStatuses[i];

            // If mapping provided in frontend, use it
            if (statusMappings[jiraStatus.id]) continue;

            // Use upsert on the unique (workflowId, name) constraint so this is
            // idempotent: it won't fail if the status already exists in the
            // shared default workflow from a previous project's import.
            // Map Jira statusCategory.key → Taskosaur StatusCategory
            const category = this.jiraStatusToCategory(jiraStatus.statusCategory?.key);
            const taskStatus = await this.prisma.taskStatus.upsert({
              where: {
                workflowId_name: {
                  workflowId: workflow.id,
                  name: jiraStatus.name,
                },
              },
              update: {
                updatedBy: userId,
              },
              create: {
                name: jiraStatus.name,
                position: i + existingWorkflowStatuses.length,
                workflowId: workflow.id,
                category,
                color:
                  category === 'DONE'
                    ? '#00875A'
                    : category === 'IN_PROGRESS'
                      ? '#0052CC'
                      : '#DFE1E6',
                createdBy: userId,
                updatedBy: userId,
              },
            });
            statusMappings[jiraStatus.id] = taskStatus.id;
          }
        } else {
          // No Jira statuses found — upsert a single fallback "To Do" status
          this.logger.warn(
            `No statuses found for Jira project ${projectKey}; upserting default "To Do" status`,
          );
          await this.prisma.taskStatus.upsert({
            where: {
              workflowId_name: {
                workflowId: workflow.id,
                name: 'To Do',
              },
            },
            update: { updatedBy: userId },
            create: {
              name: 'To Do',
              position: 0,
              workflowId: workflow.id,
              category: 'TODO',
              color: '#0052CC',
              createdBy: userId,
              updatedBy: userId,
            },
          });
        }

        // Create project-level JiraSync record BEFORE importing issues so that
        // subsequent scheduled syncs can pick up this project even if task import fails.
        const projectSync = await this.prisma.jiraSync.create({
          data: {
            projectId: project.id,
            jiraSiteUrl: sync.jiraSiteUrl,
            jiraProjectKey: projectKey,
            jiraEmail: sync.jiraEmail, // reuse workspace encrypted credentials
            jiraApiToken: sync.jiraApiToken,
            syncEnabled: true,
            syncInterval: 15,
            statusMappings,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        // Trigger the newly batched runSync to handle the actual import and mappings!
        const result = await this.runSync(projectSync, userId);
        this.logger.log(
          `Imported ${result.issuesProcessed} issues from Jira project ${jiraProject.key} to project ${project.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to import Jira project ${projectKey}: ${error.message}`,
          error.stack,
        );
        this.logger.error(
          `Full error context for ${projectKey}: ${JSON.stringify({ message: error.message, code: error.code, meta: error.meta })}`,
        );
        // Continue with next project
      }
    }

    return {
      success: true,
      importedProjectsCount: importedProjects.length,
      projectIds: importedProjects,
    };
  }

  async updateWorkspaceConfig(workspaceId: string, dto: ConnectJiraWorkspaceDto, userId: string) {
    const sync = await this.findWorkspaceSyncOrFail(workspaceId);

    const valid = await this.jiraApi.validateCredentials(
      dto.jiraSiteUrl,
      dto.jiraEmail,
      dto.jiraApiToken,
    );
    if (!valid) throw new BadRequestException('Invalid Jira credentials.');

    const encryptedEmail = this.crypto.encrypt(dto.jiraEmail);
    const encryptedToken = this.crypto.encrypt(dto.jiraApiToken);

    const updated = await this.prisma.jiraSync.update({
      where: { id: sync.id },
      data: {
        jiraSiteUrl: dto.jiraSiteUrl,
        jiraEmail: encryptedEmail,
        jiraApiToken: encryptedToken,
        updatedBy: userId,
      },
    });

    return this.safeResponse(updated);
  }

  async getWorkspaceSyncedProjects(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: { jiraSync: true },
      orderBy: { name: 'asc' },
    });

    return projects
      .filter((p) => p.jiraSync)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        jiraProjectKey: p.jiraSync?.jiraProjectKey,
        jiraSiteUrl: p.jiraSync?.jiraSiteUrl,
        lastSyncAt: p.jiraSync?.lastSyncAt,
        lastSyncStatus: p.jiraSync?.lastSyncStatus,
        syncEnabled: p.jiraSync?.syncEnabled,
        issuesImported: p.jiraSync?.issuesImported,
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
    await this.prisma.jiraSync.delete({ where: { workspaceId } });
    this.logger.log(`Jira sync disconnected for workspace ${workspaceId}`);
    return { message: 'Jira workspace sync disconnected successfully' };
  }

  // ─────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────
  private async findSyncOrFail(projectId: string) {
    const sync = await this.prisma.jiraSync.findUnique({ where: { projectId } });
    if (!sync) throw new NotFoundException('No Jira sync configured for this project');
    return sync;
  }

  private async findWorkspaceSyncOrFail(workspaceId: string) {
    const sync = await this.prisma.jiraSync.findUnique({ where: { workspaceId } });
    if (!sync) throw new NotFoundException('No Jira sync configured for this workspace');
    return sync;
  }

  private decryptCredentials(sync: JiraSync): { email: string; apiToken: string } {
    return {
      email: this.crypto.decrypt(sync.jiraEmail),
      apiToken: this.crypto.decrypt(sync.jiraApiToken),
    };
  }

  /** Strip encrypted fields from the response */
  private safeResponse(sync: JiraSync) {
    const { jiraEmail, jiraApiToken, ...safe } = sync;
    return {
      ...safe,
      hasEmail: !!jiraEmail,
      hasApiToken: !!jiraApiToken,
    };
  }
}
