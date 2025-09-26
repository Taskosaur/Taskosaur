import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import {
  HiArrowLeft,
  HiCog,
  HiUsers,
  HiExclamationTriangle,
  HiSparkles,
} from "react-icons/hi2";
import { HiViewGrid, HiOfficeBuilding } from "react-icons/hi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import OrganizationSettingsComponent from "@/components/organizations/OrganizationSettings";
import OrganizationMembers from "@/components/organizations/OrganizationMembers";
import WorkflowManager from "@/components/workflows/WorkflowManager";
import AISettings from "@/components/settings/AISettings";
import {
  Organization,
  OrganizationMember,
  OrganizationRole,
} from "@/types/organizations";
import { Workflow } from "@/types";
import { PageHeader } from "@/components/common/PageHeader";
import Loader from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import { ChartNoAxesGantt } from "lucide-react";

const AccessDenied = ({ onBack }: { onBack: () => void }) => (
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
                Access Denied
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                You don't have permission to manage this organization. Only
                owners and administrators can access these settings.
              </p>
              <Button
                onClick={onBack}
                className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2"
              >
                <HiArrowLeft className="w-4 h-4" />
                Back to Organizations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

function OrganizationManagePageContent() {
  const router = useRouter();
  const { slug } = router.query;

  const {
    getOrganizationBySlug,
    getOrganizationMembers,
    getOrganizationWorkFlows,
    isLoading: orgLoading,
  } = useOrganization();
  const { getCurrentUser } = useAuth();

  const [organization, setOrganization] = useState<
    import("@/types/organizations").Organization | null
  >(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "settings" | "members" | "workflows" | "ai-chat"
  >("settings");

  const currentUser = getCurrentUser();

  const getCurrentUserRole = (): OrganizationRole => {
    if (!currentUser || !organization) return OrganizationRole.MEMBER;
    if (organization.ownerId === currentUser.id) {
      return OrganizationRole.OWNER;
    }
    const userMember = members.find(
      (member) => member.userId === currentUser.id
    );
    if (currentUser.role === "SUPER_ADMIN") {
      return OrganizationRole.SUPER_ADMIN;
    }
    return userMember?.role || OrganizationRole.MEMBER;
  };

  const loadWorkflows = async () => {
    if (!slug || typeof slug !== "string") return;
    try {
      setWorkflowLoading(true);
      setWorkflowError(null);
      const workflowData = await getOrganizationWorkFlows(slug);
      if (!workflowData) {
        setWorkflows([]);
        return;
      }
      if (!Array.isArray(workflowData)) {
        setWorkflowError("Invalid workflow data format received from server");
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
        err instanceof Error ? err.message : "Failed to load workflows";
      setWorkflowError(errorMessage);
      setWorkflows([]);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!currentUser?.id) {
        setError("User not authenticated");
        return;
      }
      if (!slug || typeof slug !== "string") {
        setError("Invalid organization slug");
        return;
      }
      const orgData = await getOrganizationBySlug(slug);
      if (!orgData) {
        setError("Organization not found");
        return;
      }
      const membersData = await getOrganizationMembers(slug);
      // Ensure orgData has memberCount and workspaceCount
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
      setMembers(membersData);
      loadWorkflows();
    } catch (err) {
      setError("Failed to load organization data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug && currentUser && typeof slug === "string") {
      loadData();
    }
  }, [slug]);

  const handleOrganizationUpdate = async (
    updatedOrganization: Organization
  ) => {
    setOrganization(updatedOrganization);
    await loadData();
  };

  const handleTabChange = async (value: string) => {
    setActiveTab(value as "settings" | "members" | "workflows" | "ai-chat");
    if (
      value === "workflows" &&
      workflows.length === 0 &&
      !workflowLoading &&
      !workflowError
    ) {
      await loadWorkflows();
    }
  };

  const handleWorkflowAction = {
    onCreate: () => {
      loadWorkflows();
    },
    onUpdate: (workflow: Workflow) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? workflow : w))
      );
    },
    onDelete: (workflowId: string) => {
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    },
    onSetDefault: (workflowId: string) => {
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

  const getRoleBadgeColor = (role: OrganizationRole) => {
    switch (role) {
      case OrganizationRole.SUPER_ADMIN:
        return "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20";
      default:
        return "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
    }
  };

  if (isLoading || orgLoading) {
    return <Loader text="fetching your organization details" />;
  }

  if (error || !organization) {
    return (
      <ErrorState
        error={error || "Organization not found"}
        onRetry={error?.includes("Failed") ? loadData : undefined}
      />
    );
  }

  const canManage =
    getCurrentUserRole() === OrganizationRole.SUPER_ADMIN ||
    organization.ownerId === currentUser?.id;
  if (!canManage) {
    return <AccessDenied onBack={handleBackToOrganizations} />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto p-4 space-y-4">
        <PageHeader
          icon={<HiOfficeBuilding className="w-5 h-5" />}
          title={organization.name}
          description="Manage organization settings, members, and workflows"
        />

        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
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
                  Your Role:
                </span>
                <Badge
                  className={`text-xs px-2 py-1 rounded-md border-none ${getRoleBadgeColor(
                    getCurrentUserRole()
                  )}`}
                >
                  {getCurrentUserRole() === "SUPER_ADMIN"
                    ? "SUPER ADMIN"
                    : getCurrentUserRole()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <div className="border-b border-[var(--border)]">
            <TabsList className="relative grid w-full grid-cols-4 bg-transparent p-0 h-auto">
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-[var(--primary)] transition-all duration-300 ease-in-out"
                style={{
                  width: "25%", // 1/4 of the width
                  transform: `translateX(${
                    activeTab === "settings"
                      ? "0%"
                      : activeTab === "workflows"
                      ? "100%"
                      : activeTab === "members"
                      ? "200%"
                      : "300%"
                  })`,
                }}
              />

              <TabsTrigger
                value="settings"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none shadow-none cursor-pointer"
              >
                <HiCog className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
              <TabsTrigger
                value="workflows"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none cursor-pointer"
              >
                <HiViewGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Workflows</span>
                {workflowLoading && (
                  <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-transparent data-[state=active]:text-[var(--primary)] hover:text-[var(--foreground)] transition-colors bg-transparent rounded-none cursor-pointer"
              >
                <HiUsers className="w-4 h-4" />
                <span className="hidden sm:inline">Members</span>
                <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)] border-none text-xs ml-1">
                  {members.length}
                </Badge>
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
                    Workflow Management
                  </CardTitle>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Configure task statuses and workflow transitions for your
                  organization. These workflows will be used as templates for
                  new projects.
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
                            Failed to load workflows
                          </h4>
                          <p className="text-sm text-[var(--destructive)]/80">
                            {workflowError}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadWorkflows}
                        className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
                      >
                        Retry
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
            <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
              <OrganizationMembers
                organizationId={organization.id}
                members={members}
                currentUserRole={getCurrentUserRole()}
                onMembersChange={loadData}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function OrganizationManagePage() {
  return <OrganizationManagePageContent />;
}
