import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjectContext } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import ProjectAvatar from "@/components/ui/avatars/ProjectAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { EntityCard } from "@/components/common/EntityCard";
import ActionButton from "@/components/common/ActionButton";
import { HiFolder, HiClipboardDocumentList, HiCalendarDays, HiXMark } from "react-icons/hi2";
import { HiSearch, HiChevronDown, HiViewBoards } from "react-icons/hi";
import { DynamicBadge } from "@/components/common/DynamicBadge";
import { NewProjectModal } from "@/components/projects/NewProjectModal";
import { availableStatuses, availablePriorities } from "@/utils/data/projectFilters";
import { FilterDropdown, useGenericFilters } from "@/components/common/FilterDropdown";
import { CheckSquare, Flame } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import { EmptyState } from "@/components/ui";

import { toast } from "sonner";
import Tooltip from "../common/ToolTip";
import { CardsSkeleton } from "../skeletons/CardsSkeleton";
import { useRouter } from "next/router";

interface ProjectsContentProps {
  contextType: "workspace" | "organization";
  contextId: string;
  workspaceSlug?: string;
  title: string;
  description: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  enablePagination?: boolean;
  generateProjectLink: (project: any, workspaceSlug?: string) => string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "Unknown";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown";
  }
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

const ProjectsContent: React.FC<ProjectsContentProps> = ({
  contextType,
  contextId,
  workspaceSlug,
  title,
  description,
  emptyStateTitle,
  emptyStateDescription,
  enablePagination = false,
  generateProjectLink,
}) => {
  const { isAuthenticated, getUserAccess } = useAuth();
  const { getWorkspaceBySlug } = useWorkspaceContext();
  const router = useRouter();
  const {
    projects,
    error,
    isLoading,
    getProjectsByWorkspace,
    getProjectsByOrganization,
    refreshProjects,
    clearError,
  } = useProjectContext();

  const [hasAccess, setHasAccess] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [hasMore, setHasMore] = useState(false);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string>("");
  const currentContextRef = useRef<string>("");
  const isInitializedRef = useRef(false);

  const debouncedSearchQuery = useDebounce(searchInput, 500);

  const { createSection } = useGenericFilters();

  const showLoader = isInitialLoad || (isFetching && projects.length === 0);
  const showContent = !showLoader && !error;

  // Project icon component
  const ProjectLeadingIcon = ({ project }: { project: any }) => {
    const hasImage = project.avatar || project.image || project.logo || project.icon;

    if (hasImage) {
      return (
        <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-transparent">
          <ProjectAvatar
            project={project}
            size="md"
            className="w-full h-full object-cover rounded-sm"
          />
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-md bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-semibold flex-shrink-0">
        {project.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const formatStatus = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "Active";
      case "PLANNING":
        return "Planning";
      case "ON_HOLD":
        return "On Hold";
      case "COMPLETED":
        return "Completed";
      default:
        return "Active";
    }
  };

  // Filter functions
  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const togglePriority = useCallback((id: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSearchInput("");
    setCurrentPage(1);
  }, []);

  // Filter data preparation - always use context projects
  const statusFilters = useMemo(
    () =>
      availableStatuses.map((status) => ({
        id: status.id,
        name: status.name,
        value: status.value,
        selected: selectedStatuses.includes(status.value),
        count: projects.filter((project) => project.status === status.value).length,
        color: status.color,
        icon: status.icon,
      })),
    [availableStatuses, selectedStatuses, projects]
  );

  const priorityFilters = useMemo(
    () =>
      availablePriorities.map((priority) => ({
        id: priority.id,
        name: priority.name,
        value: priority.value,
        selected: selectedPriorities.includes(priority.value),
        count: projects.filter((project) => project.priority === priority.value).length,
        color: priority.color,
        icon: priority.icon,
      })),
    [availablePriorities, selectedPriorities, projects]
  );

  const filterSections = useMemo(
    () => [
      createSection({
        id: "status",
        title: "Status",
        icon: CheckSquare,
        data: statusFilters,
        selectedIds: selectedStatuses,
        allowSelectAll: false,
        searchable: false,
        multiSelect: true,
        onToggle: toggleStatus,
        onSelectAll: () => setSelectedStatuses(statusFilters.map((s) => s.value)),
        onClearAll: () => setSelectedStatuses([]),
      }),
      createSection({
        id: "priority",
        title: "Priority",
        icon: Flame,
        data: priorityFilters,
        selectedIds: selectedPriorities,
        searchable: false,
        multiSelect: true,
        allowSelectAll: false,
        onToggle: togglePriority,
        onSelectAll: () => setSelectedPriorities(priorityFilters.map((p) => p.value)),
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

  // Data fetching function
  const fetchData = useCallback(
    async (page: number = 1, resetData: boolean = true) => {
      const contextKey = `${contextType}/${contextId}`;
      const requestId = `${contextKey}-${Date.now()}-${Math.random()}`;

      if (!contextId || !isAuthenticated()) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      requestIdRef.current = requestId;
      currentContextRef.current = contextKey;

      if (resetData || page === 1) {
        setIsFetching(true);
        if (!isInitializedRef.current) {
          setIsInitialLoad(true);
        }
      }

      try {
        const filters = {
          ...(selectedStatuses.length > 0 && {
            status: selectedStatuses.join(","),
          }),
          ...(selectedPriorities.length > 0 && {
            priority: selectedPriorities.join(","),
          }),
          ...(debouncedSearchQuery.trim() && {
            search: debouncedSearchQuery.trim(),
          }),
          ...(enablePagination && {
            page,
            pageSize,
          }),
        };

        let projectsData: any[] = [];

        if (contextType === "workspace") {
          // For workspace context, get workspace first if needed
          if (!workspace) {
            const workspaceData = await getWorkspaceBySlug(contextId);

            if (requestIdRef.current !== requestId || !isMountedRef.current) {
              return;
            }

            if (!workspaceData) {
              throw new Error("Workspace not found");
            }

            setWorkspace(workspaceData);

            // Call workspace projects API with filters
            projectsData = await getProjectsByWorkspace(workspaceData.id, filters);
          } else {
            // Call workspace projects API with filters
            projectsData = await getProjectsByWorkspace(workspace.id, filters);
          }
        } else if (contextType === "organization") {
          projectsData = await getProjectsByOrganization(contextId, filters);
        }

        if (requestIdRef.current !== requestId || !isMountedRef.current) {
          return;
        }

        // Handle pagination
        if (enablePagination) {
          setHasMore(projectsData.length === pageSize);
          setCurrentPage(page);
        }

        isInitializedRef.current = true;
      } catch (error: any) {
        if (requestIdRef.current === requestId && isMountedRef.current) {
          if (error.status === 403) {
            toast.error(error?.message || "User not authenticated");
            router.back();
            return;
          }
          if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            toast.error("Authentication required. Please log in again.");
          } else {
            toast.error(
              `Failed to load ${
                contextType === "workspace" ? "workspace" : "organization"
              } projects`
            );
          }
        }
      } finally {
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setIsFetching(false);
          setIsInitialLoad(false);
        }
      }
    },
    [
      contextType,
      contextId,
      isAuthenticated,
      selectedStatuses,
      selectedPriorities,
      debouncedSearchQuery,
      enablePagination,
      pageSize,
    ]
  );

  // Check user access
  useEffect(() => {
    if (contextId) {
      const accessType = contextType === "workspace" ? "workspace" : "organization";
      const accessId = contextType === "workspace" && workspace ? workspace.id : contextId;

      if (contextType === "workspace" && !workspace) return;

      getUserAccess({ name: accessType, id: accessId })
        .then((data) => {
          setHasAccess(data?.canChange);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [contextId, contextType, workspace]);

  // Single effect for data loading and changes
  useEffect(() => {
    const contextKey = `${contextType}/${contextId}`;

    // Handle context changes
    if (currentContextRef.current !== contextKey) {
      isInitializedRef.current = false;
      setIsInitialLoad(true);
      setWorkspace(null);
      setSelectedStatuses([]);
      setSelectedPriorities([]);
      setSearchInput("");
      setCurrentPage(1);
      currentContextRef.current = contextKey;
    }

    if (contextId) {
      const timeoutId = setTimeout(
        () => {
          fetchData(1, true);
        },
        isInitializedRef.current ? 0 : 50
      );

      return () => clearTimeout(timeoutId);
    }
  }, [contextId, contextType, selectedStatuses, selectedPriorities, debouncedSearchQuery]);

  // Effect for pagination
  useEffect(() => {
    if (enablePagination && currentPage > 1 && !isInitialLoad) {
      fetchData(currentPage, false);
    }
  }, [currentPage, enablePagination, isInitialLoad]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      isInitializedRef.current = false;
      currentContextRef.current = "";
      requestIdRef.current = "";

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Event handlers
  const retryFetch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    clearError();
    isInitializedRef.current = false;
    currentContextRef.current = "";
    requestIdRef.current = "";
    setIsInitialLoad(true);
    setWorkspace(null);
    setCurrentPage(1);

    fetchData(1, true);
  }, [clearError]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  };

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setCurrentPage(1);
  }, []);

  const handleProjectCreated = useCallback(async () => {
    try {
      await refreshProjects();
      await fetchData(1, true);
      toast.success("Project created successfully!");
    } catch (error) {
      console.error("Error refreshing projects after creation:", error);
      toast.error("Project created but failed to refresh list");
    }
  }, [refreshProjects]);

  const loadMore = () => {
    if (hasMore && !isFetching && enablePagination) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const totalActiveFilters = selectedStatuses.length + selectedPriorities.length;

  if (error) {
    return <ErrorState error={error} onRetry={retryFetch} />;
  }

  if (showLoader) {
    return <CardsSkeleton />;
  }

  const displayTitle =
    contextType === "workspace" && workspace ? `${workspace.name} Projects` : title;

  return (
    <div className="dashboard-container">
      <div className="space-y-6 text-md">
        <PageHeader
          icon={<HiViewBoards className="size-20px" />}
          title={displayTitle}
          description={description}
          actions={
            <>
              {/* Responsive search/filter row for mobile */}
              <div className="flex flex-col gap-2 w-full md:flex-row md:items-center md:gap-4">
                <div className="flex flex-row gap-2 w-full">
                  <div className="relative flex-1 min-w-0">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                    <Input
                      type="text"
                      placeholder="Search projects..."
                      value={searchInput}
                      onChange={handleSearchChange}
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
                    {isFetching && searchInput && (
                      <div className="absolute right-8 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Tooltip content="Advanced Filters" position="top" color="primary">
                      <FilterDropdown
                        sections={filterSections}
                        title="Advanced Filters"
                        activeFiltersCount={totalActiveFilters}
                        onClearAllFilters={clearAllFilters}
                        placeholder="Filter projects..."
                        dropdownWidth="w-56"
                        showApplyButton={false}
                      />
                    </Tooltip>
                  </div>
                </div>
                {/* Create Project button for mobile (below search/filter row) */}
                {hasAccess && (
                  <div className="block md:hidden w-full">
                    <ActionButton
                      primary
                      showPlusIcon
                      onClick={() => setIsNewProjectModalOpen(true)}
                      className="w-full"
                    >
                      Create Project
                    </ActionButton>
                  </div>
                )}
              </div>
              {/* Create Project button for desktop (inline with search/filter) */}
              {hasAccess && (
                <div className="hidden md:block">
                  <ActionButton primary showPlusIcon onClick={() => setIsNewProjectModalOpen(true)}>
                    Create Project
                  </ActionButton>
                </div>
              )}
            </>
          }
        />

        <NewProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
          workspaceSlug={contextType === "workspace" ? workspaceSlug : undefined}
          onProjectCreated={handleProjectCreated}
          initialData={contextType === "organization" ? { organizationId: contextId } : undefined}
        />

        {/* Content Area */}
        {showContent && (
          <>
            {/* Projects Grid */}
            {projects.length === 0 ? (
              searchInput || totalActiveFilters > 0 ? (
                <EmptyState
                  icon={<HiSearch size={24} />}
                  title="No projects found"
                  description={`No projects match your current search${
                    totalActiveFilters > 0 ? " and filters" : ""
                  }. Try adjusting your criteria.`}
                  action={
                    <ActionButton primary onClick={clearAllFilters}>
                      Clear Filters
                    </ActionButton>
                  }
                />
              ) : (
                <EmptyState
                  icon={<HiFolder size={24} />}
                  title={emptyStateTitle}
                  description={emptyStateDescription}
                  action={
                    hasAccess && (
                      <ActionButton
                        primary
                        showPlusIcon
                        onClick={() => setIsNewProjectModalOpen(true)}
                      >
                        Create Project
                      </ActionButton>
                    )
                  }
                />
              )
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
                  {projects.map((project) => {
                    const statusText = formatStatus(project.status);

                    return (
                      <EntityCard
                        key={project.id}
                        href={generateProjectLink(project, workspaceSlug)}
                        leading={
                          <div className="w-10 h-10 flex items-center justify-center text-[var(--primary-foreground)] font-semibold">
                            <ProjectLeadingIcon project={project} />
                          </div>
                        }
                        heading={project.name}
                        subheading={project.key || project.slug}
                        description={project.description}
                        footer={
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                              <Tooltip content="Number of Tasks" position="top" color="primary">
                                <span className="flex items-center gap-1">
                                  <HiClipboardDocumentList size={12} />
                                  {project._count?.tasks || 0}
                                </span>
                              </Tooltip>
                              <Tooltip content="Start Date" position="top" color="primary">
                                <span className="flex items-center gap-1">
                                  <HiCalendarDays size={12} />
                                  {formatDate(project.updatedAt)}
                                </span>
                              </Tooltip>
                            </div>
                            <DynamicBadge label={statusText} size="sm" />
                          </div>
                        }
                      />
                    );
                  })}
                </div>

                {/* Load More Button (for pagination) */}
                {enablePagination && hasMore && (
                  <div className="flex justify-center">
                    <Button
                      onClick={loadMore}
                      disabled={isFetching}
                      variant="outline"
                      className="group relative min-w-[140px] h-10 border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] transition-all duration-200 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        {isFetching ? (
                          <>
                            <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <span>Load More</span>
                            <HiChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                          </>
                        )}
                      </div>
                    </Button>
                  </div>
                )}

                {/* Footer Counter */}
                {projects.length > 0 && (
                  <div className="fixed bottom-0 left-[50%] md:left-[55%] -translate-x-1/2 w-full min-h-[48px] flex items-center justify-center pb-4 pointer-events-none">
                    <p className="text-sm text-[var(--muted-foreground)] pointer-events-auto">
                      Showing {projects.length} project
                      {projects.length !== 1 ? "s" : ""}
                      {searchInput && ` matching "${searchInput}"`}
                      {totalActiveFilters > 0 &&
                        ` with ${totalActiveFilters} filter${
                          totalActiveFilters !== 1 ? "s" : ""
                        } applied`}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectsContent;
