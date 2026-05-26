import React from 'react';
import Tooltip from "@/components/common/ToolTip";

export interface ProjectHealthStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
  completionPredictor: number;
  heatmapData: number[];
}

interface ProjectHealthIndicatorProps {
  stats?: ProjectHealthStats;
}

export const ProjectHealthIndicator: React.FC<ProjectHealthIndicatorProps> = ({ stats }) => {
  if (!stats || stats.totalTasks === 0) {
    return (
      <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-[var(--border)]">
        <span className="text-xs text-[var(--muted-foreground)]">No tasks yet</span>
      </div>
    );
  }

  const maxTasks = Math.max(...stats.heatmapData, 1);

  return (
    <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-[var(--border)]">
      {/* Completion Predictor */}
      <Tooltip content={`Health Score: ${stats.completionPredictor}% (Based on completed & overdue tasks)`} position="top" color="primary">
        <div className="flex items-center gap-2 cursor-help">
          <div className="w-5 h-5">
            <svg viewBox="0 0 36 36" className="w-5 h-5 -rotate-90">
              {/* Background circle */}
              <path
                className="text-[var(--muted)]"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              {/* Progress circle */}
              <path
                className={
                  stats.completionPredictor > 75
                    ? "text-green-500"
                    : stats.completionPredictor > 40
                    ? "text-yellow-500"
                    : "text-red-500"
                }
                strokeDasharray={`${stats.completionPredictor}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[var(--foreground)]">{stats.completionPredictor}%</span>
        </div>
      </Tooltip>

      {/* Workload Heatmap */}
      <Tooltip content="Workload Heatmap (Tasks due in the next 14 days)" position="top" color="primary">
        <div className="flex items-center gap-[2px] cursor-help">
          {stats.heatmapData.map((count, i) => {
            const intensity = count / maxTasks;
            let bgClass = "bg-[var(--muted)]/50";
            if (intensity > 0) {
              if (intensity <= 0.3) bgClass = "bg-blue-300 dark:bg-blue-800";
              else if (intensity <= 0.7) bgClass = "bg-blue-400 dark:bg-blue-600";
              else bgClass = "bg-blue-500 dark:bg-blue-500";
            }

            return (
              <div
                key={i}
                className={`w-1.5 h-4 rounded-sm transition-colors ${bgClass}`}
                title={count > 0 ? `${count} tasks due in ${i} days` : `No tasks due in ${i} days`}
              />
            );
          })}
        </div>
      </Tooltip>
    </div>
  );
};
