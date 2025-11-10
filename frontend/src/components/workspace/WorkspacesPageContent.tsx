import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import ActionButton from "@/components/common/ActionButton";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { EntityCard } from "@/components/common/EntityCard";
import { EmptyState } from "@/components/ui";
import { HiUsers, HiFolder, HiSearch } from "react-icons/hi";
import { HiViewGrid } from "react-icons/hi";
import ErrorState from "@/components/common/ErrorState";
import NewWorkspaceDialog from "@/components/workspace/NewWorkspaceDialogProps";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { HiXMark } from "react-icons/hi2";
import { CardsSkeleton } from "../skeletons/CardsSkeleton";

interface WorkspacesPageContentProps {
  organizationId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function WorkspacesPageContent({ organizationId }: WorkspacesPageContentProps) {
  const {
    workspaces,
    isLoading,
    error,
    currentWorkspace,
    getWorkspacesByOrganization,
    clearError,
    getCurrentOrganizationId,
  } = useWorkspaceContext();
  const { getUserAccess } = useAuth();

  // State management
  const [hasAccess, setHasAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const currentOrganization = organizationId || getCurrentOrganizationId();
  const fetchData = useCallback(
    async (searchTerm?: string) => {
      if (!currentOrganization) {
        toast.error("No organization selected. Please select an organization first.");
        return;
      }

      try {
        await getWorkspacesByOrganization(currentOrganization, searchTerm);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            toast.error("Authentication required. Please log in again.");
          } else {
            toast.error(`Failed to load workspaces: ${error.message}`);
          }
        } else {
          toast.error("Failed to load workspaces");
        }
      }
    },
    [currentOrganization, getWorkspacesByOrganization]
  );

  useEffect(() => {
    const trimmedSearch = debouncedSearchQuery.trim();
    fetchData(trimmedSearch || undefined);
  }, [debouncedSearchQuery]);

  // Enhanced retry function
  const retryFetch = useCallback(() => {
    clearError();
    fetchData(searchQuery.trim() || undefined);
  }, [clearError, searchQuery]);

  const didFetchRef = useRef(false);
  useEffect(() => {
    if (currentOrganization && !didFetchRef.current) {
      didFetchRef.current = true;
      fetchData();
    }
    if (!currentOrganization) return;

    getUserAccess({ name: "organization", id: currentOrganization })
      .then((data) => {
        setHasAccess(data?.canChange || false);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
        setHasAccess(false);
      });
  }, [currentOrganization]);

  // Search change handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleWorkspaceCreated = useCallback(async () => {
    try {
      await fetchData(searchQuery.trim() || undefined);
      toast.success("Workspace created successfully!");
    } catch (error) {
      console.error("Error refreshing workspaces after creation:", error);
      toast.error("Workspace created but failed to refresh list. Please refresh the page.");
    }
  }, [searchQuery]);
  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  if (isLoading) {
    return <CardsSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={retryFetch} />;
  }

  return (
    <div className="dashboard-container">
      <div className="space-y-6 text-md">
        <PageHeader
          icon={<HiViewGrid className="size-5" />}
          title="Workspaces"
          description="Manage your workspaces efficiently and collaborate with your team."
          actions={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-xs w-full">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] z-10" />
                <Input
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 pr-10 rounded-md border border-[var(--border)]"
                />

                {isLoading && searchQuery && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                    <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                  </div>
                )}

                {searchQuery && !isLoading && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                  >
                    <HiXMark size={16} />
                  </button>
                )}
              </div>

              {hasAccess && (
                <NewWorkspaceDialog
                  open={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  onWorkspaceCreated={handleWorkspaceCreated}
                  refetchWorkspaces={handleWorkspaceCreated}
                >
                  <ActionButton primary showPlusIcon onClick={() => setIsDialogOpen(true)}>
                    New Workspace
                  </ActionButton>
                </NewWorkspaceDialog>
              )}
            </div>
          }
        />
        {workspaces.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={<HiSearch size={24} />}
              title="No workspaces found"
              description={`No workspaces match "${searchQuery}". Try different search terms.`}
              action={<ActionButton onClick={clearSearch}>Clear Search</ActionButton>}
            />
          ) : (
            <EmptyState
              icon={<HiFolder size={24} />}
              title="No workspaces found"
              description={
                hasAccess
                  ? "Create your first workspace to get started with organizing your projects and collaborating with your team."
                  : "No workspaces available. Contact your organization admin to create workspaces or get access."
              }
              action={
                hasAccess && (
                  <ActionButton primary showPlusIcon onClick={() => setIsDialogOpen(true)}>
                    Create Workspace
                  </ActionButton>
                )
              }
            />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
            {workspaces.map((ws) => (
              <EntityCard
                key={ws.id}
                href={`/${ws.slug}`}
                leading={
                  <div className="w-10 h-10 rounded-md bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-semibold">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                }
                heading={ws.name}
                subheading={ws.slug}
                description={ws.description}
                footer={
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <HiFolder size={12} />
                      {ws._count?.projects ?? ws.projectCount ?? 0} projects
                    </span>
                    <span className="flex items-center gap-1">
                      <HiUsers size={12} />
                      {ws._count?.members ?? ws.memberCount ?? 0} members
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full min-h-[48px] flex items-center justify-center pb-4 pointer-events-none">
            <p className="text-sm text-[var(--muted-foreground)] pointer-events-auto">
              Showing {workspaces.length} workspace
              {workspaces.length !== 1 ? "s" : ""}
              {searchQuery && ` matching "${searchQuery}"`}
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="ml-2 text-[var(--primary)] hover:underline"
                >
                  Clear search
                </button>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
