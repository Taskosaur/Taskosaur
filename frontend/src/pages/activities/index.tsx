import { useOrganization } from "@/contexts/organization-context";
import {
  HiClock,
  HiClipboardDocumentCheck,
  HiDocumentText,
  HiUserPlus,
  HiCheckCircle,
  HiUser,
  HiXMark,
  HiCalendar,
} from "react-icons/hi2";
import { SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { ActivityFeedPanel } from "@/components/activity/ActivityFeedPanel";
import { ActivityFilters, ActivityItem, ActivityResponse } from "@/types";
import Tooltip from "@/components/common/ToolTip";
import ErrorState from "@/components/common/ErrorState";

type EntityTypeFilter = "Task" | "Project" | "Workspace" | "Organization" | "User" | "all";

// Simple Next/Previous Pagination Component
interface ActivityPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function ActivityPagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: ActivityPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
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

function ActivityPageContent() {
  const [activeFilter, setActiveFilter] = useState<EntityTypeFilter>("all");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ActivityResponse["pagination"] | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState("");

  const { user } = useAuth();
  const { getOrganizationRecentActivity, clearError } = useOrganization();

  useEffect(() => {
    const currentOrgId = localStorage.getItem("currentOrganizationId");
    if (currentOrgId) {
      setCurrentOrgId(currentOrgId);
    }
  }, []);

  const filterOptions = [
    {
      value: "all" as EntityTypeFilter,
      label: "All Activity",
      icon: HiClock,
      color: "text-[var(--muted-foreground)]",
    },
    {
      value: "Task" as EntityTypeFilter,
      label: "Tasks",
      icon: HiClipboardDocumentCheck,
      color: "text-blue-600",
    },
    {
      value: "Project" as EntityTypeFilter,
      label: "Projects",
      icon: HiDocumentText,
      color: "text-green-600",
    },
    {
      value: "Workspace" as EntityTypeFilter,
      label: "Workspaces",
      icon: HiUserPlus,
      color: "text-purple-600",
    },
    {
      value: "User" as EntityTypeFilter,
      label: "Users",
      icon: HiUser,
      color: "text-orange-600",
    },
  ];

  const currentFilter = filterOptions.find((f) => f.value === activeFilter) || filterOptions[0];

  const loadActivities = async (
    page: number = 1,
    entityTypeFilter: EntityTypeFilter = activeFilter
  ) => {
    if (!currentOrgId) return;

    try {
      setIsLoadingActivity(true);
      setActivityError(null);
      const filters: ActivityFilters = {
        limit: 20,
        page: page,
        userId: user?.id,
      };

      if (entityTypeFilter !== "all") {
        filters.entityType = entityTypeFilter;
      }

      const response: ActivityResponse = await getOrganizationRecentActivity(currentOrgId, filters);
      setActivities(response.activities);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Error loading organization activities:", error);
      setActivityError(error?.message ? error.message : "Failed to load activities");
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (currentOrgId && user?.id) {
      loadActivities(1, activeFilter);
    }
  }, [currentOrgId, user?.id, activeFilter]);

  const handleFilterChange = async (newFilter: EntityTypeFilter) => {
    setActiveFilter(newFilter);
    await loadActivities(1, newFilter);
  };

  const handleRefreshActivities = async () => {
    if (currentOrgId) {
      try {
        clearError();
        await loadActivities(pagination?.currentPage || 1, activeFilter);
      } catch (error) {
        console.error("Error refreshing activities:", error);
        setActivityError(error?.message ? error.message : "Failed to refresh activities");
      }
    }
  };

  const handlePageChange = async (page: number) => {
    if (page !== pagination?.currentPage) {
      await loadActivities(page, activeFilter);
    }
  };

  if (activityError) {
    return <ErrorState error={activityError} onRetry={handleRefreshActivities} />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4">
      <div className="">
        <div className="flex flex-col gap-4">
          <PageHeader
            icon={<HiCalendar className="w-5 h-5" />}
            title="Activity Feed"
            description="Manage and track all your activities in one place."
            actions={
              <div className="flex items-center gap-2">
                {activeFilter !== "all" && (
                  <Badge
                    variant="secondary"
                    className="bg-[var(--primary)]/10 text-[var(--primary)] border-none"
                  >
                    <currentFilter.icon className="w-3 h-3 mr-1" />
                    <span className="text-xs">{currentFilter.label}</span>
                    <button
                      onClick={() => handleFilterChange("all")}
                      className="ml-1 hover:bg-[var(--primary)]/20 rounded-sm p-0.5"
                      aria-label="Clear filter"
                    >
                      <HiXMark className="w-3 h-3" />
                    </button>
                  </Badge>
                )}

                <DropdownMenu>
                  <Tooltip content="Filter activities" position="top" color="primary">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative border-none bg-[var(--accent)] hover:bg-[var(--accent)]/80"
                        aria-label="Filter activities"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        {activeFilter !== "all" && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--primary)] rounded-full" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </Tooltip>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 p-0 bg-[var(--card)] border border-[var(--border)]"
                  >
                    <div className="p-2 border-b border-[var(--border)]">
                      <DropdownMenuLabel className="text-sm font-medium text-[var(--foreground)]">
                        Filter by Type
                      </DropdownMenuLabel>
                    </div>
                    <div className="p-1">
                      {filterOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = activeFilter === option.value;
                        return (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() => handleFilterChange(option.value)}
                            className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-[var(--accent)]"
                          >
                            <Icon
                              className={`w-4 h-4 ${
                                isActive ? option.color : "text-[var(--muted-foreground)]"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                isActive
                                  ? "text-[var(--foreground)] font-medium"
                                  : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {option.label}
                            </span>
                            {isActive && (
                              <HiCheckCircle className="w-4 h-4 text-[var(--primary)] ml-auto" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                      {activeFilter !== "all" && (
                        <>
                          <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />
                          <DropdownMenuItem
                            onClick={() => handleFilterChange("all")}
                            className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-[var(--accent)]"
                          >
                            <HiXMark className="w-4 h-4 text-[var(--muted-foreground)]" />
                            <span className="text-sm text-[var(--muted-foreground)]">
                              Clear Filter
                            </span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />

          <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
            <ActivityFeedPanel
              title="Recent Activity"
              activities={activities}
              isLoading={isLoadingActivity}
              error={activityError}
              onRetry={handleRefreshActivities}
              onClearFilter={activeFilter !== "all" ? () => handleFilterChange("all") : undefined}
            />

            {/* Simple Next/Previous Pagination */}
            {pagination && (
              <div className="border-t border-[var(--border)]">
                <ActivityPagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                  isLoading={isLoadingActivity}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  return <ActivityPageContent />;
}
