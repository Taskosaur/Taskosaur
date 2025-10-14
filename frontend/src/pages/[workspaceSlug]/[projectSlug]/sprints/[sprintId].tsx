import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTask } from "@/contexts/task-context";
import { HiXMark } from "react-icons/hi2";
import { HiSearch } from "react-icons/hi";
import type { ColumnConfig } from "@/types/tasks";
import { useRouter } from "next/router";
import TabView from "@/components/tasks/TabView";
import TaskListView from "@/components/tasks/views/TaskListView";
import TaskGanttView from "@/components/tasks/views/TaskGanttView";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import EmptyState from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { ColumnManager } from "@/components/tasks/ColumnManager";
import { ViewMode } from "@/types";
import { TokenManager } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import {
  FilterDropdown,
  useGenericFilters,
} from "@/components/common/FilterDropdown";
import { CheckSquare, Flame } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import SortingManager, {
  SortOrder,
  SortField,
} from "@/components/tasks/SortIngManager";
import { useProjectContext } from "@/contexts/project-context";
import Tooltip from "@/components/common/ToolTip";
import Pagination from "@/components/common/Pagination";
import TaskTableSkeleton from "@/components/skeletons/TaskTableSkeleton";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

const SprintTasksTable = () => {
  const router = useRouter();
  const { sprintId, projectSlug, workspaceSlug } = router.query;

  const { isAuthenticated, getUserAccess } = useAuth();
  const workspaceContext = useWorkspaceContext();
  const {
    getAllTasks,
    getCalendarTask,
    getTaskKanbanStatus,
    getPublicProjectTasks,
    tasks,
    isLoading,
    error: contextError,
    taskResponse,
  } = useTask();

  const SORT_FIELD_KEY = "tasks_sort_field";
  const SORT_ORDER_KEY = "tasks_sort_order";
  const COLUMNS_KEY = "tasks_columns";

  const projectApi = useProjectContext();
  const [kanban, setKanban] = useState<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"list" | "kanban" | "gantt">(
    "list"
  );
  const isAuth = isAuthenticated();
  const [searchInput, setSearchInput] = useState("");
  const [kabBanSettingModal, setKabBanSettingModal] = useState(false);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>("days");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>([]);
  const [availablePriorities] = useState([
    { id: "LOW", name: "Low", value: "LOW", color: "#6b7280" },
    { id: "MEDIUM", name: "Medium", value: "MEDIUM", color: "#f59e0b" },
    { id: "HIGH", name: "High", value: "HIGH", color: "#ef4444" },
    { id: "HIGHEST", name: "Highest", value: "HIGHEST", color: "#dc2626" },
  ]);

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

  // Show pagination if there are tasks and multiple pages
  const showPagination = useMemo(() => {
    return (
      currentView !== "kanban" && tasks.length > 0 && pagination.totalPages > 1
    );
  }, [tasks.length, pagination.totalPages]);

  // Search handlers
  const clearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const debouncedSearchQuery = useDebounce(searchInput, 500);
  const currentOrganizationId = TokenManager.getCurrentOrgId();
  const { createSection } = useGenericFilters();
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [availableTaskStatuses, setAvailableTaskStatuses] = useState<any[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectSlug || project) return;
    const fetchData = async () => {
      try {
        const isAuth = isAuthenticated();

        if (isAuth) {
          // Authenticated flow - get workspace first, then project
          const ws = await workspaceContext.getWorkspaceBySlug(
            workspaceSlug as string
          );
          setWorkspace(ws);

          if (ws) {
            const projects = await projectApi.getProjectsByWorkspace(ws.id);
            const proj = projects.find((p: any) => p.slug === projectSlug);
            setProject(proj || null);
          }
        } else {
          // Public flow - get project directly
          const proj = await projectApi.getProjectBySlug(
            projectSlug as string,
            false, // isAuthenticated = false
            workspaceSlug as string
          );
          setProject(proj);
        }
      } catch (error) {
        console.error("Error fetching project data:", error);
        setProject(null);
      }
    };
    fetchData();
  }, [workspaceSlug, projectSlug, projectApi, project]);

  // Check user access for authenticated users
  useEffect(() => {
    if (!project?.id) return;

    const isAuth = isAuthenticated();
    if (isAuth) {
      getUserAccess({ name: "project", id: project.id })
        .then((data) => {
          setHasAccess(data?.canChange || false);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
          setHasAccess(false);
        });
    } else {
      // Public users have no edit access
      setHasAccess(false);
    }
  }, [project?.id]);

  const loadTasks = useCallback(async () => {
    if (!sprintId) return;

    setLocalError(null);
    const isAuth = isAuthenticated();

    try {
      const params = {
        ...(project?.id && { projectId: project.id }),
        ...(project?.workspaceId && { workspaceId: project.workspaceId }),
        sprintId: sprintId as string,
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
      console.log("isAuth Params", isAuth);
      if (isAuth && currentOrganizationId) {
        // Authenticated flow
        await getAllTasks(currentOrganizationId, params);
      } else {
        // Public flow - use public task API
        if (workspaceSlug && projectSlug) {
          await getPublicProjectTasks(
            workspaceSlug as string,
            projectSlug as string,
            params
          );
        }
      }
      const uniqueStatuses = Array.from(
        new Map(
          tasks
            .map((task) => task.status)
            .filter((status) => status && status.id)
            .map((status) => [status.id, status])
        ).values()
      );
      setAvailableStatuses(uniqueStatuses);
    } catch (err: any) {
      setLocalError(err?.message || "Failed to fetch tasks");
    }
  }, [
    sprintId,
    currentOrganizationId,
    project?.id,
    project?.workspaceId,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
    tasks,
    workspaceSlug,
    projectSlug,
  ]);

  const loadKanbanData = useCallback(
    async (
      projSlug: string,
      sprintId: string,
      statusId?: string,
      page: number = 1
    ) => {
      if (!isAuth) return;

      try {
        const response = await getTaskKanbanStatus({
          slug: projSlug,
          sprintId: sprintId,
          includeSubtasks: true,
          ...(statusId && { statusId, page }),
        });

        if (page === 1 || !statusId) {
          // Initial load or full refresh - replace all data
          setKanban(response.data || []);
        } else {
          // Load more for specific status - append tasks
          setKanban((prevKanban) => {
            return prevKanban.map((status) => {
              if (status.statusId === statusId) {
                const newStatusData = response.data.find(
                  (s) => s.statusId === statusId
                );
                if (newStatusData) {
                  return {
                    ...status,
                    tasks: [...status.tasks, ...newStatusData.tasks], // Append new tasks
                    pagination: newStatusData.pagination, // Update pagination info
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
      }
    },
    [getTaskKanbanStatus, isAuth]
  );

  const handleLoadMoreKanbanTasks = useCallback(
    async (statusId: string, page: number) => {
      console.log("Loading more tasks for status:", statusId, "page:", page); // Debug log
      await loadKanbanData(
        projectSlug as string,
        sprintId as string,
        statusId,
        page
      );
    },
    [loadKanbanData, projectSlug]
  );

  const loadGanttData = useCallback(async () => {
    if (!sprintId) return;
    const isAuth = isAuthenticated();

    try {
      const params = {
        ...(project?.id && { projectId: project.id }),
        ...(project?.workspaceId && { workspaceId: project.workspaceId }),
        sprintId: sprintId as string,
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

      if (isAuth && currentOrganizationId) {
        await getCalendarTask(currentOrganizationId, params);
      } else {
        console.warn("Gantt view not available for public access");
      }
    } catch (err) {
      console.error("Failed to load Gantt data", err);
    }
  }, [
    sprintId,
    currentOrganizationId,
    project?.id,
    project?.workspaceId,
    currentPage,
    pageSize,
    debouncedSearchQuery,
    selectedStatuses,
    selectedPriorities,
  ]);

  useEffect(() => {
    if (!project?.id || membersLoaded) return;
    const isAuth = isAuthenticated();

    const fetchMembers = async () => {
      try {
        if (isAuth) {
          // Only load members for authenticated users
          const members = await projectApi.getProjectMembers(project.id);
          setProjectMembers(members || []);
        } else {
          // Public users don't need member data
          setProjectMembers([]);
        }
        setMembersLoaded(true);
      } catch (error) {
        setProjectMembers([]);
        setMembersLoaded(true);
      }
    };
    fetchMembers();
  }, [project?.id, membersLoaded, projectApi]);

  useEffect(() => {
    if (!project?.id || statusesLoaded) return;
    const isAuth = isAuthenticated();

    const fetchStatuses = async () => {
      try {
        if (isAuth) {
          // Load full task statuses for authenticated users
          const statuses = await projectApi.getTaskStatusByProject(project.id);
          setAvailableTaskStatuses(statuses || []);
        } else {
          // Public users get basic statuses from task data
          setAvailableTaskStatuses([]);
        }
        setStatusesLoaded(true);
      } catch (error) {
        setAvailableTaskStatuses([]);
        setStatusesLoaded(true);
      }
    };
    fetchStatuses();
  }, [project?.id, statusesLoaded, projectApi]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (currentView === "kanban") {
      loadKanbanData(projectSlug as string, sprintId as string);
    }
    if (currentView === "gantt") {
      loadGanttData();
    }
    if (currentView === "list") {
      loadTasks();
    }
  }, [currentView]);

  const toggleProject = useCallback((id: string) => {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setCurrentPage(1);
  }, []);

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

  const clearAllFilters = useCallback(() => {
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setCurrentPage(1);
  }, []);

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

  const totalActiveFilters =
    selectedProjects.length +
    selectedStatuses.length +
    selectedPriorities.length;

  const filterSections = useMemo(
    () => [
      createSection({
        id: "status",
        title: "Status",
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
        title: "Priority",
        icon: Flame,
        data: priorityFilters,
        selectedIds: selectedPriorities,
        searchable: false,
        onToggle: togglePriority,
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
      toggleStatus,
      togglePriority,
    ]
  );

  // Callback to refetch tasks after creation
  const handleTaskRefetch = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

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

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Sorting logic for tasks (client-side sorting of server results)
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (
        ["createdAt", "updatedAt", "completedAt", "timeline"].includes(
          sortField
        )
      ) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
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

  const renderContent = () => {
    if (isLoading) {
      return <TaskTableSkeleton />;
    }

    if (error) {
      return <div className="text-red-500 py-8">{error}</div>;
    }

    if (tasks?.length === 0) {
      return (
        <EmptyState
          searchQuery={debouncedSearchQuery}
          priorityFilter={selectedPriorities.length > 0 ? "filtered" : "all"}
        />
      );
    }

    if (!isAuth) {
      // Only show list view for public users
      return (
        <TaskListView
          tasks={sortedTasks}
          columns={columns}
          projectSlug={projectSlug as string}
          projectMembers={projectMembers}
          addTaskStatuses={availableTaskStatuses}
          onTaskRefetch={handleTaskRefetch}
          showAddTaskRow={false}
        />
      );
    }
    switch (currentView) {
      case "kanban":
        return kanban?.length ? (
          <div>
            <KanbanBoard
              kanbanData={kanban}
              projectId={project?.id || ""}
              onRefresh={() =>
                loadKanbanData(projectSlug as string, sprintId as string)
              }
              onLoadMore={handleLoadMoreKanbanTasks}
              kabBanSettingModal={kabBanSettingModal}
              setKabBanSettingModal={setKabBanSettingModal}
              workspaceSlug={workspaceSlug as string}
              projectSlug={projectSlug as string}
              onKanbanUpdate={setKanban}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No workflow found. Create workflow statuses to use the Kanban
              view.
            </p>
          </div>
        );
      case "gantt":
        return (
          <TaskGanttView
            tasks={tasks}
            workspaceSlug={tasks[0]?.project?.workspace?.slug || ""}
            projectSlug={tasks[0]?.project?.slug || ""}
            viewMode={ganttViewMode}
            onViewModeChange={setGanttViewMode}
          />
        );
      default:
        return (
          <TaskListView
            tasks={sortedTasks}
            columns={columns}
            projectSlug={projectSlug as string}
            projectMembers={projectMembers}
            addTaskStatuses={availableTaskStatuses}
            onTaskRefetch={handleTaskRefetch}
            showAddTaskRow={false}
          />
        );
    }
  };

  return (
    <div className="dashboard-container h-[86vh] flex flex-col space-y-3">
      {/* Sticky PageHeader */}
      <div className="sticky top-0 z-50">
        <PageHeader
          title="Sprint Tasks"
          description={`Manage and track all tasks in this sprint. ${pagination.totalCount} total tasks`}
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <HiXMark size={16} />
                    </button>
                  )}
                </div>
                {currentView === "list" && isAuth && (
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
            </div>
          }
        />
      </div>

      {/* Sticky TabView */}
      <div className="sticky top-[64px] z-40 bg-background">
        <TabView
          currentView={currentView}
          onViewChange={(v) => setCurrentView(v)}
          viewKanban={isAuth}
          viewGantt={isAuth}
          rightContent={
            <>
              {currentView === "gantt" && isAuth && (
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
              {currentView === "kanban" && isAuthenticated() && hasAccess && (
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto rounded-md">{renderContent()}</div>

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
};

export default SprintTasksTable;
