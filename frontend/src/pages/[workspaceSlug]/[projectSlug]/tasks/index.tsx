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
import Loader from "@/components/common/Loader";
import Pagination from "@/components/common/Pagination";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import {
  FilterDropdown,
  useGenericFilters,
} from "@/components/common/FilterDropdown";
import { CheckSquare, Flame } from "lucide-react";
import SortingManager, {
  SortOrder,
  SortField,
} from "@/components/tasks/SortIngManager";
import Tooltip from "@/components/common/ToolTip";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

function ProjectTasksContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const auth = useAuth();
  const workspaceApi = useWorkspaceContext();
  const projectApi = useProjectContext();

  const {
    getAllTasks,
    getTaskKanbanStatus,
    getCalendarTask,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
  } = useTask();

  const { getUserAccess } = useAuth();

  const [hasAccess, setHasAccess] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project>(null);
  const [kanban, setKanban] = useState<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [currentView, setCurrentView] = useState<"list" | "kanban" | "gantt">(
    () => {
      const type =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("type")
          : null;
      return type === "list" || type === "gantt" || type === "kanban"
        ? type
        : "list";
    }
  );
  const [kabBanSettingModal, setKabBanSettingModal] = useState(false);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [availablePriorities] = useState(TaskPriorities);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [addTaskPriorities, setAddTaskPriorities] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const error = contextError || localError;

  // Create pagination info from context
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

  const routeRef = useRef<string>("");
  const firstRenderRef = useRef(true);
  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const hasValidAuth =
    !!auth.isAuthenticated() && !!workspaceSlug && !!projectSlug;

  const { createSection } = useGenericFilters();

  // Load user access
  useEffect(() => {
    if (project) {
      getUserAccess({ name: "project", id: project.id })
        .then((data) => {
          setHasAccess(data?.canChange);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [project]);

  // Initialize filter states from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
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
  }, []);

  // Load task priorities for Add Task row
  useEffect(() => {
    const fetchMeta = async () => {
      if (!project?.id) return;
      try {
        setAddTaskPriorities(TaskPriorities || []);
      } catch (error) {
        console.error("Failed to fetch priorities for Add Task row:", error);
        setAddTaskPriorities([]);
      }
    };
    fetchMeta();
  }, [project?.id]);

  const validateRequiredData = useCallback(() => {
    const issues = [];

    if (!workspace?.id) issues.push("Missing workspace ID");
    if (!workspace?.organizationId) issues.push("Missing organization ID");
    if (!project?.id) issues.push("Missing project ID");

    if (issues.length > 0) {
      console.error("Validation failed:", issues);
      setLocalError(`Missing required data: ${issues.join(", ")}`);
      return false;
    }

    return true;
  }, [workspace?.id, workspace?.organizationId, project?.id]);

  const loadInitialData = useCallback(async () => {
    if (!hasValidAuth) return;

    try {
      setLocalError(null);

      if (!auth.isAuthenticated()) {
        router.push("/auth/login");
        return;
      }

      const ws = await workspaceApi.getWorkspaceBySlug(workspaceSlug as string);
      if (!ws) {
        throw new Error(`Workspace "${workspaceSlug}" not found`);
      }

      setWorkspace(ws);

      const proj = await projectApi.getProjectBySlug(projectSlug as string);
      if (!proj) {
        throw new Error(
          `Project "${projectSlug}" not found in workspace "${workspaceSlug}"`
        );
      }

      setProject(proj);

      return { ws, proj };
    } catch (error) {
      console.error("LoadInitialData error:", error);
      setLocalError(
        error instanceof Error ? error.message : "Failed to load initial data"
      );
    }
  }, [
    auth.isAuthenticated,
    workspaceSlug,
    projectSlug,
    workspaceApi,
    projectApi,
    router,
  ]);

  // Load task statuses
  const loadStatusData = useCallback(async () => {
    if (!project?.id || statusesLoaded) return;
    try {
      const statuses = await projectApi.getTaskStatusByProject(project.id);
      setAvailableStatuses(statuses || []);
      setStatusesLoaded(true);
    } catch (error) {
      console.error("Failed to load task statuses:", error);
      setAvailableStatuses([]);
    }
  }, [project?.id, statusesLoaded, projectApi]);

  // Load project members
  const loadProjectMembers = useCallback(async () => {
    if (!project?.id || membersLoaded) return;
    try {
      const members = await projectApi.getProjectMembers(project.id);
      setProjectMembers(members || []);
      setMembersLoaded(true);
    } catch (error) {
      console.error("Failed to load project members:", error);
      setProjectMembers([]);
    }
  }, [project?.id, membersLoaded, projectApi]);

  // Updated loadTasks using getAllTasks with proper parameters
  const loadTasks = useCallback(async () => {
    if (!workspace?.organizationId || !project?.id) {
      return;
    }

    if (!validateRequiredData()) {
      return;
    }

    try {
      setLocalError(null);

      // Build parameters for getAllTasks
      const params = {
        projectId: project.id,
        workspaceId: workspace.id,
        ...(selectedStatuses.length > 0 && {
          statuses: selectedStatuses.join(","),
        }),
        ...(selectedPriorities.length > 0 && {
          priorities: selectedPriorities.join(","),
        }),
        ...(debouncedSearchQuery.trim() && {
          search: debouncedSearchQuery.trim(),
        }),
        page: currentPage,
        limit: pageSize,
      };

      // Call getAllTasks - this will update tasks and taskResponse in context
      await getAllTasks(workspace.organizationId, params);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setLocalError(
        error instanceof Error ? error.message : "Failed to load tasks"
      );
    }
  }, [
    workspace?.organizationId,
    workspace?.id,
    project?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    validateRequiredData,
  ]);

  
  useEffect(() => {
    if (currentView === "gantt") {
      
      if (project && projectSlug) {
        loadGanttData();
      }
      return;
    }
    if (
      currentView === "list" &&
      workspace?.organizationId &&
      project?.id
    ) {
      loadTasks();
    }
    if (
      currentView === "kanban" &&
      project &&
      projectSlug
    ) {
      loadKanbanData(projectSlug as string);
    }
  }, [currentView, workspace?.organizationId, project?.id, projectSlug]);

  const loadKanbanData = useCallback(
    async (projSlug: string) => {
      try {
        const data = await getTaskKanbanStatus({
          type: "project",
          slug: projSlug,
          includeSubtasks: true,
        });
        setKanban(data.data || []);
      } catch (error) {
        console.error("Failed to load kanban data:", error);
      }
    },
    [getTaskKanbanStatus]
  );

 
  const loadGanttData = useCallback(async () => {
  if (!workspace?.organizationId || !project?.id) return;
  try {
    await getCalendarTask(workspace.organizationId, {
      projectId: project.id,
      workspaceId: workspace.id,
     
    });
  } catch (error) {
    console.error("Failed to load Gantt data:", error);
  }
}, [ workspace?.organizationId, workspace?.id, project?.id]);

  useEffect(() => {
    if (!router.isReady) return;

    const currentRoute = `${workspaceSlug}/${projectSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug, projectSlug]);

  
  useEffect(() => {
    if (workspace?.organizationId && project?.id) {
      loadTasks();
    }
  }, [workspace?.organizationId, project?.id]);

  // Load supplementary data when project is available
  useEffect(() => {
    if (project?.id) {
      loadStatusData();
      loadProjectMembers();
    }
  }, [project?.id]);

  // Handle filter changes
  const previousFiltersRef = useRef({
    page: currentPage,
    pageSize,
    search: debouncedSearchQuery,
    statuses: selectedStatuses.join(","),
    priorities: selectedPriorities.join(","),
  });

  useEffect(() => {
    if (!workspace?.organizationId || !project?.id) return;

    const currentFilters = {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      statuses: selectedStatuses.join(","),
      priorities: selectedPriorities.join(","),
    };

    const filtersChanged =
      JSON.stringify(currentFilters) !==
      JSON.stringify(previousFiltersRef.current);
    previousFiltersRef.current = currentFilters;

    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (filtersChanged && validateRequiredData()) {
      loadTasks();
    }
  }, [
    workspace?.organizationId,
    project?.id,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    validateRequiredData
  ]);




  // Sorting logic for tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      // Handle date fields
      if (
        ["createdAt", "updatedAt", "completedAt", "timeline"].includes(
          sortField
        )
      ) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      // Handle number comparison
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      // Fallback
      return 0;
    });
    return sorted;
  }, [tasks, sortOrder, sortField]);

  // Filter configurations
  const statusFilters = useMemo(
    () =>
      availableStatuses.map((status) => ({
        id: status.id,
        label: status.name,
        value: status.id,
        selected: selectedStatuses.includes(status.id),
        count: status._count?.tasks || 0,
        color: status.color || "#6b7280",
      })),
    [availableStatuses, selectedStatuses]
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
// Sorting logic for tasks
  const safeToggleStatus = useCallback((id: string) => {
    try {
      setSelectedStatuses((prev) => {
        const newSelection = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];

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
  }, []);

  const safeTogglePriority = useCallback((id: string) => {
    try {
      setSelectedPriorities((prev) => {
        const newSelection = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];

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
  }, []);

  const filterSections = useMemo(
    () => [
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
        onSelectAll: () =>
          setSelectedPriorities(priorityFilters.map((p) => p.id)),
        onClearAll: () => setSelectedPriorities([]),
      }),
    ],
    [
      statusFilters,
      priorityFilters,
      selectedStatuses,
      selectedPriorities,
      safeToggleStatus,
      safeTogglePriority,
    ]
  );

  const totalActiveFilters =
    selectedStatuses.length + selectedPriorities.length;

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setCurrentPage(1);

    // Clear URL query parameters for filters
    const params = new URLSearchParams(window.location.search);
    params.delete("statuses");
    params.delete("priorities");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  // Column management
  const handleAddColumn = (columnId: string) => {
    const columnConfigs: Record<
      string,
      { label: string; type: ColumnConfig["type"] }
    > = {
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

  // Task operations
  const handleTaskCreated = useCallback(async () => {
    try {
      await loadTasks();

      if (currentView === "kanban") {
        const data = await getTaskKanbanStatus({
          type: "project",
          slug: projectSlug as string,
          includeSubtasks: true,
        });
        setKanban(data.data || []);
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      throw error;
    }
  }, [loadTasks, currentView, projectSlug, getTaskKanbanStatus]);

  const handleTaskRefetch = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    loadInitialData();
    if (workspace?.organizationId && project?.id) {
      loadTasks();
    }
  }, [loadInitialData, loadTasks, workspace?.organizationId, project?.id]);

  // Pagination handlers
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

  // Render content based on current view
  const renderContent = () => {
    if (isLoading)
      return <Loader text="Fetching project tasks..." className="py-20" />;

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
        return kanban.length ? (
          <KanbanBoard
            kanbanData={kanban}
            projectId={project?.id || ""}
            onRefresh={() => loadKanbanData(projectSlug as string)}
            kabBanSettingModal={kabBanSettingModal}
            setKabBanSettingModal={setKabBanSettingModal}
            workspaceSlug={workspaceSlug as string}
            projectSlug={projectSlug as string}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--muted-foreground)]">
              No workflow found. Create workflow statuses to use the Kanban
              view.
            </p>
          </div>
        );
      case "gantt":
        return (
          <TaskGanttView
            tasks={tasks}
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
            showAddTaskRow={hasAccess}

          />
        );
    }
  };

  const showPagination =
    currentView === "list" && tasks.length > 0 && pagination.totalPages > 1;

  if (error) return <ErrorState error={error} onRetry={handleRetry} />;

  return (
    <div className="dashboard-container h-[86vh] flex flex-col space-y-3">
      {/* Sticky PageHeader */}
      <div className="sticky top-0 z-30 bg-[var(--background)]">
        <PageHeader
          title={project ? `${project.name} Tasks` : "Project Tasks"}
          description={`Manage and track all tasks for ${
            project?.name || "this project"
          }`}
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
                  />
                )}
              </div>

              {hasAccess && (
                <ActionButton
                  primary
                  showPlusIcon
                  onClick={() =>
                    router.push(`/${workspaceSlug}/${projectSlug}/tasks/new`)
                  }
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
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to refresh tasks";
                    console.error("Error creating task:", errorMessage);
                    await loadTasks();
                  }
                }}
                workspaceSlug={workspaceSlug as string}
                projectSlug={projectSlug as string}
              />
            </div>
          }
        />
      </div>

      {/* Sticky TabView */}
      <div className="sticky top-[64px] z-20 bg-[var(--background)]">
        <TabView
          currentView={currentView}
          onViewChange={(v) => {
            setCurrentView(v);
            router.push(
              `/${workspaceSlug}/${projectSlug}/tasks?type=${v}`,
              undefined,
              { shallow: true }
            );
          }}
          viewKanban={true}
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
                  <Tooltip
                    content="Sorting Manager"
                    position="top"
                    color="primary"
                  >
                    <SortingManager
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSortFieldChange={setSortField}
                      onSortOrderChange={setSortOrder}
                    />
                  </Tooltip>
                  <Tooltip
                    content="Manage Columns"
                    position="top"
                    color="primary"
                  >
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
              {currentView === "kanban" && (
                <div className="flex items-center gap-2">
                  <Tooltip
                    content="Manage Columns"
                    position="top"
                    color="primary"
                  >
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

      {/* Scrollable KanbanBoard/content */}
      <div className="flex-1 overflow-y-auto rounded-md">{renderContent()}</div>

      {/* Sticky Pagination */}
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
