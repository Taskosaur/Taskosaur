import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/badges/PriorityBadge";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/tables/BulkActionBar";
import moment from "moment";
import {
  CalendarDays,
  User,
  MessageSquare,
  FileText,
  Bookmark,
  X,
  Target,
  Timer,
  Layers,
  Paperclip,
  Clock,
  Plus,
  Check,
  Users,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import type { Task, ColumnConfig } from "@/types";
import { TaskPriorities, TaskTypeIcon } from "@/utils/data/taskData";
import { StatusBadge } from "@/components/badges";
import TaskDetailClient from "@/components/tasks/TaskDetailClient";
import { CustomModal } from "@/components/common/CustomeModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTask } from "@/contexts/task-context";
import { useProject } from "@/contexts/project-context";
import { toast } from "sonner";
import Tooltip from "@/components/common/ToolTip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/auth-context";

// Data extraction utility functions
function extractTaskValue(task: Task, columnId: string): any {
  switch (columnId) {
    case "description":
      return task.description || "";

    case "taskNumber":
      return task.taskNumber || "";

    case "timeline":
      return {
        startDate: task.startDate,
        dueDate: task.dueDate,
      };

    case "completedAt":
      return task.completedAt ? moment(task.completedAt).format("MMM D, YYYY") : "";

    case "storyPoints":
      return task.storyPoints || 0;

    case "originalEstimate":
      return task.originalEstimate || 0;

    case "remainingEstimate":
      return task.remainingEstimate || 0;

    case "reporter":
      return task.reporter
        ? {
            id: task.reporter.id,
            firstName: task.reporter.firstName,
            lastName: task.reporter.lastName,
            name: task.reporter.firstName || `${task.reporter.firstName} ${task.reporter.lastName}`,
            email: task.reporter.email,
            avatar: task.reporter.avatar,
          }
        : null;

    case "createdBy":
      return task.createdBy || "";

    case "createdAt":
      return task.createdAt ? moment(task.createdAt).format("MMM D, YYYY") : "";

    case "updatedAt":
      return task.updatedAt ? moment(task.updatedAt).format("MMM D, YYYY") : "";

    case "sprint":
      return task.sprint ? task.sprint.name : "";

    case "parentTask":
      return task.parentTask ? task.parentTask.title || task.parentTask.taskNumber : "";

    case "childTasksCount":
      return task._count?.childTasks || task.childTasks?.length || 0;

    case "commentsCount":
      return task._count?.comments || task.comments?.length || 0;

    case "attachmentsCount":
      return task._count?.attachments || task.attachments?.length || 0;

    case "timeEntries":
      return task.timeEntries?.length || 0;

    default:
      return "";
  }
}

function formatColumnValue(value: any, columnType: string): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  switch (columnType) {
    case "user":
      if (typeof value === "object" && value.name) {
        return value.name;
      }
      return value.toString();
    case "dateRange":
      if (typeof value === "object" && value.startDate && value.dueDate) {
        const start = moment(value.startDate).format("MMM D, YYYY");
        const end = moment(value.dueDate).format("MMM D, YYYY");
        return `${start} - ${end}`;
      } else if (typeof value === "object" && value.startDate) {
        return `${moment(value.startDate).format("MMM D, YYYY")} - TBD`;
      } else if (typeof value === "object" && value.dueDate) {
        return `TBD - ${moment(value.dueDate).format("MMM D, YYYY")}`;
      }
      return "-";
    case "date":
      if (value instanceof Date || typeof value === "string") {
        return moment(value).format("MMM D, YYYY");
      }
      return value?.toString?.() ?? "";
    case "number":
      return value.toString();
    case "text":
    default:
      return value.toString();
  }
}

interface TaskTableProps {
  tasks: Task[];
  workspaceSlug?: string;
  projectSlug?: string;
  onTaskSelect?: (taskId: string) => void;
  selectedTasks?: string[];
  projects?: any[];
  projectsOfCurrentWorkspace?: any[];
  showProject?: boolean;
  columns?: ColumnConfig[];
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
  onPageChange?: (page: number) => void;
  onTaskRefetch?: () => void;
  showAddTaskRow?: boolean;
  addTaskStatuses?: Array<{ id: string; name: string }>;
  projectMembers?: any[];
  currentProject?: any;
  workspaceMembers?: any[];
  showBulkActionBar?: boolean;
  totalTask?: number;
}

