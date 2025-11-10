import { TimelineHeaderProps, ViewMode } from "@/types";
import { getViewModeWidth, isWeekend } from "@/utils/gantt";
import { useCallback } from "react";

// Timeline Header Component
export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  timeRange,
  viewMode,
  isCompact,
}) => {
  const formatDateForView = useCallback((date: Date, mode: ViewMode): string => {
    try {
      switch (mode) {
        case "days":
          return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          }).format(date);
        case "weeks":
          const weekEnd = new Date(date);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return `${new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          }).format(date)} - ${new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          }).format(weekEnd)}`;
        case "months":
          return new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
          }).format(date);
        default:
          return date.toLocaleDateString();
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return date.toString();
    }
  }, []);

  return (
    <div className="flex min-h-[64.98px] sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)] shadow-sm">
      <div
        className={`${
          isCompact ? "w-48" : "w-80"
        } bg-[var(--muted)] border-r border-[var(--border)] flex items-center px-4 py-3 shrink-0 sticky left-0 z-20`}
        role="columnheader"
      >
        <span className="text-sm font-semibold text-[var(--foreground)]">Tasks</span>
      </div>
      <div className="flex flex-1" role="row">
        {timeRange.days.map((day, index) => {
          const isToday = new Date().toDateString() === day.toDateString();
          const cellWidth = getViewModeWidth(viewMode);
          return (
            <div
              key={index}
              className={`text-xs text-center py-3 border-r border-[var(--border)] shrink-0 ${
                isWeekend(day)
                  ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  : isToday
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
              style={{ width: `${cellWidth}px` }}
              role="columnheader"
            >
              <div className="break-words px-2">
                {viewMode === "days"
                  ? formatDateForView(day, viewMode).split(" ")[1] ||
                    formatDateForView(day, viewMode)
                  : formatDateForView(day, viewMode)}
              </div>
              {isToday && viewMode === "days" && (
                <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mx-auto mt-1"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
