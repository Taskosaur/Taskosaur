import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjectContext } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import TaskListView from "@/components/tasks/views/TaskListView";
import TaskGanttView from "@/components/tasks/views/TaskGanttView";
import { HiXMark } from "react-icons/hi2";
import { Input } from "@/components/ui/input";
import { ColumnConfig, Project, ViewMode, Workspace } from "@/types";
import { TaskPriorities } from "@/utils/data/taskData";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { HiSearch } from "react-icons/hi";
import ActionButton from "@/components/common/ActionButton";
import TabView from "@/components/tasks/TabView";
import Pagination from "@/components/common/Pagination";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import { FilterDropdown, useGenericFilters } from "@/components/common/FilterDropdown";
import { CheckSquare, Flame, User, Users } from "lucide-react";
import SortingManager, { SortOrder, SortField } from "@/components/tasks/SortIngManager";
import Tooltip from "@/components/common/ToolTip";
import { TokenManager } from "@/lib/api";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";
import { KanbanColumnSkeleton } from "@/components/skeletons/KanbanColumnSkeleton";

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

function ProjectTasksContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const workspaceApi = useWorkspaceContext();
  const projectApi = useProjectContext();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const {
    getAllTasks,
    getTaskKanbanStatus,
    getCalendarTask,
    getPublicProjectTasks,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
  } = useTask();

  const { getUserAccess, isAuthenticated } = useAuth();
  const isAuth = isAuthenticated();

  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAccess] = useState(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project>(null);
  const [kanban, setKanban] = useState<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [currentView, setCurrentView] = useState<"list" | "kanban" | "gantt">(() => {
    const type =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("type")
        : null;
    return type === "list" || type === "gantt" || type === "kanban" ? type : "list";
  });
  const [kabBanSettingModal, setKabBanSettingModal] = useState(false);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [availablePriorities] = useState(TaskPriorities);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [addTaskPriorities, setAddTaskPriorities] = useState<any[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [publicTasks, setPublicTasks] = useState<any[]>([]);
  const [publicTasksTotal, setPublicTasksTotal] = useState(0);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [kanbanPage, setKanbanPage] = useState(1);
  const [kanbanLimit, setKanbanLimit] = useState(25);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };
  const error = contextError || localError;

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

  const checkAuthForAction = (action: () => void) => {
    if (!isAuth) {
      router.push("/login");
      return;
    }
    action();
  };

  useEffect(() => {
    localStorage.setItem(SORT_FIELD_KEY, sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  }, [columns]);

  const pagination = useMemo(() => {
    if (!isAuth) {
      const totalPages = Math.ceil(publicTasksTotal / pageSize);
      return {
        currentPage,
        totalPages,
        totalCount: publicTasksTotal,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      };
    }

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
  }, [taskResponse, isAuth, publicTasksTotal, pageSize, currentPage]);

  const routeRef = useRef<string>("");
  const firstRenderRef = useRef(true);
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const hasValidAuth = !!isAuth && !!workspaceSlug && !!projectSlug;
  const currentOrganizationId = TokenManager.getCurrentOrgId();
  const { createSection } = useGenericFilters();

  useEffect(() => {
    if (project && isAuth) {
      getUserAccess({ name: "project", id: project.id })
        .then((data) => {
          setHasAccess(data?.canChange);
          setUserAccess(data);
        })

        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [project, isAuth]);

  useEffect(() => {
    if (typeof window !== "undefined" && isAuth) {
      const params = new URLSearchParams(window.location.search);
      const statusParams = params.get("statuses");
      const priorityParams = params.get("priorities");

      if (statusParams) {
        setSelectedStatuses(statusParams.split(","));
      }
      if (priorityParams) {
        setSelectedPriorities(priorityParams.split(","));
      }
    }
  }, [isAuth]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!project?.id || !isAuth) return;
      try {
        setAddTaskPriorities(TaskPriorities || []);
      } catch (error) {
        console.error("Failed to fetch priorities for Add Task row:", error);
        setAddTaskPriorities([]);
      }
    };
    fetchMeta();
  }, [project?.id, isAuth]);

  const validateRequiredData = useCallback(() => {
    if (!isAuth) return true;

    const issues = [];

    if (!workspace?.id) issues.push("Missing workspace ID");
    if (!currentOrganizationId) issues.push("Missing organization ID");
    if (!project?.id) issues.push("Missing project ID");

    if (issues.length > 0) {
      console.error("Validation failed:", issues);
      setLocalError(`Missing required data: ${issues.join(", ")}`);
      return false;
    }

    return true;
  }, [workspace?.id, currentOrganizationId, project?.id, isAuth]);

  const loadInitialData = useCallback(async () => {
    try {
      setLocalError(null);

      const ws: Workspace | null = null;
      // if (hasValidAuth) {
      //   ws = await workspaceApi.getWorkspaceBySlug(workspaceSlug as string);
      //   if (!ws) {
      //     throw new Error(`Workspace "${workspaceSlug}" not found`);
      //   }
      //   setWorkspace(ws);
      // }

      const proj = await projectApi.getProjectBySlug(
        projectSlug as string,
        isAuth,
        workspaceSlug as string
      );

      if (!proj) {
        throw new Error(`Project "${projectSlug}" not found in workspace "${workspaceSlug}"`);
      }

      setWorkspace((proj.workspace as Workspace) || null);
      setProject(proj);

      return { ws, proj };
    } catch (error) {
      console.error("LoadInitialData error:", error);
      setLocalError(error instanceof Error ? error.message : "Failed to load initial data");
    }
  }, [hasValidAuth, workspaceSlug, projectSlug, workspaceApi, projectApi, isAuth]);

  const loadStatusData = useCallback(async () => {
    if (!project?.id || statusesLoaded || !isAuth) return;
    try {
      const statuses = await projectApi.getTaskStatusByProject(project.id);
      setAvailableStatuses(statuses || []);
      setStatusesLoaded(true);
    } catch (error) {
      console.error("Failed to load task statuses:", error);
      setAvailableStatuses([]);
    }
  }, [project?.id, statusesLoaded, projectApi, isAuth]);

  const loadProjectMembers = useCallback(async () => {
    if (!project?.id || membersLoaded || !isAuth) return;
    try {
      const members = await projectApi.getProjectMembers(project.id);
      setProjectMembers(members || []);
      setMembersLoaded(true);
    } catch (error) {
      console.error("Failed to load project members:", error);
      setProjectMembers([]);
    }
  }, [project?.id, membersLoaded, projectApi, isAuth]);

  const loadPublicTasks = useCallback(async () => {
    if (isAuth || !workspaceSlug || !projectSlug) return;

    try {
      setIsLoadingPublic(true);
      setLocalError(null);

      const filters = {
        limit: pageSize,
        page: currentPage,
      };

      const publicTaskResponse = await getPublicProjectTasks(
        workspaceSlug as string,
        projectSlug as string,
        filters
      );

      setPublicTasks(publicTaskResponse.data || []);
      setPublicTasksTotal(publicTaskResponse.total || 0);
    } catch (error) {
      console.error("Failed to load public tasks:", error);
      setLocalError(error instanceof Error ? error.message : "Failed to load public tasks");
    } finally {
      setIsLoadingPublic(false);
      setIsInitialLoad(false);
    }
  }, [isAuth, workspaceSlug, projectSlug, pageSize, currentPage, getPublicProjectTasks]);

  const loadTasks = useCallback(async () => {
    if (!isAuth) return;

    if (!currentOrganizationId || !project?.id) {
      return;
    }

    if (!validateRequiredData()) {
      return;
    }

    try {
      setLocalError(null);

      const params = {
        projectId: project.id,
        workspaceId: workspace.id,
        ...(selectedStatuses.length > 0 && {
          statuses: selectedStatuses.join(","),
        }),
        ...(selectedPriorities.length > 0 && {
          priorities: selectedPriorities.join(","),
        }),
        ...(selectedAssignees.length > 0 && {
          assignees: selectedAssignees.join(","),
        }),
        ...(selectedReporters.length > 0 && {
          reporters: selectedReporters.join(","),
        }),
        ...(debouncedSearchQuery.trim() && {
          search: debouncedSearchQuery.trim(),
        }),
        page: currentPage,
        limit: pageSize,
      };
      await getAllTasks(currentOrganizationId, params);
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
    selectedAssignees,
    selectedReporters,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    validateRequiredData,
    getAllTasks,
  ]);

  useEffect(() => {
    if (currentView === "gantt") {
      if (project && projectSlug) {
        if (isAuth) {
          loadGanttData();
        }
      }
      return;
    }
    if (currentView === "list") {
      if (isAuth && currentOrganizationId && project?.id) {
        loadTasks();
      } else if (!isAuth) {
        loadPublicTasks();
      }
    }
    if (currentView === "kanban" && project && projectSlug && isAuth) {
      loadKanbanData(projectSlug as string);
    }
  }, [
    currentView,
    currentOrganizationId,
    project?.id,
    projectSlug,
    isAuth,
    selectedAssignees,
    selectedReporters,
  ]);

  const loadKanbanData = useCallback(
    async (projSlug: string, statusId?: string, page: number = 1) => {
      if (!isAuth) return;

      try {
        const response = await getTaskKanbanStatus({
          slug: projSlug,
          includeSubtasks: true,
          ...(statusId && { statusId, page }),
        });

        if (page === 1 || !statusId) {
          setKanban(response.data || []);
          setIsInitialLoad(false);
        } else {
          setKanban((prevKanban) => {
            return prevKanban.map((status) => {
              if (status.statusId === statusId) {
                const newStatusData = response.data.find((s) => s.statusId === statusId);
                if (newStatusData) {
                  return {
                    ...status,
                    tasks: [...status.tasks, ...newStatusData.tasks],
                    pagination: newStatusData.pagination,
                  };
                }
              }
              return status;
            });
          });
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
      await getCalendarTask(currentOrganizationId, {
        projectId: project.id,
        workspaceId: workspace.id,
      });
      setIsInitialLoad(false);
    } catch (error) {
      console.error("Failed to load Gantt data:", error);
      setIsInitialLoad(false);
    }
  }, [currentOrganizationId, workspace?.id, project?.id, isAuth]);

  useEffect(() => {
    if (!router.isReady) return;

    const currentRoute = `${workspaceSlug}/${projectSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug, projectSlug]);

  useEffect(() => {
    if (isAuth) {
      if (currentOrganizationId && project?.id) {
        loadTasks();
      }
    } else {
      loadPublicTasks();
    }
  }, [currentOrganizationId, project?.id, isAuth]);

  useEffect(() => {
    if (project?.id && isAuth) {
      loadStatusData();
      loadProjectMembers();
    }
  }, [project?.id, isAuth]);

  const previousFiltersRef = useRef({
    page: currentPage,
    pageSize,
    search: debouncedSearchQuery,
    statuses: selectedStatuses.join(","),
    priorities: selectedPriorities.join(","),
  });

  useEffect(() => {
    if (!isAuth) return;
    if (!currentOrganizationId || !project?.id) return;

    const currentFilters = {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      statuses: selectedStatuses.join(","),
      priorities: selectedPriorities.join(","),
    };

    const filtersChanged =
      JSON.stringify(currentFilters) !== JSON.stringify(previousFiltersRef.current);
    previousFiltersRef.current = currentFilters;

    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (filtersChanged && validateRequiredData()) {
      loadTasks();
    }
  }, [
    isAuth,
    currentOrganizationId,
    project?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
  ]);

  useEffect(() => {
    if (!isAuth && project) {
      loadPublicTasks();
    }
  }, [currentPage, pageSize, isAuth, project]);

  const displayTasks = isAuth ? tasks : publicTasks;
  const displayLoading = isAuth ? isLoading : isLoadingPublic;

  const sortedTasks = useMemo(() => {
    const sorted = [...displayTasks].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (["createdAt", "updatedAt", "completedAt", "timeline"].includes(sortField)) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });
    return sorted;
  }, [displayTasks, sortOrder, sortField]);

  const statusFilters = useMemo(
    () =>
      isAuth
        ? availableStatuses.map((status) => ({
            id: status.id,
            label: status.name,
            value: status.id,
            selected: selectedStatuses.includes(status.id),
            count: status._count?.tasks || 0,
            color: status.color || "#6b7280",
          }))
        : [],
    [availableStatuses, selectedStatuses, isAuth]
  );

  const priorityFilters = useMemo(
    () =>
      isAuth
        ? availablePriorities.map((priority) => ({
            id: priority.id,
            name: priority.name,
            value: priority.value,
            selected: selectedPriorities.includes(priority.value),
            count: displayTasks.filter((task) => task.priority === priority.value).length,
            color: priority.color,
          }))
        : [],
    [availablePriorities, selectedPriorities, displayTasks, isAuth]
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

  const safeToggleStatus = useCallback(
    (id: string) => {
      if (!isAuth) return;

      try {
        setSelectedStatuses((prev) => {
          const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];

          const params = new URLSearchParams(window.location.search);
          if (newSelection.length > 0) {
            params.set("statuses", newSelection.join(","));
          } else {
            params.delete("statuses");
          }
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          window.history.replaceState({}, "", newUrl);
          return newSelection;
        });
        setCurrentPage(1);
      } catch (error) {
        console.error("Error toggling status filter:", error);
      }
    },
    [isAuth]
  );

  const safeTogglePriority = useCallback(
    (id: string) => {
      if (!isAuth) return;

      try {
        setSelectedPriorities((prev) => {
          const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];

          const params = new URLSearchParams(window.location.search);
          if (newSelection.length > 0) {
            params.set("priorities", newSelection.join(","));
          } else {
            params.delete("priorities");
          }
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          window.history.replaceState({}, "", newUrl);
          return newSelection;
        });
        setCurrentPage(1);
      } catch (error) {
        console.error("Error toggling priority filter:", error);
      }
    },
    [isAuth]
  );

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
    () =>
      isAuth
        ? [
            createSection({
              id: "status",
              title: "Status",
              icon: CheckSquare,
              data: statusFilters,
              selectedIds: selectedStatuses,
              searchable: false,
              onToggle: safeToggleStatus,
              onSelectAll: () => setSelectedStatuses(statusFilters.map((s) => s.id)),
              onClearAll: () => setSelectedStatuses([]),
            }),
            createSection({
              id: "priority",
              title: "Priority",
              icon: Flame,
              data: priorityFilters,
              selectedIds: selectedPriorities,
              searchable: false,
              onToggle: safeTogglePriority,
              onSelectAll: () => setSelectedPriorities(priorityFilters.map((p) => p.id)),
              onClearAll: () => setSelectedPriorities([]),
            }),
            createSection({
              id: "assignee",
              title: "Assignee",
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
              title: "Reporter",
              icon: Users,
              data: reporterFilters,
              selectedIds: selectedReporters,
              searchable: true,
              onToggle: toggleReporter,
              onSelectAll: () => setSelectedReporters(reporterFilters.map((r) => r.id)),
              onClearAll: () => setSelectedReporters([]),
            }),
          ]
        : [],
    [
      isAuth,
      statusFilters,
      priorityFilters,
      selectedStatuses,
      selectedPriorities,
      assigneeFilters,
      selectedAssignees,
      selectedReporters,
      reporterFilters,
      toggleAssignee,
      toggleReporter,
      safeToggleStatus,
      safeTogglePriority,
      createSection,
    ]
  );

  const totalActiveFilters = isAuth
    ? selectedStatuses.length +
      selectedPriorities.length +
      selectedAssignees.length +
      selectedReporters.length
    : 0;

  const clearAllFilters = useCallback(() => {
    if (!isAuth) return;

    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setCurrentPage(1);

    const params = new URLSearchParams(window.location.search);
    params.delete("statuses");
    params.delete("priorities");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [isAuth]);

  const handleAddColumn = (columnId: string) => {
    const columnConfigs: Record<string, { label: string; type: ColumnConfig["type"] }> = {
      description: { label: "Description", type: "text" },
      taskNumber: { label: "Task Number", type: "number" },
      timeline: { label: "Timeline", type: "dateRange" },
      completedAt: { label: "Completed Date", type: "date" },
      storyPoints: { label: "Story Points", type: "number" },
      originalEstimate: { label: "Original Estimate", type: "number" },
      remainingEstimate: { label: "Remaining Estimate", type: "number" },
      reporter: { label: "Reporter", type: "user" },
      updatedBy: { label: "Updated By", type: "user" },
      createdAt: { label: "Created Date", type: "date" },
      updatedAt: { label: "Updated Date", type: "date" },
      sprint: { label: "Sprint", type: "text" },
      parentTask: { label: "Parent Task", type: "text" },
      childTasksCount: { label: "Child Tasks", type: "number" },
      commentsCount: { label: "Comments", type: "number" },
      attachmentsCount: { label: "Attachments", type: "number" },
      timeEntries: { label: "Time Entries", type: "number" },
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
    if (!isAuth) return;

    try {
      await loadTasks();

      if (currentView === "kanban") {
        const data = await getTaskKanbanStatus({
          slug: projectSlug as string,
          includeSubtasks: true,
          page: kanbanPage,
          limit: kanbanLimit,
        });
        setKanban(data.data || []);
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      throw error;
    }
  }, [isAuth, loadTasks, currentView, projectSlug, getTaskKanbanStatus]);

  const handleTaskRefetch = useCallback(async () => {
    if (isAuth) {
      await loadTasks();
    } else {
      await loadPublicTasks();
    }
  }, [isAuth, loadTasks, loadPublicTasks]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    loadInitialData();
    if (isAuth && currentOrganizationId && project?.id) {
      loadTasks();
    } else if (!isAuth) {
      loadPublicTasks();
    }
  }, [loadInitialData, isAuth, currentOrganizationId, project?.id, loadTasks, loadPublicTasks]);

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

  const renderContent = () => {
    if (isInitialLoad || displayLoading) {
      return currentView === "kanban" ? <KanbanColumnSkeleton /> : <TaskTableSkeleton />;
    }

    if (!displayTasks.length) {
      return (
        <EmptyState
          searchQuery={debouncedSearchQuery}
          priorityFilter={selectedPriorities.length > 0 ? "filtered" : "all"}
        />
      );
    }

    switch (currentView) {
      case "kanban":
        if (!isAuth) {
          return (
            <div className="text-center py-12">
              <p className="text-[var(--muted-foreground)]">
                Kanban view is available for authenticated users only. Please log in to access this
                view.
              </p>
            </div>
          );
        }
        if (!kanban.length) {
          return currentView === "kanban" ? <KanbanColumnSkeleton /> : <TaskTableSkeleton />;
        }
        return kanban.length ? (
          <KanbanBoard
            kanbanData={kanban}
            projectId={project?.id || ""}
            onRefresh={() => loadKanbanData(projectSlug as string)}
            onLoadMore={handleLoadMoreKanbanTasks}
            kabBanSettingModal={kabBanSettingModal}
            setKabBanSettingModal={setKabBanSettingModal}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            onKanbanUpdate={setKanban}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--muted-foreground)]">
              No workflow found. Create workflow statuses to use the Kanban view.
            </p>
          </div>
        );
      case "gantt":
        if (!isAuth) {
          return (
            <div className="text-center py-12">
              <p className="text-[var(--muted-foreground)]">
                Gantt view is available for authenticated users only. Please log in to access this
                view.
              </p>
            </div>
          );
        }
        return (
          <TaskGanttView
            tasks={displayTasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            viewMode={ganttViewMode}
            onViewModeChange={setGanttViewMode}
          />
        );
      default:
        return (
          <TaskListView
            tasks={sortedTasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
            onTaskRefetch={handleTaskRefetch}
            columns={columns}
            addTaskStatuses={availableStatuses}
            addTaskPriorities={addTaskPriorities}
            projectMembers={projectMembers}
            showAddTaskRow={userAccess?.role !== "VIEWER" && isAuth}
            onTaskSelect={handleTaskSelect}
            selectedTasks={selectedTasks}
            showBulkActionBar={
              hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
            }
            totalTask={pagination.totalCount}
          />
        );
    }
  };

  const showPagination =
    currentView !== "kanban" && displayTasks.length > 0 && pagination.totalPages > 1;
  if (error) return <ErrorState error={error} onRetry={handleRetry} />;

  return (
    <div className="dashboard-container h-[86vh] flex flex-col space-y-3">
      {/* Sticky PageHeader */}
      <div className="sticky top-0 z-30 bg-[var(--background)]">
        <PageHeader
          title={project ? `${project.name} Tasks` : "Project Tasks"}
          description={`Manage and track all tasks for ${project?.name || "this project"}`}
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
              <div className="flex items-center gap-2">
                {/* Hide search for unauthenticated users */}
                {isAuth && (
                  <div className="relative w-full sm:max-w-xs">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                    <Input
                      type="text"
                      placeholder="Search tasks..."
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
                )}

                {/* Hide filters for unauthenticated users */}
                {isAuth && currentView === "list" && (
                  <FilterDropdown
                    sections={filterSections}
                    title="Advanced Filters"
                    activeFiltersCount={totalActiveFilters}
                    onClearAllFilters={clearAllFilters}
                    placeholder="Filter results..."
                    dropdownWidth="w-56"
                    showApplyButton={false}
                  />
                )}
              </div>

              {/* ONLY Create Task requires authentication */}
              {userAccess?.role !== "VIEWER" && isAuth && (
                <ActionButton
                  primary
                  showPlusIcon
                  onClick={() => {
                    checkAuthForAction(() => {
                      const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
                      const safeProjectSlug = sanitizeSlug(projectSlug);
                      if (!safeWorkspaceSlug || !safeProjectSlug) {
                        console.error('Invalid workspace or project slug');
                        router.push('/');
                        return;
                      }
                      const path = `/${safeWorkspaceSlug}/${safeProjectSlug}/tasks/new`;
                      if (isValidInternalPath(path)) {
                        router.push(path);
                      } else {
                        router.push('/');
                      }
                    });
                  }}
                  disabled={!workspace?.id || !project?.id}
                >
                  Create Task
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
                    const errorMessage = error?.message ? error.message : "Failed to refresh tasks";
                    console.error("Error creating task:", errorMessage);
                    if (isAuth) {
                      await loadTasks();
                    }
                  }
                }}
                workspaceSlug={workspaceSlug as string}
                projectSlug={projectSlug as string}
              />
            </div>
          }
        />
      </div>

      {/* Sticky TabView - Limited for unauthenticated users */}
      <div className="sticky top-[64px] z-20 bg-[var(--background)]">
        <TabView
          currentView={currentView}
          onViewChange={(v) => {
            // For unauthenticated users, only allow list view
            if (!isAuth && v !== "list") {
              return;
            }
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
          viewKanban={isAuth}
          viewGantt={isAuth}
          rightContent={
            <>
              {/* Hide most controls for unauthenticated users */}
              {isAuth && currentView === "gantt" && (
                <div className="flex items-center bg-[var(--odd-row)] rounded-lg p-1 shadow-sm">
                  {(["days", "weeks", "months"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGanttViewMode(mode)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize cursor-pointer ${
                        ganttViewMode === mode
                          ? "bg-blue-500 text-white"
                          : "text-slate-600 dark:text-slate-400 hover:bg-[var(--accent)]/50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
              {/* List view controls - Available for all users */}
              {currentView === "list" && (
                <div className="flex items-center gap-2">
                  <SortingManager
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
                    setKabBanSettingModal={setKabBanSettingModal}
                  />
                </div>
              )}
              {/* Kanban view controls - Only for authenticated users */}
              {isAuth &&
                currentView === "kanban" &&
                (hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER") && (
                  <div className="flex items-center gap-2">
                    <Tooltip content="Manage Columns" position="top" color="primary">
                      <ColumnManager
                        currentView={currentView}
                        availableColumns={columns}
                        onAddColumn={handleAddColumn}
                        onRemoveColumn={handleRemoveColumn}
                        setKabBanSettingModal={setKabBanSettingModal}
                      />
                    </Tooltip>
                  </div>
                )}
            </>
          }
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto rounded-md">{renderContent()}</div>

      {/* Sticky Pagination - Available for all users */}
      {showPagination && (
        <div className="sticky bottom-0 z-10 bg-[var(--background)]">
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
