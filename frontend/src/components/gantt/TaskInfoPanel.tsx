import { Task } from "@/types";
import Link from "next/link";
import { HiCalendarDays } from "react-icons/hi2";

interface TaskInfoPanelProps {
  task: Task;
  isCompact: boolean;
  isOverdue: boolean;
  workspaceSlug: string;
  projectSlug?: string;
  onFocus: (taskId: string) => void;
}

// Utility to validate slug strings: alphanumeric and dash only
function sanitizeSlug(slug: string | undefined): string | undefined {
  return slug && /^[a-zA-Z0-9\-]+$/.test(slug) ? slug : undefined;
}

// Task Info Panel Component
export const TaskInfoPanel: React.FC<TaskInfoPanelProps> = ({
  task,
  isCompact,
  isOverdue,
  workspaceSlug,
  projectSlug,
  onFocus,
}) => {
  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
  const safeProjectSlug = sanitizeSlug(projectSlug);

  return (
    <div
      className={`${
        isCompact ? "w-48" : "w-80"
      } px-4 border-r border-[var(--border)] shrink-0 sticky left-0 z-[999999] py-2 bg-[var(--card)] `}
      role="cell"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={
              safeWorkspaceSlug && safeProjectSlug
                ? `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/${task.id}`
                : safeWorkspaceSlug
                  ? `/${safeWorkspaceSlug}/tasks/${task.id}`
                  : `/tasks/${task.id}`
            }
            className={`font-medium text-[var(--foreground)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 rounded-sm ${
              isCompact ? "text-sm" : "text-base"
            } ${isOverdue ? "text-red-600 dark:text-red-400" : ""}`}
            title={task.title || "Untitled Task"}
            onClick={() => onFocus(task.id)}
          >
            <span className="line-clamp-1 break-words text-sm">
              {task.title || "Untitled Task"}
            </span>
          </Link>

          {/* {task.priority && <PriorityBadge priority={task.priority} />} */}
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* <StatusBadge status={task.status.name} /> */}

          <div
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] shrink-0"
            title={`Due: ${
              task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"
            }`}
          >
            <HiCalendarDays className="w-3 h-3 shrink-0" />
            <span>
              {task.dueDate
                ? new Date(task.dueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "No date"}
            </span>
            {isOverdue && <span className="text-red-600 dark:text-red-400 font-bold ml-1">!</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
