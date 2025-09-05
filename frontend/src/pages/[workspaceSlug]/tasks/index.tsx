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
import { Task } from "@/contexts/task-context";
import { ColumnConfig, Project, ViewMode } from "@/types";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { HiSearch } from "react-icons/hi";
import ActionButton from "@/components/common/ActionButton";
import TabView from "@/components/tasks/TabView";
import Loader from "@/components/common/Loader";
import Pagination from "@/components/common/Pagination";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import SortingManager, { SortField, SortOrder } from "@/components/tasks/SortIngManager";
import {
  FilterDropdown,
  useGenericFilters,
} from "@/components/common/FilterDropdown";
import { CheckSquare, Flame, Folder } from "lucide-react";
import { TaskPriorities } from "@/utils/data/taskData";

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
  const { getProjectsByWorkspace } = useProject();
  const { getFilteredTasks } = useTask();
  const { getTaskStatusByProject } = useProject();
  const { isAuthenticated } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
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
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [statusFilterEnabled, setStatusFilterEnabled] = useState(false);
  const [availablePriorities] = useState(TaskPriorities);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [sortField, setSortField] = useState<SortField>("createdAt");

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

  const normalizeTaskStatus = useCallback((task: Task) => {
    const statusId =
      task.statusId ||
      (typeof task.status === "object" ? task.status?.id : task.status);
    return {
      ...task,
      statusId: statusId,
      normalizedStatusId: statusId,
    };
  }, []);

  const validateRequiredData = useCallback(() => {
    const issues = [];

    if (!workspace?.id) issues.push("Missing workspace ID");
    if (!workspace?.organizationId) issues.push("Missing organization ID");

    if (issues.length > 0) {
      console.error("Validation failed:", issues);
      setError(`Missing required data: ${issues.join(", ")}`);
      return false;
    }

    return true;
  }, [workspace?.id, workspace?.organizationId]);

  useEffect(() => {
    if (workspace) {
      getUserAccess({ name: "workspace", id: workspace.id })
        .then((data) => {
          setHasAccess(data?.canChange);
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

      setWorkspaceMembers(members || []);
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
      setError(null);
      setIsLoading(true);

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
      setError(
        error instanceof Error ? error.message : "Failed to load initial data"
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, workspaceSlug, router]);

  const loadFilterData = useCallback(async () => {
    if (!workspace?.id) return;
    if (filtersLoaded && projectsLoaded) return;
    try {
      if (!projectsLoaded) {
        const projects = await getProjectsByWorkspace(workspace.id);
        setProjects(projects || []);
        setProjectsLoaded(true);
      }
    } catch (error) {
      console.error("Failed to load filter data:", error);
    }
  }, [workspace?.id, filtersLoaded, projectsLoaded, getProjectsByWorkspace]);

  const getFilterParams = useCallback(
    () => ({
      organizationId: workspace?.organizationId,
      workspaceId: workspace?.id,
      ...(selectedProjects.length > 0 && {
        projectId: selectedProjects.join(","),
      }),
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      priorities:
        selectedPriorities.length > 0
          ? (selectedPriorities as ("LOW" | "MEDIUM" | "HIGH" | "HIGHEST")[])
          : undefined,
      search: debouncedSearchQuery.trim() || undefined,
    }),
    [
      workspace?.organizationId,
      workspace?.id,
      selectedProjects,
      selectedStatuses,
      selectedPriorities,
      debouncedSearchQuery,
    ]
  );

  const loadTasks = useCallback(async () => {
    if (!workspace?.id || !workspace?.organizationId) {
      return;
    }

    if (!validateRequiredData()) {
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const filterParams = getFilterParams();

      const allTasks = await getFilteredTasks(filterParams);
      const normalizedTasks = allTasks.map(normalizeTaskStatus);

      const totalTasks = normalizedTasks.length;
      const totalPages = Math.ceil(totalTasks / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTasks = normalizedTasks.slice(startIndex, endIndex);

      setTasks(paginatedTasks);
      setPagination({
        currentPage,
        totalPages,
        totalCount: totalTasks,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      });
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setError(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [
    workspace?.id,
    workspace?.organizationId,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    normalizeTaskStatus,
    validateRequiredData,
    getFilteredTasks,
  ]);

  useEffect(() => {
    if (!router.isReady) return;

    const currentRoute = `${workspaceSlug}`;
    if (routeRef.current !== currentRoute) {
      routeRef.current = currentRoute;
      loadInitialData();
    }
  }, [router.isReady, workspaceSlug]);

  useEffect(() => {
    if (workspace?.id && workspace.organizationId) {
      loadTasks();
    }
  }, [workspace?.id, workspace?.organizationId]);

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
      JSON.stringify(currentFilters) !==
      JSON.stringify(previousFiltersRef.current);
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
    loadTasks,
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
            task.statusId ||
            (typeof task.status === "object" ? task.status?.id : task.status);
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

  const toggleProject = useCallback((id: string) => {
    setSelectedProjects((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return newSelection;
    });
    setCurrentPage(1);
  }, []);

  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return newSelection;
    });
    setCurrentPage(1);
  }, []);

  const togglePriority = useCallback((id: string) => {
    setSelectedPriorities((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return newSelection;
    });
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
          console.error('Failed to fetch statuses for selected project:', error);
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
        onSelectAll: statusFilterEnabled ? () => setSelectedStatuses(statusFilters.map((s) => s.id)) : undefined,
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
    ],
    [projectFilters, statusFilters, priorityFilters, selectedProjects, selectedStatuses, selectedPriorities, toggleProject, toggleStatus, togglePriority, statusFilterEnabled]
  );

  const totalActiveFilters =
    selectedProjects.length +
    selectedStatuses.length +
    selectedPriorities.length;

  const clearAllFilters = useCallback(() => {
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setCurrentPage(1);
  }, []);

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
    setError(null);
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

  const renderContent = () => {
    if (isLoading)
      return <Loader text="Fetching workspace tasks..." className="py-20" />;

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
            tasks={tasks}
            workspaceSlug={workspaceSlug as string}
            projectSlug="default-project"
            viewMode={ganttViewMode}
            onViewModeChange={setGanttViewMode}
          />
        );
      default:
        return (
          <TaskListView
            tasks={tasks}
            workspaceSlug={workspaceSlug as string}
            projects={projects}
            projectsOfCurrentWorkspace={projects}
            columns={columns}
            onTaskRefetch={memoizedTaskRefetch}
            addTaskStatuses={addTaskStatuses}
            workspaceMembers={workspaceMembers}
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
              {hasAccess && (
                <ActionButton
                  primary
                  showPlusIcon
                  onClick={() => router.push(`/${workspaceSlug}/tasks/new`)}
                  disabled={!workspace?.id}
                >
                  Create Task
                </ActionButton>
              )}
              <NewTaskModal
                isOpen={isNewTaskModalOpen}
                onClose={() => {
                  setNewTaskModalOpen(false);
                  setError(null);
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
            router.push(`/${workspaceSlug}/tasks?type=${v}`, undefined, {
              shallow: true,
            });
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
            </>
          }
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto rounded-md">
        {error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          renderContent()
        )}
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
