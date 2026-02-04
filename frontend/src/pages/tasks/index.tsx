import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask } from "@/contexts/task-context";
import { useProjectContext } from "@/contexts/project-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import TaskListView from "@/components/tasks/views/TaskListView";
import TaskGanttView from "@/components/tasks/views/TaskGanttView";
import { PageHeader } from "@/components/common/PageHeader";
import ActionButton from "@/components/common/ActionButton";
import TabView from "@/components/tasks/TabView";
import Pagination from "@/components/common/Pagination";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import { FilterDropdown, useGenericFilters } from "@/components/common/FilterDropdown";
import SortIngManager, { SortOrder, SortField } from "@/components/tasks/SortIngManager";
import Tooltip from "@/components/common/ToolTip";

import { HiXMark } from "react-icons/hi2";
import {
  CheckSquare,
  Flame,
  Building2,
  Folder,
  Search,
  Clipboard,
  User,
  Users,
  Download,
  Shapes,
} from "lucide-react";
import { Input } from "@/components/ui/input";

import { Task, ColumnConfig, Project, ViewMode, TaskStatus } from "@/types";
import { TokenManager } from "@/lib/api";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";
import { exportTasksToCSV } from "@/utils/exportUtils";
import { SEO } from "@/components/common/SEO";
import { TaskTypeIcon } from "@/utils/data/taskData";

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function TasksPageContent() {
  const router = useRouter();
  const { t } = useTranslation("tasks");
  const { getAllTasks, getCalendarTask, getAllTaskStatuses, isLoading: taskLoading, taskResponse, tasks, updateTask } = useTask();
  const { getWorkspacesByOrganization } = useWorkspaceContext();
  const { getProjectsByOrganization, getTaskStatusByProject } = useProjectContext();
  const { getCurrentUser, getUserAccess } = useAuth();
  const { createSection } = useGenericFilters();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const currentOrganizationId = TokenManager.getCurrentOrgId();
  const currentUser = getCurrentUser();
  const { getOrganizationMembers } = useProjectContext();

  // State management
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAcess] = useState<any>(null);
  const [urlParamsInitialized, setUrlParamsInitialized] = useState(false);
  const [statusFilterEnabled, setStatusFilterEnabled] = useState(false);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);

  // View and display state
  type ViewType = "list" | "kanban" | "gantt";

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    if (typeof window === "undefined") return "list";
    const type = new URLSearchParams(window.location.search).get("type");
    return type === "list" || type === "gantt" || type === "kanban" ? type : "list";
  });

  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Filter state
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);

  const [sortField, setSortField] = useState<SortField>(() => {
    return localStorage.getItem(SORT_FIELD_KEY) || "createdAt";
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const stored = localStorage.getItem(SORT_ORDER_KEY);
    return stored === "asc" || stored === "desc" ? stored : "desc";
  });

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(COLUMNS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const priorityParams = params.get("priorities");
      const statusParams = params.get("statuses");

      if (priorityParams) {
        setSelectedPriorities(priorityParams.split(","));
      }
      if (statusParams) {
        setSelectedStatuses(statusParams.split(","));
      }
    }
  }, [router.asPath]);

  // Derived state
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const hasValidUserAndOrg = !!currentUser?.id && !!currentOrganizationId;

  const defaultProject = useMemo(() => {
    return projects.length > 0 ? projects[0] : { slug: "default-project" };
  }, [projects]);

  const defaultWorkspace = useMemo(() => {
    return projects.length > 0 && projects[0].workspace
      ? projects[0].workspace
      : { slug: "default-workspace" };
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(SORT_FIELD_KEY, sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const workspaceParams = params.get("workspaces");
      const projectParams = params.get("projects");
      const statusParams = params.get("statuses");
      const priorityParams = params.get("priorities");
      const typeParams = params.get("types");

      if (workspaceParams) {
        setSelectedWorkspaces(workspaceParams.split(","));
      }
      if (projectParams) {
        setSelectedProjects(projectParams.split(","));
      }
      if (statusParams) {
        setSelectedStatuses(statusParams.split(","));
      }
      if (priorityParams) {
        setSelectedPriorities(priorityParams.split(","));
      }
      if (typeParams) {
        setSelectedTaskTypes(typeParams.split(","));
      }

      // Mark URL params as initialized
      setUrlParamsInitialized(true);
    }
  }, []);

  // Check user access
  useEffect(() => {
    if (!currentOrganizationId) return;

    getUserAccess({ name: "organization", id: currentOrganizationId })
      .then((data) => {
        (setHasAccess(data?.canChange), setUserAcess(data));
      })
      .catch((error) => console.error("Error fetching user access:", error));
  }, [currentOrganizationId]);

  // Fetch statuses for selected project or for the entire organization
  useEffect(() => {
    const fetchStatusesList = async () => {
      try {
        let statuses: TaskStatus[] = [];
        if (selectedProjects.length === 1) {
          statuses = await getTaskStatusByProject(selectedProjects[0]);
        } else if (currentOrganizationId) {
          statuses = await getAllTaskStatuses({ organizationId: currentOrganizationId });
        }

        if (statuses.length > 0) {
          setAvailableStatuses(statuses);
          setStatusFilterEnabled(true);

          // Handle category=COMPLETED from URL only if statuses aren't already set from URL params
          const params = new URLSearchParams(window.location.search);
          const categoryParam = params.get("category");
          const statusParams = params.get("statuses");

          // Only apply category logic if we have a category param and no explicit status params
          if (categoryParam === "COMPLETED" && !statusParams) {
            const completedStatusIds = statuses
              .filter((s) => s.category === "DONE")
              .map((s) => s.id);

            if (completedStatusIds.length > 0) {
              setSelectedStatuses(completedStatusIds);
            }
          }
        } else {
          setAvailableStatuses([]);
          setStatusFilterEnabled(false);
        }
      } catch (error) {
        console.error("Failed to fetch statuses:", error);
        setAvailableStatuses([]);
        setStatusFilterEnabled(false);
      }
    };

    fetchStatusesList();
  }, [selectedProjects, currentOrganizationId]);

  // Load initial data (workspaces and projects)
  const loadInitialData = useCallback(async () => {
    if (!hasValidUserAndOrg || !currentOrganizationId) return;

    try {
      setError(null);
      const [workspacesData, projectsData, organizationMembers] = await Promise.all([
        getWorkspacesByOrganization(currentOrganizationId),
        getProjectsByOrganization(currentOrganizationId),
        getOrganizationMembers(currentOrganizationId),
      ]);

      setWorkspaces(workspacesData || []);
      setProjects(projectsData || []);
      setOrganizationMembers(organizationMembers || []);
    } catch (error) {
      setError(error?.message ? error.message : "Failed to load initial data");
    }
  }, [hasValidUserAndOrg, currentOrganizationId]);

  // Load tasks with filters
  const loadTasks = useCallback(async () => {
    if (!hasValidUserAndOrg || !currentOrganizationId) return;

    try {
      setError(null);

      const params = {
        page: currentPage,
        limit: pageSize,
        ...(debouncedSearchQuery.trim() && {
          search: debouncedSearchQuery.trim(),
        }),
        ...(selectedWorkspaces.length > 0 && {
          workspaceId: selectedWorkspaces.join(","),
        }),
        ...(selectedProjects.length > 0 && {
          projectId: selectedProjects.join(","),
        }),
        ...(selectedStatuses.length > 0 && {
          statuses: selectedStatuses.join(","),
        }),
        ...(selectedPriorities.length > 0 && {
          priorities: selectedPriorities.join(","),
        }),
        ...(selectedTaskTypes.length > 0 && {
          types: selectedTaskTypes.join(","),
        }),
        ...(selectedAssignees.length > 0 && {
          assignees: selectedAssignees.join(","),
        }),
        ...(selectedReporters.length > 0 && {
          reporters: selectedReporters.join(","),
        }),
      };

      const res = await getAllTasks(currentOrganizationId, params);
      if (res) {
        setPagination({
          currentPage: res.page,
          totalPages: res.totalPages,
          totalCount: res.total,
          hasNextPage: res.page < res.totalPages,
          hasPrevPage: res.page > 1,
        });
      }
    } catch (error) {
      setError(error?.message ? error.message : "Failed to load tasks");
    }
  }, [
    hasValidUserAndOrg,
    currentOrganizationId,
    selectedWorkspaces,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    selectedAssignees,
    selectedReporters,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    taskResponse,
  ]);

  // Load Gantt data
  const [ganttTasks, setGanttTasks] = useState<Task[]>([]);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [ganttError, setGanttError] = useState<string | null>(null);

  const loadGanttData = useCallback(async () => {
    if (!currentOrganizationId) return;
    try {
      setGanttError(null);
      setGanttLoading(true);
      const data = await getCalendarTask(currentOrganizationId, {
        includeSubtasks: true,
      });
      setGanttTasks(data || []);
    } catch (error) {
      setGanttError(error?.message ? error.message : "Failed to load Gantt data");
      setGanttTasks([]);
    } finally {
      setGanttLoading(false);
    }
  }, [currentOrganizationId, getCalendarTask]);

  // Load data on mount and when organization changes
  useEffect(() => {
    if (hasValidUserAndOrg && currentOrganizationId) {
      loadInitialData();
    }
  }, [hasValidUserAndOrg, currentOrganizationId, loadInitialData]);

  // Load tasks when filters change (only after URL params are initialized)
  useEffect(() => {
    if (urlParamsInitialized) {
      loadTasks();
    }
  }, [
    urlParamsInitialized,
    selectedWorkspaces,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    selectedAssignees,
    selectedReporters,
    currentPage,
    pageSize,
    debouncedSearchQuery,
  ]);

  const handleTaskUpdate = useCallback(
    async (taskId: string, updates: any) => {
      try {
        await updateTask(taskId, updates);
        // Refresh Gantt data if needed
        if (currentView === "gantt") {
          loadGanttData();
        }
      } catch (error) {
        console.error("Failed to update task:", error);
      }
    },
    [updateTask, currentView, loadGanttData]
  );

  // Load Gantt data when Gantt tab is active
  useEffect(() => {
    if (currentView === "gantt" && currentOrganizationId) {
      loadGanttData();
    }
  }, [currentView, currentOrganizationId, loadGanttData]);

  // Column management
  const handleAddColumn = useCallback((columnId: string) => {
    const columnConfigs: Record<string, { label: string; type: ColumnConfig["type"] }> = {
      description: { label: t("columns.description"), type: "text" },
      taskNumber: { label: t("columns.taskNumber"), type: "number" },
      timeline: { label: t("columns.timeline"), type: "dateRange" },
      completedAt: { label: t("columns.completedAt"), type: "date" },
      storyPoints: { label: t("columns.storyPoints"), type: "number" },
      originalEstimate: { label: t("columns.originalEstimate"), type: "number" },
      remainingEstimate: { label: t("columns.remainingEstimate"), type: "number" },
      reporter: { label: t("columns.reporter"), type: "user" },
      updatedBy: { label: t("columns.updatedBy"), type: "user" },
      createdAt: { label: t("columns.createdAt"), type: "date" },
      updatedAt: { label: t("columns.updatedAt"), type: "date" },
      sprint: { label: t("columns.sprint"), type: "text" },
      parentTask: { label: t("columns.parentTask"), type: "text" },
      childTasksCount: { label: t("columns.childTasksCount"), type: "number" },
      commentsCount: { label: t("columns.commentsCount"), type: "number" },
      attachmentsCount: { label: t("columns.attachmentsCount"), type: "number" },
      timeEntries: { label: t("columns.timeEntries"), type: "number" },
    };

    const config = columnConfigs[columnId];
    if (!config) {
      console.warn(`Unknown column ID: ${columnId}`);
      return;
    }

    const newColumn: ColumnConfig = {
      id: columnId,
      label: config.label,
      type: config.type,
      visible: true,
    };

    setColumns((prev) => [...prev, newColumn]);
  }, []);

  const handleRemoveColumn = useCallback((columnId: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== columnId));
  }, []);

  // Filter handlers
  const toggleWorkspace = useCallback((id: string) => {
    setSelectedWorkspaces((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.workspaces = newSelection.join(",");
      } else {
        delete newQuery.workspaces;
      }
      router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
      return newSelection;
    });
    setCurrentPage(1);
  }, [router]);

  const toggleProject = useCallback((id: string) => {
    setSelectedProjects((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.projects = newSelection.join(",");
      } else {
        delete newQuery.projects;
      }
      router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
      return newSelection;
    });
    setCurrentPage(1);
  }, [router]);

  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.statuses = newSelection.join(",");
      } else {
        delete newQuery.statuses;
      }
      router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
      return newSelection;
    });
    setCurrentPage(1);
  }, [router]);

  const togglePriority = useCallback((id: string) => {
    setSelectedPriorities((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.priorities = newSelection.join(",");
      } else {
        delete newQuery.priorities;
      }
      router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
      return newSelection;
    });
    setCurrentPage(1);
  }, [router]);

  const toggleTaskType = useCallback((id: string) => {
    setSelectedTaskTypes((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.types = newSelection.join(",");
      } else {
        delete newQuery.types;
      }
      router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
      return newSelection;
    });
    setCurrentPage(1);
  }, [router]);

  const toggleAssignee = useCallback((id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

  const toggleReporter = useCallback((id: string) => {
    setSelectedReporters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedWorkspaces([]);
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTaskTypes([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setCurrentPage(1);
    router.push({ pathname: router.pathname }, undefined, { shallow: true });
  }, [router]);

  // Event handlers
  const handleRetry = useCallback(() => {
    setError(null);
    loadInitialData();
    loadTasks();
  }, [loadInitialData, loadTasks]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const handleFilterDropdownOpen = useCallback(() => {
    if (hasValidUserAndOrg) {
      loadInitialData();
    }
  }, [hasValidUserAndOrg]);

  // Memoized computations
  const totalActiveFilters = useMemo(
    () =>
      selectedWorkspaces.length +
      selectedProjects.length +
      selectedStatuses.length +
      selectedPriorities.length +
      selectedTaskTypes.length +
      selectedAssignees.length +
      selectedReporters.length,
    [
      selectedWorkspaces.length,
      selectedProjects.length,
      selectedStatuses.length,
      selectedPriorities.length,
      selectedTaskTypes.length,
      selectedAssignees.length,
      selectedReporters.length,
    ]
  );

  const workspaceFilters = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return workspaces
      .filter((workspace) => workspace.id && uuidRegex.test(workspace.id))
      .map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        value: workspace.id,
        selected: selectedWorkspaces.includes(workspace.id),
        count: projects.filter((p) => p.workspaceId === workspace.id).length,
      }));
  }, [workspaces, projects, selectedWorkspaces]);

  const projectFilters = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return projects
      .filter(
        (project) =>
          project.id &&
          uuidRegex.test(project.id) &&
          selectedWorkspaces.includes(project.workspaceId)
      )
      .map((project) => ({
        id: project.id,
        name: project.name,
        value: project.id,
        selected: selectedProjects.includes(project.id),
        count: tasks.filter((task) => task.projectId === project.id).length,
        workspace: workspaces.find((w) => w.id === project.workspaceId)?.name || "",
        workspaceId: project.workspaceId,
      }));
  }, [projects, selectedProjects, tasks, workspaces, selectedWorkspaces]);

  const statusFilters = useMemo(
    () =>
      availableStatuses.map((status) => {
        const allIds = status.allIds || [status.id];
        return {
          id: status.id,
          name: status.name,
          value: status.id,
          selected: allIds.some((id: string) => selectedStatuses.includes(id)),
          count: tasks.filter((task) => {
            const taskStatusId =
              task.statusId || (typeof task.status === "object" ? task.status?.id : task.status);
            return allIds.includes(taskStatusId);
          }).length,
          color: status.color || "#6b7280",
        };
      }),
    [availableStatuses, selectedStatuses, tasks]
  );

  const priorityFilters = useMemo(() => {
    const priorities = [
      { id: "LOW", name: "Low", value: "LOW", color: "#6b7280" },
      { id: "MEDIUM", name: "Medium", value: "MEDIUM", color: "#f59e0b" },
      { id: "HIGH", name: "High", value: "HIGH", color: "#ef4444" },
      { id: "HIGHEST", name: "Highest", value: "HIGHEST", color: "#dc2626" },
    ];

    return priorities.map((priority) => ({
      ...priority,
      selected: selectedPriorities.includes(priority.value),
      count: Array.isArray(tasks)
        ? tasks.filter((task) => task.priority === priority.value).length
        : 0,
    }));
  }, [selectedPriorities, tasks]);

  const taskTypeFilters = useMemo(
    () =>
      Object.keys(TaskTypeIcon).map((type) => {
        const typeKey = type as keyof typeof TaskTypeIcon;
        const iconData = TaskTypeIcon[typeKey];
        return {
          id: type,
          name: type.charAt(0) + type.slice(1).toLowerCase(),
          value: type,
          selected: selectedTaskTypes.includes(type),
          count: tasks.filter((task) => task.type === type).length,
          color: iconData?.color || "text-gray-500",
        };
      }),
    [selectedTaskTypes, tasks]
  );

  const assigneeFilters = useMemo(() => {
    return organizationMembers.map((member) => ({
      id: member.user.id,
      name: member?.user?.firstName + " " + member.user.lastName,
      value: member?.user.id,
      selected: selectedAssignees.includes(member.user.id),
      count: Array.isArray(tasks)
        ? tasks.filter((task) =>
          Array.isArray(task.assignees)
            ? task.assignees.some((assignee) => assignee.id === member.user.id)
            : false
        ).length
        : 0,
      email: member?.user?.email,
    }));
  }, [organizationMembers, selectedAssignees, tasks]);

  const reporterFilters = useMemo(() => {
    return organizationMembers.map((member) => ({
      id: member.user.id,
      name: member?.user?.firstName + " " + member.user.lastName,
      value: member?.user.id,
      selected: selectedReporters.includes(member.user.id),
      count: Array.isArray(tasks)
        ? tasks.filter((task) =>
          Array.isArray(task.reporters)
            ? task.reporters.some((reporter) => reporter.id === member.user.id)
            : false
        ).length
        : 0,
      email: member?.user?.email,
    }));
  }, [organizationMembers, selectedReporters, tasks]);

  const filterSections = useMemo(
    () => [
      createSection({
        id: "workspace",
        title: t("filters.workspace"),
        icon: Building2,
        data: workspaceFilters,
        selectedIds: selectedWorkspaces,
        searchable: true,
        onToggle: toggleWorkspace,
        onSelectAll: () => setSelectedWorkspaces(workspaceFilters.map((w) => w.id)),
        onClearAll: () => setSelectedWorkspaces([]),
      }),
      createSection({
        id: "project",
        title: t("filters.project"),
        icon: Folder,
        data: projectFilters,
        selectedIds: selectedProjects,
        searchable: true,
        multiSelect: false,
        onToggle: toggleProject,
        onClearAll: () => setSelectedProjects([]),
      }),
      createSection({
        id: "status",
        title: t("filters.status"),
        icon: CheckSquare,
        data: statusFilters,
        selectedIds: selectedStatuses,
        searchable: false,
        onToggle: toggleStatus,
        onSelectAll: () => setSelectedStatuses(statusFilters.map((s) => s.id)),
        onClearAll: () => setSelectedStatuses([]),
        disabled: !statusFilterEnabled,
      }),
      createSection({
        id: "priority",
        title: t("filters.priority"),
        icon: Flame,
        data: priorityFilters,
        selectedIds: selectedPriorities,
        searchable: false,
        onToggle: togglePriority,
        onSelectAll: () => setSelectedPriorities(priorityFilters.map((p) => p.id)),
        onClearAll: () => setSelectedPriorities([]),
      }),
      createSection({
        id: "type",
        title: t("filters.type"),
        icon: Shapes,
        data: taskTypeFilters,
        selectedIds: selectedTaskTypes,
        searchable: false,
        onToggle: toggleTaskType,
        onSelectAll: () => setSelectedTaskTypes(taskTypeFilters.map((t) => t.id)),
        onClearAll: () => setSelectedTaskTypes([]),
      }),
      createSection({
        id: "assignee",
        title: t("filters.assignee"),
        icon: User,
        data: assigneeFilters,
        selectedIds: selectedAssignees,
        searchable: true,
        onToggle: toggleAssignee,
        onSelectAll: () => setSelectedAssignees(assigneeFilters.map((a) => a.id)),
        onClearAll: () => setSelectedAssignees([]),
      }),
      createSection({
        id: "reporter",
        title: t("filters.reporter"),
        icon: Users,
        data: reporterFilters,
        selectedIds: selectedReporters,
        searchable: true,
        onToggle: toggleReporter,
        onSelectAll: () => setSelectedReporters(reporterFilters.map((r) => r.id)),
        onClearAll: () => setSelectedReporters([]),
      }),
    ],
    [
      workspaceFilters,
      projectFilters,
      statusFilters,
      priorityFilters,
      taskTypeFilters,
      assigneeFilters,
      reporterFilters,
      selectedWorkspaces,
      selectedProjects,
      selectedStatuses,
      selectedPriorities,
      selectedTaskTypes,
      selectedAssignees,
      selectedReporters,
      toggleWorkspace,
      toggleProject,
      toggleStatus,
      togglePriority,
      toggleTaskType,
      toggleAssignee,
      toggleReporter,
      statusFilterEnabled,
      createSection,
      t,
    ]
  );

  // Sorting logic
  const sortedTasks = useMemo(() => {
    return [...tasks]?.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === "dueIn") {
        const now = Date.now();
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        
        const aDue = new Date(a.dueDate).getTime() - now;
        const bDue = new Date(b.dueDate).getTime() - now;
        return sortOrder === "asc" ? aDue - bDue : bDue - aDue;
      }
      
      // Handle date fields
      if (["createdAt", "updatedAt", "completedAt", "dueDate", "timeline"].includes(sortField)) {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        
        const aTime = new Date(aVal).getTime();
        const bTime = new Date(bVal).getTime();
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      }

      // Handle priority field
      if (sortField === "priority") {
        const priorityOrder = {
          HIGHEST: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        aValue = priorityOrder[aValue] || 999;
        bValue = priorityOrder[bValue] || 999;

        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      // Handle status field (object with name property)
      if (sortField === "status") {
        aValue = a.status?.name || "";
        bValue = b.status?.name || "";
      }

      // Handle commentsCount field (stored in _count.comments)
      if (sortField === "commentsCount") {
        aValue = a._count?.comments || 0;
        bValue = b._count?.comments || 0;
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      // Handle number comparison
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [tasks, sortOrder, sortField]);

  const handleExport = useCallback(() => {
    exportTasksToCSV(sortedTasks, columns, `tasks_export_${new Date().toISOString().split("T")[0]}.csv`, {
      showProject: true,
    });
  }, [columns, sortedTasks]);

  // Render content based on view
  const renderContent = () => {
    if (currentView === "gantt") {
      if (ganttLoading) {
        return <TaskTableSkeleton />;
      }
      if (ganttError) {
        return <ErrorState error={ganttError} onRetry={loadGanttData} />;
      }
      return (
        <TaskGanttView
          tasks={sortedTasks}
          workspaceSlug={defaultWorkspace.slug}
          projectSlug={defaultProject.slug}
          viewMode={ganttViewMode}
          onViewModeChange={setGanttViewMode}
          onTaskUpdate={handleTaskUpdate}
        />
      );
    }

    if (taskLoading) {
      return <TaskTableSkeleton />;
    }

    if (!tasks.length) {
      return (
        <EmptyState
          searchQuery={debouncedSearchQuery}
          priorityFilter={selectedPriorities.length > 0 ? "filtered" : "all"}
        />
      );
    }

    switch (currentView) {
      case "kanban":
        return <div>{t("kanbanRestriction")}</div>;
      default:
        return (
          <TaskListView
            tasks={sortedTasks}
            projects={projects}
            columns={columns}
            showAddTaskRow={false}
            showBulkActionBar={
              hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
            }
          />
        );
    }
  };

  const showPagination = tasks.length > 0 && pagination.totalPages > 1;

  if (error) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  return (
    <div className="dashboard-container flex flex-col">
      <SEO title={t("title")} />
      {/* Unified Sticky Header */}
      <div className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80 border-b border-[var(--border)]/10 -mx-4 px-4 pb-0 pt-4">
        {/* PageHeader */}
        <div className="pb-2">
          <PageHeader
            icon={<Clipboard className="size-20px" />}
            title={t("title")}
            description={t("description")}
            actions={
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                    <Input
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-10 rounded-md border border-[var(--border)]"
                    />
                    {searchInput && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <HiXMark size={16} />
                      </button>
                    )}
                  </div>
                  {currentView === "list" && (
                    <Tooltip content={t("advancedFilters")} position="top" color="primary">
                      <FilterDropdown
                        sections={filterSections}
                        title={t("advancedFilters")}
                        activeFiltersCount={totalActiveFilters}
                        onClearAllFilters={clearAllFilters}
                        placeholder={t("filterResults")}
                        dropdownWidth="w-56"
                        showApplyButton={false}
                        onOpen={handleFilterDropdownOpen}
                      />
                    </Tooltip>
                  )}
                </div>
                {userAccess?.role !== "VIEWER" && (
                  <ActionButton primary showPlusIcon onClick={() => setNewTaskModalOpen(true)}>
                    {t("createTask")}
                  </ActionButton>
                )}
              </div>
            }
          />
        </div>

        {/* TabView */}
        <div className="py-3 border-t border-[var(--border)]/50">
          <TabView
            currentView={currentView}
            onViewChange={(v) => {
              setCurrentView(v);
              router.push(`/tasks?type=${v}`, undefined, { shallow: true });
            }}
            rightContent={
              <>
                {currentView === "gantt" && (
                  <div className="flex items-center bg-[var(--odd-row)] rounded-lg p-1 shadow-sm">
                    {(["days", "weeks", "months"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setGanttViewMode(mode)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize cursor-pointer ${ganttViewMode === mode
                            ? "bg-blue-500 text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-[var(--accent)]/50"
                          }`}
                      >
                        {t(`views.${mode}`)}
                      </button>
                    ))}
                  </div>
                )}
                {currentView === "list" && (
                  <div className="flex items-center gap-2">
                    <SortIngManager
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSortFieldChange={setSortField}
                      onSortOrderChange={setSortOrder}
                    />

                    <ColumnManager
                      currentView={currentView}
                      availableColumns={columns}
                      onAddColumn={handleAddColumn}
                      onRemoveColumn={handleRemoveColumn}
                    />

                    <ActionButton
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={handleExport}
                      variant="outline"
                    >
                      {t("export")}
                    </ActionButton>
                  </div>
                )}
              </>
            }
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="rounded-md">{renderContent()}</div>

      {/* Natural Flow Pagination */}
      {showPagination && (
        <div className="mt-4 border-t border-[var(--border)]/50 py-4 -mx-4 px-4">
          <Pagination
            pagination={pagination}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
            itemType="tasks"
          />
        </div>
      )}

      <NewTaskModal isOpen={isNewTaskModalOpen} onClose={() => setNewTaskModalOpen(false)} />
    </div>
  );
}

export default function TasksPage() {
  return <TasksPageContent />;
}
