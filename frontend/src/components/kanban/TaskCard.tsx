import React from "react";
import { CardContent } from "@/components/ui/card";
import { HiChatBubbleLeft, HiCalendarDays, HiPaperClip } from "react-icons/hi2";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  taskNumber: number;
  assignees?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
  reporters?: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  subtaskCount?: number;
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

interface TaskCardProps {
  task: KanbanTask;
  statusId: string;
  isDragging: boolean;
  onDragStart: (task: KanbanTask, statusId: string) => void;
  onDragEnd: () => void;
  onClick?: (task: KanbanTask) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "HIGHEST":
      return "#ef4444";
    case "HIGH":
      return "#f97316";
    case "MEDIUM":
      return "#eab308";
    case "LOW":
      return "#22c55e";
    case "LOWEST":
      return "#6b7280";
    default:
      return "#6b7280";
  }
};

const getCategoryFromDescription = (description?: string) => {
  if (!description) return { name: "Task", color: "#6b7280" };

  const desc = description.toLowerCase();
  if (desc.includes("development") || desc.includes("code") || desc.includes("api")) {
    return { name: "Development", color: "#3b82f6" };
  }
  if (desc.includes("design") || desc.includes("ui") || desc.includes("ux")) {
    return { name: "Design", color: "#10b981" };
  }
  if (desc.includes("writing") || desc.includes("content")) {
    return { name: "UX Writing", color: "#f59e0b" };
  }
  return { name: "Task", color: "#6b7280" };
};

const getInitials = (firstName?: string, lastName?: string) => {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
};

const formatDueDate = (dueDate: string) => {
  const due = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time parts for comparison
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);

  if (due.getTime() === today.getTime()) {
    return "Today";
  } else if (due.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  } else {
    return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  statusId,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const category = getCategoryFromDescription(task.description);
  const priorityColor = getPriorityColor(task.priority);

  // Handle click with proper event handling
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    e.stopPropagation();

    // Call onClick if provided
    if (onClick) {
      onClick(task);
    }
  };

  // Handle drag start with click prevention
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
    onDragStart(task, statusId);
  };

  // Get assignees - support both old (single assignee) and new (assignees array) format
  const assignees = task.assignees || [];
  const hasAssignees = assignees.length > 0;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      className={cn(
        "rounded-lg border mb-3 cursor-move transition-all duration-200 hover:shadow-md h-[150px]",
        isDragging && "opacity-50 rotate-1 shadow-lg",
        onClick && "hover:cursor-pointer"
      )}
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <CardContent className="p-4">
        {/* Task Title */}
        <h4
          className="text-sm font-medium mb-2 line-clamp-1"
          style={{ color: "var(--foreground)" }}
        >
          {task.title}
        </h4>

        {/* Category Tag */}
        <div className="mb-3">
          <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium text-[var(--muted-foreground)]`}
          >
            {task.priority}
          </span>
        </div>

        {/* Bottom Section */}
        <div className="flex items-center justify-between">
          {/* Left side - Meta info */}
          <div
            className="flex items-center gap-3 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {task.commentCount && task.commentCount > 0 && (
              <div className="flex items-center gap-1">
                <HiChatBubbleLeft size={12} />
                <span>{task.commentCount}</span>
              </div>
            )}

            {task.subtaskCount && task.subtaskCount > 0 && (
              <div className="flex items-center gap-1">
                <HiPaperClip size={12} />
                <span>{task.subtaskCount}</span>
              </div>
            )}

            {task.dueDate && (
              <div
                className={cn("flex items-center gap-1", isOverdue && "text-red-500")}
                style={isOverdue ? { color: "var(--destructive)" } : {}}
              >
                <HiCalendarDays size={12} />
                <span>{formatDueDate(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Right side - Assignee Avatars */}
          {hasAssignees && (
            <div className="flex items-center -space-x-2">
              {assignees.slice(0, 3).map((assignee, index) => (
                <div
                  key={assignee.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[var(--card)]"
                  style={{
                    backgroundColor: priorityColor,
                    color: "var(--primary-foreground)",
                    zIndex: assignees.length - index,
                  }}
                  title={`${assignee.firstName} ${assignee.lastName}`}
                >
                  {assignee.avatar ? (
                    <Image
                      src={assignee.avatar}
                      alt={`${assignee.firstName} ${assignee.lastName}`}
                      className="w-full h-full rounded-full object-cover"
                      height={24}
                      width={24}
                    />
                  ) : (
                    getInitials(assignee.firstName, assignee.lastName)
                  )}
                </div>
              ))}

              {/* Show +N if more than 3 assignees */}
              {assignees.length > 3 && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[var(--card)]"
                  style={{
                    backgroundColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                    zIndex: 0,
                  }}
                  title={`${assignees.length - 3} more assignees`}
                >
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </div>
  );
};

export default TaskCard;
