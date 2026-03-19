import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import ActionButton from "@/components/common/ActionButton";
import { Button } from "@/components/ui/button";
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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("workspaces");
  const {
    workspaces,
    isLoading,
    error,
    currentWorkspace,
    getWorkspacesByOrganization,
    clearError,
    getCurrentOrganizationId,
    getArchivedWorkspaces,
    unarchiveWorkspace,
  } = useWorkspaceContext();
  const { getUserAccess } = useAuth();

  // State management
  const [hasAccess, setHasAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [archivedWorkspaces, setArchivedWorkspaces] = useState<any[]>([]);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const currentOrganization = organizationId || getCurrentOrganizationId();
  const fetchData = useCallback(
    async (searchTerm?: string) => {
      if (!currentOrganization) {
        toast.error(t("messages.no_org_selected"));
        return;
      }

      try {
        await getWorkspacesByOrganization(currentOrganization, searchTerm);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            toast.error(t("messages.auth_required"));
          } else {
            toast.error(`${t("messages.load_failed")}: ${error.message}`);
          }
        } else {
          toast.error(t("messages.load_failed"));
        }
      }
    },
    [currentOrganization, getWorkspacesByOrganization, t]
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
        const canChange = data?.canChange || false;
        setHasAccess(canChange);
        if (canChange && currentOrganization) {
          getArchivedWorkspaces(currentOrganization)
            .then((archived) => setArchivedWorkspaces(archived || []))
            .catch(() => { });
        }
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
      toast.success(t("messages.created_success"));
    } catch (error) {
      console.error("Error refreshing workspaces after creation:", error);
      toast.error(t("messages.refresh_failed"));
    }
  }, [searchQuery, t]);
  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  if (error) {
    return <ErrorState error={error} onRetry={retryFetch} />;
  }

  return (
    <div className="dashboard-container">
      <div className="space-y-6 text-md">
        <PageHeader
          icon={<HiViewGrid className="size-5" />}
          title={t("title")}
          description={t("description")}
          actions={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-xs w-full">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] z-10" />
                <Input
                  type="text"
                  placeholder={t("search_placeholder")}
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
                    {t("new_workspace")}
                  </ActionButton>
                </NewWorkspaceDialog>
              )}
            </div>
          }
        />

        {isLoading ? (
          <CardsSkeleton />
        ) : workspaces.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={<HiSearch size={24} />}
              title={t("no_workspaces_found")}
              description={t("no_workspaces_match", { query: searchQuery })}
              action={<ActionButton onClick={clearSearch}>{t("clear_search")}</ActionButton>}
            />
          ) : (
            <EmptyState
              icon={<HiFolder size={24} />}
              title={t("no_workspaces_found")}
              description={
                hasAccess
                  ? t("empty_state_description_admin")
                  : t("empty_state_description_member")
              }
              action={
                hasAccess && (
                  <ActionButton primary showPlusIcon onClick={() => setIsDialogOpen(true)}>
                    {t("create_workspace")}
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
                      {t("projects_count", { count: ws._count?.projects ?? ws.projectCount ?? 0 })}
                    </span>
                    <span className="flex items-center gap-1">
                      <HiUsers size={12} />
                      {t("members_count", { count: ws._count?.members ?? ws.memberCount ?? 0 })}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {hasAccess && archivedWorkspaces.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">
              {t("archived_workspaces", "Archived Workspaces")}
            </h3>
            <div className="space-y-3">
              {archivedWorkspaces.map((ws: any) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30"
                >
                  <div>
                    <p className="font-medium text-sm">{ws.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{ws.slug}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unarchiving === ws.id}
                    onClick={async () => {
                      try {
                        setUnarchiving(ws.id);
                        const result = await unarchiveWorkspace(ws.id);
                        if (result.success) {
                          setArchivedWorkspaces((prev) =>
                            prev.filter((w: any) => w.id !== ws.id)
                          );
                          toast.success(t("unarchive_success", "Workspace unarchived successfully"));
                          await fetchData();
                        }
                      } catch (err) {
                        console.error("Unarchive error:", err);
                        toast.error(t("unarchive_failed", "Failed to unarchive workspace"));
                      } finally {
                        setUnarchiving(null);
                      }
                    }}
                  >
                    {unarchiving === ws.id
                      ? t("unarchiving", "Unarchiving...")
                      : t("unarchive", "Unarchive")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full min-h-[48px] flex items-center justify-center pb-4 pointer-events-none">
            <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] pointer-events-auto">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t("showing_workspaces", { count: workspaces.length })}
                  {searchQuery && t("matching", { query: searchQuery })}
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {t("clear_search")}
                    </button>
                  )}
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
