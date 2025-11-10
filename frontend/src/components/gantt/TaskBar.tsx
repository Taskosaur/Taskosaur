import { Task, TimeRange, ViewMode } from "@/types";
import {
  calculateTaskPosition,
  getPriorityColors,
  getViewModeWidth,
  isWeekend,
  parseDate,
} from "@/utils/gantt";
import { useRouter } from "next/router";
import { type KeyboardEvent } from "react";
import { StatusBadge } from "../ui";
import { HiCheckCircle, HiClock } from "react-icons/hi";
import { HiExclamationTriangle } from "react-icons/hi2";

interface TaskBarProps {
  task: Task;
  timeRange: TimeRange;
  viewMode: ViewMode;
  isCompact: boolean;
  isHovered: boolean;
  isFocused: boolean;
  workspaceSlug: string;
  projectSlug?: string;
  onHover: (taskId: string | null) => void;
  onFocus: (taskId: string | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, task: Task) => void;
}

// Task Bar Component
export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  timeRange,
  viewMode,
  isCompact,
  isHovered,
  isFocused,
  workspaceSlug,
  projectSlug,
  onHover,
  onFocus,
  onKeyDown,
}) => {
  const router = useRouter();
  const taskStart = parseDate(task.startDate);
  const taskEnd = parseDate(task.dueDate);

  // Use the new calculation function
  const { barLeft, finalBarWidth, actualDuration } = calculateTaskPosition(
    taskStart,
    taskEnd,
    timeRange,
    viewMode
  );

  const priorityColors = getPriorityColors(task.priority || "low");

  const isOverdue = taskEnd < new Date() && task.status.name.toLowerCase() !== "done";

  const isDone = task.status.name.toLowerCase() === "done";
  const isInProgress = task.status.name.toLowerCase().includes("progress");

  const handleNavigation = () => {
    const href =
      workspaceSlug && projectSlug
        ? `/${workspaceSlug}/${projectSlug}/tasks/${task.id}`
        : workspaceSlug
          ? `/${workspaceSlug}/tasks/${task.id}`
          : `/tasks/${task.id}`;
    router.push(href);
  };

  const totalDays = timeRange.days.length;
  const cellWidth = getViewModeWidth(viewMode);

  return (
    <div
      className="relative flex-1 h-12"
      style={{
        minWidth: `${totalDays * cellWidth}px`,
      }}
      role="cell"
    >
      {/* Background Grid */}
      <div className="absolute inset-0 flex">
        {timeRange.days.map((day, index) => {
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={index}
              className={`border-r border-[var(--border)] shrink-0 ${
                isWeekend(day) && viewMode === "days"
                  ? "bg-[var(--muted)]"
                  : isToday
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                    : "hover:bg-[var(--accent)]"
              }`}
              style={{ width: `${cellWidth}px` }}
            >
              {isToday && (
                <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-600 dark:border-blue-400"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Task Bar */}
      <div
        className={`absolute rounded-lg shadow-md border-2 cursor-pointer transition-all group ${
          priorityColors.bg
        } ${priorityColors.border} ${isOverdue ? "border-red-500 animate-pulse" : ""}`}
        style={{
          left: `${barLeft}px`,
          width: `${finalBarWidth}px`,
          height: isCompact ? "20px" : "28px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
        title={`${task.title || "Untitled Task"}\nStatus: ${
          task.status.name
        }\nDuration: ${actualDuration} ${viewMode === "days" ? "days" : viewMode}`}
        tabIndex={0}
        role="button"
        onMouseEnter={() => onHover(task.id)}
        onMouseLeave={() => onHover(null)}
        onKeyDown={(e) => onKeyDown(e, task)}
        onFocus={() => onFocus(task.id)}
        onBlur={() => onFocus(null)}
        onClick={handleNavigation}
      >
        <div className="h-full flex items-center justify-between px-2 text-white text-sm">
          {finalBarWidth > 60 && !isCompact && (
            <span className={`text-xs font-medium truncate text-white`}>
              {task.title?.substring(0, Math.floor(finalBarWidth / 10))}
              {task.title && task.title.length > Math.floor(finalBarWidth / 10) ? "..." : ""}
            </span>
          )}

          {/* Icons */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Status icons */}
            {isDone && <HiCheckCircle className="w-4 h-4 text-white drop-shadow-sm" />}
            {isOverdue && !isDone && (
              <HiExclamationTriangle className="w-4 h-4 text-white drop-shadow-sm animate-pulse" />
            )}
            {isInProgress && <HiClock className="w-4 h-4 text-white drop-shadow-sm" />}
          </div>
        </div>

        {/* Hover Tooltip */}
        {(isHovered || isFocused) && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[var(--popover)] text-[var(--popover-foreground)] px-3 py-2 rounded-lg shadow-lg z-40 whitespace-nowrap max-w-xs border border-[var(--border)] text-sm">
            <div className="font-semibold truncate text-sm">{task.title || "Untitled Task"}</div>
            <div className="text-[var(--muted-foreground)] mt-1 text-xs">
              {new Date(task.startDate!).toLocaleDateString()} -{" "}
              {new Date(task.dueDate!).toLocaleDateString()}
            </div>
            <div className="mt-2 text-sm">
              <StatusBadge status={task.status.name} />
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--popover)]"></div>
          </div>
        )}
      </div>
    </div>
  );
};
