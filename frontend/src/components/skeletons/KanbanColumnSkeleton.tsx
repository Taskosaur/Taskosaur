import React from "react";
import { Card } from "../ui/card";

interface KanbanColumnSkeletonProps {
  columnCount?: number;
  cardCount?: number;
}

export const KanbanColumnSkeleton: React.FC<KanbanColumnSkeletonProps> = ({
  columnCount = 4,
  cardCount = 4,
}) => {
  return (
    <div className="flex gap-4 w-full">
      {Array.from({ length: columnCount }).map((_, colIdx) => (
        <div key={colIdx} className="kanban-column-container animate-pulse flex-1">
          <div className="kanban-column-wrapper bg-[var(--muted)] rounded-md shadow-sm border border-[var(--border)]">
            <div className="kanban-column-header p-3 flex items-center justify-between border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[var(--muted-foreground)]" />
                <div className="h-4 w-24 bg-[var(--muted-foreground)]/30 rounded"></div>
              </div>
              <div className="h-5 w-8 bg-[var(--muted-foreground)]/30 rounded-full"></div>
            </div>
            <div className="kanban-column-tasks-container p-3 space-y-3 flex flex-col">
              {Array.from({ length: cardCount }).map((_, idx) => (
                <Card
                  key={idx}
                  className="bg-[var(--card)] border-[var(--border)] rounded-md p-3 shadow-sm min-h-[60px]"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--muted-foreground)]/30 rounded"></div>
                    <div className="h-3 w-1/2 bg-[var(--muted-foreground)]/20 rounded"></div>
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <div className="h-3 w-10 bg-[var(--muted-foreground)]/20 rounded"></div>
                    <div className="h-3 w-6 bg-[var(--muted-foreground)]/20 rounded"></div>
                  </div>
                </Card>
              ))}
              <div className="h-8 w-full bg-[var(--muted-foreground)]/10 rounded-md"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
