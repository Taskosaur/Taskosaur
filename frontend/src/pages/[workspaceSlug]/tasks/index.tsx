import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGroupedTasks } from "@/hooks/useGroupedTasks";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import { CsvImportModal } from "@/components/tasks/CsvImportModal";
import { useWorkspace } from "@/contexts/workspace-context";
import { useProject } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import TaskListView from "@/components/tasks/views/TaskListView";
import TaskGanttView from "@/components/tasks/views/TaskGanttView";
import { HiXMark } from "react-icons/hi2";
import { Input } from "@/components/ui/input";
import { ColumnConfig, Project, ViewMode } from "@/types";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { HiSearch } from "react-icons/hi";
import ActionButton from "@/components/common/ActionButton";
import TabView from "@/components/tasks/TabView";
import Pagination from "@/components/common/Pagination";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import SortingManager, { SortField, SortOrder } from "@/components/tasks/SortIngManager";
import { FilterDropdown, useGenericFilters } from "@/components/common/FilterDropdown";
import GroupByManager, { GROUP_BY_STORAGE_KEY } from "@/components/tasks/GroupByManager";
import type { GroupByField } from "@/types/tasks";
import { CheckSquare, Flame, Folder, User, Users, Download, Upload, Shapes } from "lucide-react";

import { TaskPriorities, TaskTypeIcon } from "@/utils/data/taskData";
import Tooltip from "@/components/common/ToolTip";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";
import { exportTasksToCSV, exportTasksToPDF, exportTasksToXLSX, exportTasksToJSON } from "@/utils/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useSlugRedirect, cacheSlugId } from "@/hooks/useSlugRedirect";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

// Helper function to validate internal paths and prevent open redirect vulnerabilities
function isValidInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  // Ensure the path starts with / and doesn't contain protocol or domain
  if (!path.startsWith('/')) return false;
  if (path.includes('://') || path.startsWith('//')) return false;
  return true;
}

// Helper function to sanitize slug inputs before URL construction
function sanitizeSlug(slug: string | string[] | undefined): string {
  if (!slug || typeof slug !== 'string') return '';
  // Allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
  return slug;
}

interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  [key: string]: any;
}

