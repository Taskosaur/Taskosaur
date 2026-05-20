import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, ScopeType, ViewType } from '@prisma/client';
import { ReorderDto } from './dto/reorder.dto';

@Injectable()
export class TaskRanksService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return `This action returns all taskRanks`;
  }

  findOne(id: number) {
    return `This action returns a #${id} taskRank`;
  }

  remove(id: number) {
    return `This action removes a #${id} taskRank`;
  }

  /**
   * Computes a rank between two neighbors.
   * @param predecessorRank The rank of the task appearing BEFORE the drop point.
   * @param successorRank The rank of the task appearing AFTER the drop point.
   */
  private computeRank(predecessorRank: number | null, successorRank: number | null): number {
    if (predecessorRank === null && successorRank === null) return 1.0;
    if (predecessorRank === null) return successorRank! - 1.0; // dropped at absolute top
    if (successorRank === null) return predecessorRank + 1.0; // dropped at absolute bottom
    return (predecessorRank + successorRank) / 2.0;
  }

  private needsRebalance(
    afterRank: number | null,
    beforeRank: number | null,
    neighbor: number,
  ): boolean {
    // Check if the rank is too close to its neighbor
    const threshold = 0.0001;
    if (afterRank !== null && Math.abs(afterRank - neighbor) < threshold) return true;
    if (beforeRank !== null && Math.abs(beforeRank - neighbor) < threshold) return true;
    return false;
  }

  async rebalance(scopeType: ScopeType, scopeId: string, viewType: ViewType): Promise<void> {
    const rows = await this.prisma.taskRank.findMany({
      where: { scopeType, scopeId, viewType },
      orderBy: [
        { rank: 'asc' },
        { taskId: 'asc' }, // Secondary sort for absolute determinism
      ],
      select: { id: true },
    });

    await this.prisma.$transaction(
      rows.map((row, i) =>
        this.prisma.taskRank.update({
          where: { id: row.id },
          data: { rank: i + 1 },
        }),
      ),
    );
  }

  async seedForTask(
    taskId: string,
    projectId: string,
    workspaceId: string,
    orgId: string,
    tx: Prisma.TransactionClient,
  ) {
    const scopes = [
      { scopeType: ScopeType.PROJECT, scopeId: projectId },
      { scopeType: ScopeType.WORKSPACE, scopeId: workspaceId },
      { scopeType: ScopeType.ORGANIZATION, scopeId: orgId },
    ];

    const views = [ViewType.LIST, ViewType.GANTT, ViewType.BOARD];

    const existingMaxRanks = await tx.taskRank.groupBy({
      by: ['scopeType', 'scopeId', 'viewType'],
      where: {
        OR: scopes.flatMap((scope) =>
          views.map((view) => ({
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            viewType: view,
          })),
        ),
      },
      _max: { rank: true },
    });

    const maxRankMap = new Map(
      existingMaxRanks.map((r) => [`${r.scopeType}:${r.scopeId}:${r.viewType}`, r._max.rank ?? 0]),
    );

    const rows = scopes.flatMap(({ scopeType, scopeId }) =>
      views.map((viewType) => ({
        taskId,
        scopeType,
        scopeId,
        viewType,
        rank: (maxRankMap.get(`${scopeType}:${scopeId}:${viewType}`) ?? 0) + 1,
      })),
    );

    await tx.taskRank.createMany({ data: rows });
  }

  async seedForTasksBatch(
    taskIds: string[],
    projectId: string,
    workspaceId: string,
    orgId: string,
    tx: Prisma.TransactionClient,
  ) {
    if (taskIds.length === 0) return;

    const scopes = [
      { scopeType: ScopeType.PROJECT, scopeId: projectId },
      { scopeType: ScopeType.WORKSPACE, scopeId: workspaceId },
      { scopeType: ScopeType.ORGANIZATION, scopeId: orgId },
    ];

    const views = [ViewType.LIST, ViewType.GANTT, ViewType.BOARD];

    const existingMaxRanks = await tx.taskRank.groupBy({
      by: ['scopeType', 'scopeId', 'viewType'],
      where: {
        OR: scopes.flatMap((scope) =>
          views.map((view) => ({
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            viewType: view,
          })),
        ),
      },
      _max: { rank: true },
    });

    const maxRankMap = new Map(
      existingMaxRanks.map((r) => [`${r.scopeType}:${r.scopeId}:${r.viewType}`, r._max.rank ?? 0]),
    );

    const rows: {
      taskId: string;
      scopeType: ScopeType;
      scopeId: string;
      viewType: ViewType;
      rank: number;
    }[] = [];
    for (const taskId of taskIds) {
      for (const { scopeType, scopeId } of scopes) {
        for (const viewType of views) {
          const key = `${scopeType}:${scopeId}:${viewType}`;
          const currentRank = (maxRankMap.get(key) ?? 0) + 1;
          rows.push({
            taskId,
            scopeType,
            scopeId,
            viewType,
            rank: currentRank,
          });
          maxRankMap.set(key, currentRank); // increment for the next task
        }
      }
    }

    await tx.taskRank.createMany({ data: rows });
  }

  /**
   * Ensures that EVERY task belonging to the given scope/view has a taskRank
   * row before we compute a reorder.  Tasks that were created before the
   * ranking system existed will have no row; without this guard the neighbor
   * lookup returns null for them and `computeRank` collapses everything to 1.0.
   *
   * Strategy
   * ─────────
   * 1. Find all tasks in the scope that are missing a rank row (ordered by
   *    createdAt so the existing visual order is respected).
   * 2. Find the current MAX rank so new rows are appended *after* every
   *    already-ranked task.
   * 3. Bulk-insert the missing rows with sequential integer ranks.
   *    `skipDuplicates: true` makes this idempotent and race-condition safe.
   */
  private async ensureRanksSeeded(
    scopeType: ScopeType,
    scopeId: string,
    viewType: ViewType,
  ): Promise<void> {
    // ── 1. Identify unranked TOP-LEVEL tasks in this scope ─────────────────
    // Order by task_number DESC so seeded ranks mirror the default API display
    // order (newest first).  This ensures that on a user's very first drag, the
    // rank ordering matches what they see on screen and subsequent reloads look
    // identical to the pre-drag state.
    let unrankedRows: { id: string }[] = [];

    if (scopeType === ScopeType.PROJECT) {
      unrankedRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT t.id
        FROM   tasks t
        WHERE  t.project_id = ${scopeId}::uuid
          AND  t.parent_task_id IS NULL
          AND  NOT EXISTS (
                 SELECT 1 FROM task_ranks tr
                 WHERE  tr.task_id        = t.id
                   AND  tr."scope_type"::text = ${scopeType as string}
                   AND  tr."scope_id"::uuid   = ${scopeId}::uuid
                   AND  tr."view_type"::text  = ${viewType as string}
               )
        ORDER BY t.task_number DESC
      `;
    } else if (scopeType === ScopeType.WORKSPACE) {
      unrankedRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT t.id
        FROM   tasks t
        INNER  JOIN projects p ON p.id = t.project_id
        WHERE  p.workspace_id = ${scopeId}::uuid
          AND  t.parent_task_id IS NULL
          AND  NOT EXISTS (
                 SELECT 1 FROM task_ranks tr
                 WHERE  tr.task_id        = t.id
                   AND  tr."scope_type"::text = ${scopeType as string}
                   AND  tr."scope_id"::uuid   = ${scopeId}::uuid
                   AND  tr."view_type"::text  = ${viewType as string}
               )
        ORDER BY t.task_number DESC
      `;
    } else {
      // ORGANIZATION
      unrankedRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT t.id
        FROM   tasks t
        INNER  JOIN projects  p ON p.id  = t.project_id
        INNER  JOIN workspaces w ON w.id = p.workspace_id
        WHERE  w.organization_id = ${scopeId}::uuid
          AND  t.parent_task_id IS NULL
          AND  NOT EXISTS (
                 SELECT 1 FROM task_ranks tr
                 WHERE  tr.task_id        = t.id
                   AND  tr."scope_type"::text = ${scopeType as string}
                   AND  tr."scope_id"::uuid   = ${scopeId}::uuid
                   AND  tr."view_type"::text  = ${viewType as string}
               )
        ORDER BY t.task_number DESC
      `;
    }

    if (unrankedRows.length === 0) return; // nothing to seed

    // ── 2. Find current maximum rank so new rows are appended at the bottom ─
    const aggResult = await this.prisma.taskRank.aggregate({
      where: { scopeType, scopeId, viewType },
      _max: { rank: true },
    });
    const base = aggResult._max.rank ?? 0;

    // ── 3. Bulk-insert missing rows ────────────────────────────────────────
    await this.prisma.taskRank.createMany({
      data: unrankedRows.map((row, i) => ({
        taskId: row.id,
        scopeType,
        scopeId,
        viewType,
        rank: base + i + 1,
      })),
      skipDuplicates: true, // idempotent — safe against concurrent requests
    });
  }

  private async getNeighborRanks(
    scopeType: ScopeType,
    scopeId: string,
    viewType: ViewType,
    afterTaskId: string | null,
    beforeTaskId: string | null,
  ): Promise<{ afterRank: number | null; beforeRank: number | null }> {
    const [after, before] = await Promise.all([
      afterTaskId
        ? this.prisma.taskRank.findUnique({
            where: {
              taskId_scopeType_scopeId_viewType: {
                taskId: afterTaskId,
                scopeType,
                scopeId,
                viewType,
              },
            },
            select: { rank: true },
          })
        : null,
      beforeTaskId
        ? this.prisma.taskRank.findUnique({
            where: {
              taskId_scopeType_scopeId_viewType: {
                taskId: beforeTaskId,
                scopeType,
                scopeId,
                viewType,
              },
            },
            select: { rank: true },
          })
        : null,
    ]);

    let afterRank = after?.rank ?? null;
    let beforeRank = before?.rank ?? null;

    // Cross-page or boundary drops: If we only have one neighbor from the frontend,
    // find the true adjacent rank in the database to prevent pagination collisions.
    if (beforeRank !== null && afterRank === null) {
      const trueAfter = await this.prisma.taskRank.findFirst({
        where: { scopeType, scopeId, viewType, rank: { lt: beforeRank } },
        orderBy: [{ rank: 'desc' }, { taskId: 'desc' }],
        select: { rank: true },
      });
      if (trueAfter) afterRank = trueAfter.rank;
    } else if (afterRank !== null && beforeRank === null) {
      const trueBefore = await this.prisma.taskRank.findFirst({
        where: { scopeType, scopeId, viewType, rank: { gt: afterRank } },
        orderBy: [{ rank: 'asc' }, { taskId: 'asc' }],
        select: { rank: true },
      });
      if (trueBefore) beforeRank = trueBefore.rank;
    }

    return { afterRank, beforeRank };
  }

  async reorder({
    taskId,
    scopeType,
    scopeId,
    viewType,
    afterTaskId,
    beforeTaskId,
  }: ReorderDto & { taskId: string }) {
    // ── Guard: seed rank rows for any tasks in this scope that are missing one ──
    // This makes drag-and-drop safe regardless of whether the dragged task or its
    // neighbors already have a rank entry.  Tasks created before the ranking table
    // existed are appended at the bottom (ordered by createdAt) so the current
    // visual order is preserved on first drag.
    await this.ensureRanksSeeded(scopeType, scopeId, viewType);

    const { afterRank, beforeRank } = await this.getNeighborRanks(
      scopeType,
      scopeId,
      viewType,
      afterTaskId,
      beforeTaskId,
    );

    const newRank = this.computeRank(afterRank, beforeRank);

    await this.prisma.taskRank.upsert({
      where: {
        taskId_scopeType_scopeId_viewType: {
          taskId,
          scopeType,
          scopeId,
          viewType,
        },
      },
      update: { rank: newRank },
      create: { taskId, scopeType, scopeId, viewType, rank: newRank },
    });

    if (this.needsRebalance(afterRank, beforeRank, newRank)) {
      await this.rebalance(scopeType, scopeId, viewType);
    }
  }
}
