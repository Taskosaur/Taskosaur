import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
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
import { CheckSquare, Flame, Folder, User, Users } from "lucide-react";
import { TaskPriorities } from "@/utils/data/taskData";
import Tooltip from "@/components/common/ToolTip";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";

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
  const [addTaskStatuses, setAddTaskStatuses] = useState<any[]>([]);
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { getWorkspaceBySlug, getWorkspaceMembers } = useWorkspace();
  const { getProjectsByWorkspace, getTaskStatusByProject } = useProject();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const {
    getAllTasks,
    getCalendarTask,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
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
  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAccess] = useState(null);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [statusFilterEnabled, setStatusFilterEnabled] = useState(false);
  const [availablePriorities] = useState(TaskPriorities);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [ganttTasks, setGanttTasks] = useState<any[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

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
      setAddTaskStatuses([]);
    };
    fetchMeta();
  }, [workspace?.id, workspace?.organizationId]);

  const routeRef = useRef<string>("");
  const firstRenderRef = useRef(true);
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const hasValidAuth = !!isAuthenticated() && !!workspaceSlug;
  const { createSection } = useGenericFilters();

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

  const loadInitialData = useCallback(async () => {
    if (!hasValidAuth) return;
    try {
      setLocalError(null);

      if (!isAuthenticated()) {
        router.push("/auth/login");
        return;
      }

      const ws = await getWorkspaceBySlug(workspaceSlug as string);
      if (!ws) {
        throw new Error(`Workspace "${workspaceSlug}" not found`);
      }
      setWorkspace(ws);
      return { ws };
    } catch (error) {
      console.error("LoadInitialData error:", error);
      setLocalError(error instanceof Error ? error.message : "Failed to load initial data");
    }
  }, [isAuthenticated, workspaceSlug, router]);

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

      // Build parameters for getAllTasks
      const params = {
        workspaceId: workspace.id,
        ...(selectedProjects.length > 0 && {
          projectId: selectedProjects.join(","),
        }),
        ...(selectedStatuses.length > 0 && {
          statuses: selectedStatuses.join(","),
        }),
        ...(selectedPriorities.length > 0 && {
          priorities: selectedPriorities.join(","),
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

        page: currentPage,
        limit: pageSize,
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
    selectedAssignees,
    selectedReporters,
    validateRequiredData,
    getAllTasks,
  ]);

  const loadGanttData = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      const data = await getCalendarTask(workspace.organizationId, {
        workspaceId: workspace.id,
      });
      setGanttTasks(data || []);
      setIsInitialLoad(false);
    } catch (error) {
      console.error("Failed to load Gantt data:", error);
      setGanttTasks([]);
      setIsInitialLoad(false);
    }
  }, [workspace?.id, getCalendarTask]);

  useEffect(() => {
    if (currentView === "gantt" && workspace?.id) {
      loadGanttData();
    }
  }, [currentView, workspace?.id]);

  useEffect(() => {
    if (!router.isReady) return;
    const currentRoute = `${workspaceSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug]);

  useEffect(() => {
    if (workspace?.organizationId && workspace?.id) {
      loadTasks();
    }
  }, [workspace?.organizationId, workspace?.id, selectedAssignees, selectedReporters]);

  const previousFiltersRef = useRef({
    page: currentPage,
    pageSize,
    search: debouncedSearchQuery,
    projects: selectedProjects.join(","),
    statuses: selectedStatuses.join(","),
    priorities: selectedPriorities.join(","),
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
    validateRequiredData,
  ]);

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
      availableStatuses.map((status) => ({
        id: status.id,
        name: status.name,
        value: status.id,
        selected: selectedStatuses.includes(status.id),
        count: tasks.filter((task) => {
          const taskStatusId =
            task.statusId || (typeof task.status === "object" ? task.status?.id : task.status);
          return taskStatusId === status.id;
        }).length,
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
      return newSelection;
    });
    setCurrentPage(1);
  }, []);

  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return newSelection;
    });
    setCurrentPage(1);
  }, []);

  const togglePriority = useCallback((id: string) => {
    setSelectedPriorities((prev) => {
      const newSelection = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return newSelection;
    });
    setCurrentPage(1);
  }, []);

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

  // Fetch statuses for selected project
  useEffect(() => {
    const fetchStatusesForProject = async () => {
      if (selectedProjects.length === 1) {
        try {
          const statuses = await getTaskStatusByProject(selectedProjects[0]);
          setAvailableStatuses(statuses || []);
          setStatusFilterEnabled(true);
        } catch (error) {
          console.error("Failed to fetch statuses for selected project:", error);
          setAvailableStatuses([]);
          setStatusFilterEnabled(false);
        }
      } else {
        setAvailableStatuses([]);
        setStatusFilterEnabled(false);
      }
    };
    fetchStatusesForProject();
  }, [selectedProjects]);

  const filterSections = useMemo(
    () => [
      createSection({
        id: "project",
        title: "Projects",
        icon: Folder,
        data: projectFilters,
        selectedIds: selectedProjects,
        searchable: true,
        multiSelect: false,
        onToggle: toggleProject,
        onSelectAll: undefined,
        onClearAll: () => setSelectedProjects([]),
      }),
      createSection({
        id: "status",
        title: "Status",
        icon: CheckSquare,
        data: statusFilters,
        selectedIds: selectedStatuses,
        searchable: false,
        onToggle: statusFilterEnabled ? toggleStatus : undefined,
        onSelectAll: statusFilterEnabled
          ? () => setSelectedStatuses(statusFilters.map((s) => s.id))
          : undefined,
        onClearAll: statusFilterEnabled ? () => setSelectedStatuses([]) : undefined,
        disabled: !statusFilterEnabled,
      }),
      createSection({
        id: "priority",
        title: "Priority",
        icon: Flame,
        data: priorityFilters,
        selectedIds: selectedPriorities,
        searchable: false,
        onToggle: togglePriority,
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
    ],
    [
      projectFilters,
      statusFilters,
      priorityFilters,
      selectedProjects,
      selectedStatuses,
      selectedPriorities,
      assigneeFilters,
      reporterFilters,
      selectedAssignees,
      selectedReporters,
      toggleAssignee,
      toggleReporter,
      toggleProject,
      toggleStatus,
      togglePriority,
      statusFilterEnabled,
    ]
  );

  const totalActiveFilters =
    selectedProjects.length +
    selectedStatuses.length +
    selectedPriorities.length +
    selectedAssignees.length +
    selectedReporters.length;

  const clearAllFilters = useCallback(() => {
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedAssignees([]);
    setSelectedReporters([]);
    setCurrentPage(1);
  }, []);

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

  const memoizedTaskRefetch = useCallback(() => {
    handleTaskRefetch();
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

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
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
  }, [tasks, sortOrder, sortField]);

  const renderContent = () => {
    if (isInitialLoad || isLoading) return <TaskTableSkeleton />;

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
              Kanban is only available on Project level.
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
            showBulkActionBar={
              hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER"
            }
          />
        );
    }
  };

  const showPagination = currentView === "list" && tasks.length > 0 && pagination.totalPages > 1;

  if (error) return <ErrorState error={error} onRetry={handleRetry} />;

  return (
    <div className="dashboard-container h-[86vh] flex flex-col space-y-3">
      {/* Sticky PageHeader */}
      <div className="sticky top-0 z-50 ">
        <PageHeader
          title={workspace ? `${workspace.name} Tasks` : "Workspace Tasks"}
          description="Manage and track all tasks across projects in this workspace."
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
              <div className="flex items-center gap-2">
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
                {currentView === "list" && (
                  <FilterDropdown
                    sections={filterSections}
                    title="Advanced Filters"
                    activeFiltersCount={totalActiveFilters}
                    onClearAllFilters={clearAllFilters}
                    placeholder="Filter results..."
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
                  onClick={() => {
                    const safeSlug = sanitizeSlug(workspaceSlug);
                    if (!safeSlug) {
                      console.error('Invalid workspace slug');
                      router.push('/');
                      return;
                    }
                    const path = `/${safeSlug}/tasks/new`;
                    if (isValidInternalPath(path)) {
                      router.push(path);
                    } else {
                      router.push('/');
                    }
                  }}
                  disabled={!workspace?.id}
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
                    const errorMessage =
                      error instanceof Error ? error.message : "Failed to refresh tasks";
                    console.error("Error creating task:", errorMessage);
                    await loadTasks();
                  }
                }}
                workspaceSlug={workspaceSlug as string}
              />
            </div>
          }
        />
      </div>
      {/* Sticky TabView */}
      <div className="sticky top-[64px] z-40">
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
                  />
                </div>
              )}
              {currentView === "kanban" &&
                (hasAccess || userAccess?.role === "OWNER" || userAccess?.role === "MANAGER") && (
                  <div className="flex items-center gap-2">
                    <Tooltip content="Manage Columns" position="top" color="primary">
                      <ColumnManager
                        currentView={currentView}
                        availableColumns={columns}
                        onAddColumn={handleAddColumn}
                        onRemoveColumn={handleRemoveColumn}
                      />
                    </Tooltip>
                  </div>
                )}
            </>
          }
        />
      </div>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto rounded-md">
        {error ? <ErrorState error={error} onRetry={handleRetry} /> : renderContent()}
      </div>
      {/* Sticky Pagination */}
      {showPagination && (
        <div className="sticky bottom-0 z-30 pt-2">
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
