import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

interface TaskGroupSectionProps {
  groupKey: string;
  label: string;
  tasks: Task[];
  itemIds?: string[];
  renderRow: (task: Task, index: number) => React.ReactNode;
  defaultExpanded?: boolean;
  /** True total count of tasks in this group (from the DB) */
  totalCount: number;
  /** Current page being shown (1-based, only meaningful when totalPages > 1) */
  page?: number;
  totalPages?: number;
  loadingMore?: boolean;
  onPageChange?: (page: number) => void;
}

const TaskGroupSection: React.FC<TaskGroupSectionProps> = ({
  groupKey,
  label,
  tasks,
  itemIds,
  renderRow,
  defaultExpanded = true,
  totalCount,
  page = 1,
  totalPages = 1,
  loadingMore = false,
  onPageChange,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const showPager = totalPages >= 1 && onPageChange;

  return (
    <tbody className="task-group-section" data-group-key={groupKey}>
      {/* ── Group Header Row ── */}
      <tr
        className={cn(
          "task-group-header select-none",
          "bg-[var(--accent)]/30 hover:bg-[var(--accent)]/50 transition-colors cursor-pointer"
        )}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <td colSpan={999} className="py-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted-foreground)]">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>

            <span className="text-xs font-semibold text-[var(--foreground)] tracking-wide uppercase">
              {label}
            </span>

            {/* Total count badge */}
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--border)]/60 text-[10px] font-medium text-[var(--muted-foreground)]">
              {totalCount}
            </span>
          </div>
        </td>
      </tr>

      {/* ── Task Rows ── */}
      {expanded && (
        <>
          {loadingMore ? (
            <tr>
              <td colSpan={999} className="py-4 text-center text-sm text-[var(--muted-foreground)] animate-pulse">
                Loading…
              </td>
            </tr>
          ) : (
            itemIds ? (
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {tasks.map((task, i) => renderRow(task, i))}
              </SortableContext>
            ) : (
              tasks.map((task, i) => renderRow(task, i))
            )
          )}

          {/* ── Per-group pagination bar ── */}
          {showPager && (
            <tr className="task-group-pager">
              <td colSpan={999} className="py-1.5 px-4 border-t border-[var(--border)]/20">
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="p-1 rounded hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={page <= 1 || loadingMore}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    className="p-1 rounded hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={page >= totalPages || loadingMore}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
                  </button>
                </div>
              </td>
            </tr>
          )}
        </>
      )}
    </tbody>
  );
};

export default TaskGroupSection;
