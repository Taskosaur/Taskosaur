import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import { HiPlus, HiInformationCircle } from "react-icons/hi2";
import { HiCog } from "react-icons/hi";
import { Button } from "@/components/ui/button";
import { Organization } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { EntityCard } from "@/components/common/EntityCard";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import OrganizationFormModal from "@/components/organizations/OrganizationFormModal";
import { ChartNoAxesGantt, Star, Users } from "lucide-react";
import Tooltip from "@/components/common/ToolTip";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui";
import { toast } from "sonner";
import { CardsSkeleton } from "@/components/skeletons/CardsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function OrganizationSettingsPageContent() {
  const router = useRouter();
  const { getCurrentOrganizationId } = useWorkspaceContext();
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const { getUserOrganizations, isLoading: orgLoading, setDefaultOrganization } = useOrganization();
  const { getCurrentUser } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = getCurrentUser();

  const currentOrganization = getCurrentOrganizationId();

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!currentUser?.id) {
        setError("User not authenticated");
        return;
      }

      const data = await getUserOrganizations(currentUser.id);
      const organizationsArray = Array.isArray(data) ? data : [];
      setOrganizations(organizationsArray);
    } catch (err) {
      console.error("Error fetching organizations:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch organizations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentOrganization) return;
    getUserAccess({ name: "organization", id: currentOrganization })
      .then((data) => {
        setHasAccess(data?.canChange || (data.role !== "MEMBER" && data.role !== "VIEWER"));
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [currentOrganization]);

  useEffect(() => {
    fetchOrganizations();
  }, []);
  const canAccess = (organization: Organization) => {
    if (organization.userRole === "MEMBER" || organization.userRole === "VIEWER") {
      return false;
    }
    return true;
  };
  const handleOrganizationCreated = async (organization: Organization) => {
    setOrganizations((prev) => [...prev, organization]);
    setShowCreateForm(false);
    await fetchOrganizations();
  };

  const handleSetDefaultOrganization = async (organizationId: string) => {
    try {
      const updatedMember = await setDefaultOrganization(organizationId);
      await fetchOrganizations();
      toast.success("Default organization updated successfully");
    } catch (error) {
      console.error("Failed to set default organization:", error);
      toast.error("Failed to set default organization. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div>
        <CardsSkeleton />
        <div className="rounded-[var(--card-radius)] border-0 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-11/12 rounded" />
                <Skeleton className="h-3 w-10/12 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchOrganizations} />;
  }

  return (
    <div className="dashboard-container">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={<HiCog className="w-5 h-5" />}
          title="Organization Management"
          description="Manage your organizations and switch between different tenants"
          actions={
            !showCreateForm &&
            hasAccess && (
              <div className="flex items-center gap-2">
                {/* Create Organization Button */}
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="h-9 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-all duration-200 font-medium flex items-center gap-2 rounded-lg shadow-none border-none"
                >
                  <HiPlus className="w-4 h-4" />
                  Create Organization
                </Button>
              </div>
            )
          }
        />

        {/* Create Organization Form */}
        {showCreateForm && (
          <OrganizationFormModal
            showCreateForm={showCreateForm}
            setShowCreateForm={setShowCreateForm}
            onSuccess={handleOrganizationCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Organizations List */}
        {organizations.length === 0 ? (
          <div className="bg-[var(--card)] rounded-[var(--card-radius)] border border-[var(--border)] p-8">
            <EmptyState />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {organizations.map((organization) => {
              const access = canAccess(organization);
              return (
                <EntityCard
                  key={organization.id}
                  onClick={() => {
                    if (access) {
                      router.push(`/settings/${organization.slug}`);
                    }
                  }}
                  className={`${
                    hasAccess
                      ? "hover:border-[var(--primary)]/30 transition-colors duration-200"
                      : "cursor-default"
                  }`}
                  leading={
                    <div className="relative">
                      <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 flex items-center justify-center text-[var(--primary-foreground)] font-semibold text-sm">
                        {organization.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      {/* Default badge on avatar */}
                      {organization.isDefault && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center border-2 border-[var(--card)]">
                          <Star className="h-2.5 w-2.5 text-white fill-white" />
                        </div>
                      )}
                    </div>
                  }
                  heading={
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-semibold text-[var(--foreground)] truncate text-sm capitalize">
                        {organization.name}
                      </span>
                      {/* Set as Default Button - Always Visible */}
                      <Tooltip
                        content={
                          organization.isDefault
                            ? "Current default organization"
                            : "Set as default organization"
                        }
                        position="top"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!organization.isDefault) {
                              handleSetDefaultOrganization(organization.id);
                            }
                          }}
                          disabled={organization.isDefault}
                          aria-label={
                            organization.isDefault
                              ? "Current default organization"
                              : "Set as default organization"
                          }
                          className={cn(
                            "h-6 w-6 p-0 rounded-full transition-all duration-200 flex-shrink-0",
                            organization.isDefault
                              ? "text-green-600 dark:text-green-400 cursor-default bg-transparent hover:bg-transparent"
                              : "hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          )}
                        >
                          {!organization.isDefault && (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />
                          )}
                        </Button>
                      </Tooltip>
                    </div>
                  }
                  subheading={
                    <div className="flex items-center gap-2 flex-wrap ">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {organization.slug}
                      </span>
                      {organization?.userRole && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0 h-4 bg-[var(--accent)] text-[var(--accent-foreground)] border-none font-medium"
                        >
                          {organization.userRole}
                        </Badge>
                      )}
                    </div>
                  }
                  description={
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 h-10 capitalize">
                      {organization.description || "No description provided"}
                    </p>
                  }
                  footer={
                    <div className="flex flex-col gap-2 w-full pt-2 border-t border-[var(--border)]/50">
                      {/* Stats Row */}
                      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                        <span className="flex items-center gap-1 font-medium">
                          <ChartNoAxesGantt className="h-3.5 w-3.5 text-[var(--primary)]" />
                          <span className="text-[var(--foreground)]">
                            {organization._count?.workspaces || 0}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Users className="h-3.5 w-3.5 text-[var(--primary)]" />
                          <span className="text-[var(--foreground)]">
                            {organization._count?.members || 0}
                          </span>
                        </span>
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <div className="rounded-lg border border-[var(--border)]/50 bg-gradient-to-br from-[var(--card)] to-[var(--accent)]/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 flex items-center justify-center flex-shrink-0">
              <HiInformationCircle className="w-4 h-4 text-[var(--primary-foreground)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1.5">
                About Organizations
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Organizations are your top-level containers for workspaces, projects, and teams.
                Click the checkbox icon to set an organization as your default. Click on any
                organization card to manage its settings (requires owner or administrator
                permissions).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  return <OrganizationSettingsPageContent />;
}
