import type React from "react";
import { Badge } from "../ui";

export type TaskStatus =
  | "todo"
  | "in-progress"
  | "in-review"
  | "completed"
  | "done"
  | "backlog"
  | "cancelled";

export type ProjectStatus = "active" | "completed" | "on_hold" | "cancelled" | "planning";

interface StatusBadgeProps {
  status: TaskStatus | ProjectStatus | string | { name: string; color?: string; category?: string };
  type?: "task" | "project";
  className?: string;
}

const taskStatusClassMap: Record<TaskStatus, string> = {
  todo: "",
  backlog: "statusbadge-todo",
  "in-progress": "statusbadge-inprogress",
  "in-review": "statusbadge-inreview",
  completed: "statusbadge-done",
  done: "statusbadge-done",
  cancelled: "statusbadge-cancelled",
};

const projectStatusClassMap: Record<ProjectStatus, string> = {
  active: "statusbadge-inprogress",
  completed: "statusbadge-done",
  on_hold: "statusbadge-todo",
  cancelled: "statusbadge-cancelled",
  planning: "statusbadge-todo",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  backlog: "Backlog",
  "in-progress": "In Progress",
  "in-review": "In Review",
  completed: "Completed",
  done: "Done",
  cancelled: "Cancelled",
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  planning: "Planning",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = "task", className }) => {
  const statusName = typeof status === "string" ? status : status?.name || "unknown";
  const normalizedStatus = statusName.toLowerCase().replace(/\s+/g, "-");

  let statusClass = "statusbadge-todo";
  let label = statusName;

  if (type === "task") {
    const taskStatus = normalizedStatus as TaskStatus;
    statusClass = taskStatusClassMap[taskStatus] || "statusbadge-todo";
    label = taskStatusLabels[taskStatus] || statusName;
  } else if (type === "project") {
    const projectStatus = normalizedStatus as ProjectStatus;
    statusClass = projectStatusClassMap[projectStatus] || "statusbadge-todo";
    label = projectStatusLabels[projectStatus] || statusName;
  }

  const combinedClasses = `statusbadge-base ${statusClass} ${className || ""}`;

  return (
    <Badge className={`${combinedClasses} `}>
      <span className="text-white">{label}</span>
    </Badge>
  );
};
