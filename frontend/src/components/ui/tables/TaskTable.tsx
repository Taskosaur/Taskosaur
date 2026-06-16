import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { getUserTimezone } from "@/utils/date";
import { getRelativeDateLabel, formatDateForDisplay, isDateOverdue as checkDateOverdue } from "@/utils/date";
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
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import type { Task, ColumnConfig } from "@/types";
import type { TaskStatus } from "@/types/task-status";
import type { GroupByField, TaskGroup, GroupState } from "@/types/tasks";


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
import { useOrganization } from "@/contexts/organization-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
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
import RecurringBadge from "@/components/common/RecurringBadge";
import { taskApi } from "@/utils/api/taskApi";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskGroupSection from "@/components/tasks/views/TaskGroupSection";


// Sortable Header Component
const SortableHeader = ({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : "auto",
  };

  return (
    <TableHead ref={setNodeRef} style={style} className={cn("cursor-grab active:cursor-grabbing", className)} {...attributes} {...listeners}>
      {children}
    </TableHead>
  );
};

// Sortable Row Component
const SortableRow = ({ 
  task, 
  workspaceSlug, 
  projectSlug, 
  columnOrder, 
  renderTaskRowCell, 
  handleRowClick,
  isFocused,
  rowIndex,
  onRowClick,
}: { 
  task: any;
  workspaceSlug?: string;
  projectSlug?: string;
  columnOrder: string[];
  renderTaskRowCell: (colId: string, task: any, options?: { dragHandleProps?: any }) => React.ReactNode;
  handleRowClick: (task: any) => void;
  isFocused?: boolean;
  rowIndex?: number;
  onRowClick?: (task: any, index: number, e: React.MouseEvent) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-row-index={rowIndex}
      tabIndex={0}
      aria-selected={isFocused}
      className={cn(
        "tasktable-row group/row h-12 odd:bg-[var(--odd-row)] cursor-pointer outline-none",
        isDragging && "shadow-lg rounded-md",
        isFocused && "ring-2 ring-inset ring-[var(--primary)] bg-[var(--accent)]/40"
      )}
      onClick={(e) => {
        if (onRowClick && rowIndex !== undefined) {
          onRowClick(task, rowIndex, e);
        } else {
          handleRowClick(task);
        }
      }}
      {...attributes}
    >
      {/* Other columns */}
      {columnOrder.map((colId) => renderTaskRowCell(colId, task, { dragHandleProps: listeners }))}
    </TableRow>
  );
};

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
      return task.completedAt ? formatDayjsDate(task.completedAt, "MMM D, YYYY") : "";

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
      return task.createdAt ? formatDayjsDate(task.createdAt, "MMM D, YYYY") : "";

    case "updatedAt":
      return task.updatedAt ? formatDayjsDate(task.updatedAt, "MMM D, YYYY") : "";

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
        const start = formatDayjsDate(value.startDate, "MMM D, YYYY");
        const end = formatDayjsDate(value.dueDate, "MMM D, YYYY");
        return `${start} - ${end}`;
      } else if (typeof value === "object" && value.startDate) {
        return `${formatDayjsDate(value.startDate, "MMM D, YYYY")} - TBD`;
      } else if (typeof value === "object" && value.dueDate) {
        return `TBD - ${formatDayjsDate(value.dueDate, "MMM D, YYYY")}`;
      }
      return "-";
    case "date":
      if (value instanceof Date || typeof value === "string") {
        return formatDayjsDate(value, "MMM D, YYYY");
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
  onTasksSelect?: (taskIds: string[], action: "add" | "remove" | "set") => void;
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
  onTaskRefetch?: () => Promise<void> | void;
  showAddTaskRow?: boolean;
  addTaskStatuses?: Array<{ id: string; name: string }>;
  projectMembers?: any[];
  currentProject?: any;
  workspaceMembers?: any[];
  showBulkActionBar?: boolean;
  totalTask?: number;
  search?: string;
  selectedStatuses?: string[];
  selectedPriorities?: string[];
  selectedTaskTypes?: string[];
  selectedAssignees?: string[];
  selectedReporters?: string[];
  sprintId?: string;
  workspaceId?: string;
  organizationId?: string;
  /** Active group-by field (default "none" = flat list) */
  groupBy?: GroupByField;
  /**
   * Backend-driven group state map — when provided, TaskGroupSection reads
   * real totalCount + per-group page info from here instead of the client-side groupTasks().
   */
  groupMap?: Map<string, GroupState>;
  /** Called when user navigates to a different page within a specific group */
  onGroupPageChange?: (groupKey: string, page: number) => void;
  /** True while the initial grouped API call is in-flight */
  groupedLoading?: boolean;
}


// ---------------------------------------------------------------------------
// groupTasks — pure grouping utility
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  HIGHEST: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  LOWEST: 4,
  URGENT: 5,
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGHEST: "Highest",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  LOWEST: "Lowest",
  URGENT: "Urgent",
};

const TYPE_LABELS: Record<string, string> = {
  TASK: "Task",
  BUG: "Bug",
  EPIC: "Epic",
  STORY: "Story",
  SUBTASK: "Sub-task",
};

/** Format a date value as "MMM DD, YYYY" (e.g. "Apr 29, 2026") */
function formatGroupDate(date: string | Date | null | undefined): { key: string; label: string } {
  if (!date) return { key: "no-date", label: "No Date" };
  const d = dayjs(date).tz(getUserTimezone());
  if (!d.isValid()) return { key: "no-date", label: "No Date" };
  // key uses ISO date so sorting is chronological
  return {
    key: d.format("YYYY-MM-DD"),
    label: d.format("MMM DD, YYYY"),
  };
}

function groupTasks(tasks: Task[], field: GroupByField): TaskGroup[] {
  if (field === "none") return [];

  const groupMap = new Map<string, TaskGroup>();

  tasks.forEach((task) => {
    let key: string;
    let label: string;

    switch (field) {
      case "status": {
        const status = task.status as any;
        key = status?.id ?? "no-status";
        label = status?.name ?? "No Status";
        break;
      }
      case "priority": {
        key = task.priority ?? "MEDIUM";
        label = PRIORITY_LABELS[key] ?? key;
        break;
      }
      case "project": {
        key = task.projectId ?? "no-project";
        label = (task.project as any)?.name ?? "No Project";
        break;
      }
      case "assignee": {
        const firstAssignee = task.assignees?.[0] ?? task.assignee;
        if (firstAssignee) {
          key = (firstAssignee as any).id;
          label = `${(firstAssignee as any).firstName ?? ""} ${(firstAssignee as any).lastName ?? ""}`.trim();
        } else {
          key = "unassigned";
          label = "Unassigned";
        }
        break;
      }
      case "type": {
        key = task.type ?? "TASK";
        label = TYPE_LABELS[key] ?? key;
        break;
      }
      case "dueDate": {
        const { key: dk, label: dl } = formatGroupDate(task.dueDate);
        key = dk;
        label = dk === "no-date" ? "No Due Date" : dl;
        break;
      }
      case "createdAt": {
        const { key: ck, label: cl } = formatGroupDate((task as any).createdAt);
        key = ck;
        label = ck === "no-date" ? "No Created Date" : cl;
        break;
      }
      default:
        key = "other";
        label = "Other";
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label, tasks: [] });
    }
    groupMap.get(key)!.tasks.push(task);
  });

  // Sort groups
  const groups = Array.from(groupMap.values());

  if (field === "priority") {
    groups.sort((a, b) => (PRIORITY_ORDER[a.key] ?? 99) - (PRIORITY_ORDER[b.key] ?? 99));
  } else if (field === "dueDate" || field === "createdAt") {
    groups.sort((a, b) => {
      if (a.key === "no-date") return 1;
      if (b.key === "no-date") return -1;
      return a.key.localeCompare(b.key);
    });
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label));
  }

  return groups;
}




// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const formatDayjsDate = (date: string | Date | null | undefined, formatStr: string = "MMM D, YYYY"): string => {
  if (!date) return "";
  return dayjs(date).tz(getUserTimezone()).format(formatStr);
};

const getTodayDate = (): string => dayjs().tz(getUserTimezone()).format("YYYY-MM-DD");

const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  workspaceSlug,
  projectSlug,
  onTaskSelect,
  onTasksSelect,
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
  search,
  selectedStatuses,
  selectedPriorities,
  selectedTaskTypes,
  selectedAssignees,
  selectedReporters,
  sprintId,
  workspaceId,
  organizationId,
  groupBy = "none",
  groupMap,
  onGroupPageChange,
  groupedLoading = false,
}) => {


  const { t } = useTranslation("tasks");
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { currentProject: contextProject, getProjectMemberRole } = useProject();
  const { getUserWorkspaceRole } = useWorkspaceContext();
  const {
    createTask,
    getTaskById,
    currentTask,
    bulkDeleteTasks,
    bulkUpdateTasksStatus,
    bulkAssignTasks,
    updateRelativeTaskRank,
  } = useTask();
  const { getTaskStatusByProject } = useProject();
  const { getProjectMembers } = useProject();
  const { isAuthenticated } = useAuth();

  const userRole = useMemo(() => {
    if (!user) return null;
    if (user.role === 'SUPER_ADMIN') return 'SUPER_ADMIN';

    // Priority 1: Project role if in project context
    const projectToUse = currentProject || contextProject;
    if (projectToUse?.id) {
      const role = getProjectMemberRole(projectToUse.id, user.id);
      if (role) return role;
    }

    // Priority 2: Workspace role if in workspace context
    if (workspaceId) {
      const role = getUserWorkspaceRole(workspaceId, user.id);
      if (role) return role;
    }

    // Priority 3: Organization role
    return user.role;
  }, [user, currentProject, workspaceId, getProjectMemberRole, getUserWorkspaceRole]);

  const canBulkAction = useMemo(() => {
    if (!userRole) return false;
    return ["SUPER_ADMIN", "OWNER", "MANAGER", "MEMBER", "DEVELOPER"].includes(userRole);
  }, [userRole]);

  const isOrgOrWorkspaceLevel = (!workspaceSlug && !projectSlug) || (workspaceSlug && !projectSlug);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Guard to prevent double-close race conditions
  const isClosingRef = useRef(false);

  // ─── Keyboard navigation state ───────────────────────────────────────────
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  // Ref mirror — always holds the latest focusedRowIndex so the document-level
  // keydown listener can read it synchronously without closure staleness.
  const focusedRowIndexRef = useRef<number>(-1);
  // Ref to handleRowClick — lets the keydown listener call it without needing
  // it in the useEffect dependency array (it's declared late in the component).
  const handleRowClickRef = useRef<((task: Task) => Promise<void>) | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  // Anchor index for shift-click range selection
  const lastClickedIndexRef = useRef<number>(-1);

  // Keep the ref in sync with state on every render (runs before effects)
  focusedRowIndexRef.current = focusedRowIndex;

  // Column Reordering State with localStorage persistence
  // Make the key project-specific so each project can have its own column order
  const getStorageKey = () => {
    if (projectSlug) {
      return `taskosaur_task_table_column_order_${projectSlug}`;
    } else if (workspaceSlug) {
      return `taskosaur_task_table_column_order_workspace_${workspaceSlug}`;
    } else {
      return 'taskosaur_task_table_column_order_global';
    }
  };

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  // Ref-based guard: synchronously blocks the sync effect while a reorder
  // API call + refetch is in flight.  Using a ref avoids the React batching
  // delay that caused the old state-based guard to let stale props overwrite
  // the optimistic task order before the fresh data arrived.
  const isReorderingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const prevTasksRef = useRef<Task[]>(tasks);
  // Timestamp of the last completed reorder — protects localTasks from being
  // overwritten by the background refetch for a short cooldown window.
  const lastReorderTimeRef = useRef<number>(0);
  const REORDER_COOLDOWN_MS = 3000;

  // Sync localTasks when tasks prop changes.
  // Skip during active reorder AND during the cooldown window after one,
  // so the fire-and-forget background refetch can't overwrite the optimistic order.
  useEffect(() => {
    const timeSinceLastReorder = Date.now() - lastReorderTimeRef.current;
    if (!isReorderingRef.current && timeSinceLastReorder > REORDER_COOLDOWN_MS) {
      setLocalTasks(tasks);
    }
  }, [tasks]);


  // Grouped view: use backend groupMap when available, else fall back to client-side groupTasks()
  const groupedTasks = useMemo<TaskGroup[]>(() => {
    if (groupBy === "none") return [];
    // Backend-driven: convert groupMap → TaskGroup[]
    if (groupMap && groupMap.size > 0) {
      return Array.from(groupMap.values()).map((g) => ({
        key: g.key,
        label: g.label,
        tasks: g.tasks,
      }));
    }
    // Fallback: client-side grouping (used when groupMap is not provided)
    return groupTasks(localTasks, groupBy);
  }, [localTasks, groupBy, groupMap]);

  const isGrouped = groupBy !== "none" && (groupedTasks.length > 0 || groupedLoading);


  // Load column order from localStorage and sync with current columns
  useEffect(() => {
    const fixedColumns = ["task"];
    if (showProject) fixedColumns.push("project");
    fixedColumns.push("priority", "status", "assignees", "dueDate");

    const dynamicColumns = columns.filter((col) => col.visible).map((col) => col.id);
    const allIds = [...fixedColumns, ...dynamicColumns];

    setColumnOrder((prev) => {
      // Try to load from localStorage on first render
      if (prev.length === 0) {
        try {
          const storageKey = getStorageKey();
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const storedOrder = JSON.parse(stored) as string[];
            const validIds = new Set(allIds);

            // Filter stored order to only include currently valid columns
            const validStoredOrder = storedOrder.filter(id => validIds.has(id));

            // Add any new columns that weren't in the stored order
            const newIds = allIds.filter(id => !storedOrder.includes(id));

            // If we have a valid stored order, use it
            if (validStoredOrder.length > 0) {
              return [...validStoredOrder, ...newIds];
            }
          }
        } catch (error) {
          console.error('Failed to load column order from localStorage:', error);
        }

        // Fallback to default order
        return allIds;
      }

      // Sync with current props/visibility while preserving order
      const validIds = new Set(allIds);
      const currentOrderValid = prev.filter(id => validIds.has(id));
      const newIds = allIds.filter(id => !prev.includes(id));

      return [...currentOrderValid, ...newIds];
    });
  }, [columns, showProject, projectSlug, workspaceSlug]); // Added projectSlug and workspaceSlug to dependencies

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (columnOrder.length > 0) {
      try {
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
      } catch (error) {
        console.error('Failed to save column order to localStorage:', error);
      }
    }
  }, [columnOrder, projectSlug, workspaceSlug]); // Added projectSlug and workspaceSlug to dependencies

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    // Check if we're dragging a column or a row
    const isColumnDrag = columnOrder.includes(active.id as string);
    
    if (isColumnDrag) {
      // Handle column reordering
      if (active.id !== over.id) {
        setColumnOrder((items) => {
          const oldIndex = items.indexOf(active.id as string);
          const newIndex = items.indexOf(over.id as string);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    } else {
      // Handle row reordering
      const oldIndex = localTasks.findIndex((t) => t.id === active.id);
      const newIndex = localTasks.findIndex((t) => t.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Snapshot the pre-drag order so we can roll back on API failure
      const snapshotTasks = [...localTasks];

      // 1. Apply optimistic UI order immediately — this is now the source of truth.
      //    Lock the sync effect so incoming tasks prop updates (from context)
      //    don't overwrite our local order while the API call is in flight.
      isReorderingRef.current = true;
      setIsReordering(true);
      const reorderedTasks = arrayMove(localTasks, oldIndex, newIndex);
      setLocalTasks(reorderedTasks);
      
      // Identify neighbors for relative reordering
      const prevTask = reorderedTasks[newIndex - 1];
      const nextTask = reorderedTasks[newIndex + 1];
      const afterTaskId = prevTask ? prevTask.id : null;
      const beforeTaskId = nextTask ? nextTask.id : null;

      // Determine the polymorphic scope
      let scopeType: "PROJECT" | "WORKSPACE" | "ORGANIZATION" = "ORGANIZATION";
      let scopeId = organizationId;
      if (projectSlug && (currentProject?.id || contextProject?.id)) {
        scopeType = "PROJECT";
        scopeId = currentProject?.id || contextProject?.id;
      } else if (workspaceSlug && workspaceId) {
        scopeType = "WORKSPACE";
        scopeId = workspaceId;
      }

      const activeTask = snapshotTasks[oldIndex];

      try {
        // 2. Persist rank to backend
        await updateRelativeTaskRank(activeTask.id, {
          scopeType,
          scopeId: scopeId!,
          viewType: "LIST",
          afterTaskId,
          beforeTaskId,
        });

        // 3. Fire-and-forget background refetch to sync context/pagination.
        //    We do NOT await this — the optimistic order in localTasks is the
        //    UI truth. The refetch keeps the context state consistent for
        //    page changes, filter changes, etc.
        if (onTaskRefetch) {
          Promise.resolve(onTaskRefetch()).catch((err) =>
            console.warn("Background refetch after reorder failed:", err)
          );
        }
      } catch (error) {
        console.error("Failed to persist task reorder:", error);
        // Roll back to the pre-drag snapshot on API failure
        setLocalTasks(snapshotTasks);
      } finally {
        // Stamp the completion time so the cooldown guard prevents the
        // background refetch from overwriting the optimistic order.
        lastReorderTimeRef.current = Date.now();
        // Unlock the sync guard so that future filter/page changes from the
        // parent correctly sync localTasks again.
        isReorderingRef.current = false;
        setIsReordering(false);
      }
    }
  };

  // Group-aware drag end: only reorders tasks within the same group.
  // Cross-group drops are silently ignored to prevent invalid state changes.
  const handleGroupedDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    // Ignore column drags
    if (columnOrder.includes(active.id as string)) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the group each task belongs to
    const activeGroup = groupedTasks.find((g) => g.tasks.some((t) => t.id === activeId));
    const overGroup = groupedTasks.find((g) => g.tasks.some((t) => t.id === overId));

    // Silently cancel if they are in different groups
    if (!activeGroup || !overGroup || activeGroup.key !== overGroup.key) return;

    const oldIndex = localTasks.findIndex((t) => t.id === activeId);
    const newIndex = localTasks.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    // Snapshot for rollback
    const snapshotTasks = [...localTasks];

    // Lock sync before any state update
    isReorderingRef.current = true;
    setIsReordering(true);
    const reorderedTasks = arrayMove(localTasks, oldIndex, newIndex);
    setLocalTasks(reorderedTasks);

    const prevTask = reorderedTasks[newIndex - 1];
    const nextTask = reorderedTasks[newIndex + 1];

    let scopeType: "PROJECT" | "WORKSPACE" | "ORGANIZATION" = "ORGANIZATION";
    let scopeId = organizationId;
    if (projectSlug && (currentProject?.id || contextProject?.id)) {
      scopeType = "PROJECT";
      scopeId = currentProject?.id || contextProject?.id;
    } else if (workspaceSlug && workspaceId) {
      scopeType = "WORKSPACE";
      scopeId = workspaceId;
    }

    try {
      await updateRelativeTaskRank(activeId, {
        scopeType,
        scopeId: scopeId!,
        viewType: "LIST",
        afterTaskId: prevTask?.id ?? null,
        beforeTaskId: nextTask?.id ?? null,
      });
      // Fire-and-forget background sync
      if (onTaskRefetch) {
        Promise.resolve(onTaskRefetch()).catch((err) =>
          console.warn("Background refetch after grouped reorder failed:", err)
        );
      }
    } catch (error) {
      console.error("Failed to persist grouped task reorder:", error);
      setLocalTasks(snapshotTasks);
    } finally {
      lastReorderTimeRef.current = Date.now();
      isReorderingRef.current = false;
      setIsReordering(false);
    }
  }, [groupedTasks, localTasks, columnOrder, organizationId, projectSlug, workspaceSlug, workspaceId, currentProject, contextProject, updateRelativeTaskRank, onTaskRefetch]);


  // Handle browser back button to close modal
  useEffect(() => {
    const handlePopState = () => {
      if (isEditModalOpen) {
        isClosingRef.current = true;
        setIsEditModalOpen(false);
        setSelectedTask(null);
        setTimeout(() => { isClosingRef.current = false; }, 100);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isEditModalOpen]);


  const handleCloseModal = () => {
    if (isClosingRef.current || !isEditModalOpen) return;
    window.history.back();
  };

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
  const [excludedTaskIds, setExcludedTaskIds] = useState<string[]>([]);
  const [localAddTaskStatuses, setLocalAddTaskStatuses] = useState<TaskStatus[]>([]);
  const [localAddTaskProjectMembers, setLocalAddTaskProjectMembers] = useState<any[]>([]);

  // ─── Keyboard navigation via document-level listener ────────────────────
  // We attach to `document` so arrow keys/space work immediately without
  // needing the user to click the table wrapper first.
  useEffect(() => {
    const handleDocKeyDown = (e: KeyboardEvent) => {
      // Skip when modal is open
      if (isEditModalOpen) return;

      // Skip when an interactive element (input, textarea, select, button inside
      // a popover, etc.) has keyboard focus — we don't want to hijack typing.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          // contenteditable divs (rich-text editors)
          active.getAttribute("contenteditable") === "true" ||
          // Any element inside a [role=dialog] or [data-radix-popper-content-wrapper]
          active.closest("[role=dialog], [data-radix-popper-content-wrapper]")
        ) {
          return;
        }
      }

      // Only intercept when the table is actually in the DOM
      if (!tableWrapperRef.current) return;

      const tasksForNav = isGrouped
        ? groupedTasks.flatMap((g) => g.tasks)
        : localTasks;

      if (tasksForNav.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedRowIndex((prev) => {
          // First press: start at row 0 if nothing focused yet
          if (prev < 0) return 0;
          return Math.min(prev + 1, tasksForNav.length - 1);
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedRowIndex((prev) => {
          if (prev < 0) return 0;
          return Math.max(prev - 1, 0);
        });
      } else if (e.key === " ") {
        // Space toggles the checkbox of the focused row.
        // Read the current index from the ref (always fresh, no closure staleness).
        const currentIdx = focusedRowIndexRef.current;
        if (currentIdx < 0 || currentIdx >= tasksForNav.length) return;

        // Only when bulk selection is available
        if (!showBulkActionBar || !canBulkAction) return;

        const task = tasksForNav[currentIdx];
        if (!task) return;

        // Prevent the browser from scrolling the page on Space
        e.preventDefault();

        if (allDelete) {
          setExcludedTaskIds((ids) =>
            ids.includes(task.id)
              ? ids.filter((id) => id !== task.id)
              : [...ids, task.id]
          );
        } else {
          if (onTaskSelect) {
            onTaskSelect(task.id);
          } else if (onTasksSelect) {
            const action = selectedTasks.includes(task.id) ? "remove" : "add";
            onTasksSelect([task.id], action);
          }
        }
      } else if (e.key === "Enter") {
        // Enter opens the task detail drawer for the currently focused row
        const currentIdx = focusedRowIndexRef.current;
        if (currentIdx < 0 || currentIdx >= tasksForNav.length) return;
        const task = tasksForNav[currentIdx];
        if (!task) return;
        e.preventDefault();
        handleRowClickRef.current?.(task);
      }
    };

    document.addEventListener("keydown", handleDocKeyDown);
    return () => document.removeEventListener("keydown", handleDocKeyDown);
  }, [
    isEditModalOpen,
    isGrouped,
    groupedTasks,
    localTasks,
    showBulkActionBar,
    canBulkAction,
    allDelete,
    selectedTasks,
    onTaskSelect,
    onTasksSelect,
  ]);
  // focusedRowIndex intentionally not in deps — we use focusedRowIndexRef.current
  // (always fresh) so we avoid re-registering the listener on every arrow key.

  useEffect(() => {
    const fetchProjectMeta = async () => {
      const projectId = currentProject?.id || contextProject?.id || newTaskData?.projectId || (tasks.length > 0 ? tasks[0].projectId : null);
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
      if (projectId && (!projectMembers || projectMembers.length === 0)) {
        try {
          const members = await getProjectMembers(projectId);
          setLocalAddTaskProjectMembers(members || []);
        } catch (err) {
          setLocalAddTaskProjectMembers([]);
        }
      } else if (projectId && projectMembers && projectMembers.length > 0) {
        setLocalAddTaskProjectMembers(projectMembers);
      }
    };
    fetchProjectMeta();
  }, [newTaskData.projectId, projectSlug, showBulkActionBar, currentProject?.id, contextProject?.id]);

  const loadTaskCreationData = () => {
    if (localAddTaskStatuses && localAddTaskStatuses.length > 0) {
      const defaultStatus =
        localAddTaskStatuses.find((s) => s.isDefault) || localAddTaskStatuses[0];

      if (defaultStatus) {
        setNewTaskData((prev) => ({ ...prev, statusId: defaultStatus.id }));
      }
    }
  };

  useEffect(() => {
    if (isCreatingTask && localAddTaskStatuses.length > 0 && !newTaskData.statusId) {
      loadTaskCreationData();
    }
  }, [localAddTaskStatuses, isCreatingTask]);

  const today = getTodayDate();

  const formatDate = (dateString: string) => {
    const label = getRelativeDateLabel(dateString);
    // If it's a relative label, return it; otherwise format the date
    if (["Today", "Tomorrow", "Yesterday"].includes(label) || label.includes("days")) {
      return label;
    }
    return formatDateForDisplay(dateString);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const handleAllDeleteSelect = () => {
    const nextAllDelete = !allDelete;
    setAllDelete(nextAllDelete);
    setExcludedTaskIds([]);
  };

  const handleBulkDelete = async () => {
    const finalSelectedCount = allDelete ? (totalTask ?? 0) - excludedTaskIds.length : selectedTasks.length;
    if (finalSelectedCount === 0) {
      toast.warning("No tasks selected for deletion");
      return;
    }

    try {
      const displayCount = finalSelectedCount;
      const loadingToast = toast.loading(
        `Deleting ${displayCount} task${displayCount === 1 ? "" : "s"}...`
      );

      // Note: Backend now supports exclusions for "all: true" via excludedIds.
      const result = await bulkDeleteTasks(
        selectedTasks,
        currentProject?.id,
        allDelete,
        excludedTaskIds
      );

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
            `...and ${result.failedTasks.length - maxErrorsToShow} more task${result.failedTasks.length - maxErrorsToShow === 1 ? "" : "s"
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

  const handleBulkStatusUpdate = async (statusId: string) => {
    const finalSelectedCount = allDelete ? (totalTask ?? 0) - excludedTaskIds.length : selectedTasks.length;
    if (finalSelectedCount === 0) {
      toast.warning("No tasks selected for status update");
      return;
    }

    try {
      const displayCount = finalSelectedCount;
      const loadingToast = toast.loading(
        `Updating status for ${displayCount} task${displayCount === 1 ? "" : "s"}...`
      );

      const result = await bulkUpdateTasksStatus({
        taskIds: selectedTasks,
        projectId: currentProject?.id,
        all: allDelete,
        excludedIds: excludedTaskIds,
        statusId,
        search,
        statuses: selectedStatuses?.join(","),
        priorities: selectedPriorities?.join(","),
        types: selectedTaskTypes?.join(","),
        assignees: selectedAssignees?.join(","),
        reporters: selectedReporters?.join(","),
        organizationId: organizationId || currentOrganization?.id,
        workspaceId,
      });

      toast.dismiss(loadingToast);

      if (result.updatedCount > 0) {
        toast.success(
          `Successfully updated status for ${result.updatedCount} task${result.updatedCount === 1 ? "" : "s"}`
        );
      }

      if (result.failedTasks && result.failedTasks.length > 0) {
        const maxErrorsToShow = 3;
        result.failedTasks.slice(0, maxErrorsToShow).forEach((failed) => {
          toast.error(`Failed to update task status: ${failed.reason}`, {
            duration: 5000,
          });
        });

        if (result.failedTasks.length > maxErrorsToShow) {
          toast.warning(
            `...and ${result.failedTasks.length - maxErrorsToShow} more task${result.failedTasks.length - maxErrorsToShow === 1 ? "" : "s"
            } could not be updated`,
            { duration: 5000 }
          );
        }
      }

      if (onTaskRefetch) {
        await onTaskRefetch();
      }
      
      // Clear selection after successful bulk update
      handleClearSelection();
    } catch (error: any) {
      console.error("Failed to update tasks status:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update tasks status. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleBulkAssign = async (assigneeIds: string[]) => {
    const finalSelectedCount = allDelete ? (totalTask ?? 0) - excludedTaskIds.length : selectedTasks.length;
    if (finalSelectedCount === 0) {
      toast.warning("No tasks selected for assignment");
      return;
    }

    try {
      const displayCount = finalSelectedCount;
      const loadingToast = toast.loading(
        `Assigning ${displayCount} task${displayCount === 1 ? "" : "s"}...`
      );

      const result = await bulkAssignTasks({
        taskIds: selectedTasks,
        projectId: currentProject?.id,
        all: allDelete,
        excludedIds: excludedTaskIds,
        assigneeIds,
        search,
        statuses: selectedStatuses?.join(","),
        priorities: selectedPriorities?.join(","),
        types: selectedTaskTypes?.join(","),
        assignees: selectedAssignees?.join(","),
        reporters: selectedReporters?.join(","),
        organizationId: organizationId || currentOrganization?.id,
        workspaceId,
      });

      toast.dismiss(loadingToast);

      if (result.assignedCount > 0) {
        toast.success(
          `Successfully assigned ${result.assignedCount} task${result.assignedCount === 1 ? "" : "s"}`
        );
      }

      if (result.failedTasks && result.failedTasks.length > 0) {
        const maxErrorsToShow = 3;
        result.failedTasks.slice(0, maxErrorsToShow).forEach((failed) => {
          toast.error(`Failed to assign task: ${failed.reason}`, {
            duration: 5000,
          });
        });

        if (result.failedTasks.length > maxErrorsToShow) {
          toast.warning(
            `...and ${result.failedTasks.length - maxErrorsToShow} more task${result.failedTasks.length - maxErrorsToShow === 1 ? "" : "s"
            } could not be assigned`,
            { duration: 5000 }
          );
        }
      }

      if (onTaskRefetch) {
        await onTaskRefetch();
      }
      
      // Clear selection after successful bulk update
      handleClearSelection();
    } catch (error: any) {
      console.error("Failed to assign tasks:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to assign tasks. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleClearAssignment = async () => {
    const finalSelectedCount = allDelete ? (totalTask ?? 0) - excludedTaskIds.length : selectedTasks.length;
    if (finalSelectedCount === 0) {
      toast.warning("No tasks selected for clearing assignment");
      return;
    }

    try {
      const displayCount = finalSelectedCount;
      const loadingToast = toast.loading(
        `Clearing assignment for ${displayCount} task${displayCount === 1 ? "" : "s"}...`
      );

      const result = await bulkAssignTasks({
        taskIds: selectedTasks,
        projectId: currentProject?.id,
        all: allDelete,
        excludedIds: excludedTaskIds,
        assigneeIds: [],
        search,
        statuses: selectedStatuses?.join(","),
        priorities: selectedPriorities?.join(","),
        types: selectedTaskTypes?.join(","),
        assignees: selectedAssignees?.join(","),
        reporters: selectedReporters?.join(","),
        organizationId: organizationId || currentOrganization?.id,
        workspaceId,
      });

      toast.dismiss(loadingToast);

      if (result.assignedCount > 0) {
        toast.success(
          `Successfully cleared assignment for ${result.assignedCount} task${result.assignedCount === 1 ? "" : "s"}`
        );
      }

      if (result.failedTasks && result.failedTasks.length > 0) {
        const maxErrorsToShow = 3;
        result.failedTasks.slice(0, maxErrorsToShow).forEach((failed) => {
          toast.error(`Failed to clear assignment: ${failed.reason}`, {
            duration: 5000,
          });
        });

        if (result.failedTasks.length > maxErrorsToShow) {
          toast.warning(
            `...and ${result.failedTasks.length - maxErrorsToShow} more task${result.failedTasks.length - maxErrorsToShow === 1 ? "" : "s"
            } could not be updated`,
            { duration: 5000 }
          );
        }
      }

      if (onTaskRefetch) {
        await onTaskRefetch();
      }
    } catch (error: any) {
      console.error("Failed to clear assignment:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to clear assignment. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleClearSelection = () => {
    if (onTasksSelect) {
      onTasksSelect(selectedTasks, "remove");
    } else if (onTaskSelect) {
      selectedTasks.forEach((taskId) => onTaskSelect(taskId));
    }
    setAllDelete(false);
    setExcludedTaskIds([]);
  };

  // Helper function to render multiple assignees
  const renderMultipleAssignees = (assignees: any[], maxVisible = 3) => {
    if (!assignees || assignees.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span className="tasktable-assignee-unassigned">{t("table.unassigned")}</span>
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
                <span className="text-sm text-gray-500">{t("table.selectAssignees")}</span>
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
                        alt={`${assignee.user?.firstName || assignee.firstName
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
            <CommandInput placeholder={t("table.searchAssignees")} />
            <CommandList>
              <CommandEmpty>{t("table.noAssignees")}</CommandEmpty>
              <CommandGroup>
                {availableMembers.map((member) => {
                  const memberId = member.user?.id || member.id;
                  const isSelected = newTaskData.assigneeIds.includes(memberId);

                  return (
                    <CommandItem
                      key={memberId}
                      value={`${member.user?.firstName || member.firstName} ${member.user?.lastName || member.lastName
                        }`}
                      onSelect={() => handleAssigneeToggle(memberId)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <Avatar className="w-6 h-6">
                        <AvatarImage
                          src={member.user?.avatar || member.avatar || "/placeholder.svg"}
                          alt={`${member.user?.firstName || member.firstName} ${member.user?.lastName || member.lastName
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

  const isOverdue = (dueDate: string, completedAt?: string) => {
    return checkDateOverdue(dueDate, completedAt);
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
            <span className="tasktable-assignee-unassigned">{t("table.unassigned")}</span>
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
            <span className="tasktable-date-empty">{t("table.noTimeline")}</span>
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
    const slug = task.slug || "";

    const wsSlug = workspaceSlug || task.project?.workspace?.slug;
    const pgSlug = projectSlug || task.project?.slug;

    let newUrl = "";
    if (wsSlug && pgSlug) {
      newUrl = `/${wsSlug}/${pgSlug}/tasks/${slug}`;
    } else if (wsSlug) {
      newUrl = `/${wsSlug}/tasks/${slug}`;
    } else {
      newUrl = `/tasks/${slug}`;
    }

    // Check if URL is already correct to avoid duplicate pushes
    if (window.location.pathname !== newUrl) {
      window.history.pushState({ taskOpen: true }, "", newUrl);
    }

    await getTaskById(task.slug || task.id, isAuthenticated());
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };
  // Keep the ref in sync so the keydown handler can always call the latest version
  handleRowClickRef.current = handleRowClick;

  // ─── Shift-click / single-click row handler ───────────────────────────────
  const handleRowClickWithKeyboard = useCallback(
    (task: Task, rowIndex: number, e: React.MouseEvent) => {
      setFocusedRowIndex(rowIndex);

      const canSelect = showBulkActionBar && canBulkAction && (onTaskSelect || onTasksSelect);

      // Shift + click → range-select (only when selection is available)
      if (e.shiftKey && canSelect) {
        e.preventDefault();
        const tasksForNav = isGrouped
          ? groupedTasks.flatMap((g) => g.tasks)
          : localTasks;

        if (lastClickedIndexRef.current < 0) {
          // No anchor yet — treat this shift-click as a regular selection click
          // (select just this row and set the anchor)
          lastClickedIndexRef.current = rowIndex;
          if (allDelete) {
            setExcludedTaskIds((prev) => prev.filter((id) => id !== task.id));
          } else {
            if (onTasksSelect) onTasksSelect([task.id], "add");
            else if (onTaskSelect) onTaskSelect(task.id);
          }
        } else {
          // Range-select from anchor to current row
          const start = Math.min(lastClickedIndexRef.current, rowIndex);
          const end = Math.max(lastClickedIndexRef.current, rowIndex);
          const rangeIds = tasksForNav.slice(start, end + 1).map((t) => t.id);

          if (allDelete) {
            // In "all selected" mode, un-exclude the range
            setExcludedTaskIds((prev) => prev.filter((id) => !rangeIds.includes(id)));
          } else {
            if (onTasksSelect) {
              onTasksSelect(rangeIds, "add");
            } else if (onTaskSelect) {
              rangeIds.forEach((id) => {
                if (!selectedTasks.includes(id)) onTaskSelect(id);
              });
            }
          }
        }
        return; // don't open the detail modal on shift-click
      }

      // Normal click → open task detail & update anchor for future shift-clicks
      lastClickedIndexRef.current = rowIndex;
      handleRowClick(task);
    },
    [
      showBulkActionBar,
      canBulkAction,
      isGrouped,
      groupedTasks,
      localTasks,
      allDelete,
      selectedTasks,
      onTaskSelect,
      onTasksSelect,
      handleRowClick,
    ]
  );

  if (tasks.length === 0) {
    return (
      <div className="tasktable-empty-state">
        <h3 className="tasktable-empty-title">{t("table.empty.title")}</h3>
        <p className="tasktable-empty-description">
          {t("table.empty.description")}
        </p>
      </div>
    );
  }

  const visibleColumns = columns.filter((col) => col.visible);


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
        dueDate: newTaskData.dueDate ? dayjs(newTaskData.dueDate).toISOString() : undefined,
        ...(sprintId && { sprintId }),
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
    return getTodayDate();
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

  const renderHeaderCell = (colId: string) => {
    switch (colId) {
      case "task":
        const currentPageIds = tasks.map((t) => t.id);
        const selectedOnPage = currentPageIds.filter((id) => selectedTasks.includes(id));
        const excludedOnPage = currentPageIds.filter((id) => excludedTaskIds.includes(id));

        let headerChecked: boolean | "indeterminate" = false;
        if (allDelete) {
          if (excludedOnPage.length === 0) {
            headerChecked = true;
          } else if (excludedOnPage.length === currentPageIds.length) {
            headerChecked = false;
          } else {
            headerChecked = "indeterminate";
          }
        } else {
          if (selectedOnPage.length === currentPageIds.length && currentPageIds.length > 0) {
            headerChecked = true;
          } else if (selectedOnPage.length > 0) {
            headerChecked = "indeterminate";
          } else {
            headerChecked = false;
          }
        }

        return (
          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {(onTaskSelect || onTasksSelect) && showBulkActionBar && canBulkAction && (
              <Checkbox
                className="border-[var(--ring)] cursor-pointer"
                checked={headerChecked}
                onCheckedChange={(checked) => {
                  if (checked === true || checked === "indeterminate") {
                    if (allDelete) {
                      setExcludedTaskIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
                    } else {
                      if (onTasksSelect) {
                        onTasksSelect(currentPageIds, "add");
                      } else if (onTaskSelect) {
                        tasks.forEach((task) => {
                          if (!selectedTasks.includes(task.id)) {
                            onTaskSelect(task.id);
                          }
                        });
                      }
                    }
                  } else {
                    if (allDelete) setAllDelete(false);
                    if (onTasksSelect) {
                      onTasksSelect(currentPageIds, "remove");
                    } else if (onTaskSelect) {
                      tasks.forEach((task) => {
                        if (selectedTasks.includes(task.id)) {
                          onTaskSelect(task.id);
                        }
                      });
                    }
                  }
                }}
              />
            )}
            <span>{t("table.task")}</span>
          </div>
        );
      case "project":
        return <span>{t("table.project")}</span>;
      case "priority":
        return <span>{t("table.priority")}</span>;
      case "status":
        return <p className="ml-3">{t("table.status")}</p>;
      case "assignees":
        return <span>{t("table.assignees")}</span>;
      case "dueDate":
        return <span>{t("table.dueDate")}</span>;
      default:
        const col = columns.find((c) => c.id === colId);
        return (
          <div className="flex items-center justify-between group">
            <span>{col?.label || colId}</span>
          </div>
        );
    }
  };

  const getHeaderClass = (colId: string) => {
    switch (colId) {
      case "task": return "tasktable-header-cell-task pl-6";
      case "project": return "tasktable-header-cell-project";
      case "priority": return "tasktable-header-cell-priority";
      case "status": return "tasktable-header-cell-status";
      case "assignees": return "tasktable-header-cell-assignee w-32 text-center min-w-[120px] max-w-[180px]";
      case "dueDate": return "tasktable-header-cell-date";
      case "timeline": return "tasktable-header-cell w-[14%] min-w-[200px] max-w-[260px]";
      default: return "tasktable-header-cell w-[8%] min-w-[100px] max-w-[140px]";
    }
  };

  const renderAddRowCell = (colId: string) => {
    switch (colId) {
      case "task":
        return (
          <TableCell key={colId} className="tasktable-cell-task gap-0">
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
                placeholder={t("table.enterTaskTitle")}
                className={`flex-1 border-none shadow-none focus-visible:ring-1 bg-transparent ${isTitleInvalid ? "ring-2 ring-red-500" : ""}`}
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
        );
      case "project":
        return (
          <TableCell key={colId} className="tasktable-cell-project">
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
                <SelectTrigger className={`border-none shadow-none -ml-3 ${!newTaskData.projectId ? "ring-1 ring-red-300" : ""}`}>
                  <SelectValue placeholder={t("table.selectProject")} />
                </SelectTrigger>
                <SelectContent className="overflow-y-auto bg-[var(--card)] border-none text-[var(--foreground)]">
                  {Array.isArray(projectsOfCurrentWorkspace) && projectsOfCurrentWorkspace.length > 0 ? (
                    projectsOfCurrentWorkspace.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-projects" disabled>
                      {t("table.noProjects")}
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
        );
      case "priority":
        return (
          <TableCell key={colId} className="tasktable-cell">
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
        );
      case "status":
        return (
          <TableCell key={colId} className="tasktable-cell">
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
                <SelectTrigger className={`border-none shadow-none bg-transparent ${!newTaskData.statusId ? "ring-1 ring-red-300" : ""}`}>
                  <SelectValue placeholder={t("table.selectStatus")} />
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
                      {t("table.noStatuses")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-gray-400">{t("table.selectProjectFirst")}</span>
            )}
          </TableCell>
        );
      case "assignees":
        return (
          <TableCell key={colId} className="tasktable-cell-assignee">
            {newTaskData.projectId || projectSlug || currentProject?.id ? (
              <MultiSelectAssignee />
            ) : (
              <span className="text-sm text-gray-400">{t("table.selectProjectFirst")}</span>
            )}
          </TableCell>
        );
      case "dueDate":
        return (
          <TableCell key={colId} className="tasktable-cell-date">
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
                placeholder={t("table.dueDate")}
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
        );
      default:
        return (
          <TableCell key={colId} className="tasktable-cell w-[8%] min-w-[100px] max-w-[140px]">
            <span className="text-sm text-gray-400">-</span>
          </TableCell>
        );
    }
  };

  const renderTaskRowCell = (colId: string, task: Task, options?: { dragHandleProps?: any }) => {
    switch (colId) {
      case "task":
        return (
          <TableCell key={colId} className="tasktable-cell-task">
            <div className="flex items-start gap-3">
              {/* Drag handle */}
              {options?.dragHandleProps && (
                <div 
                  className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing"
                  {...options.dragHandleProps}
                >
                  <span className="text-muted-foreground">⋮⋮</span>
                </div>
              )}
              {(onTaskSelect || onTasksSelect) && showBulkActionBar && canBulkAction && (
                <div className="flex-shrink-0 mt-0.5">
                  <Checkbox
                    className="cursor-pointer border-[var(--ring)]"
                    checked={allDelete ? !excludedTaskIds.includes(task.id) : selectedTasks.includes(task.id)}
                    onCheckedChange={(checked) => {
                      if (allDelete) {
                        setExcludedTaskIds((prev) =>
                          checked ? prev.filter((id) => id !== task.id) : [...prev, task.id]
                        );
                      } else {
                        if (onTaskSelect) onTaskSelect(task.id);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <div className="flex-shrink-0 mt-0.5">{getTaskTypeIcon(task.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="tasktable-task-title line-clamp-1 max-w-[400px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {task.parentTask?.title && (
                      <span className="text-[var(--muted-foreground)] mr-1">
                        {task.parentTask.title} /
                      </span>
                    )}
                    {task.title}
                  </h4>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                    <span className="text-muted text-[0.600rem]">{task.slug || `#${task.taskNumber}`}</span>
                  </Badge>
                  {task.isRecurring && <RecurringBadge />}
                  {task.isArchived && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 flex-shrink-0 bg-gray-100 text-gray-600">
                      Archived
                    </Badge>
                  )}
                  <Tooltip content="Expand to full screen" position="top">
                    <button
                      className="p-0.5 rounded opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 hover:bg-[var(--accent)] cursor-pointer flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const wsSlug = workspaceSlug || task.project?.workspace?.slug;
                        const pgSlug = projectSlug || task.project?.slug;
                        const slug = task.slug || "";
                        let url = `/tasks/${slug}`;
                        if (wsSlug && pgSlug) url = `/${wsSlug}/${pgSlug}/tasks/${slug}`;
                        else if (wsSlug) url = `/${wsSlug}/tasks/${slug}`;
                        router.push(url);
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    </button>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {task._count?.comments > 0 && (
                    <div className="flex items-center gap-0.5 text-xs text-[varml(--muted-foreground)]">
                      <MessageSquare className="w-4 h-4 mt-0.5" />
                      <span className="">{task._count.comments}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        );
      case "project":
        return (
          <TableCell key={colId} className="tasktable-cell-project">
            <div className="flex items-center">
              <span className="tasktable-project-name">
                {task.project?.name || "Unknown Project"}
              </span>
            </div>
          </TableCell>
        );
      case "priority":
        return (
          <TableCell key={colId} className="tasktable-cell">
            <PriorityBadge priority={task.priority} />
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={colId} className="tasktable-cell">
            <StatusBadge status={task.status} />
          </TableCell>
        );
      case "assignees":
        return (
          <TableCell key={colId} className="tasktable-cell-assignee w-32 min-w-[120px] max-w-[180px] text-center align-middle">
            <div className="flex justify-center items-center">
              {renderMultipleAssignees(
                currentTask && currentTask.id === task.id
                  ? currentTask.assignees || (currentTask.assignee ? [currentTask.assignee] : [])
                  : task.assignees || (task.assignee ? [task.assignee] : [])
              )}
            </div>
          </TableCell>
        );
      case "dueDate":
        return (
          <TableCell key={colId} className="tasktable-cell-date">
            {task.dueDate ? (
              <div className="tasktable-date-container">
                <CalendarDays className="tasktable-date-icon w-4 h-4" />
                <span className={cn("tasktable-date-text", isOverdue(task.dueDate, task.completedAt) && "text-red-600")}>
                  {formatDate(task.dueDate)}
                </span>
              </div>
            ) : (
              <div className="tasktable-date-container">
                <CalendarDays className="tasktable-date-icon w-4 h-4" />
                <span className="tasktable-date-empty">{t("table.noDueDate")}</span>
              </div>
            )}
          </TableCell>
        );
      default:
        const column = columns.find(c => c.id === colId);
        const isTimeline = colId === "timeline";
        return (
          <TableCell
            key={colId}
            className={isTimeline ? "tasktable-cell w-[14%] min-w-[200px] max-w-[260px]" : "tasktable-cell w-[8%] min-w-[100px] max-w-[140px]"}
          >
            {column ? renderDynamicCellContent(task, column) : null}
          </TableCell>
        );
    }
  };

  return (
    <div className="w-full">
      <div
        className="tasktable-container"
        ref={tableWrapperRef}
      >
        <div className="tasktable-wrapper">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={isGrouped ? handleGroupedDragEnd : handleDragEnd}
          >
            {/* ─── GROUPED rendering ─── */}
            {isGrouped ? (
              <table className="tasktable-table w-full caption-bottom text-sm border-collapse">
                {/* Shared table header */}
                <thead className="tasktable-header">
                  <tr className="tasktable-header-row border-b border-[var(--border)]/50">
                    {columnOrder.map((colId) => (
                      <th
                        key={colId}
                        className={`text-left align-middle font-medium text-[var(--muted-foreground)] text-xs ${getHeaderClass(colId)} py-3`}
                      >
                        {renderHeaderCell(colId)}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Grouped loading spinner */}
                {groupedLoading && (

                  <tbody>
                    <tr>
                      <td colSpan={columnOrder.length} className="text-center py-8 text-[var(--muted-foreground)] text-sm animate-pulse">
                        Loading groups…
                      </td>
                    </tr>
                  </tbody>
                )}

                {/* One TaskGroupSection (tbody) per group — each has its own SortableContext */}
                {!groupedLoading && groupedTasks.map((group) => {
                  const state = groupMap?.get(group.key);
                  return (
                    <TaskGroupSection
                      key={group.key}
                      groupKey={group.key}
                      label={group.label}
                      tasks={group.tasks}
                      defaultExpanded={true}
                      itemIds={group.tasks.map((t) => t.id)}
                      totalCount={state?.totalCount ?? group.tasks.length}
                      page={state?.page ?? 1}
                      totalPages={state?.totalPages ?? 1}
                      loadingMore={state?.loadingMore ?? false}
                      onPageChange={onGroupPageChange ? (p) => onGroupPageChange(group.key, p) : undefined}
                      renderRow={(task, taskIndex) => {
                        // compute global index across all groups
                        const globalIndex = groupedTasks
                          .slice(0, groupedTasks.findIndex((g) => g.tasks.some((t) => t.id === task.id)))
                          .reduce((acc, g) => acc + g.tasks.length, 0) + taskIndex;
                        return (
                          <SortableRow
                            key={task.id}
                            task={task}
                            workspaceSlug={workspaceSlug}
                            projectSlug={projectSlug}
                            columnOrder={columnOrder}
                            renderTaskRowCell={renderTaskRowCell}
                            handleRowClick={handleRowClick}
                            isFocused={focusedRowIndex === globalIndex}
                            rowIndex={globalIndex}
                            onRowClick={handleRowClickWithKeyboard}
                          />
                        );
                      }}
                    />
                  );
                })}

                {/* Empty state inside grouped view */}

                {groupedTasks.length === 0 && (

                  <tbody>
                    <tr>
                      <td colSpan={columnOrder.length} className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                        No tasks found
                      </td>
                    </tr>
                  </tbody>
                )}

              </table>

            ) : (
              /* ─── FLAT list rendering (original) ─── */
              <Table className="tasktable-table">
                <TableHeader className="tasktable-header">
                  <TableRow className="tasktable-header-row">
                    <SortableContext
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {columnOrder.map((colId) => (
                        <SortableHeader key={colId} id={colId} className={getHeaderClass(colId)}>
                          {renderHeaderCell(colId)}
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>

                <TableBody className="tasktable-body">
                  {showAddTaskRow &&
                    (isCreatingTask ? (
                      <TableRow className="tasktable-add-row h-12 bg-[var(--mini-sidebar)]/50 border-none">
                        {columnOrder.map((colId) => renderAddRowCell(colId))}
                      </TableRow>
                    ) : (
                      <TableRow className="tasktable-add-row h-12 border-none transition-colors bg-[var(--mini-sidebar)]/50">
                        <TableCell
                          colSpan={columnOrder.length + 1}
                          className="text-center py-3"
                        >
                          <button
                            onClick={handleStartCreating}
                            className="flex items-center pl-4 justify-start gap-2 w-full  cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium ">{t("table.addTask")}</span>
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  <SortableContext
                    items={localTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {localTasks.map((task, idx) => (
                      <SortableRow
                        key={task.id}
                        task={task}
                        workspaceSlug={workspaceSlug}
                        projectSlug={projectSlug}
                        columnOrder={columnOrder}
                        renderTaskRowCell={renderTaskRowCell}
                        handleRowClick={handleRowClick}
                        isFocused={focusedRowIndex === idx}
                        rowIndex={idx}
                        onRowClick={handleRowClickWithKeyboard}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            )}

            <DragOverlay>
              {activeDragId && !columnOrder.includes(activeDragId) && (
                <div className="bg-background border rounded-md shadow-lg opacity-80">
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 text-muted-foreground">⋮⋮</div>
                      <span className="text-sm font-medium">
                        {localTasks.find(t => t.id === activeDragId)?.title || "Task"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {pagination && pagination.totalPages > 1 && (

          <TableRow className="tasktable-footer-row">
            <TableCell colSpan={columnOrder.length + 1} className="tasktable-footer-cell">
              <div className="tasktable-pagination-container">
                <div className="tasktable-pagination-info">
                  {t("table.showing", {
                    start: (pagination.currentPage - 1) * pagination.pageSize + 1,
                    end: Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount),
                    total: pagination.totalCount
                  })}
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
      {(onTaskSelect || onTasksSelect) && showBulkActionBar && canBulkAction && (
        <BulkActionBar
          selectedCount={selectedTasks.length}
          onDelete={handleBulkDelete}
          onClear={handleClearSelection}
          onAllDeleteSelect={handleAllDeleteSelect}
          totalTask={totalTask}
          currentTaskCount={Array.isArray(tasks) ? tasks.length : 0}
          allDelete={allDelete}
          excludedCount={excludedTaskIds.length}
          onStatusUpdate={handleBulkStatusUpdate}
          availableStatuses={localAddTaskStatuses}
          onAssign={handleBulkAssign}
          onClearAssignment={handleClearAssignment}
          availableMembers={
            projectSlug && projectMembers && projectMembers.length > 0
              ? projectMembers
              : localAddTaskProjectMembers
          }
          userRole={userRole}
        />
      )}

      {isEditModalOpen && (
        <CustomModal
          isOpen={isEditModalOpen}
          onClose={handleCloseModal}
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
              taskId={selectedTask.slug}
              onTaskRefetch={onTaskRefetch}
              onClose={handleCloseModal}
            />
          )}
        </CustomModal>
      )}
    </div>
  );
};

export default TaskTable;