function WorkspaceTasksContent() {
  const { t } = useTranslation("tasks");
  const [addTaskStatuses, setAddTaskStatuses] = useState<any[]>([]);
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { getWorkspaceBySlug, getWorkspaceMembers, currentWorkspace } = useWorkspace();
  const { getProjectsByWorkspace, getTaskStatusByProject } = useProject();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const {
    getAllTasks,
    getCalendarTask,
    getAllTaskStatuses,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
    updateTask,
  } = useTask();

  const { isAuthenticated, getUserAccess } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [currentView, setCurrentView] = useState<"list" | "kanban" | "gantt">(() => {
    const type =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("type")
        : null;
    return type === "list" || type === "gantt" || type === "kanban" ? type : "list";
  });
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [isCsvImportOpen, setCsvImportOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAccess] = useState(null);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [availablePriorities] = useState(TaskPriorities);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);

  useEffect(() => {
    if (router.isReady) {
      const { projects, statuses, priorities, types, assignees, reporters } = router.query;
      if (projects) setSelectedProjects((Array.isArray(projects) ? projects : projects.split(",")));
      if (statuses) setSelectedStatuses((Array.isArray(statuses) ? statuses : statuses.split(",")));
      if (priorities) setSelectedPriorities((Array.isArray(priorities) ? priorities : priorities.split(",")));
      if (types) setSelectedTaskTypes((Array.isArray(types) ? types : types.split(",")));
      if (assignees) setSelectedAssignees((Array.isArray(assignees) ? assignees : assignees.split(",")));
      if (reporters) setSelectedReporters((Array.isArray(reporters) ? reporters : reporters.split(",")));
    }
  }, [router.isReady]);

  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const handleTasksSelect = useCallback(
    (taskIds: string[], action: "add" | "remove" | "set") => {
      setSelectedTasks((prev) => {
        if (action === "set") return taskIds;
        if (action === "add") {
          const newIds = taskIds.filter((id) => !prev.includes(id));
          return [...prev, ...newIds];
        }
        if (action === "remove") {
          return prev.filter((id) => !taskIds.includes(id));
        }
        return prev;
      });
    },
    []
  );

  const [sortField, setSortField] = useState<SortField>(() => {
    return localStorage.getItem(SORT_FIELD_KEY) || "listRank";
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window === "undefined") return "asc";
    const stored = localStorage.getItem(SORT_ORDER_KEY);
    return stored === "asc" || stored === "desc" ? stored : "asc";
  });

  const [groupBy, setGroupBy] = useState<GroupByField>(() => {
    if (typeof window === "undefined") return "none";
    const stored = localStorage.getItem(GROUP_BY_STORAGE_KEY);
    const valid: GroupByField[] = ["none", "status", "priority", "project", "assignee", "type", "dueDate", "createdAt"];
    return valid.includes(stored as GroupByField) ? (stored as GroupByField) : "none";
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

  const error = contextError || localError;

  const pagination = useMemo(() => {
    if (!taskResponse) {
      return {
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    return {
      currentPage: taskResponse.page,
      totalPages: taskResponse.totalPages,
      totalCount: taskResponse.total,
      hasNextPage: taskResponse.page < taskResponse.totalPages,
      hasPrevPage: taskResponse.page > 1,
    };
  }, [taskResponse]);

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
    if (workspace?.id && !projectsLoaded) {
      (async () => {
        try {
          const projects = await getProjectsByWorkspace(workspace.id);
          setProjects(projects || []);
          setProjectsLoaded(true);
        } catch (error) {
          console.error("Failed to fetch workspace projects:", error);
          setProjects([]);
        }
      })();
    }
  }, [workspace?.id, projectsLoaded]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (workspace?.organizationId) {
        try {
          const statuses = await getAllTaskStatuses({
            organizationId: workspace.organizationId,
          });
          
          const uniqueStatusesNames = new Set();
          const uniqueStatuses = (statuses || []).filter((status) => {
            if (uniqueStatusesNames.has(status.name)) {
              return false;
            }
            uniqueStatusesNames.add(status.name);
            return true;
          });
          
          setAddTaskStatuses(uniqueStatuses);
        } catch (error) {
          console.error("Failed to fetch workspace statuses:", error);
          setAddTaskStatuses([]);
        }
      }
    };
    fetchMeta();
  }, [workspace?.id, workspace?.organizationId]);

  const routeRef = useRef<string>("");
  const firstRenderRef = useRef(true);
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const hasValidAuth = !!isAuthenticated() && !!workspaceSlug;
  const { createSection } = useGenericFilters();

  // Backend-driven grouped tasks (placed here so debouncedSearchQuery is in scope)
  const groupedFilters = useMemo(() => ({
    ...(debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
    ...(selectedStatuses.length > 0  && { statuses:   selectedStatuses.join(",") }),
    ...(selectedPriorities.length > 0 && { priorities: selectedPriorities.join(",") }),
    ...(selectedTaskTypes.length > 0  && { types:      selectedTaskTypes.join(",") }),
    ...(selectedAssignees.length > 0  && { assigneeIds: selectedAssignees.join(",") }),
    ...(selectedReporters.length > 0  && { reporterIds: selectedReporters.join(",") }),
    ...(workspace?.id                 && { workspaceId: workspace.id }),
  }), [debouncedSearchQuery, selectedStatuses, selectedPriorities, selectedTaskTypes, selectedAssignees, selectedReporters, workspace?.id]);

  const {
    groupMap,
    isLoading: groupedLoading,
    goToGroupPage,
  } = useGroupedTasks({
    organizationId: workspace?.organizationId,
    groupBy,
    limitPerGroup: pageSize,
    filters: groupedFilters,
  });

  const validateRequiredData = useCallback(() => {

    const issues = [];
    if (!workspace?.id) issues.push("Missing workspace ID");
    if (!workspace?.organizationId) issues.push("Missing organization ID");
    if (issues.length > 0) {
      console.error("Validation failed:", issues);
      setLocalError(`Missing required data: ${issues.join(", ")}`);
      return false;
    }
    return true;
  }, [workspace?.id, workspace?.organizationId]);

  useEffect(() => {
    if (workspace) {
      getUserAccess({ name: "workspace", id: workspace.id })
        .then((data) => {
          setHasAccess(data?.canChange);
          setUserAccess(data);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [workspace]);

  const loadWorkspaceMembers = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      const members = await getWorkspaceMembers(workspace.id);
      setWorkspaceMembers(members.data || []);
    } catch (error) {
      console.error("Failed to fetch workspace members:", error);
      setWorkspaceMembers([]);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (workspace?.id) {
      loadWorkspaceMembers();
    }
  }, [workspace?.id]);

  const { handleSlugNotFound } = useSlugRedirect();

  const loadInitialData = useCallback(async () => {
    if (!hasValidAuth) return;

    // Silently wait for the organization ID — it may not yet be in localStorage
    // when this fires on a hard refresh. Rather than throwing, we defer.
    const orgId =
      typeof window !== "undefined"
        ? localStorage.getItem("currentOrganizationId")
        : null;

    if (!orgId) {
      // Will be re-triggered by the effect below once orgId lands in localStorage
      return;
    }

    try {
      setLocalError(null);

      if (!isAuthenticated()) {
        router.push("/auth/login");
        return;
      }

      if (currentWorkspace?.slug === workspaceSlug) {
        setWorkspace(currentWorkspace);
        return { ws: currentWorkspace };
      }

      const ws = await getWorkspaceBySlug(workspaceSlug as string);
      if (!ws) {
        throw new Error(`Workspace "${workspaceSlug}" not found`);
      }
      cacheSlugId("workspace", workspaceSlug as string, ws.id);
      setWorkspace(ws);
      return { ws };
    } catch (error) {
      console.error("LoadInitialData error:", error);

      // Don't show error for missing org — it's a transient state
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("No organization selected")) {
        return;
      }

      const redirected = await handleSlugNotFound(
        error,
        workspaceSlug as string,
        undefined,
        workspace?.id
      );
      if (!redirected) {
        setLocalError(error instanceof Error ? error.message : "Failed to load initial data");
      }
    }
  }, [isAuthenticated, workspaceSlug, router, handleSlugNotFound, workspace?.id, currentWorkspace]);


  const loadFilterData = useCallback(async () => {
    if (!workspace?.id) return;
    if (projectsLoaded) return;
    try {
      if (!projectsLoaded) {
        const projects = await getProjectsByWorkspace(workspace.id);
        setProjects(projects || []);
        setProjectsLoaded(true);
      }
    } catch (error) {
      console.error("Failed to load filter data:", error);
    }
  }, [workspace?.id, projectsLoaded, getProjectsByWorkspace]);

  const loadTasks = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }

    if (!validateRequiredData()) {
      return;
    }

    try {
      setLocalError(null);

      let statusFilter: { statuses?: string } = {};
      if (selectedStatuses.length > 0) {
        statusFilter = { statuses: selectedStatuses.join(",") };
      }

      // Build parameters for getAllTasks
      const params = {
        workspaceId: workspace.id,
        ...(selectedProjects.length > 0 && {
          projectId: selectedProjects.join(","),
        }),
        ...statusFilter,
        ...(selectedPriorities.length > 0 && {
          priorities: selectedPriorities.join(","),
        }),
        ...(selectedTaskTypes.length > 0 && {
          types: selectedTaskTypes.join(","),
        }),
        ...(debouncedSearchQuery.trim() && {
          search: debouncedSearchQuery.trim(),
        }),
        ...(selectedAssignees.length > 0 && {
          assignees: selectedAssignees.join(","),
        }),
        ...(selectedReporters.length > 0 && {
          reporters: selectedReporters.join(","),
        }),
        sortBy: sortField,
        sortOrder: sortOrder,

        page: currentPage,
        limit: pageSize,
        groupBy: groupBy,
        parentTaskId: "all",
      };

      // Call getAllTasks - this will update tasks and taskResponse in context
      await getAllTasks(workspace.organizationId, params);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setLocalError(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setIsInitialLoad(false);
    }
  }, [
    workspace?.organizationId,
    workspace?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    selectedAssignees,
    selectedReporters,
    availableStatuses,
    currentView,
    validateRequiredData,
    getAllTasks,
    sortField,
    sortOrder,
    groupBy,
  ]);

  const loadGanttData = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      const res = await getCalendarTask(workspace.organizationId, {
        workspaceId: workspace.id,
        includeSubtasks: true,
        sortBy: "listRank",
        sortOrder: "asc",
        viewType: "GANTT",
        page: currentPage,
        limit: pageSize,
      });
      if (res) {
        setGanttTasks(res.data || []);
      }
      setIsInitialLoad(false);
    } catch (error) {
      console.error("Failed to load Gantt data:", error);
      setGanttTasks([]);
      setIsInitialLoad(false);
    }
  }, [workspace?.id, workspace?.organizationId, getCalendarTask, currentPage, pageSize]);

  const handleTaskUpdate = useCallback(
    async (taskId: string, updates: any) => {
      // Optimistic update for Gantt tasks
      if (currentView === "gantt") {
        setGanttTasks((prev) =>
          prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
        );
      }

      try {
        await updateTask(taskId, updates);
        // If not Gantt view, or if we want a definitive sync, we could call loadGanttData
        // but for smooth experience, the optimistic update plus occasional sync is better.
        if (currentView === "gantt") {
          // background silent refresh
          loadGanttData();
        }
      } catch (error) {
        console.error("Failed to update task:", error);
        // Rollback by triggering a full reload if optimistic update fails
        if (currentView === "gantt") {
          loadGanttData();
        }
      }
    },
    [updateTask, loadGanttData, currentView]
  );

  useEffect(() => {
    if (currentView === "gantt" && workspace?.id) {
      loadGanttData();
    }
  }, [currentView, workspace?.id]);

  // Primary trigger: fires when router is ready and workspaceSlug is known
  useEffect(() => {
    if (!router.isReady) return;
    const currentRoute = `${workspaceSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug]);

  // Retry trigger: polls until org ID is available in localStorage.
  // This handles hard-refresh scenarios where the org context hydrates
  // slightly after the initial loadInitialData call, which would silently
  // return early (no org → no error shown, but also no data loaded).
  useEffect(() => {
    if (!router.isReady || workspace) return; // Already loaded — nothing to do

    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 10 × 500ms = 5 seconds max wait

    const interval = setInterval(() => {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("currentOrganizationId")
          : null;

      if (orgId) {
        clearInterval(interval);
        loadInitialData();
        return;
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        // After 5 s with no org ID, surface a helpful error
        setLocalError(
          "Unable to determine your organization. Please refresh the page or log in again."
        );
      }
    }, 500);

    return () => clearInterval(interval);
  }, [router.isReady, workspaceSlug, workspace]);


  useEffect(() => {
    // For list view, wait for statuses to load so we can exclude the last workflow status
    if (workspace?.organizationId && workspace?.id && (currentView !== "list" || statusesLoaded)) {
      loadTasks();
    }
  }, [workspace?.organizationId, workspace?.id, selectedAssignees, selectedReporters, statusesLoaded, currentView]);

  const previousFiltersRef = useRef({
    page: currentPage,
    pageSize,
    search: debouncedSearchQuery,
    projects: selectedProjects.join(","),
    statuses: selectedStatuses.join(","),
    priorities: selectedPriorities.join(","),
    types: selectedTaskTypes.join(","),
    sortField,
    sortOrder,
    groupBy,
  });

  useEffect(() => {
    if (!workspace?.organizationId || !workspace?.id) return;
    const currentFilters = {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      projects: selectedProjects.join(","),
      statuses: selectedStatuses.join(","),
      priorities: selectedPriorities.join(","),
      types: selectedTaskTypes.join(","),
      sortField,
      sortOrder,
      groupBy,
    };
    const filtersChanged =
      JSON.stringify(currentFilters) !== JSON.stringify(previousFiltersRef.current);
    previousFiltersRef.current = currentFilters;
    if (!firstRenderRef.current && filtersChanged && validateRequiredData()) {
      loadTasks();
    }
    firstRenderRef.current = false;
  }, [
    workspace?.organizationId,
    workspace?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    validateRequiredData,
    sortField,
    sortOrder,
    groupBy,
  ]);

  // Reset page when groupBy changes
  useEffect(() => {
    setCurrentPage(1);
  }, [groupBy]);

  const projectFilters = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        value: project.id,
        selected: selectedProjects.includes(project.id),
        count: tasks.filter((task) => task.projectId === project.id).length,
      })),
    [projects, selectedProjects, tasks]
  );

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

  const priorityFilters = useMemo(
    () =>
      availablePriorities.map((priority) => ({
        id: priority.id,
        name: priority.name,
        value: priority.value,
        selected: selectedPriorities.includes(priority.value),
        count: tasks.filter((task) => task.priority === priority.value).length,
        color: priority.color,
      })),
    [availablePriorities, selectedPriorities, tasks]
  );

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
    return workspaceMembers.map((member) => ({
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
  }, [workspaceMembers, selectedAssignees, tasks]);

  const reporterFilters = useMemo(() => {
    return workspaceMembers.map((member) => ({
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
  }, [workspaceMembers, selectedReporters, tasks]);

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
    const status = availableStatuses.find((s: any) => s.id === id);
    const allIds = status?.allIds || [id];

    setSelectedStatuses((prev) => {
      const isCurrentlySelected = allIds.some(aid => prev.includes(aid));
      let newSelection;

      if (isCurrentlySelected) {
        // Remove all IDs in this group
        newSelection = prev.filter(aid => !allIds.includes(aid));
      } else {
        // Add all IDs in this group
        newSelection = [...prev, ...allIds];
      }

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
  }, [router, availableStatuses]);

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

  // Fetch statuses for selected project or all statuses for organization
  useEffect(() => {
    const fetchStatuses = async () => {
      let statuses: any[] = [];
      try {
        if (selectedProjects.length === 1) {
          statuses = await getTaskStatusByProject(selectedProjects[0]);
        } else if (workspace?.organizationId) {
          statuses = await getAllTaskStatuses({ organizationId: workspace.organizationId });
        }

        if (statuses && statuses.length > 0) {
          // Group statuses by name and category to handle multiple workflows in workspace view
          const groups: Record<string, any> = {};
          statuses.forEach((status) => {
            const key = `${status.name}-${status.category}`;
            if (!groups[key]) {
              groups[key] = {
                ...status,
                allIds: [status.id],
              };
            } else {
              groups[key].allIds.push(status.id);
            }
          });
          setAvailableStatuses(Object.values(groups));
        } else {
          setAvailableStatuses([]);
        }
      } catch (error) {
        console.error("Failed to fetch task statuses:", error);
        setAvailableStatuses([]);
      } finally {
        setStatusesLoaded(true);
      }
    };
    fetchStatuses();
  }, [selectedProjects, workspace?.organizationId, workspace?.id]);

  const filterSections = useMemo(
    () => [
      createSection({
        id: "project",
        title: t("filters.project"),
        icon: Folder,
        data: projectFilters,
        selectedIds: selectedProjects,
        searchable: true,
        multiSelect: false,
        onToggle: toggleProject,
        onSelectAll: undefined,
        onClearAll: () => {
          setSelectedProjects([]);
          const newQuery = { ...router.query };
          delete newQuery.projects;
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
      }),
      createSection({
        id: "status",
        title: t("filters.status"),
        icon: CheckSquare,
        data: statusFilters,
        selectedIds: selectedStatuses,
        searchable: false,
        onToggle: toggleStatus,
        onSelectAll: () => {
          const allValues = statusFilters.map((s) => s.id);
          setSelectedStatuses(allValues);
          const newQuery = { ...router.query, statuses: allValues.join(",") };
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
        onClearAll: () => {
          setSelectedStatuses([]);
          const newQuery = { ...router.query };
          delete newQuery.statuses;
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
      }),
      createSection({
        id: "priority",
        title: t("filters.priority"),
        icon: Flame,
        data: priorityFilters,
        selectedIds: selectedPriorities,
        searchable: false,
        onToggle: togglePriority,
        onSelectAll: () => {
          const allValues = priorityFilters.map((p) => p.id);
          setSelectedPriorities(allValues);
          const newQuery = { ...router.query, priorities: allValues.join(",") };
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
        onClearAll: () => {
          setSelectedPriorities([]);
          const newQuery = { ...router.query };
          delete newQuery.priorities;
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
      }),
      createSection({
        id: "type",
        title: t("filters.type"),
        icon: Shapes,
        data: taskTypeFilters,
        selectedIds: selectedTaskTypes,
        searchable: false,
        onToggle: toggleTaskType,
        onSelectAll: () => {
          const allValues = taskTypeFilters.map((t) => t.id);
          setSelectedTaskTypes(allValues);
          const newQuery = { ...router.query, types: allValues.join(",") };
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
        onClearAll: () => {
          setSelectedTaskTypes([]);
          const newQuery = { ...router.query };
          delete newQuery.types;
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
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
      priorityFilters,
      taskTypeFilters,
      selectedProjects,
      selectedStatuses,
      selectedPriorities,
      selectedTaskTypes,
      assigneeFilters,
      reporterFilters,
      selectedAssignees,
      selectedReporters,
      toggleAssignee,
      toggleReporter,
      toggleProject,
      toggleStatus,
      togglePriority,
      toggleTaskType,
      t,
    ]
  );

  const totalActiveFilters =
    selectedProjects.length +
    selectedStatuses.length +
    selectedPriorities.length +
    selectedTaskTypes.length +
    selectedAssignees.length +
    selectedReporters.length;

  const clearAllFilters = useCallback(() => {
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTaskTypes([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setCurrentPage(1);
    router.push({ pathname: router.pathname }, undefined, { shallow: true });
  }, [router]);

  const handleAddColumn = (columnId: string) => {
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
  };

  const handleRemoveColumn = (columnId: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== columnId));
  };

  const handleTaskCreated = useCallback(async () => {
    try {
      await loadTasks();
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      throw error;
    }
  }, [loadTasks]);

  const handleTaskRefetch = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  const memoizedTaskRefetch = useCallback(async () => {
    await handleTaskRefetch();
  }, [handleTaskRefetch]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    loadInitialData();
    if (workspace?.organizationId && workspace?.id) {
      loadTasks();
    }
  }, [loadInitialData, loadTasks, workspace?.organizationId, workspace?.id]);

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

  // Tasks are already sorted by the backend, so we use tasks directly
  const sortedTasks = tasks;

  const handleExport = useCallback((format: "csv" | "pdf" | "xlsx" | "json" = "csv") => {
    const dateStr = new Date().toISOString().split("T")[0];
    if (format === "csv") {
      exportTasksToCSV(sortedTasks, columns, `tasks_export_${dateStr}.csv`, {
        showProject: true,
      });
    } else if (format === "xlsx") {
      exportTasksToXLSX(sortedTasks, columns, `tasks_export_${dateStr}.xlsx`, {
        showProject: true,
      });
    } else if (format === "json") {
      exportTasksToJSON(sortedTasks, columns, `tasks_export_${dateStr}.json`, {
        showProject: true,
      });
    } else {
      exportTasksToPDF(sortedTasks, columns, `tasks_export_${dateStr}.pdf`, {
        showProject: true,
      });
    }
  }, [columns, sortedTasks]);

  const renderContent = () => {
    if ((isInitialLoad || isLoading) && groupBy === "none") return <TaskTableSkeleton />;

    if (groupBy !== "none" && currentView !== "gantt" && currentView !== "kanban") {
      return (
        <TaskListView
          tasks={sortedTasks}
          workspaceSlug={workspaceSlug as string}
          projects={projects}
          columns={columns}
          onTaskRefetch={loadTasks}
          showAddTaskRow={false}
          selectedTasks={selectedTasks}
          onTaskSelect={handleTaskSelect}
          onTasksSelect={handleTasksSelect}
          showBulkActionBar={
            hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
          }
          search={debouncedSearchQuery}
          selectedStatuses={selectedStatuses}
          selectedPriorities={selectedPriorities}
          selectedTaskTypes={selectedTaskTypes}
          selectedAssignees={selectedAssignees}
          selectedReporters={selectedReporters}
          totalTask={pagination.totalCount}
          workspaceId={workspace?.id}
          organizationId={workspace?.organizationId}
          groupBy={groupBy}
          groupMap={undefined}
          onGroupPageChange={undefined}
          groupedLoading={isLoading}
        />
      );
    }

    if (!sortedTasks.length && currentView !== "gantt") {
      return (
        <EmptyState
          searchQuery={debouncedSearchQuery}
          priorityFilter={selectedPriorities.length > 0 ? "filtered" : "all"}
        />
      );
    }
    switch (currentView) {
      case "kanban":
        return (
          <div className="text-center py-12">
            <p className="text-[var(--muted-foreground)]">
              {t("kanbanRestriction")}
            </p>
          </div>
        );
      case "gantt":
        return (
          <TaskGanttView
            tasks={ganttTasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug="default-project"
            viewMode={ganttViewMode}
            onViewModeChange={setGanttViewMode}
            onTaskUpdate={handleTaskUpdate}
            groupBy={groupBy}
          />
        );

      default:
        return (
          <TaskListView
            tasks={sortedTasks}
            workspaceSlug={workspaceSlug as string}
            projects={projects}
            projectsOfCurrentWorkspace={projects}
            columns={columns}
            onTaskRefetch={memoizedTaskRefetch}
            addTaskStatuses={addTaskStatuses}
            workspaceMembers={workspaceMembers}
            showAddTaskRow={userAccess?.role !== "VIEWER"}
            selectedTasks={selectedTasks}
            onTaskSelect={handleTaskSelect}
            onTasksSelect={handleTasksSelect}
            showBulkActionBar={
              hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
            }
            totalTask={pagination.totalCount}
            workspaceId={workspace?.id}
            organizationId={workspace?.organizationId}
            groupBy={groupBy}
            groupMap={undefined}
            onGroupPageChange={undefined}
            groupedLoading={false}

          />
        );
    }
  };

  const showPagination = currentView === "list" && tasks.length > 0 && pagination.totalPages >= 1;


  if (error) return <ErrorState error={error} onRetry={handleRetry} />;

  return (
    <div className="dashboard-container flex flex-col">
      {/* Unified Sticky Header */}
      <div className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80 border-b border-[var(--border)]/10 -mx-4 px-4 pb-0 pt-4">
        {/* PageHeader */}
        <div className="pb-2">
          <PageHeader
            title={workspace ? t("workspaceTasks", { name: workspace.name }) : t("defaultWorkspaceTasks")}
            description={t("workspaceTasksDescription")}
            actions={
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:max-w-xs">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                      >
                        <HiXMark size={16} />
                      </button>
                    )}
                  </div>
                  {currentView === "list" && (
                    <FilterDropdown
                      sections={filterSections}
                      title={t("advancedFilters")}
                      activeFiltersCount={totalActiveFilters}
                      onClearAllFilters={clearAllFilters}
                      placeholder={t("filterResults")}
                      dropdownWidth="w-56"
                      showApplyButton={false}
                      onOpen={loadFilterData}
                    />
                  )}
                </div>
                {userAccess?.role !== "VIEWER" && (
                  <ActionButton
                    primary
                    showPlusIcon
                    onClick={() => setNewTaskModalOpen(true)}
                    disabled={!workspace?.id}
                  >
                    {t("createTask")}
                  </ActionButton>
                )}
                <NewTaskModal
                  isOpen={isNewTaskModalOpen}
                  onClose={() => {
                    setNewTaskModalOpen(false);
                    setLocalError(null);
                  }}
                  onTaskCreated={async () => {
                    try {
                      await handleTaskCreated();
                    } catch (error) {
                      const errorMessage =
                        error instanceof Error ? error.message : "Failed to refresh tasks";
                      console.error("Error creating task:", errorMessage);
                      await loadTasks();
                    }
                  }}
                  workspaceSlug={workspaceSlug as string}
                />
                <CsvImportModal
                  isOpen={isCsvImportOpen}
                  onClose={() => setCsvImportOpen(false)}
                  onImportComplete={loadTasks}
                  workspaceId={workspace?.id}
                  workspaceName={workspace?.name}
                />
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
              const safeSlug = sanitizeSlug(workspaceSlug);
              if (!safeSlug) {
                console.error('Invalid workspace slug');
                router.push('/');
                return;
              }
              const path = `/${safeSlug}/tasks?type=${v}`;
              if (isValidInternalPath(path.split('?')[0])) {
                router.push(path, undefined, {
                  shallow: true,
                });
              } else {
                router.push('/');
              }
            }}
            viewKanban={false}
            rightContent={
              <>
                {currentView === "gantt" && (
                  <div className="flex items-center gap-2">
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
                    <GroupByManager
                      groupBy={groupBy}
                      onGroupByChange={setGroupBy}
                    />
                  </div>
                )}

                {currentView === "list" && (
                  <div className="flex items-center gap-2">
                    <SortingManager
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSortFieldChange={setSortField}
                      onSortOrderChange={setSortOrder}
                    />

                    <GroupByManager
                      groupBy={groupBy}
                      onGroupByChange={setGroupBy}
                    />

                    <ColumnManager

                      currentView={currentView}
                      availableColumns={columns}
                      onAddColumn={handleAddColumn}
                      onRemoveColumn={handleRemoveColumn}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton
                          leftIcon={<Download className="w-4 h-4" />}
                          variant="outline"
                        >
                          {t("export")}
                        </ActionButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[var(--popover)] border-[var(--border)]">
                        <DropdownMenuItem onClick={() => handleExport("csv")}>
                          Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                          Export as Excel (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("json")}>
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("pdf")}>
                          Export as PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <ActionButton
                      leftIcon={<Upload className="w-4 h-4" />}
                      variant="outline"
                      onClick={() => setCsvImportOpen(true)}
                    >
                      Import
                    </ActionButton>                  </div>
                )}
              </>
            }
          />
        </div>
      </div>
      {/* Scrollable Content */}
      <div className="rounded-md">
        {error ? <ErrorState error={error} onRetry={handleRetry} /> : renderContent()}
      </div>
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
    </div>
  );
}

export default function WorkspaceTasksPage() {
  return <WorkspaceTasksContent />;
}
