import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import { HiPlus, HiInformationCircle } from "react-icons/hi2";
import { HiCog, HiSparkles } from "react-icons/hi";
import { Button } from "@/components/ui/button";
import { Organization } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
import Loader from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";
import { EntityCard } from "@/components/common/EntityCard";
import Link from "next/link";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import OrganizationFormModal from "@/components/organizations/OrganizationFormModal";
import { ChartNoAxesGantt, Users } from "lucide-react";


const getManageUrl = (organization: Organization) => {
  const canManage =
    organization.isOwner || organization.userRole === "SUPER_ADMIN";
  return canManage ? `/settings/${organization.slug}` : undefined;
};

function OrganizationSettingsPageContent() {
  const { getCurrentOrganizationId } = useWorkspaceContext();
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const { getUserOrganizations } = useOrganization();
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
      setError(
        err instanceof Error ? err.message : "Failed to fetch organizations"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentOrganization) return;
    getUserAccess({ name: "organization", id: currentOrganization })
      .then((data) => {
        setHasAccess(data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [currentOrganization]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleOrganizationCreated = async (organization: Organization) => {
    setOrganizations((prev) => [...prev, organization]);
    setShowCreateForm(false);
    await fetchOrganizations();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center ">
        <Loader text="Fetching all project..." />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {organizations.map((organization) => (
              <EntityCard
                key={organization.id}
                leading={
                  <div className="w-10 h-10 rounded-md bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-semibold">
                    {organization.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                }
                heading={organization.name}
                subheading={organization.slug}
                description={organization.description}
                role={organization?.userRole}
                footer={
                  <div className="flex items-center justify-between w-full pt-2">
                    <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <ChartNoAxesGantt className="h-4 w-4" />
                          {organization._count?.workspaces || 0} workspaces
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span>{organization._count?.members || 0} members</span>
                      </span>
                    </div>

                    <div className="flex items-center">
                      {(organization.isOwner ||
                        organization.userRole === "SUPER_ADMIN") && (
                        <Link
                          href={getManageUrl(organization)}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-medium transition-colors border border-[var(--primary)]/20 hover:border-[var(--primary)]/30"
                          title="Manage Organization"
                        >
                          <HiCog className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="rounded-[var(--card-radius)] border-0 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
              <HiInformationCircle className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                About Organizations
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Organizations are your top-level containers for workspaces,
                projects, and teams. Switch between organizations using the
                selector in the header to work with different groups or
                companies. Only owners and administrators can manage
                organization settings.
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
