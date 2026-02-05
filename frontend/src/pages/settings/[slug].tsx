import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import { HiArrowLeft, HiCog, HiUsers, HiExclamationTriangle } from "react-icons/hi2";
import { HiViewGrid, HiOfficeBuilding } from "react-icons/hi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import OrganizationSettingsComponent from "@/components/organizations/OrganizationSettings";
import OrganizationMembers from "@/components/organizations/OrganizationMembers";
import WorkflowManager from "@/components/workflows/WorkflowManager";
import { Organization, OrganizationMember, OrganizationRole } from "@/types/organizations";
import { Workflow } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
import ErrorState from "@/components/common/ErrorState";
import { ChartNoAxesGantt } from "lucide-react";
import PendingInvitations, { PendingInvitationsRef } from "@/components/common/PendingInvitations";
import OrganizationManageSkeleton from "@/components/skeletons/OrganizationManageSkeleton";
import Pagination from "@/components/common/Pagination";
import { useTranslation } from "react-i18next";

// Define the access structure type
interface UserAccess {
  isElevated: boolean;
  role: string;
  canChange: boolean;
  userId: string;
  scopeId: string;
  scopeType: string;
  isSuperAdmin: boolean;
}

const AccessDenied = ({ onBack, t }: { onBack: () => void; t: any }) => (
  <div className="flex min-h-screen bg-[var(--background)]">
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm max-w-md mx-auto">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                <HiExclamationTriangle className="w-5 h-5 text-[var(--muted-foreground)]" />
              </div>
              <h3 className="text-md font-semibold text-[var(--foreground)] mb-2">
                {t("organization_details.access_denied_title")}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                {t("organization_details.access_denied_desc")}
              </p>
              <Button
                onClick={onBack}
                className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2 mx-auto"
              >
                <HiArrowLeft className="w-4 h-4" />
                {t("organization_details.back_to_organizations")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

function OrganizationManagePageContent() {
  const { t } = useTranslation("settings");
  const router = useRouter();
  const { slug } = router.query;

  const {
    getOrganizationBySlug,
    getOrganizationMembers,
    getOrganizationWorkFlows,
    isLoading: orgLoading,
  } = useOrganization();
  const { getUserAccess } = useAuth();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "members" | "workflows">("settings");

  useEffect(() => {
    if (router.isReady && router.query.tab) {
      const tabParam = router.query.tab;
      const tab = (Array.isArray(tabParam) ? tabParam[0] : tabParam).toLowerCase();
      if (["settings", "members", "workflows"].includes(tab)) {
        setActiveTab(tab as "settings" | "members" | "workflows");
      }
    }
  }, [router.isReady, router.query.tab]);

  const pendingInvitationsRef = useRef<PendingInvitationsRef>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  // Helper to check if user has access
  const hasManagementAccess = userAccess?.canChange || false;
  const [searchQuery, setSearchQuery] = useState("");
  // Add this state to your component
  const [roleCounts, setRoleCounts] = useState<{
    OWNER: number;
    MANAGER: number;
    MEMBER: number;
    VIEWER: number;
  }>({
    OWNER: 0,
    MANAGER: 0,
    MEMBER: 0,
    VIEWER: 0,
  });

  const loadWorkflows = async (organizationSlug?: string) => {
    const slugToUse = organizationSlug || slug;
    if (!slugToUse || typeof slugToUse !== "string" || !hasManagementAccess) return;
    try {
      setWorkflowLoading(true);
      setWorkflowError(null);
      const workflowData = await getOrganizationWorkFlows(slugToUse);
      if (!workflowData) {
        setWorkflows([]);
        return;
      }
      if (!Array.isArray(workflowData)) {
        setWorkflowError(t("organization_details.workflow_management.failed_to_load"));
        setWorkflows([]);
        return;
      }
      const validatedWorkflows = workflowData.map((workflow) => ({
        ...workflow,
        statuses: Array.isArray(workflow?.statuses) ? workflow.statuses : [],
        _count: workflow?._count || {
          statuses: workflow?.statuses?.length || 0,
          transitions: 0,
          tasks: 0,
        },
      }));
      setWorkflows(validatedWorkflows);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("organization_details.workflow_management.failed_to_load");
      setWorkflowError(errorMessage);
      setWorkflows([]);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const loadData = async (organizationSlug?: string) => {
    const slugToUse = organizationSlug || slug;
    try {
      setIsLoading(true);
      setError(null);

      if (!slugToUse || typeof slugToUse !== "string") {
        setError(t("organization_details.failed_to_load"));
        return;
      }

      const orgData = await getOrganizationBySlug(slugToUse);
      if (!orgData) {
        setError(t("organization_details.not_found"));
        return;
      }

      // Check access first
      const accessData = (await getUserAccess({
        name: "organization",
        id: orgData.id,
      })) as UserAccess;

      setUserAccess(accessData);

      // If no access, stop loading here
      if (!accessData?.canChange) {
        setOrganization(orgData);
        setIsLoading(false);
        return;
      }

      // Only load members and workflows if user has access
      const membersData = await getOrganizationMembers(slugToUse, currentPage, pageSize, searchQuery);

      setOrganization({
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        description: orgData.description,
        avatar: orgData.avatar,
        website: orgData.website,
        settings: orgData.settings,
        ownerId: orgData.ownerId,
        memberCount: Array.isArray(membersData) ? membersData.length : 0,
        workspaceCount: 0,
        createdAt: orgData.createdAt,
        updatedAt: orgData.updatedAt,
      });
      setMembers(membersData.data); // Set only current page data
      setTotalMembers(membersData.total); // Set total count
      setCurrentPage(membersData.page); // Set current page
      setRoleCounts(membersData.roleCounts);
      loadWorkflows(slugToUse);
    } catch (err) {
      setError("Failed to load organization data");
      setUserAccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (page: number = currentPage, search: string = searchQuery) => {
    if (!slug || typeof slug !== "string") return;

    try {
      const membersData = await getOrganizationMembers(
        slug,
        page,
        pageSize,
        search || undefined // Pass search query
      );

      setMembers(membersData.data);
      setTotalMembers(membersData.total);
      setCurrentPage(membersData.page || page);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };
  useEffect(() => {
    console.log("useEffect triggered, slug:", slug);
    if (slug && typeof slug === "string") {
      console.log("test call - loading data");
      loadData();
    }
  }, [slug]); // This will trigger when slug becomes available

  useEffect(() => {
    const timer = setTimeout(() => {
      if (slug && typeof slug === "string") {
        setCurrentPage(1);
        loadMembers(1, searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);
  const handleOrganizationUpdate = async (updatedOrganization: Organization) => {
    if (!hasManagementAccess) return;
    setOrganization(updatedOrganization);
    await loadData(updatedOrganization.slug);
  };

  const handleTabChange = async (value: string) => {
    if (!hasManagementAccess) return;
    setActiveTab(value as "settings" | "members" | "workflows");
    if (value === "workflows" && workflows.length === 0 && !workflowLoading && !workflowError) {
      await loadWorkflows();
    }
  };

  const handleWorkflowAction = {
    onCreate: () => {
      if (!hasManagementAccess) return;
      loadWorkflows();
    },
    onUpdate: (workflow: Workflow) => {
      if (!hasManagementAccess) return;
      setWorkflows((prev) => prev.map((w) => (w.id === workflow.id ? workflow : w)));
    },
    onDelete: (workflowId: string) => {
      if (!hasManagementAccess) return;
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    },
    onSetDefault: (workflowId: string) => {
      if (!hasManagementAccess) return;
      setWorkflows((prev) =>
        prev.map((w) => ({
          ...w,
          isDefault: w.id === workflowId,
        }))
      );
    },
  };

  const handleBackToOrganizations = () => {
    router.push("/settings");
  };

  // Get badge label based on access
  const getAccessBadgeLabel = () => {
    if (!userAccess) return "Member";
    if (userAccess.isSuperAdmin) return "Super Admin";
    if (userAccess.isElevated) return userAccess?.role || "Manager";
    return userAccess?.role || "Member";
  };

  const getAccessBadgeColor = () => {
    if (!userAccess) return "bg-[var(--muted)] text-[var(--muted-foreground)]";
    if (userAccess.isSuperAdmin) return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    if (userAccess.isElevated)
      return "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20";
    return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  };

  if (isLoading) {
    return <OrganizationManageSkeleton />;
  }

  if (error || !organization) {
    return (
      <ErrorState
        error={error || t("organization_details.not_found")}
        onRetry={error?.includes("Failed") ? loadData : undefined}
      />
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasManagementAccess) {
    return <AccessDenied onBack={handleBackToOrganizations} t={t} />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto p-4 space-y-4">
        <PageHeader
          icon={<HiOfficeBuilding className="w-5 h-5" />}
          title={organization.name}
          description={t("organization_details.description")}
        />

        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardContent className="p-4">
            {/* Mobile Layout (< md) */}
            <div className="block md:hidden space-y-3">
              {/* Row 1: Avatar + Name */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-semibold flex-shrink-0">
                  {organization.avatar ? (
                    <Image
                      src={organization.avatar}
                      alt={organization.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    organization.name?.charAt(0)?.toUpperCase() || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-md font-semibold text-[var(--foreground)] mb-1">
                    {organization.name}
                  </h2>
                  {organization.description && (
                    <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                      {organization.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Role Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("organization_details.your_role")}
                </span>
                <Badge
                  className={`${getAccessBadgeColor()} text-xs px-2 py-1 rounded-md border-none`}
                >
                  {getAccessBadgeLabel()}
                </Badge>
              </div>
            </div>

            {/* Desktop Layout (>= md) - EXACT ORIGINAL */}
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-semibold flex-shrink-0">
                {organization.avatar ? (
                  <Image
                    src={organization.avatar}
                    alt={organization.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  organization.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-md font-semibold text-[var(--foreground)] mb-1">
                  {organization.name}
                </h2>
                {organization.description && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {organization.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("organization_details.your_role")}
                </span>
                <Badge
                  className={`${getAccessBadgeColor()} text-xs px-2 py-1 rounded-md border-none`}
                >
                  {getAccessBadgeLabel()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="">
          <div className="border-b border-[var(--border)]">
            <TabsList className="relative grid w-full grid-cols-3 bg-transparent p-0 h-auto">
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-[var(--primary)] transition-all duration-300 ease-in-out"
                style={{
                  width: "33.33%",
                  transform: `translateX(${
                    activeTab === "settings" ? "0%" : activeTab === "workflows" ? "100%" : "200%"
                  })`,
                }}
              />

              <TabsTrigger
                value="settings"
                data-automation-id="org-settings-tab"
                aria-label="Organization Settings Tab"
                onClick={() => handleTabChange("settings")}
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none shadow-none cursor-pointer"
              >
                <HiCog className="w-4 h-4" />
                <span className="hidden sm:inline">{t("organization_details.tabs.settings")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="workflows"
                data-automation-id="org-workflows-tab"
                aria-label="Organization Workflows Tab"
                onClick={() => handleTabChange("workflows")}
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none cursor-pointer"
              >
                <HiViewGrid className="w-4 h-4" />
                <span className="hidden sm:inline">{t("organization_details.tabs.workflows")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="members"
                data-automation-id="org-members-tab"
                aria-label="Organization Members Tab"
                onClick={() => handleTabChange("members")}
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none cursor-pointer"
              >
                <HiUsers className="w-4 h-4" />
                <span className="hidden sm:inline">{t("organization_details.tabs.members")}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <OrganizationSettingsComponent
                organization={organization}
                onUpdate={handleOrganizationUpdate}
              />
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-4 mt-4">
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ChartNoAxesGantt className="w-5 h-5 text-[var(--primary)]" />
                  <CardTitle className="text-md font-semibold text-[var(--foreground)]">
                    {t("organization_details.workflow_management.title")}
                  </CardTitle>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("organization_details.workflow_management.description")}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                {workflowError ? (
                  <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HiExclamationTriangle className="w-4 h-4 text-[var(--destructive)] flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-[var(--destructive)] mb-1">
                            {t("organization_details.workflow_management.failed_to_load")}
                          </h4>
                          <p className="text-sm text-[var(--destructive)]/80">{workflowError}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadWorkflows()}
                        className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
                      >
                        {t("common.retry")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <WorkflowManager
                    workflows={workflows}
                    isLoading={workflowLoading}
                    error={workflowError}
                    onCreateWorkflow={handleWorkflowAction.onCreate}
                    onUpdateWorkflow={handleWorkflowAction.onUpdate}
                    onDeleteWorkflow={handleWorkflowAction.onDelete}
                    onSetDefaultWorkflow={handleWorkflowAction.onSetDefault}
                    isProjectLevel={false}
                    organizationId={organization.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Members List - Takes most space */}
              <div className="lg:col-span-2">
                <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                  <OrganizationMembers
                    organizationId={organization.id}
                    members={members}
                    currentUserRole={
                      (userAccess?.role as OrganizationRole.MANAGER) ||
                      ("MEMBER" as OrganizationRole.MANAGER)
                    }
                    onMembersChange={loadData}
                    organization={organization}
                    pendingInvitationsRef={pendingInvitationsRef}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                  <div className="px-4">
                    <Pagination
                      pagination={{
                        currentPage: currentPage,
                        totalPages: Math.ceil(totalMembers / pageSize),
                        totalCount: totalMembers,
                        hasNextPage: currentPage * pageSize < totalMembers,
                        hasPrevPage: currentPage > 1,
                      }}
                      pageSize={pageSize}
                      onPageChange={async (page) => {
                        setCurrentPage(page);
                        const membersData = await getOrganizationMembers(
                          slug as string,
                          page,
                          pageSize
                        );
                        setMembers(membersData.data);
                      }}
                      onPageSizeChange={async (newPageSize) => {
                        setCurrentPage(1);
                        const membersData = await getOrganizationMembers(
                          slug as string,
                          1,
                          newPageSize
                        );
                        setPageSize(newPageSize);
                        setMembers(membersData.data);
                      }}
                    />
                  </div>
                </Card>
              </div>

              {/* Organization Info Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                {/* Organization Info Card */}
                <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <HiOfficeBuilding className="w-5 h-5 text-[var(--muted-foreground)]" />
                      {t("organization_details.info_title")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {organization?.name || t("organization_details.not_found")}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {organization?.description || t("organization_details.info_desc")}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                        <span>{t("organization_management.members")}:</span>
                        <span className="font-medium text-[var(--foreground)]">{totalMembers}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                        <span>{t("organization_details.slug")}</span>
                        <span className="font-medium text-[var(--foreground)] font-mono">
                          {organization?.slug || "N/A"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Member Roles Summary */}
                {/* Member Roles Summary */}
                <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <HiCog className="w-5 h-5 text-[var(--muted-foreground)]" />
                      {t("organization_details.role_distribution")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {[
                        { name: "OWNER", variant: "default" },
                        { name: "MANAGER", variant: "success" },
                        { name: "MEMBER", variant: "info" },
                        { name: "VIEWER", variant: "secondary" },
                      ].map((role) => {
                        const count = roleCounts[role.name as keyof typeof roleCounts]; // Use roleCounts state
                        return (
                          <div
                            key={role.name}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-[var(--muted-foreground)]">{role.name}</span>
                            <Badge
                              variant={role.variant as any}
                              className="h-5 px-2 text-xs border-none bg-[var(--primary)]/10 text-[var(--primary)]"
                            >
                              {count}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Pending Invitations */}
                {hasManagementAccess && (
                  <PendingInvitations
                    ref={pendingInvitationsRef}
                    entity={organization}
                    entityType="organization"
                    members={members}
                  />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function OrganizationManagePage() {
  return <OrganizationManagePageContent />;
}
