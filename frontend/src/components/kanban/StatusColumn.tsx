import React, { useState, useEffect } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiPlus, HiXMark, HiSquare3Stack3D } from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { useProjectContext } from "@/contexts/project-context";
import TaskCard from "./TaskCard";
import { Input } from "../ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import moment from "moment";

interface TaskPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface TasksByStatus {
  statusId: string;
  statusName: string;
  statusColor: string;
  statusCategory: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  tasks: KanbanTask[];
  pagination: TaskPagination;
}

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

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
}

interface ProjectMember {
  id: string;
  user?: User;
  role: string;
}

interface StatusColumnProps {
  status: TasksByStatus;
  projectId: string;
  dragState: any;
  onDragOver: (e: React.DragEvent, statusId: string) => void;
  onDrop: (e: React.DragEvent, statusId: string) => void;
  onTaskDragStart: (task: KanbanTask, statusId: string) => void;
  onTaskDragEnd: () => void;
  onCreateTask: (statusId: string, taskData: any) => void;
  onTaskClick?: (task: KanbanTask) => any;
  onLoadMore?: (statusId: string, currentPage: number) => void;
  isLoadingMore?: boolean;
}

const StatusColumn: React.FC<StatusColumnProps> = ({
  status,
  projectId,
  dragState,
  onDragOver,
  onDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onCreateTask,
  onTaskClick,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const { getProjectMembers } = useProjectContext();

  const [isCreating, setIsCreating] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    dueDate: "",
    reporterId: "",
    priority: "MEDIUM",
  });
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [canStatusChange, setStatusChange] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    getUserAccess({ name: "project", id: projectId })
      .then((data) => {
        setHasAccess(data?.canChange || !(data?.role === "VIEWER"));
        setStatusChange(data?.role === "MANAGER" || data?.role || "OWNER" || data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [projectId]);

  useEffect(() => {
    if (isCreating && projectId && members.length === 0) {
      loadProjectMembers();
    }
  }, [isCreating, projectId]);

  const loadProjectMembers = async () => {
    setLoading(true);
    try {
      const projectMembers = await getProjectMembers(projectId);
      setMembers(projectMembers || []);
    } catch (error) {
      console.error("Failed to load project members:", error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (onLoadMore && status.pagination?.hasNextPage && !isLoadingMore) {
      onLoadMore(status.statusId, status.pagination.page + 1);
    }
  };

  const reset = () => {
    setIsCreating(false);
    setTaskForm({
      title: "",
      dueDate: "",
      reporterId: "",
      priority: "MEDIUM",
    });
  };

  const isFormValid = () => {
    return taskForm.title.trim();
  };

  const save = () => {
    if (isFormValid()) {
      onCreateTask(status.statusId, taskForm);
      reset();
    }
  };

  const getStatusIndicator = () => {
    switch (status.statusCategory) {
      case "TODO":
        return (
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.statusColor }} />
        );
      case "IN_PROGRESS":
        return (
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.statusColor }} />
        );
      case "DONE":
        return (
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.statusColor }} />
        );
      default:
        return <HiSquare3Stack3D className="w-4 h-4" style={{ color: status.statusColor }} />;
    }
  };

  const taskCount = status.pagination?.total ?? (status as any)._count ?? 0;

  return (
    <div className="kanban-column-container group">
      <div className="kanban-column-wrapper" style={{ backgroundColor: "var(--muted)" }}>
        {/* Header */}
        <div className="kanban-column-header flex justify-between items-center">
          <div className="kanban-column-header-content">
            {getStatusIndicator()}
            <h3 className="kanban-column-title">{status.statusName}</h3>
            <Badge
              variant="secondary"
              className="kanban-column-counter"
              style={{
                backgroundColor: `${status.statusColor}20`,
                color: status.statusColor,
                borderColor: `${status.statusColor}40`,
              }}
            >
              {taskCount}
            </Badge>
          </div>
          {/* Add Task Button */}
          {!isCreating && hasAccess && (
            <Button
              variant="ghost"
              onClick={() => setIsCreating(true)}
              className="kanban-column-add-task-button"
            >
              <HiPlus size={14} />
              Add a task
            </Button>
          )}
        </div>

        {/* Tasks Container */}
        <div
          onDragOver={(e) => onDragOver(e, status.statusId)}
          onDrop={(e) => onDrop(e, status.statusId)}
          className={cn(
            "kanban-column-tasks-container",
            dragState.isDragging &&
              dragState.draggedTo === status.statusId &&
              "kanban-column-tasks-container-dragging"
          )}
          style={{
            backgroundColor:
              dragState.isDragging && dragState.draggedTo === status.statusId
                ? `${status.statusColor}10`
                : "transparent",
          }}
        >
          {/* Create Task Form */}
          {isCreating && (
            <div className="kanban-create-task-container">
              <CardContent className="kanban-create-task-content">
                {/* Form Header */}
                <div className="kanban-create-task-header">
                  <span className="kanban-create-task-title">Create new task</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="kanban-create-task-close-button"
                  >
                    <HiXMark size={14} />
                  </Button>
                </div>

                {/* Task title */}
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  className="kanban-create-task-title-input"
                  autoFocus
                />

                {/* Due date & priority */}
                <div className="kanban-create-task-form-grid">
                  <div className="kanban-create-task-field">
                    <label className="kanban-create-task-label">Due date</label>
                    <Input
                      type="date"
                      min={moment().format("YYYY-MM-DD")}
                      value={taskForm.dueDate ? moment(taskForm.dueDate).format("YYYY-MM-DD") : ""}
                      onChange={(e) =>
                        setTaskForm((p) => ({
                          ...p,
                          dueDate: moment(e.target.value).format("YYYY-MM-DD"),
                        }))
                      }
                      className="kanban-create-task-date-input"
                    />
                  </div>

                  <div className="kanban-create-task-field">
                    <label className="kanban-create-task-label">Priority</label>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="kanban-create-task-priority-dropdown">
                          {taskForm.priority === "LOW" && "🔵 Low"}
                          {taskForm.priority === "MEDIUM" && "🟡 Medium"}
                          {taskForm.priority === "HIGH" && "🟠 High"}
                          {taskForm.priority === "HIGHEST" && "🔴 Highest"}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="kanban-create-task-priority-content">
                        <DropdownMenuItem
                          onClick={() => setTaskForm((p) => ({ ...p, priority: "LOW" }))}
                          className="kanban-create-task-priority-item"
                        >
                          🔵 Low
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskForm((p) => ({ ...p, priority: "MEDIUM" }))}
                          className="kanban-create-task-priority-item"
                        >
                          🟡 Medium
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskForm((p) => ({ ...p, priority: "HIGH" }))}
                          className="kanban-create-task-priority-item"
                        >
                          🟠 High
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskForm((p) => ({ ...p, priority: "HIGHEST" }))}
                          className="kanban-create-task-priority-item"
                        >
                          🔴 Highest
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* actions */}
                <div className="kanban-create-task-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="kanban-create-task-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={save}
                    disabled={!isFormValid()}
                    className="kanban-create-task-submit"
                    style={{
                      backgroundColor: status.statusColor,
                      color: "white",
                    }}
                  >
                    Create Task
                  </Button>
                </div>
              </CardContent>
            </div>
          )}

          {status.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              statusId={status.statusId}
              isDragging={dragState.isDragging && dragState.draggedItem?.id === task.id}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
              onClick={onTaskClick}
            />
          ))}

          {/* Loading indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          )}

          {/* Load More Button */}
          {!isLoadingMore && status.pagination?.hasNextPage && (
            <Button
              variant="ghost"
              onClick={handleLoadMore}
              className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2"
            >
              Load More ({status.pagination.total - status.tasks.length} remaining)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusColumn;
