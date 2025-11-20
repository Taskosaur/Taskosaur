import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import TaskDetailClient from "./TaskDetailClient";
import { useTask } from "../../contexts/task-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/common/ActionButton";
import { DynamicBadge } from "@/components/common/DynamicBadge";
import {
  HiPencilSquare,
  HiXMark,
  HiListBullet,
  HiCalendar,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi2";
import Tooltip from "../common/ToolTip";
import { useAuth } from "@/contexts/auth-context";
import { Task } from "@/types";
import { Label, Select } from "../ui";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { PRIORITY_OPTIONS, TASK_TYPE_OPTIONS } from "@/utils/data/taskData";
import validator from "validator";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
}

interface SubtasksProps {
  taskId: string;
  projectId: string;
  onSubtaskAdded?: (subtask: Task) => void;
  onSubtaskUpdated?: (subtaskId: string, updates: any) => void;
  onSubtaskDeleted?: (subtaskId: string) => void;
  showConfirmModal?: (
    title: string,
    message: string,
    onConfirm: () => void,
    type?: "danger" | "warning" | "info"
  ) => void;
  isAssignOrRepoter: boolean;
  setLoading?: (loading: boolean) => void;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={20} className="text-[var(--primary)]" />
    <h2 className="text-md font-semibold text-[var(--foreground)]">{title}</h2>
  </div>
);

