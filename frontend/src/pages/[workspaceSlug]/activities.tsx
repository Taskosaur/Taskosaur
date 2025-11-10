import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/DropdownMenu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import {
  HiClock,
  HiDocumentText,
  HiChatBubbleLeft,
  HiClipboardDocumentCheck,
  HiUserPlus,
  HiCheckCircle,
  HiXMark,
} from "react-icons/hi2";
import { SlidersHorizontal } from "lucide-react";
import { ActivityFeedPanel } from "@/components/activity/ActivityFeedPanel";
import { PageHeader } from "@/components/common/PageHeader";

import { ActivityLog, Workspace } from "@/types";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Tooltip from "@/components/common/ToolTip";
import { InfoPanel } from "@/components/common/InfoPanel";
import { toast } from "sonner";

interface WorkspacePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function WorkspacePagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: WorkspacePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4 border-t border-[var(--border)]">
      <div className="text-sm text-[var(--muted-foreground)]">
        Page {currentPage} of {totalPages}
      </div>

      <Pagination>
        <PaginationContent>
          {/* Previous Button */}
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1 && !isLoading) {
                  onPageChange(currentPage - 1);
                }
              }}
              className={`${
                currentPage === 1 || isLoading
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer hover:bg-[var(--accent)]"
              }`}
            />
          </PaginationItem>

          {/* Next Button */}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages && !isLoading) {
                  onPageChange(currentPage + 1);
                }
              }}
              className={`${
                currentPage === totalPages || isLoading
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer hover:bg-[var(--accent)]"
              }`}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function WorkspaceActivityContent() {
  const router = useRouter();
  const { workspaceSlug } = router.query;
  const { getWorkspaceBySlug, getWorkspaceRecentActivity } = useWorkspace();
  const { isAuthenticated } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | ActivityLog["type"]>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const fetchingRef = useRef(false);
  const currentSlugRef = useRef<string>("");

  const filterOptions = [
    {
      value: "all",
      label: "All Activity",
      icon: HiClock,
      color: "bg-gray-500/10 text-gray-700",
    },
    {
      value: "comment",
      label: "Comments",
      icon: HiChatBubbleLeft,
      color: "bg-blue-500/10 text-blue-700",
    },
    {
      value: "task",
      label: "Tasks",
      icon: HiClipboardDocumentCheck,
      color: "bg-green-500/10 text-green-700",
    },
    {
      value: "status",
      label: "Status Changes",
      icon: HiDocumentText,
      color: "bg-orange-500/10 text-orange-700",
    },
    {
      value: "assignment",
      label: "Assignments",
      icon: HiUserPlus,
      color: "bg-purple-500/10 text-purple-700",
    },
  ];

  const currentFilter = filterOptions.find((f) => f.value === activityFilter) || filterOptions[0];

  const fetchData = useCallback(
    async (page: number = 1) => {
      if (fetchingRef.current && currentSlugRef.current === workspaceSlug && page === currentPage) {
        return;
      }

      fetchingRef.current = true;
      currentSlugRef.current = workspaceSlug as string;

      setIsLoadingActivity(true);
      setError(null);

      try {
        if (!isAuthenticated()) {
          router.push("/login");
          fetchingRef.current = false;
          return;
        }

        let ws = workspace;
        if (!ws) {
          setIsLoading(true);
          ws = await getWorkspaceBySlug(workspaceSlug as string);
          if (!ws) {
            setError("Workspace not found");
            setIsLoading(false);
            fetchingRef.current = false;
            return;
          }
          setWorkspace(ws);
          setIsLoading(false);
        }

        let entityType: string | undefined = undefined;
        if (activityFilter !== "all") {
          entityType = activityFilter.charAt(0).toUpperCase() + activityFilter.slice(1);
        }

        const recentActivityResponse = await getWorkspaceRecentActivity(ws.id, {
          limit: 20,
          page: page,
          entityType,
        });

        const mappedActivities: ActivityLog[] = recentActivityResponse.activities.map(
          (item: any) => ({
            id: item.id,
            user: item.user
              ? {
                  id: item.user.id || "unknown",
                  name: item.user.name || "Unknown User",
                  email: item.user.email || "unknown@example.com",
                  avatar: item.user.avatar || undefined,
                }
              : {
                  id: "unknown",
                  name: "Unknown User",
                  email: "unknown@example.com",
                },
            action: item.action,
            target: item.description,
            project: undefined,
            time: new Date(item.createdAt).toLocaleString(),
            comment: item.metadata?.comment || undefined,
            type: item.entityType?.toLowerCase() as ActivityLog["type"],
            description: item.description,
            entityType: item.entityType,
            entityId: item.entityId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })
        );

        setActivities(mappedActivities);
        if (recentActivityResponse.pagination) {
          setCurrentPage(recentActivityResponse.pagination.currentPage);
          setTotalPages(recentActivityResponse.pagination.totalPages);
        }
      } catch (e) {
        if (e.status === 403) {
          toast.error(e?.message || "User not authenticated");
          router.back();
          return;
        }
        setError(e?.message ? e.message : "Failed to load workspace activity");
      } finally {
        setIsLoading(false);
        setIsLoadingActivity(false);
        fetchingRef.current = false;
      }
    },
    [
      workspaceSlug,
      getWorkspaceBySlug,
      getWorkspaceRecentActivity,
      isAuthenticated,
      router,
      activityFilter,
      workspace,
      currentPage,
    ]
  );

  // Handle filter changes - reset to page 1
  const handleFilterChange = async (newFilter: "all" | ActivityLog["type"]) => {
    setActivityFilter(newFilter);
    setCurrentPage(1);
    fetchingRef.current = false; // Allow new fetch
    await fetchData(1);
  };

  // Handle page changes
  const handlePageChange = async (page: number) => {
    if (page !== currentPage) {
      await fetchData(page);
    }
  };

  useEffect(() => {
    if (!workspaceSlug) return;

    // Reset when slug changes
    if (currentSlugRef.current !== workspaceSlug) {
      fetchingRef.current = false;
      currentSlugRef.current = "";
      setWorkspace(null);
      setActivities([]);
      setCurrentPage(1);
      setTotalPages(1);
    }

    fetchData();
  }, [workspaceSlug]);

  // Filter activities with frontend filtering (optional, since you can filter from backend too)
  const filteredActivities = activities.filter((activity) => {
    if (activityFilter === "all") return true;
    return activity.type === activityFilter;
  });

  if (isLoading) {
    return (
      <InfoPanel title={"Workspace Activity"} subtitle={""}>
        <div className="activity-loading-container">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="activity-loading-item">
              <div className="activity-loading-avatar" />
              <div className="activity-loading-content">
                <div className="activity-loading-title" />
                <div className="activity-loading-subtitle" />
              </div>
            </div>
          ))}
        </div>
      </InfoPanel>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => fetchData()} />;
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <EmptyState searchQuery="Workspace not found" priorityFilter="all" />
      </div>
    );
  }

  return (
    <div className="dashboard-container flex flex-col gap-6">
      {/* Header (Modern Compact UI) */}
      <PageHeader
        title="Activity Feed"
        description={`Recent activity and updates in the "${workspace.name}" workspace`}
        actions={
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            {/* Active-filter badge */}
            {activityFilter !== "all" && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                <Badge
                  variant="secondary"
                  className={`flex items-center gap-2 px-3 py-1.5 ${currentFilter.color} border border-current/20 hover:bg-current/20 transition-all duration-200`}
                >
                  <currentFilter.icon className="w-3 h-3" />
                  <span className="text-xs font-medium">{currentFilter.label}</span>
                  <button
                    onClick={() => handleFilterChange("all")}
                    className="ml-1 hover:bg-current/20 rounded-full p-0.5 transition-colors"
                    aria-label="Clear filter"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}

            {/* Filter dropdown trigger */}
            <DropdownMenu>
              <Tooltip content="Filter activities" position="top" color="primary">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-9 h-9 p-0 border-[var(--border)] hover:bg-[var(--accent)] hover:border-[var(--primary)]/50 transition-all duration-200 relative"
                    aria-label="Filter activities"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activityFilter !== "all" && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </Tooltip>

              <DropdownMenuContent
                align="end"
                className="w-56 border-[var(--border)] bg-[var(--background)]"
              >
                <DropdownMenuLabel className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-3 py-2">
                  Filter Activity
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border)]" />

                {filterOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = activityFilter === option.value;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleFilterChange(option.value as ActivityLog["type"])}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
                          : "hover:bg-[var(--accent)]/50"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                          isActive ? option.color : "bg-[var(--muted)]/30"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="flex-1">{option.label}</span>
                      {isActive && (
                        <HiCheckCircle className="w-4 h-4 text-[var(--primary)] animate-in zoom-in-50 duration-200" />
                      )}
                    </DropdownMenuItem>
                  );
                })}

                {activityFilter !== "all" && (
                  <>
                    <DropdownMenuSeparator className="bg-[var(--border)]" />
                    <DropdownMenuItem
                      onClick={() => handleFilterChange("all")}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--accent)]/50 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all duration-200"
                    >
                      <HiXMark className="w-4 h-4" />
                      <span>Clear Filter</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Activity Feed with Pagination */}
      <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
        <ActivityFeedPanel
          title="Workspace Activity"
          activities={filteredActivities}
          isLoading={isLoadingActivity}
          error={error}
          onRetry={() => fetchData(currentPage)}
          onClearFilter={activityFilter !== "all" ? () => handleFilterChange("all") : undefined}
          emptyMessage={
            activityFilter === "all"
              ? "No activity yet"
              : `No ${currentFilter.label.toLowerCase()} found`
          }
        />

        {/* Pagination Controls */}
        <WorkspacePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoadingActivity}
        />
      </div>
    </div>
  );
}

export default function WorkspaceActivityPage() {
  return <WorkspaceActivityContent />;
}
