import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DangerZoneModal from "@/components/common/DangerZoneModal";
import { HiExclamationTriangle, HiCog, HiEnvelope } from "react-icons/hi2";
import { PageHeader } from "@/components/common/PageHeader";
import EmailIntegrationSettings from "@/components/inbox/EmailIntegrationSettings";
import EmailRulesManager from "@/components/inbox/EmailRulesManager";
import { Select } from "@/components/ui";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cog } from "lucide-react";
import { IoWarning } from "react-icons/io5";
import ActionButton from "@/components/common/ActionButton";
import ErrorState from "@/components/common/ErrorState";

// Helper function to validate internal paths and prevent open redirect vulnerabilities
function isValidInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  // Ensure the path starts with / and doesn't contain protocol or domain
  if (!path.startsWith('/')) return false;
  if (path.includes('://') || path.startsWith('//')) return false;
  return true;
}

// Helper function to sanitize slug inputs before URL construction
function sanitizeSlug(slug: string | string[] | undefined): string {
  if (!slug || typeof slug !== 'string') return '';
  // Allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return '';
  return slug;
}

function ProjectSettingsContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const { getProjectsByWorkspace, updateProject, deleteProject, archiveProject } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const { isAuthenticated, getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "ACTIVE",
    visibility: "PRIVATE",
  });

  const retryFetch = () => {
    toast.info("Refreshing project data...");
    const fetchProject = async () => {
      if (!workspaceSlug || !projectSlug || !isAuthenticated()) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(workspaceSlug as string);
        if (!workspaceData) {
          setError("Workspace not found");
          setLoading(false);
          return;
        }

        const workspaceProjects = await getProjectsByWorkspace(workspaceData.id);
        const projectData = workspaceProjects.find((p) => p.slug === projectSlug);

        if (!projectData) {
          setError("Project not found");
          setLoading(false);
          return;
        }

        setProject(projectData);
        setFormData({
          name: projectData.name || "",
          description: projectData.description || "",
          status: projectData.status || "ACTIVE",
          visibility: projectData.visibility || "PRIVATE",
        });
      } catch (err) {
        setError(err?.message ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  };
  useEffect(() => {
    if (!project?.id) return;
    getUserAccess({ name: "project", id: project?.id })
      .then((data) => {
        setHasAccess(data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [project]);

  const dangerZoneActions = [
    {
      name: "archive",
      type: "archive" as const,
      label: "Archive Project",
      description: "Archive this project and make it read-only",
      handler: async () => {
        try {
          const result = await archiveProject(project.id);
          if (result.success) {
            const safeSlug = sanitizeSlug(workspaceSlug);
            if (!safeSlug) {
              console.error('Invalid workspace slug');
              await router.replace('/');
              return;
            }
            const path = `/${safeSlug}/projects`;
            if (isValidInternalPath(path)) {
              await router.replace(path);
            } else {
              await router.replace('/');
            }
          } else {
            toast.error("Failed to archive project");
          }
        } catch (error) {
          console.error("Archive error:", error);
          toast.error("Failed to archive project");
          throw error;
        }
      },
      variant: "warning" as const,
    },
    {
      name: "delete",
      type: "delete" as const,
      label: "Delete Project",
      description: "Permanently delete this project and all its data",
      handler: async () => {
        try {
          await deleteProject(project.id);

          const safeSlug = sanitizeSlug(workspaceSlug);
          if (!safeSlug) {
            console.error('Invalid workspace slug');
            await router.replace('/');
            return;
          }
          const path = `/${safeSlug}/projects`;
          if (isValidInternalPath(path)) {
            await router.replace(path);
          } else {
            await router.replace('/');
          }
        } catch (error) {
          console.error("Delete error:", error);
          toast.error("Failed to delete project");
          throw error;
        }
      },
      variant: "destructive" as const,
    },
  ];

  useEffect(() => {
    let isActive = true;
    const fetchProject = async () => {
      if (!workspaceSlug || !projectSlug || !isAuthenticated()) {
        setError("Authentication required");
        setLoading(false);
        router.push("/login");
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(workspaceSlug as string);

        if (!isActive) return;

        if (!workspaceData) {
          setError("Workspace not found");
          setLoading(false);
          router.replace("/workspaces");
          return;
        }

        const workspaceProjects = await getProjectsByWorkspace(workspaceData.id);
        const projectData = workspaceProjects.find((p) => p.slug === projectSlug);

        if (!isActive) return;

        if (!projectData) {
          setError("Project not found");
          setLoading(false);
          const safeSlug = sanitizeSlug(workspaceSlug);
          if (!safeSlug) {
            console.error('Invalid workspace slug');
            router.replace('/');
            return;
          }
          const path = `/${safeSlug}/projects`;
          if (isValidInternalPath(path)) {
            router.replace(path);
          } else {
            router.replace('/');
          }
          return;
        }

        setProject(projectData);
        setFormData({
          name: projectData.name || "",
          description: projectData.description || "",
          status: projectData.status || "ACTIVE",
          visibility: projectData.visibility || "PRIVATE",
        });
      } catch (err) {
        if (!isActive) return;

        const errorMessage = err?.message ? err.message : "Failed to load project";
        setError(errorMessage);

        if (errorMessage.includes("not found") || errorMessage.includes("404")) {
          const safeSlug = sanitizeSlug(workspaceSlug);
          if (!safeSlug) {
            console.error('Invalid workspace slug');
            router.replace('/');
            return;
          }
          const path = `/${safeSlug}/projects`;
          if (isValidInternalPath(path)) {
            router.replace(path);
          } else {
            router.replace('/');
          }
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchProject();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!project) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateProject(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        visibility: formData.visibility,
      });

      toast.success("Project settings updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className=" mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[var(--muted)] rounded w-1/3"></div>
            <Card className="border-none bg-[var(--card)]">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-[var(--muted)] rounded w-1/4"></div>
                  <div className="h-10 bg-[var(--muted)] rounded"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return <ErrorState error={error} />;
  }

  const tabs = [
    { id: "general", name: "General", icon: HiCog },
    { id: "email", name: "Email Setup", icon: HiEnvelope },
    { id: "rules", name: "Rules", icon: IoWarning },
  ];

  return (
    <div className="dashboard-container space-y-6">
      <PageHeader
        title="Project Settings"
        description="Manage your project configuration and preferences"
      />

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <HiExclamationTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div className=" rounded-[var(--card-radius)] border-none">
          <div className="border-b border-[var(--border)]">
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 ease-in-out ${
                      isActive
                        ? "border-b-[var(--primary)] text-[var(--primary)]"
                        : "border-b-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === "general" && (
              <div className="space-y-6">
                <Card className="border-none bg-[var(--card)]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Cog className="w-5 h-5 mr-2" />
                      General Information
                    </CardTitle>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Manage general information of your project
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Enter project name"
                        disabled={saving || !hasAccess}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Project Slug</Label>
                      <Input
                        id="slug"
                        value={project?.slug || ""}
                        placeholder="project-slug"
                        disabled={true}
                        readOnly
                        className="cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        placeholder="Describe your project..."
                        rows={3}
                        disabled={saving || !hasAccess}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Status */}
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => handleInputChange("status", value)}
                          disabled={saving || !hasAccess}
                        >
                          <SelectTrigger
                            id="status"
                            className={`w-full border border-[var(--border)] ${
                              !hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border border-[var(--border)] ">
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ACTIVE">
                              Active
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ON_HOLD">
                              On Hold
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="COMPLETED">
                              Completed
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ARCHIVED">
                              Archived
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Visibility */}
                      <div className="space-y-2">
                        <Label htmlFor="visibility">Visibility</Label>
                        <Select
                          value={formData.visibility}
                          onValueChange={(value) => handleInputChange("visibility", value)}
                          disabled={saving || !hasAccess}
                        >
                          <SelectTrigger
                            id="visibility"
                            className={`w-full border border-[var(--border)] ${
                              !hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="PRIVATE">
                              Private - Only members
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="INTERNAL">
                              Internal - Workspace members can view
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="PUBLIC">
                              Public - Anyone can view
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Control who can access this project. Members always have full access based
                          on their role.
                        </p>
                      </div>
                    </div>

                    {hasAccess && (
                      <div className="flex justify-end pt-4">
                        <ActionButton
                          onClick={handleSave}
                          disabled={saving || !formData.name.trim() || !hasAccess}
                          primary
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </ActionButton>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="bg-red-50 dark:bg-red-950/20 border-none rounded-md px-4 py-6">
                  <div className="flex items-start gap-3">
                    <HiExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 dark:text-red-400">Danger Zone</h4>
                      <p className="text-sm text-red-700 dark:text-red-500 mb-4">
                        These actions cannot be undone. Please proceed with caution.
                      </p>
                      <DangerZoneModal
                        entity={{
                          type: "project",
                          name: project?.slug || "",
                          displayName: project?.name || "",
                        }}
                        actions={dangerZoneActions}
                        onRetry={retryFetch}
                      >
                        <ActionButton
                          leftIcon={<HiExclamationTriangle className="w-4 h-4" />}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          disabled={!hasAccess}
                        >
                          Delete Project
                        </ActionButton>
                      </DangerZoneModal>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "email" && project && (
              <EmailIntegrationSettings projectId={project.id} />
            )}

            {activeTab === "rules" && project && <EmailRulesManager projectId={project.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSettingsPage() {
  return <ProjectSettingsContent />;
}