const Pagination = ({
  pagination,
  onPageChange,
  isLoading,
}: {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}) => {
  if (pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-[var(--border)] mt-4">
      <div className="text-sm text-[var(--muted-foreground)]">
        Showing {startItem} to {endItem} of {total} subtasks
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="h-8 px-3"
        >
          <HiChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              {pageNum}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="h-8 px-3"
        >
          Next
          <HiChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default function Subtasks({
  taskId,
  projectId,
  onSubtaskUpdated,
  onSubtaskDeleted,
  showConfirmModal,
  isAssignOrRepoter,
  setLoading,
}: SubtasksProps) {
  const {
    getSubtasksByParent,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    getAllTaskStatuses,
    isLoading,
    subtTask,
    subtaskPagination,
  } = useTask();

  const { getUserAccess, isAuthenticated } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<any[]>([]);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedSubtask, setSelectedSubtask] = useState<Task | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [subtaskPriority, setSubtaskPriority] = useState("MEDIUM");
  const [subtaskType, setSubtaskType] = useState("TASK");

  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const isAuth = isAuthenticated();

  // Get current user from localStorage
  useEffect(() => {
    const getUserFromStorage = () => {
      try {
        const userString = localStorage.getItem("user");
        if (userString) {
          const user: User = JSON.parse(userString);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
      }
    };

    getUserFromStorage();
  }, []);

  // Check user access
  useEffect(() => {
    if (!projectId || !isAuth) return;

    getUserAccess({ name: "project", id: projectId })
      .then((data) => {
        setHasAccess(data?.canChange || isAssignOrRepoter);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [projectId, isAssignOrRepoter]);

  // Fetch task statuses
  useEffect(() => {
    if (!isAuth) return;
    const fetchStatuses = async () => {
      try {
        const statuses = await getAllTaskStatuses();
        setTaskStatuses(statuses);
      } catch (error) {
        console.error("Failed to fetch task statuses:", error);
      }
    };

    fetchStatuses();
  }, []);

  // Effect to set loading state
  useEffect(() => {
    if (setLoading) {
      setLoading(isLoading);
    }
  }, [isLoading]);

  // Fetch subtasks when component mounts, taskId changes, or page changes
  useEffect(() => {
    if (!taskId) return;

    const fetchSubtasks = async () => {
      try {
        await getSubtasksByParent(taskId, isAuth, workspaceSlug as string, projectSlug as string, {
          page: currentPage,
          limit: pageSize,
        });
      } catch (error) {
        console.error("Failed to fetch subtasks:", error);
      } finally {
        if (setLoading) setLoading(false);
      }
    };

    fetchSubtasks();
  }, [taskId, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newSubtaskTitle.trim() || !currentUser) return;

    try {
      const defaultStatus = taskStatuses.find((s) => s.category === "TODO") || taskStatuses[0];

      if (!defaultStatus) {
        console.error("No task statuses available");
        return;
      }

      const subtaskData = {
        title: newSubtaskTitle.trim(),
        description: `Subtask for parent task`,
        priority: subtaskPriority as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
        type: ["TASK", "BUG", "EPIC", "STORY"].includes(subtaskType)
          ? (subtaskType as "TASK" | "BUG" | "EPIC" | "STORY")
          : "TASK",
        startDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        projectId,
        assigneeIds: [currentUser.id],
        statusId: defaultStatus.id,
        parentTaskId: taskId,
      };

      await createSubtask(subtaskData);

      setNewSubtaskTitle("");
      setSubtaskPriority("MEDIUM");
      setSubtaskType("TASK");
      setIsAddingSubtask(false);

      if (currentPage > 1 && subtTask.length >= pageSize) {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Failed to add subtask:", error);
    }
  };

  const handleToggleSubtaskStatus = async (subtaskId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    try {
      const subtask = subtTask.find((s) => s.id === subtaskId);
      if (!subtask) return;

      const completedStatus = taskStatuses.find((s) => s.category === "DONE");
      const todoStatus = taskStatuses.find((s) => s.category === "TODO");

      if (!completedStatus || !todoStatus) {
        console.error("Required statuses not found (DONE or TODO categories)");
        return;
      }

      const currentStatus = taskStatuses.find((s) => s.id === subtask.statusId);
      const isCurrentlyCompleted = currentStatus?.category === "DONE";
      const newStatusId = isCurrentlyCompleted ? todoStatus.id : completedStatus.id;

      await updateSubtask(subtaskId, { statusId: newStatusId });
      onSubtaskUpdated?.(subtaskId, { statusId: newStatusId });
    } catch (error) {
      console.error("Failed to toggle subtask status:", error);
    }
  };

  const handleEditSubtask = (
    subtaskId: string,
    currentTitle: string,
    currentPriority: string,
    currentType: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }

    setEditingSubtaskId(subtaskId);
    setEditingTitle(currentTitle);
    setSubtaskPriority(currentPriority);
    setSubtaskType(currentType);
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim()) return;

    try {
      const updateData = {
        title: editingTitle.trim(),
        priority: subtaskPriority as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
        type: ["TASK", "BUG", "EPIC", "STORY"].includes(subtaskType)
          ? (subtaskType as "TASK" | "BUG" | "EPIC" | "STORY")
          : "TASK",
      };

      await updateSubtask(subtaskId, updateData);

      setEditingSubtaskId(null);
      setEditingTitle("");
      setSubtaskPriority("MEDIUM");
      setSubtaskType("TASK");

      onSubtaskUpdated?.(subtaskId, updateData);
    } catch (error) {
      console.error("Failed to update subtask:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSubtaskId(null);
    setEditingTitle("");
    setSubtaskPriority("MEDIUM");
    setSubtaskType("TASK");
  };

  const handleDeleteSubtask = async (subtaskId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const confirmDelete = async () => {
      try {
        await deleteSubtask(subtaskId);

        // If we're on a page > 1 and this was the last item on the page, go back one page
        if (currentPage > 1 && subtTask.length === 1) {
          setCurrentPage(currentPage - 1);
        }

        onSubtaskDeleted?.(subtaskId);
      } catch (error) {
        console.error("Failed to delete subtask:", error);
      }
    };

    if (showConfirmModal) {
      showConfirmModal(
        "Delete Subtask",
        "Are you sure you want to delete this subtask? This action cannot be undone.",
        confirmDelete,
        "danger"
      );
    } else {
      await confirmDelete();
    }
  };

  const handleCancelAddSubtask = () => {
    setIsAddingSubtask(false);
    setNewSubtaskTitle("");
    setSubtaskPriority("MEDIUM");
    setSubtaskType("TASK");
  };

  // Helper function to check if subtask is completed
  const isSubtaskCompleted = (subtask: Task) => {
    const currentStatus = taskStatuses.find((s) => s.id === subtask.statusId);
    return currentStatus?.category === "DONE";
  };

  // Helper function to get priority colors
  const getPriorityColor = (priority: string) => {
    const priorityColors = {
      highest: "#EF4444",
      high: "#F97316",
      medium: "#F59E0B",
      low: "#10B981",
    };
    return priorityColors[priority?.toLowerCase() as keyof typeof priorityColors] || "#6B7280";
  };

  const getTypeColor = (type: string) => {
    const typeColors = {
      task: "#3B82F6",
      bug: "#EF4444",
      epic: "#8B5CF6",
      story: "#10B981",
    };
    return typeColors[type?.toLowerCase() as keyof typeof typeColors] || "#6B7280";
  };

  const getStatusColor = (statusId: string) => {
    const status = taskStatuses.find((s) => s.id === statusId);
    if (!status) return "#6B7280";

    const statusColors = {
      done: "#10B981",
      completed: "#10B981",
      "in progress": "#3B82F6",
      in_progress: "#3B82F6",
      review: "#8B5CF6",
      todo: "#6B7280",
      "to do": "#6B7280",
    };
    return statusColors[status.name?.toLowerCase() as keyof typeof statusColors] || "#6B7280";
  };

  const completedCount = Array.isArray(subtTask)
    ? subtTask.filter((s) => isSubtaskCompleted(s)).length
    : 0;

  return (
    <>
      {selectedSubtask && router.query.taskId === selectedSubtask.id && (
        <div className="">
          <TaskDetailClient
            task={selectedSubtask}
            taskId={selectedSubtask.id}
            workspaceSlug={workspaceSlug as string | undefined}
            projectSlug={projectSlug as string | undefined}
            open="modal"
          />
        </div>
      )}

      <div className="space-y-4">
        <SectionHeader
          icon={HiListBullet}
          title={`Subtasks (${completedCount}/${
            subtaskPagination?.total || Array.isArray(subtTask) ? subtTask.length : 0
          })`}
        />

        {/* Subtasks List */}
        {Array.isArray(subtTask) && subtTask.length > 0 && (
          <div className="space-y-2">
            {subtTask.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-start gap-3 group p-3 rounded-lg bg-[var(--card)] hover:bg-[var(--accent)] border-none transition-colors shadow-sm hover:shadow-md cursor-pointer"
                onClick={(e) => {
                  if (!isAuth) return;
                  if (
                    (e.target as HTMLElement).closest("button") ||
                    (e.target as HTMLElement).closest(".action-button") ||
                    (e.target as HTMLElement).closest("svg") ||
                    (e.target as HTMLElement).closest('input[type="checkbox"]')
                  ) {
                    return;
                  }
                  setSelectedSubtask(subtask);

                  // Validate subtask.id as UUID before URL construction
                  if (!validator.isUUID(subtask.id, 4)) {
                    console.error('Invalid subtask ID format:', subtask.id);
                    return;
                  }

                  // Sanitize slugs before URL construction
                  const sanitizeSlug = (slug: string | string[] | undefined): string => {
                    if (!slug || typeof slug !== 'string') return '';
                    if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
                    return slug;
                  };

                  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
                  const safeProjectSlug = sanitizeSlug(projectSlug);

                  const subtaskUrl =
                    safeWorkspaceSlug && safeProjectSlug
                      ? `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/${subtask.id}`
                      : `/tasks/${subtask.id}`;

                  if (editingSubtaskId !== subtask.id) {
                    router.push(subtaskUrl);
                  }
                }}
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  {editingSubtaskId === subtask.id ? (
                    <div className="space-y-3">
                      <Input
                        type="text"
                        value={editingTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditingTitle(e.target.value)
                        }
                        placeholder="Enter subtask title..."
                        className="h-9 border-input bg-background text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveEdit(subtask.id);
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="edit-priority" className="text-xs font-medium">
                            Priority
                          </Label>
                          <Select
                            value={subtaskPriority}
                            onValueChange={setSubtaskPriority}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full h-8 text-xs  border-[var(--border)] bg-[var(--background)]">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent className="border-none bg-[var(--card)]">
                              {PRIORITY_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className="hover:bg-[var(--hover-bg)] text-xs"
                                >
                                  <div className="flex items-center gap-2">{option.label}</div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-type" className="text-xs font-medium">
                            Type
                          </Label>
                          <Select
                            value={subtaskType}
                            onValueChange={setSubtaskType}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full h-8 text-xs  border-[var(--border)] bg-[var(--background)]">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="border-none bg-[var(--card)]">
                              {TASK_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className="hover:bg-[var(--hover-bg)] text-xs"
                                >
                                  <div className="flex items-center gap-2">{option.label}</div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <ActionButton
                          onClick={() => handleSaveEdit(subtask.id)}
                          disabled={isLoading || !editingTitle.trim()}
                          primary
                          className="h-8 px-3 cursor-pointer"
                        >
                          Save
                        </ActionButton>
                        <ActionButton
                          onClick={handleCancelEdit}
                          variant="outline"
                          secondary
                          className="h-8 px-3 cursor-pointer"
                        >
                          Cancel
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={(e) => handleToggleSubtaskStatus(subtask.id, e)}
                            className="cursor-pointer"
                          >
                            {isSubtaskCompleted(subtask) ? (
                              <div className="w-4 h-4 flex items-center justify-center text-green-500">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-4 h-4 border border-[var(--border)] rounded" />
                            )}
                          </div>
                          <div
                            onClick={(e) => handleToggleSubtaskStatus(subtask.id, e)}
                            className={`text-sm font-medium cursor-pointer line-clamp-2 ${
                              isSubtaskCompleted(subtask)
                                ? "text-[var(--muted-foreground)] line-through"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {subtask.title}
                          </div>
                        </div>

                        {isAuth && (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0">
                            <Tooltip content="Edit" position="top" color="primary">
                              <ActionButton
                                onClick={(e) =>
                                  handleEditSubtask(
                                    subtask.id,
                                    subtask.title,
                                    subtask.priority,
                                    subtask.type,
                                    e
                                  )
                                }
                                variant="ghost"
                                className="text-[var(--muted-foreground)] hover:text-[var(--primary)] cursor-pointer p-1"
                                disabled={isLoading}
                              >
                                <HiPencilSquare className="w-4 h-4" />
                              </ActionButton>
                            </Tooltip>
                            <Tooltip content="Delete" position="top" color="primary">
                              <ActionButton
                                onClick={(e) => handleDeleteSubtask(subtask.id, e)}
                                variant="ghost"
                                className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] cursor-pointer p-1"
                                disabled={isLoading}
                              >
                                <HiXMark className="w-4 h-4" />
                              </ActionButton>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <DynamicBadge
                          label={
                            subtask.priority.charAt(0) + subtask.priority.slice(1).toLowerCase()
                          }
                          bgColor={getPriorityColor(subtask.priority)}
                          size="sm"
                          className="px-1.5 py-0.5 text-[10px] h-5 min-h-0"
                        />
                        <DynamicBadge
                          label={subtask.type.charAt(0) + subtask.type.slice(1).toLowerCase()}
                          bgColor={getTypeColor(subtask.type)}
                          size="sm"
                          className="px-1.5 py-0.5 text-[10px] h-5 min-h-0"
                        />
                        <DynamicBadge
                          label={
                            taskStatuses.find((s) => s.id === subtask.statusId)?.name || "Unknown"
                          }
                          bgColor={getStatusColor(subtask.statusId)}
                          size="sm"
                          className="px-1.5 py-0.5 text-[10px] h-5 min-h-0"
                        />
                        {subtask.dueDate && (
                          <Tooltip content="Due Date" position="top" color="primary">
                            <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                              <HiCalendar className="w-3 h-3" />
                              {new Date(subtask.dueDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Component */}
        {Array.isArray(subtTask) && subtTask.length > 0 && subtaskPagination && (
          <Pagination
            pagination={subtaskPagination}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}

        {/* Empty State */}
        {!isLoading && Array.isArray(subtTask) && subtTask.length === 0 && (
          <div className="text-center py-8 bg-[var(--muted)]/30 rounded-lg border border-[var(--border)]">
            <HiListBullet className="w-8 h-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">No subtasks yet</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Add subtasks to break down this task into smaller, manageable pieces
            </p>
          </div>
        )}

        {/* Add Subtask Form/Button */}
        {isAddingSubtask ? (
          <form
            onSubmit={handleAddSubtask}
            className="space-y-3 p-4 bg-[var(--muted)]/30 rounded-lg border border-[var(--border)]"
          >
            <Input
              type="text"
              value={newSubtaskTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewSubtaskTitle(e.target.value)
              }
              placeholder="Enter subtask title..."
              className="h-9 border-input bg-background text-[var(--foreground)]"
              autoFocus
              disabled={isLoading}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="subtask-priority" className="text-xs font-medium">
                  Priority
                </Label>
                <Select
                  value={subtaskPriority}
                  onValueChange={setSubtaskPriority}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full h-8 text-xs  border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="border-none bg-[var(--card)]">
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="hover:bg-[var(--hover-bg)] text-xs"
                      >
                        <div className="flex items-center gap-2">{option.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtask-type" className="text-xs font-medium">
                  Type
                </Label>
                <Select value={subtaskType} onValueChange={setSubtaskType} disabled={isLoading}>
                  <SelectTrigger className="w-full h-8 text-xs  border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="border-none bg-[var(--card)]">
                    {TASK_TYPE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="hover:bg-[var(--hover-bg)] text-xs"
                      >
                        <div className="flex items-center gap-2">{option.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasAccess && (
                <div className="flex justify-end w-full">
                  <ActionButton
                    type="submit"
                    disabled={!newSubtaskTitle.trim() || isLoading}
                    primary
                    showPlusIcon
                  >
                    {isLoading ? "Adding..." : "Add Subtask"}
                  </ActionButton>
                </div>
              )}

              <ActionButton
                type="button"
                onClick={handleCancelAddSubtask}
                variant="outline"
                disabled={isLoading}
                secondary
                className="cursor-pointer"
              >
                Cancel
              </ActionButton>
            </div>
          </form>
        ) : hasAccess && isAuth ? (
          <div className="flex justify-end">
            <ActionButton
              onClick={() => setIsAddingSubtask(true)}
              variant="outline"
              disabled={isLoading}
              showPlusIcon
              primary
              className="min-w-[193.56px]"
            >
              Add Subtask
            </ActionButton>
          </div>
        ) : null}
      </div>
    </>
  );
}
