import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useGroupedTasks } from "@/hooks/useGroupedTasks";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import { CsvImportModal } from "@/components/tasks/CsvImportModal";
import { useProject } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import { useSprint } from "@/contexts/sprint-context";
import TaskListView from "@/components/tasks/views/TaskListView";
import TaskGanttView from "@/components/tasks/views/TaskGanttView";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { HiXMark } from "react-icons/hi2";
import { Input } from "@/components/ui/input";
import { ColumnConfig, Project, ViewMode, TaskStatus } from "@/types";
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
import { CheckSquare, Flame, Shapes, User, Users, Download, Upload, Zap } from "lucide-react";

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
import { SEO } from "@/components/common/SEO";
import { TokenManager } from "@/lib/api";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

// Helper function to sanitize slug inputs before URL construction
function sanitizeSlug(slug: string | string[] | undefined): string {
  if (!slug || typeof slug !== 'string') return '';
  // Allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
  return slug;
}

// Helper function to validate internal paths and prevent open redirect vulnerabilities
function isValidInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  // Ensure the path starts with / and doesn't contain protocol or domain
  if (!path.startsWith('/')) return false;
  if (path.includes('://') || path.startsWith('//')) return false;
  return true;
}

function ProjectTasksContent() {
  const { t } = useTranslation("tasks");
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const { getProjectBySlug, getProjectMembers, getTaskStatusByProject, getProjectsByWorkspace } =
    useProject();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const {
    getAllTasks,
    getCalendarTask,
    getPublicProjectTasks,
    getTaskKanbanStatus,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
    updateTask,
  } = useTask();

  const { isAuthenticated, getUserAccess } = useAuth();
  const { getSprintsByProject } = useSprint();
  const currentOrganizationId = TokenManager.getCurrentOrgId();
  const isAuth = isAuthenticated();

  const [workspace, setWorkspace] = useState<any>(null);
  const [project, setProject] = useState<Project | null>(null);
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

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([]);
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [availablePriorities] = useState(TaskPriorities);
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [kanban, setKanban] = useState<any[]>([]);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const [sortField, setSortField] = useState<SortField>(() => {
    return localStorage.getItem(SORT_FIELD_KEY) || "listRank";
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
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

  // Initialize filters from URL query params
  useEffect(() => {
    if (router.isReady) {
      const { sprints, statuses, priorities, types, assignees, reporters } = router.query;
      if (sprints) setSelectedSprints((Array.isArray(sprints) ? sprints : sprints.split(",")));
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

  const error = contextError || localError;

  useEffect(() => {
    if (!taskResponse || currentView === "gantt") return;
    setPagination({
      currentPage: taskResponse.page,
      totalPages: taskResponse.totalPages,
      totalCount: taskResponse.total,
      hasNextPage: taskResponse.page < taskResponse.totalPages,
      hasPrevPage: taskResponse.page > 1,
    });
  }, [taskResponse, currentView]);

  useEffect(() => {
    localStorage.setItem(SORT_FIELD_KEY, sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  }, [columns]);

  const routeRef = useRef<string>("");
  const firstRenderRef = useRef(true);
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const { createSection } = useGenericFilters();

  // Backend-driven grouped tasks (placed here so debouncedSearchQuery is in scope)
  const groupedFilters = useMemo(() => ({
    ...(debouncedSearchQuery.trim()    && { search:      debouncedSearchQuery.trim() }),
    ...(selectedStatuses.length > 0   && { statuses:    selectedStatuses.join(",") }),
    ...(selectedPriorities.length > 0 && { priorities:  selectedPriorities.join(",") }),
    ...(selectedTaskTypes.length > 0  && { types:       selectedTaskTypes.join(",") }),
    ...(selectedAssignees.length > 0  && { assigneeIds: selectedAssignees.join(",") }),
    ...(selectedReporters.length > 0  && { reporterIds: selectedReporters.join(",") }),
    ...(selectedSprints.length > 0    && { sprintId:    selectedSprints.join(",") }),
    ...(project?.id                   && { projectId:   project.id }),
    ...(workspace?.id                 && { workspaceId: workspace.id }),
  }), [debouncedSearchQuery, selectedStatuses, selectedPriorities, selectedTaskTypes, selectedAssignees, selectedReporters, selectedSprints, project?.id, workspace?.id]);

  const {
    groupMap,
    isLoading: groupedLoading,
    goToGroupPage,
  } = useGroupedTasks({
    organizationId: currentOrganizationId,
    groupBy,
    limitPerGroup: pageSize,
    filters: groupedFilters,
  });

  const validateRequiredData = useCallback(() => {

    const issues = [];
    if (!currentOrganizationId && isAuth) issues.push("Missing organization ID");
    if (!project?.id) issues.push("Missing project ID");
    if (issues.length > 0) {
      return false;
    }
    return true;
  }, [currentOrganizationId, project?.id, isAuth]);

  useEffect(() => {
    if (project?.id && isAuth) {
      getUserAccess({ name: "project", id: project.id })
        .then((data) => {
          setHasAccess(data?.canChange);
          setUserAccess(data);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [project?.id, isAuth]);

  const loadProjectMembers = useCallback(async () => {
    if (!project?.id || !isAuth) return;
    try {
      const members = await getProjectMembers(project.id);
      setProjectMembers(members || []);
    } catch (error) {
      console.error("Failed to fetch project members:", error);
      setProjectMembers([]);
    }
  }, [project?.id, isAuth]);

  useEffect(() => {
    if (project?.id && isAuth) {
      loadProjectMembers();
    }
  }, [project?.id, isAuth]);

  const loadProjectSprints = useCallback(async () => {
    if (!projectSlug || !isAuth) return;
    try {
      const sprints = await getSprintsByProject(
        projectSlug as string,
        isAuth,
        workspaceSlug as string
      );
      setAvailableSprints(sprints || []);
    } catch (error) {
      console.error("Failed to fetch project sprints:", error);
      setAvailableSprints([]);
    }
  }, [projectSlug, workspaceSlug, isAuth, getSprintsByProject]);

  useEffect(() => {
    if (projectSlug && isAuth) {
      loadProjectSprints();
    }
  }, [projectSlug, isAuth]);

  const { handleSlugNotFound } = useSlugRedirect();

  const loadInitialData = useCallback(async () => {
    if (!workspaceSlug || !projectSlug) return;
    try {
      setLocalError(null);
      const prj = await getProjectBySlug(projectSlug as string, isAuth, workspaceSlug as string);
      if (!prj) {
        throw new Error(`Project "${projectSlug}" not found in workspace "${workspaceSlug}"`);
      }
      cacheSlugId("workspace", workspaceSlug as string, prj.workspaceId);
      cacheSlugId("project", projectSlug as string, prj.id);

      setProject(prj);
      setWorkspace(prj.workspace);

      // Load task statuses for the project
      const statuses = await getTaskStatusByProject(prj.id);
      setAvailableStatuses(statuses || []);

      return { ws: prj.workspace, prj };
    } catch (error) {
      console.error("LoadInitialData error:", error);
      const redirected = await handleSlugNotFound(
        error,
        workspaceSlug as string,
        projectSlug as string,
        project?.id
      );
      if (!redirected) {
        setLocalError(error instanceof Error ? error.message : "Failed to load project data");
      }
    }
  }, [workspaceSlug, projectSlug, handleSlugNotFound, project?.id, isAuth, getProjectBySlug]);

  const loadTasks = useCallback(async () => {
    if (!project?.id) return;
    if (isAuth && !currentOrganizationId) return;

    try {
      setLocalError(null);
      const commonFilters = {
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses.join(",") }),
        ...(selectedPriorities.length > 0 && { priorities: selectedPriorities.join(",") }),
        ...(selectedTaskTypes.length > 0 && { types: selectedTaskTypes.join(",") }),
        ...(selectedSprints.length > 0 && { sprintId: selectedSprints.join(",") }),
        ...(debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
        ...(selectedAssignees.length > 0 && { assignees: selectedAssignees.join(",") }),
        ...(selectedReporters.length > 0 && { reporters: selectedReporters.join(",") }),
      };

      if (isAuth && currentOrganizationId) {
        await getAllTasks(currentOrganizationId, {
          projectId: project.id,
          workspaceId: workspace.id,
          ...commonFilters,
          // Always fall back to 'listRank' — ensures rank order is preserved on reload
          // even if localStorage sortField is stale or empty.
          sortBy: sortField || "listRank",
          sortOrder: sortOrder || "asc",
          page: currentPage,
          limit: pageSize,
          groupBy: groupBy,
          parentTaskId: "all",
        });
      } else {
        await getPublicProjectTasks(workspaceSlug as string, projectSlug as string, {
          ...commonFilters,
          page: currentPage,
          limit: pageSize,
          parentTaskId: "all",
        });
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setLocalError(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setIsInitialLoad(false);
    }
  }, [
    isAuth,
    currentOrganizationId,
    workspace?.id,
    project?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    selectedSprints,
    selectedAssignees,
    selectedReporters,
    workspaceSlug,
    projectSlug,
    getAllTasks,
    getPublicProjectTasks,
    sortField,
    sortOrder,
    groupBy,
  ]);

  const loadKanbanData = useCallback(
    async (slug: string, statusId?: string, page: number = 1) => {
      try {
        const res = await getTaskKanbanStatus({
          slug,
          statusId,
          page,
          limit: 25,
          includeSubtasks: false,
        });

        if (res && Array.isArray(res.data)) {
          if (statusId) {
            // Update single status
            setKanban((prev) =>
              prev.map((s) =>
                s.statusId === statusId
                  ? {
                    ...s,
                    tasks: page === 1 ? res.data[0].tasks : [...s.tasks, ...res.data[0].tasks],
                    pagination: res.data[0].pagination,
                  }
                  : s
              )
            );
          } else {
            setKanban(res.data);
          }
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error("Failed to load kanban data:", error);
        setKanban([]);
        setIsInitialLoad(false);
      }
    },
    [getTaskKanbanStatus, isAuth]
  );
  const handleLoadMoreKanbanTasks = useCallback(
    async (statusId: string, page: number) => {
      await loadKanbanData(projectSlug as string, statusId, page);
    },
    [loadKanbanData, projectSlug]
  );
  const loadGanttData = useCallback(async () => {
    if (!currentOrganizationId || !project?.id || !isAuth) return;
    try {
      const res = await getCalendarTask(currentOrganizationId, {
        projectId: project.id,
        workspaceId: workspace.id,
        includeSubtasks: true,
        sortBy: "listRank",
        sortOrder: "asc",
        viewType: "GANTT",
        page: currentPage,
        limit: pageSize,
        groupBy: groupBy !== "none" ? groupBy : undefined,
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses.join(",") }),
        ...(selectedPriorities.length > 0 && { priorities: selectedPriorities.join(",") }),
        ...(selectedTaskTypes.length > 0 && { types: selectedTaskTypes.join(",") }),
        ...(selectedSprints.length > 0 && { sprintId: selectedSprints.join(",") }),
        ...(debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
        ...(selectedAssignees.length > 0 && { assignees: selectedAssignees.join(",") }),
        ...(selectedReporters.length > 0 && { reporters: selectedReporters.join(",") }),
      });
      if (res) {
        setGanttTasks(res.data || []);
        setPagination({
          currentPage: res.page,
          totalPages: res.totalPages,
          totalCount: res.total,
          hasNextPage: res.page < res.totalPages,
          hasPrevPage: res.page > 1,
        });
      }
      setIsInitialLoad(false);
    } catch (error) {
      console.error("Failed to load Gantt data:", error);
      setGanttTasks([]);
      setIsInitialLoad(false);
    }
  }, [
    currentOrganizationId,
    workspace?.id,
    project?.id,
    isAuth,
    currentPage,
    pageSize,
    getCalendarTask,
    groupBy,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    selectedSprints,
    debouncedSearchQuery,
    selectedAssignees,
    selectedReporters,
  ]);

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
        // Refresh Gantt data if needed, but in the background
        if (isAuth && currentView === "gantt") {
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
    [updateTask, isAuth, loadGanttData, currentView]
  );

  useEffect(() => {
    if (!router.isReady) return;

    const currentRoute = `${workspaceSlug}/${projectSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug, projectSlug, loadInitialData]);

  useEffect(() => {
    if (isAuth) {
      if (currentView === "kanban" && projectSlug) {
        loadKanbanData(projectSlug as string);
      } else if (currentView === "gantt") {
        loadGanttData();
      } else {
        loadTasks();
      }
    } else if (projectSlug && currentView === "list") {
      loadTasks();
    }
  }, [currentView, workspaceSlug, projectSlug, isAuth, loadKanbanData, loadGanttData, loadTasks]);

  const previousFiltersRef = useRef({
    page: currentPage,
    pageSize,
    search: debouncedSearchQuery,
    statuses: selectedStatuses.join(","),
    priorities: selectedPriorities.join(","),
    types: selectedTaskTypes.join(","),
    sortField,
    sortOrder,
    groupBy,
  });

  useEffect(() => {
    const currentFilters = {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
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
      if (currentView === "kanban" && projectSlug) {
        loadKanbanData(projectSlug as string);
      } else if (currentView === "gantt") {
        loadGanttData();
      } else {
        loadTasks();
      }
    }
    firstRenderRef.current = false;
  }, [
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    selectedTaskTypes,
    validateRequiredData,
    sortField,
    sortOrder,
    currentView,
    projectSlug,
    loadKanbanData,
    loadGanttData,
    loadTasks,
    groupBy,
  ]);

  // Reset page when groupBy changes
  useEffect(() => {
    setCurrentPage(1);
  }, [groupBy]);

  const statusFilters = useMemo(
    () =>
      availableStatuses.map((status) => ({
        id: status.id,
        name: status.name,
        value: status.id,
        selected: selectedStatuses.includes(status.id),
        count: tasks.filter((task) => task.statusId === status.id).length,
        color: status.color || "#6b7280",
      })),
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

  const sprintFilters = useMemo(
    () =>
      availableSprints.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        value: sprint.id,
        selected: selectedSprints.includes(sprint.id),
        count: tasks.filter((task) => task.sprintId === sprint.id).length,
        color: sprint.status === "ACTIVE" ? "#10b981" : "#6b7280",
      })),
    [availableSprints, selectedSprints, tasks]
  );

  const assigneeFilters = useMemo(() => {
    return projectMembers.map((member) => ({
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
  }, [projectMembers, selectedAssignees, tasks]);

  const reporterFilters = useMemo(() => {
    return projectMembers.map((member) => ({
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
  }, [projectMembers, selectedReporters, tasks]);

  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

  const togglePriority = useCallback((id: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

  const toggleTaskType = useCallback((id: string) => {
    setSelectedTaskTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

  const toggleSprint = useCallback((id: string) => {
    setSelectedSprints((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newQuery = { ...router.query };
      if (newSelection.length > 0) {
        newQuery.sprints = newSelection.join(",");
      } else {
        delete newQuery.sprints;
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

  const filterSections = useMemo(
    () => [
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
        id: "sprint",
        title: t("filters.sprint"),
        icon: Zap,
        data: sprintFilters,
        selectedIds: selectedSprints,
        searchable: true,
        onToggle: toggleSprint,
        onSelectAll: () => {
          const allValues = sprintFilters.map((s) => s.id);
          setSelectedSprints(allValues);
          const newQuery = { ...router.query, sprints: allValues.join(",") };
          router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
        },
        onClearAll: () => {
          setSelectedSprints([]);
          const newQuery = { ...router.query };
          delete newQuery.sprints;
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
      sprintFilters,
      statusFilters,
      assigneeFilters,
      reporterFilters,
      selectedStatuses,
      selectedPriorities,
      selectedTaskTypes,
      selectedSprints,
      selectedAssignees,
      selectedReporters,
      toggleAssignee,
      toggleReporter,
      toggleStatus,
      togglePriority,
      toggleTaskType,
      toggleSprint,
      createSection,
      t,
    ]
  );

  const totalActiveFilters =
    selectedStatuses.length +
    selectedPriorities.length +
    selectedTaskTypes.length +
    selectedSprints.length +
    selectedAssignees.length +
    selectedReporters.length;

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTaskTypes([]);
    setSelectedSprints([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setCurrentPage(1);
  }, []);

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
      if (currentView === "kanban") {
        await loadKanbanData(projectSlug as string);
      } else {
        await loadTasks();
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      throw error;
    }
  }, [currentView, projectSlug, loadKanbanData, loadTasks]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    loadInitialData();
    if (project?.id) {
      if (currentView === "kanban" && projectSlug) {
        loadKanbanData(projectSlug as string);
      } else {
        loadTasks();
      }
    }
  }, [loadInitialData, loadTasks, currentView, projectSlug, loadKanbanData, project?.id]);

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

    if (groupBy !== "none" && currentView === "list") {
      return (
        <TaskListView
          tasks={sortedTasks}
          workspaceSlug={workspaceSlug as string}
          projects={project ? [project] : []}
          columns={columns}
          onTaskRefetch={loadTasks}
          showAddTaskRow={isAuth && userAccess?.role !== "VIEWER"}
          showBulkActionBar={
            hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
          }
          selectedTasks={selectedTasks}
          onTaskSelect={handleTaskSelect}
          onTasksSelect={handleTasksSelect}
          totalTask={pagination.totalCount}
          search={debouncedSearchQuery}
          selectedStatuses={selectedStatuses}
          selectedPriorities={selectedPriorities}
          selectedTaskTypes={selectedTaskTypes}
          selectedAssignees={selectedAssignees}
          selectedReporters={selectedReporters}
          workspaceId={workspace?.id}
          organizationId={currentOrganizationId || undefined}
          currentProject={project}
          projectSlug={projectSlug as string}
          addTaskStatuses={availableStatuses}
          groupBy={groupBy}
          groupMap={undefined}
          onGroupPageChange={undefined}
          groupedLoading={isLoading}
        />
      );
    }

    if (!sortedTasks.length && currentView === "list") {
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
          <KanbanBoard
            kanbanData={kanban}
            projectId={project?.id || ""}
            onRefresh={() => loadKanbanData(projectSlug as string)}
            onLoadMore={handleLoadMoreKanbanTasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            onKanbanUpdate={setKanban}
          />
        );
      case "gantt":
        return (
          <TaskGanttView
            tasks={ganttTasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            viewMode={ganttViewMode}
            onViewModeChange={setGanttViewMode}
            onTaskUpdate={handleTaskUpdate}
            groupBy={groupBy}
            onTaskRefetch={loadGanttData}
            workspaceId={workspace?.id}
            organizationId={currentOrganizationId || undefined}
            currentProject={project}
          />
        );
      default:
        return (
          <TaskListView
            tasks={sortedTasks}
            workspaceSlug={workspaceSlug as string}
            projects={project ? [project] : []}
            columns={columns}
            onTaskRefetch={loadTasks}
            showAddTaskRow={isAuth && userAccess?.role !== "VIEWER"}
            showBulkActionBar={
              hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
            }
            selectedTasks={selectedTasks}
            onTaskSelect={handleTaskSelect}
            onTasksSelect={handleTasksSelect}
            totalTask={pagination.totalCount}
            search={debouncedSearchQuery}
            selectedStatuses={selectedStatuses}
            selectedPriorities={selectedPriorities}
            selectedTaskTypes={selectedTaskTypes}
            selectedAssignees={selectedAssignees}
            selectedReporters={selectedReporters}
            workspaceId={workspace?.id}
            organizationId={currentOrganizationId || undefined}
            currentProject={project}
            projectSlug={projectSlug as string}
            addTaskStatuses={availableStatuses}
            groupBy={groupBy}
            groupMap={undefined}
            onGroupPageChange={undefined}
            groupedLoading={false}

          />
        );
    }
  };

  const showPagination =
    ((currentView === "list" && tasks.length > 0) ||
      (currentView === "gantt" && ganttTasks.length > 0)) &&
    pagination.totalPages >= 1;

  if (error) return <ErrorState error={error} onRetry={handleRetry} />;

  return (
    <div className="dashboard-container flex flex-col">
      {/* Unified Sticky Header */}
      <div className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80 border-b border-[var(--border)]/10 -mx-4 px-4 pb-0 pt-4">
        {/* PageHeader */}
        <div className="pb-2">
          <PageHeader
            title={project ? t("projectTasks", { name: project.name }) : t("defaultProjectTasks")}
            description={project ? t("projectTasksDescription", { name: project.name }) : t("defaultProjectTasksDescription")}
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
                  {(currentView === "list" || currentView === "kanban") && (
                    <FilterDropdown
                      sections={filterSections}
                      title={t("advancedFilters")}
                      activeFiltersCount={totalActiveFilters}
                      onClearAllFilters={clearAllFilters}
                      placeholder={t("filterResults")}
                      dropdownWidth="w-56"
                      showApplyButton={false}
                    />
                  )}
                </div>
                {isAuth && userAccess?.role !== "VIEWER" && (
                  <ActionButton
                    primary
                    showPlusIcon
                    onClick={() => setNewTaskModalOpen(true)}
                    disabled={!project?.id}
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
                  projectSlug={projectSlug as string}
                />
                <CsvImportModal
                  isOpen={isCsvImportOpen}
                  onClose={() => setCsvImportOpen(false)}
                  onImportComplete={loadTasks}
                  workspaceId={workspace?.id}
                  workspaceName={workspace?.name}
                  projectId={project?.id}
                  projectName={project?.name}
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
              const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
              const safeProjectSlug = sanitizeSlug(projectSlug);
              if (!safeWorkspaceSlug || !safeProjectSlug) {
                console.error('Invalid workspace or project slug');
                router.push('/');
                return;
              }
              const path = `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks?type=${v}`;
              if (isValidInternalPath(path.split('?')[0])) {
                router.push(path, undefined, {
                  shallow: true,
                });
              } else {
                router.push('/');
              }
            }}
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
                    </ActionButton>
                  </div>
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

export default function ProjectTasksPage() {
  return <ProjectTasksContent />;
}