const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  workspaceSlug,
  projectSlug,
  onTaskSelect,
  selectedTasks = [],
  showProject = false,
  columns = [],
  pagination,
  onPageChange,
  onTaskRefetch,
  showAddTaskRow = true,
  projectsOfCurrentWorkspace = [],
  addTaskStatuses = [],
  projectMembers,
  currentProject,
  showBulkActionBar = false,
  totalTask,
}) => {
  const { createTask, getTaskById, currentTask, bulkDeleteTasks } = useTask();
  const { getTaskStatusByProject } = useProject();
  const { getProjectMembers } = useProject();
  const { isAuthenticated } = useAuth();

  const isOrgOrWorkspaceLevel = (!workspaceSlug && !projectSlug) || (workspaceSlug && !projectSlug);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
    statusId: "",
    assigneeIds: [] as string[],
    dueDate: "",
    projectId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false); // For multi-select popover
  const [allDelete, setAllDelete] = useState<boolean>(false);
  const [localAddTaskStatuses, setLocalAddTaskStatuses] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [localAddTaskProjectMembers, setLocalAddTaskProjectMembers] = useState<any[]>([]);

  useEffect(() => {
    const fetchProjectMeta = async () => {
      const projectId = currentProject?.id || newTaskData?.projectId;
      if (addTaskStatuses && addTaskStatuses.length > 0) {
        setLocalAddTaskStatuses(addTaskStatuses);
      } else if (projectId) {
        try {
          const statuses = await getTaskStatusByProject(projectId);
          setLocalAddTaskStatuses(statuses || []);
        } catch (err) {
          setLocalAddTaskStatuses([]);
        }
      } else {
        setLocalAddTaskStatuses([]);
      }
      if (projectId && (!projectSlug || !projectMembers || projectMembers.length === 0)) {
        try {
          const members = await getProjectMembers(projectId);
          setLocalAddTaskProjectMembers(members || []);
        } catch (err) {
          setLocalAddTaskProjectMembers([]);
        }
      }
    };
    fetchProjectMeta();
  }, [newTaskData.projectId, projectSlug]);

  const today = moment().format("YYYY-MM-DD");

  const formatDate = (dateString: string) => {
    try {
      const date = moment(dateString);
      const now = moment();
      const diffDays = date.diff(now, "days");

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      if (diffDays === -1) return "Yesterday";
      if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
      if (diffDays > 1) return `In ${diffDays} days`;

      if (date.year() !== now.year()) {
        return date.format("MMM D, YYYY");
      }
      return date.format("MMM D");
    } catch {
      return dateString;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const handleAllDeleteSelect = () => {
    setAllDelete(!allDelete);
  };

  const handleBulkDelete = async () => {
    if (!selectedTasks || selectedTasks.length === 0) {
      toast.warning("No tasks selected for deletion");
      return;
    }

    try {
      const loadingToast = toast.loading(
        `Deleting ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}...`
      );

      const result = await bulkDeleteTasks(selectedTasks, currentProject?.id, allDelete);

      toast.dismiss(loadingToast);

      if (result.deletedCount > 0) {
        toast.success(
          `Successfully deleted ${result.deletedCount} task${result.deletedCount === 1 ? "" : "s"}`
        );
      }

      if (result.failedTasks && result.failedTasks.length > 0) {
        const maxErrorsToShow = 3;
        result.failedTasks.slice(0, maxErrorsToShow).forEach((failed) => {
          toast.error(`Failed to delete task: ${failed.reason}`, {
            duration: 5000,
          });
        });

        if (result.failedTasks.length > maxErrorsToShow) {
          toast.warning(
            `...and ${result.failedTasks.length - maxErrorsToShow} more task${
              result.failedTasks.length - maxErrorsToShow === 1 ? "" : "s"
            } could not be deleted`,
            { duration: 5000 }
          );
        }
      }

      if (onTaskSelect) {
        const failedTaskIds = new Set(result.failedTasks?.map((failed) => failed.id) || []);
        const successfullyDeletedTasks = selectedTasks.filter(
          (taskId) => !failedTaskIds.has(taskId)
        );

        successfullyDeletedTasks.forEach((taskId) => {
          onTaskSelect(taskId);
        });
      }

      if (onTaskRefetch) {
        await onTaskRefetch();
      }
    } catch (error: any) {
      console.error("Failed to delete tasks:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to delete tasks. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleClearSelection = () => {
    if (onTaskSelect) {
      selectedTasks.forEach((taskId) => onTaskSelect(taskId));
    }
  };

  // Helper function to render multiple assignees
  const renderMultipleAssignees = (assignees: any[], maxVisible = 3) => {
    if (!assignees || assignees.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span className="tasktable-assignee-unassigned">Unassigned</span>
        </div>
      );
    }

    const maxToShow = 3;
    const visibleAssignees = assignees.slice(0, maxToShow);
    const remainingCount = assignees.length - maxToShow;

    return (
      <div className="flex items-center gap-1">
        <div className="flex -space-x-2">
          {visibleAssignees.map((assignee, index) => (
            <Tooltip
              key={assignee.id}
              content={`${assignee.firstName} ${assignee.lastName}`}
              position="top"
            >
              <Avatar className="tasktable-assignee-avatar w-6 h-6 border-2 border-white">
                <AvatarImage
                  src={assignee.avatar || "/placeholder.svg"}
                  alt={`${assignee.firstName} ${assignee.lastName}`}
                />
                <AvatarFallback className="tasktable-assignee-fallback text-xs">
                  {getInitials(assignee.firstName, assignee.lastName)}
                </AvatarFallback>
              </Avatar>
            </Tooltip>
          ))}
          {remainingCount > 0 && (
            <Tooltip content={`+${remainingCount} more`} position="top">
              <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">+{remainingCount}</span>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  // Helper function to get selected assignees for display
  const getSelectedAssignees = () => {
    const availableMembers =
      projectSlug && projectMembers && projectMembers.length > 0
        ? projectMembers
        : localAddTaskProjectMembers;

    return availableMembers.filter((member) =>
      newTaskData.assigneeIds.includes(member.user?.id || member.id)
    );
  };

  // Multi-select assignee component
  const MultiSelectAssignee = () => {
    const availableMembers =
      projectSlug && projectMembers && projectMembers.length > 0
        ? projectMembers
        : localAddTaskProjectMembers;

    const selectedAssignees = getSelectedAssignees();

    const handleAssigneeToggle = (memberId: string) => {
      setNewTaskData((prev) => ({
        ...prev,
        assigneeIds: prev.assigneeIds.includes(memberId)
          ? prev.assigneeIds.filter((id) => id !== memberId)
          : [...prev.assigneeIds, memberId],
      }));
    };

    return (
      <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={assigneePopoverOpen}
            className="border-none shadow-none bg-transparent justify-start p-0 h-auto min-h-[2rem] hover:bg-transparent"
            disabled={isSubmitting}
          >
            {selectedAssignees.length === 0 ? (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm text-gray-500">Select assignees...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {selectedAssignees.slice(0, 3).map((assignee) => (
                    <Avatar
                      key={assignee.user?.id || assignee.id}
                      className="w-6 h-6 border-2 border-white"
                    >
                      <AvatarImage
                        src={assignee.user?.avatar || assignee.avatar || "/placeholder.svg"}
                        alt={`${
                          assignee.user?.firstName || assignee.firstName
                        } ${assignee.user?.lastName || assignee.lastName}`}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          assignee.user?.firstName || assignee.firstName,
                          assignee.user?.lastName || assignee.lastName
                        )}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {selectedAssignees.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        +{selectedAssignees.length - 3}
                      </span>
                    </div>
                  )}
                </div>
                {selectedAssignees.length === 1 && (
                  <span className="text-sm ml-2">
                    {selectedAssignees[0].user?.firstName || selectedAssignees[0].firstName}{" "}
                    {selectedAssignees[0].user?.lastName || selectedAssignees[0].lastName}
                  </span>
                )}
                {selectedAssignees.length > 1 && (
                  <span className="text-sm ml-2">{selectedAssignees.length} assignees</span>
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-[var(--card)] border-none" align="start">
          <Command>
            <CommandInput placeholder="Search assignees..." />
            <CommandList>
              <CommandEmpty>No assignees found.</CommandEmpty>
              <CommandGroup>
                {availableMembers.map((member) => {
                  const memberId = member.user?.id || member.id;
                  const isSelected = newTaskData.assigneeIds.includes(memberId);

                  return (
                    <CommandItem
                      key={memberId}
                      value={`${member.user?.firstName || member.firstName} ${
                        member.user?.lastName || member.lastName
                      }`}
                      onSelect={() => handleAssigneeToggle(memberId)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={member.user?.avatar || member.avatar || "/placeholder.svg"}
                          alt={`${member.user?.firstName || member.firstName} ${
                            member.user?.lastName || member.lastName
                          }`}
                        />
                        <AvatarFallback className="text-xs">
                          {getInitials(
                            member.user?.firstName || member.firstName,
                            member.user?.lastName || member.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {member.user?.firstName || member.firstName}{" "}
                          {member.user?.lastName || member.lastName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {member.user?.email || member.email}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const getTaskTypeIcon = (type?: string) => {
    if (!type) return null;

    const key = type.toUpperCase() as keyof typeof TaskTypeIcon;
    const taskType = TaskTypeIcon[key] || TaskTypeIcon.TASK;
    const IconComponent = taskType.icon;

    return <IconComponent className={`w-4 h-4 text-${taskType.color}`} />;
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const renderDynamicCellContent = (task: Task, column: ColumnConfig) => {
    const value = extractTaskValue(task, column.id);

    switch (column.type) {
      case "user":
        if (value && typeof value === "object") {
          return (
            <div className="tasktable-assignee-container">
              <Avatar className="tasktable-assignee-avatar">
                <AvatarImage
                  src={value.avatar || "/placeholder.svg"}
                  alt={`${value.firstName || ""} ${value.lastName || ""}`}
                />
                <AvatarFallback className="tasktable-assignee-fallback">
                  {getInitials(value.firstName, value.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="tasktable-assignee-name">
                {value.name ||
                  `${value.firstName || ""} ${value.lastName || ""}`.trim() ||
                  value.email}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="tasktable-assignee-unassigned">Unassigned</span>
          </div>
        );

      case "dateRange":
        if (value && typeof value === "object") {
          return (
            <div className="tasktable-date-container">
              <CalendarDays className="tasktable-date-icon w-4 h-4 text-gray-500" />
              <span className="tasktable-date-text text-sm">
                {formatColumnValue(value, column.type)}
              </span>
            </div>
          );
        }
        return (
          <div className="tasktable-date-container">
            <CalendarDays className="tasktable-date-icon w-4 h-4 text-gray-500" />
            <span className="tasktable-date-empty">No timeline</span>
          </div>
        );

      case "text":
        if (column.id === "description" && value) {
          return (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm line-clamp-2 max-w-xs" title={value}>
                {value}
              </span>
            </div>
          );
        }
        return <span className="text-sm">{formatColumnValue(value, column.type)}</span>;

      case "number":
        const numValue = formatColumnValue(value, column.type);
        if (column.id === "storyPoints") {
          return (
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-blue-500" />
              <span className="text-sm font-medium">{numValue}</span>
            </div>
          );
        }
        if (column.id === "originalEstimate" || column.id === "remainingEstimate") {
          return (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-500" />
              <span className="text-sm font-mono">{numValue}h</span>
            </div>
          );
        }
        if (column.id === "childTasksCount") {
          return (
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-500" />
              <span className="text-sm">{numValue}</span>
            </div>
          );
        }
        if (column.id === "commentsCount") {
          return (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-green-500" />
              <span className="text-sm">{numValue}</span>
            </div>
          );
        }
        if (column.id === "attachmentsCount") {
          return (
            <div className="flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-gray-500" />
              <span className="text-sm">{numValue}</span>
            </div>
          );
        }
        if (column.id === "timeEntries") {
          return (
            <div className="flex items-center gap-1">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span className="text-sm">{numValue}</span>
            </div>
          );
        }
        return <span className="text-sm font-mono">{numValue}</span>;

      case "date":
        return (
          <div className="tasktable-date-container">
            <CalendarDays className="tasktable-date-icon w-4 h-4 text-gray-500" />
            <span className="tasktable-date-text text-sm">
              {formatColumnValue(value, column.type)}
            </span>
          </div>
        );

      default:
        return <span className="text-sm">{formatColumnValue(value, column.type)}</span>;
    }
  };

  const handleRowClick = async (task: Task) => {
    await getTaskById(task.id, isAuthenticated());
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  if (tasks.length === 0) {
    return (
      <div className="tasktable-empty-state">
        <h3 className="tasktable-empty-title">No tasks found</h3>
        <p className="tasktable-empty-description">
          Create your first task to get started with project management
        </p>
      </div>
    );
  }

  const visibleColumns = columns.filter((col) => col.visible);

  const loadTaskCreationData = () => {
    if (localAddTaskStatuses && localAddTaskStatuses.length > 0) {
      const defaultStatus =
        localAddTaskStatuses.find(
          (s) => s.name.toLowerCase() === "todo" || s.name.toLowerCase() === "to do"
        ) || localAddTaskStatuses[0];

      if (defaultStatus) {
        setNewTaskData((prev) => ({ ...prev, statusId: defaultStatus.id }));
      }
    }
  };

  const handleStartCreating = () => {
    setIsCreatingTask(true);
    loadTaskCreationData();
  };

  const handleCancelCreating = () => {
    setIsCreatingTask(false);
    setNewTaskData({
      title: "",
      priority: "MEDIUM",
      statusId: "",
      assigneeIds: [], // Reset to empty array
      dueDate: "",
      projectId: "",
    });
  };

  const handleCreateTask = async () => {
    if (!isTaskValid() || !newTaskData.title.trim()) {
      toast.error("Please fill in all required fields (Title, Status, and Project)");
      return;
    }

    setIsSubmitting(true);
    try {
      let projectId = null;
      if (currentProject && currentProject.id) {
        projectId = currentProject.id;
      } else if (newTaskData.projectId) {
        projectId = newTaskData.projectId;
      } else if (tasks.length > 0) {
        projectId = tasks[0].projectId || tasks[0].project?.id;
      }

      if (!projectId) {
        toast.error("Unable to determine project context. Project ID is required.");
        setIsSubmitting(false);
        return;
      }

      if (!newTaskData.statusId) {
        toast.error("Please select a task status.");
        setIsSubmitting(false);
        return;
      }

      const taskData = {
        title: newTaskData.title.trim(),
        description: "",
        priority: newTaskData.priority,
        projectId,
        statusId: newTaskData.statusId,
        assigneeIds: newTaskData.assigneeIds.length > 0 ? newTaskData.assigneeIds : undefined, // Send array of assignee IDs
        dueDate: newTaskData.dueDate ? moment(newTaskData.dueDate).toISOString() : undefined,
      };

      await createTask(taskData);
      handleCancelCreating();

      if (onTaskRefetch) {
        await onTaskRefetch();
      }

      toast.success("Task created successfully!");
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getToday = () => {
    return moment().format("YYYY-MM-DD");
  };

  // Helper to check if title is invalid
  const isTitleInvalid = !newTaskData.title.trim() && titleTouched;
  const isTaskValid = () => {
    const hasTitle = newTaskData.title.trim().length > 0;
    const hasStatus = newTaskData.statusId.length > 0;
    const hasProject =
      currentProject?.id ||
      newTaskData.projectId ||
      (tasks.length > 0 && (tasks[0].projectId || tasks[0].project?.id));

    return hasTitle && hasStatus && hasProject;
  };

  return (
    <div className="w-full">
      <div className="tasktable-container">
        <div className="tasktable-wrapper">
          <Table className="tasktable-table">
            <TableHeader className="tasktable-header">
              <TableRow className="tasktable-header-row">
                <TableHead className="tasktable-header-cell-task pl-6">
                  <div className="flex items-center gap-4">
                    {!isOrgOrWorkspaceLevel && onTaskSelect && showBulkActionBar && (
                      <Checkbox
                        className="border-[var(--ring)]"
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            tasks.forEach((task) => {
                              if (!selectedTasks.includes(task.id)) {
                                onTaskSelect(task.id);
                              }
                            });
                          } else {
                            // Deselect all: only toggle tasks that ARE selected
                            tasks.forEach((task) => {
                              if (selectedTasks.includes(task.id)) {
                                onTaskSelect(task.id);
                              }
                            });
                          }
                        }}
                      />
                    )}
                    <span>Task</span>
                  </div>
                </TableHead>
                {showProject && (
                  <TableHead className="tasktable-header-cell-project">Project</TableHead>
                )}
                <TableHead className="tasktable-header-cell-priority">Priority</TableHead>
                <TableHead className="tasktable-header-cell-status">
                  <p className="ml-3">Status</p>
                </TableHead>
                <TableHead className="tasktable-header-cell-assignee w-32 text-center min-w-[120px] max-w-[180px]">
                  <span>Assignees</span>
                </TableHead>
                <TableHead className="tasktable-header-cell-date">Due Date</TableHead>

                {/* Dynamic columns */}
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.id}
                    className="tasktable-header-cell w-[8%] min-w-[80px] max-w-[120px]"
                  >
                    <div className="flex items-center justify-between group">
                      <span>{column.label}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody className="tasktable-body">
              {showAddTaskRow &&
                (isCreatingTask ? (
                  <TableRow className="tasktable-add-row h-12 bg-[var(--mini-sidebar)]/50 border-none">
                    {/* Task Title */}
                    <TableCell className="tasktable-cell-task gap-0">
                      <div className="flex items-center gap-2">
                        {onTaskSelect && <div className="w-4 h-4" />}
                        <Input
                          value={newTaskData.title}
                          onChange={(e) => {
                            setNewTaskData((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }));
                            if (!titleTouched) setTitleTouched(true);
                          }}
                          onBlur={() => setTitleTouched(true)}
                          placeholder="Enter task title..."
                          className={`flex-1 border-none shadow-none focus-visible:ring-1 bg-transparent ${
                            isTitleInvalid ? "ring-2 ring-red-500" : ""
                          }`}
                          autoFocus
                          disabled={isSubmitting}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (isTaskValid()) {
                                handleCreateTask();
                              } else {
                                toast.error("Please fill in all required fields");
                              }
                            } else if (e.key === "Escape") {
                              handleCancelCreating();
                            }
                          }}
                        />

                        <div className="flex items-center gap-1 ml-2">
                          <Tooltip content="Create task" position="top">
                            <button
                              onClick={handleCreateTask}
                              disabled={isSubmitting || !isTaskValid() || !newTaskData.title.trim()}
                              className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Cancel" position="top">
                            <button
                              onClick={handleCancelCreating}
                              disabled={isSubmitting}
                              className="p-1 text-red-600 hover:bg-red-100 rounded cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </TableCell>
                    {/* Project column if shown */}
                    {showProject && (
                      <TableCell className="tasktable-cell-project">
                        {workspaceSlug && !projectSlug ? (
                          <Select
                            value={newTaskData.projectId || ""}
                            onValueChange={(value) =>
                              setNewTaskData((prev) => ({
                                ...prev,
                                projectId: value,
                              }))
                            }
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              className={`border-none shadow-none -ml-3 ${
                                !newTaskData.projectId ? "ring-1 ring-red-300" : ""
                              }`}
                            >
                              <SelectValue placeholder="Select project *" />
                            </SelectTrigger>
                            <SelectContent className="overflow-y-auto bg-[var(--card)] border-none text-[var(--foreground)]">
                              {Array.isArray(projectsOfCurrentWorkspace) &&
                              projectsOfCurrentWorkspace.length > 0 ? (
                                projectsOfCurrentWorkspace.map((project: any) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-projects" disabled>
                                  No projects found
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : workspaceSlug && projectSlug ? (
                          <span className="text-sm text-gray-500">
                            {projectsOfCurrentWorkspace && projectsOfCurrentWorkspace.length > 0
                              ? projectsOfCurrentWorkspace.find(
                                  (p: any) => p.id === projectSlug || p.slug === projectSlug
                                )?.name || "Current Project"
                              : "Current Project"}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">Current Project</span>
                        )}
                      </TableCell>
                    )}
                    {/* Priority */}
                    <TableCell className="tasktable-cell">
                      <Select
                        value={newTaskData.priority}
                        onValueChange={(value) =>
                          setNewTaskData((prev) => ({
                            ...prev,
                            priority: value as "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
                          }))
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="border-none shadow-none bg-transparent -ml-3">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent className="bg-[var(--card)] border-none text-[var(--foreground)]">
                          {(TaskPriorities || TaskPriorities || []).map((priority) => {
                            const value = priority.value ?? "undefined";
                            const label = priority.name ?? "undefined";
                            return (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Status - only show if projectId is selected */}
                    <TableCell className="tasktable-cell">
                      {newTaskData.projectId || projectSlug || currentProject?.id ? (
                        <Select
                          value={newTaskData.statusId}
                          onValueChange={(value) =>
                            setNewTaskData((prev) => ({
                              ...prev,
                              statusId: value,
                            }))
                          }
                          disabled={isSubmitting}
                        >
                          <SelectTrigger
                            className={`border-none shadow-none bg-transparent ${
                              !newTaskData.statusId ? "ring-1 ring-red-300" : ""
                            }`}
                          >
                            <SelectValue placeholder="Select status *" />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border-none text-[var(--foreground)]">
                            {localAddTaskStatuses.length > 0 ? (
                              localAddTaskStatuses.map((status) => (
                                <SelectItem key={status.id} value={status.id}>
                                  {status.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-status" disabled>
                                No statuses found
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-gray-400">Select project first</span>
                      )}
                    </TableCell>
                    {/* Assignees - Multi-select */}
                    <TableCell className="tasktable-cell-assignee">
                      {newTaskData.projectId || projectSlug || currentProject?.id ? (
                        <MultiSelectAssignee />
                      ) : (
                        <span className="text-sm text-gray-400">Select project first</span>
                      )}
                    </TableCell>
                    {/* Due Date - Enhanced with calendar input */}
                    <TableCell className="tasktable-cell-date">
                      <div className="relative">
                        <Input
                          type="date"
                          value={newTaskData.dueDate}
                          onChange={(e) =>
                            setNewTaskData((prev) => ({
                              ...prev,
                              dueDate: e.target.value,
                            }))
                          }
                          min={getToday()}
                          className="border-none -ml-3 shadow-none focus-visible:ring-1 bg-transparent text-sm w-full pr-8 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          disabled={isSubmitting}
                          placeholder="Select due date"
                        />
                        {newTaskData.dueDate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewTaskData((prev) => ({
                                ...prev,
                                dueDate: "",
                              }));
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded z-10"
                            title="Clear date"
                            disabled={isSubmitting}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* Dynamic columns - show empty cells */}
                    {visibleColumns.map((column) => (
                      <TableCell key={column.id} className="tasktable-cell">
                        <span className="text-sm text-gray-400">-</span>
                      </TableCell>
                    ))}
                  </TableRow>
                ) : (
                  <TableRow className="tasktable-add-row h-12 border-none transition-colors bg-[var(--mini-sidebar)]/50">
                    <TableCell
                      colSpan={
                        6 + // Base columns
                        (showProject ? 1 : 0) +
                        visibleColumns.length +
                        1
                      }
                      className="text-center py-3"
                    >
                      <button
                        onClick={handleStartCreating}
                        className="flex items-center pl-4 justify-start gap-2 w-full  cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium ">Add task</span>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="tasktable-row h-12 odd:bg-[var(--odd-row)] cursor-pointer"
                  onClick={() => handleRowClick(task)}
                >
                  <TableCell className="tasktable-cell-task">
                    <div className="flex items-start gap-3">
                      {!isOrgOrWorkspaceLevel && onTaskSelect && showBulkActionBar && (
                        <div className="flex-shrink-0 mt-0.5">
                          <Checkbox
                            className="cursor-pointer border-[var(--ring)]"
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => onTaskSelect(task.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0 mt-0.5">{getTaskTypeIcon(task.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="tasktable-task-title line-clamp-1 max-w-[400px] overflow-hidden text-ellipsis whitespace-nowrap">
                            {task.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0 h-5 flex-shrink-0"
                          >
                            <span className="text-muted text-xs">#{task.taskNumber}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {task._count?.comments > 0 && (
                            <div className="flex items-center gap-0.5 text-xs text-[var(--muted-foreground)]">
                              <MessageSquare className="w-4 h-4 mt-0.5" />
                              <span className="">{task._count.comments}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {showProject && (
                    <TableCell className="tasktable-cell-project">
                      <div className="flex items-center">
                        <span className="tasktable-project-name">
                          {task.project?.name || "Unknown Project"}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  <TableCell className="tasktable-cell">
                    <PriorityBadge priority={task.priority} />
                  </TableCell>

                  <TableCell className="tasktable-cell">
                    <StatusBadge status={task.status} />
                  </TableCell>

                  <TableCell className="tasktable-cell-assignee w-32 min-w-[120px] max-w-[180px] text-center align-middle">
                    <div className="flex justify-center items-center">
                      {renderMultipleAssignees(
                        currentTask && currentTask.id === task.id
                          ? currentTask.assignees ||
                              (currentTask.assignee ? [currentTask.assignee] : [])
                          : task.assignees || (task.assignee ? [task.assignee] : [])
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="tasktable-cell-date">
                    {task.dueDate ? (
                      <div className="tasktable-date-container">
                        <CalendarDays className="tasktable-date-icon w-4 h-4" />
                        <span
                          className={cn(
                            "tasktable-date-text",
                            isOverdue(task.dueDate) && "text-red-600"
                          )}
                        >
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                    ) : (
                      <div className="tasktable-date-container">
                        <CalendarDays className="tasktable-date-icon w-4 h-4" />
                        <span className="tasktable-date-empty">No due date</span>
                      </div>
                    )}
                  </TableCell>

                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className="tasktable-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderDynamicCellContent(task, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <TableRow className="tasktable-footer-row">
            <TableCell colSpan={8 + visibleColumns.length} className="tasktable-footer-cell">
              <div className="tasktable-pagination-container">
                <div className="tasktable-pagination-info">
                  Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} to{" "}
                  {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of{" "}
                  {pagination.totalCount} tasks
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (pagination.hasPrevPage && onPageChange) {
                            onPageChange(pagination.currentPage - 1);
                          }
                        }}
                        className={cn(!pagination.hasPrevPage && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            isActive={pagination.currentPage === pageNum}
                            onClick={(e) => {
                              e.preventDefault();
                              if (onPageChange) onPageChange(pageNum);
                            }}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (pagination.hasNextPage && onPageChange) {
                            onPageChange(pagination.currentPage + 1);
                          }
                        }}
                        className={cn(!pagination.hasNextPage && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TableCell>
          </TableRow>
        )}
      </div>

      {/* BulkActionBar - appears as a toast/modal at bottom-center */}
      {!isOrgOrWorkspaceLevel && onTaskSelect && showBulkActionBar && (
        <BulkActionBar
          selectedCount={selectedTasks.length}
          onDelete={handleBulkDelete}
          onClear={handleClearSelection}
          onAllDeleteSelect={handleAllDeleteSelect}
          totalTask={totalTask}
          currentTaskCount={Array.isArray(tasks) ? tasks.length : 0}
          allDelete={allDelete}
        />
      )}

      {isEditModalOpen && (
        <CustomModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          animation="slide-right"
          height="h-screen"
          top="top-4"
          zIndex="z-50"
          width="w-full md:w-[80%] lg:w-[60%]"
          position="items-start justify-end"
          closeOnOverlayClick={true}
        >
          {selectedTask && (
            <TaskDetailClient
              task={currentTask}
              open="modal"
              workspaceSlug={workspaceSlug as string}
              projectSlug={projectSlug as string}
              taskId={selectedTask.id}
              onTaskRefetch={onTaskRefetch}
              onClose={() => setIsEditModalOpen(false)}
            />
          )}
        </CustomModal>
      )}
    </div>
  );
};

export default TaskTable;
