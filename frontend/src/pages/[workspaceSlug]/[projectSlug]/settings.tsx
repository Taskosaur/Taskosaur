import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
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
import { SEO } from "@/components/common/SEO";
import { useSlugRedirect, cacheSlugId } from "@/hooks/useSlugRedirect";

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
  const { t } = useTranslation("project-settings");
  const [hasAccess, setHasAccess] = useState(false);
  const { handleSlugNotFound } = useSlugRedirect();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slug: "",
    status: "ACTIVE",
    visibility: "PRIVATE",
  });

  const retryFetch = () => {
    toast.info(t("refreshing"));
    const fetchProject = async () => {
      if (!workspaceSlug || !projectSlug || !isAuthenticated()) {
        setError(t("auth_required"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(workspaceSlug as string);
        if (!workspaceData) {
          setError(t("workspace_not_found"));
          setLoading(false);
          return;
        }

        const workspaceProjects = await getProjectsByWorkspace(workspaceData.id);
        const projectData = workspaceProjects.find((p) => p.slug === projectSlug);

        if (!projectData) {
          setError(t("project_not_found"));
          setLoading(false);
          return;
        }

        setProject(projectData);
        setFormData({
          name: projectData.name || "",
          description: projectData.description || "",
          slug: projectData.slug || "",
          status: projectData.status || "ACTIVE",
          visibility: projectData.visibility || "PRIVATE",
        });
      } catch (err) {
        setError(err?.message ? err.message : t("failed_to_load"));
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
      label: t("danger_zone.archive_label"),
      description: t("danger_zone.archive_description"),
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
            toast.error(t("danger_zone.archive_failed"));
          }
        } catch (error) {
          console.error("Archive error:", error);
          toast.error(t("danger_zone.archive_failed"));
          throw error;
        }
      },
      variant: "warning" as const,
    },
    {
      name: "delete",
      type: "delete" as const,
      label: t("danger_zone.delete_label"),
      description: t("danger_zone.delete_description"),
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
          toast.error(t("danger_zone.delete_failed"));
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
        setError(t("auth_required"));
        setLoading(false);
        router.push("/login");
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(workspaceSlug as string);

        if (!isActive) return;

        if (!workspaceData) {
          setError(t("workspace_not_found"));
          setLoading(false);
          router.replace("/workspaces");
          return;
        }

        const workspaceProjects = await getProjectsByWorkspace(workspaceData.id);
        const projectData = workspaceProjects.find((p) => p.slug === projectSlug);

        if (!isActive) return;

        if (!projectData) {
          setError(t("project_not_found"));
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

        // Cache slug→ID mappings
        cacheSlugId("workspace", workspaceSlug as string, workspaceData.id);
        cacheSlugId("project", projectSlug as string, projectData.id);

        setProject(projectData);
        setFormData({
          name: projectData.name || "",
          description: projectData.description || "",
          slug: projectData.slug || "",
          status: projectData.status || "ACTIVE",
          visibility: projectData.visibility || "PRIVATE",
        });
      } catch (err) {
        if (!isActive) return;

        const errorMessage = err?.message ? err.message : t("failed_to_load");

        const redirected = await handleSlugNotFound(
          err,
          workspaceSlug as string,
          projectSlug as string,
          undefined,
          project?.id
        );

        if (!redirected) {
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

    // Validate slug format
    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      toast.error(t("general.slug_error"));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updatedProject = await updateProject(project.id, {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        status: formData.status,
        visibility: formData.visibility,
      });

      setProject(updatedProject);

      // Redirect if slug changed
      if (updatedProject.slug !== projectSlug) {
        const safeWorkspaceSlug = sanitizeSlug(workspaceSlug);
        if (safeWorkspaceSlug) {
          const path = `/${safeWorkspaceSlug}/${updatedProject.slug}/settings`;
          if (isValidInternalPath(path)) {
            await router.replace(path);
          }
        }
      }

      toast.success(t("general.save_success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("general.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "name") {
      // Auto-update slug when name changes
      setFormData((prev) => ({
        ...prev,
        name: value,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
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
    { id: "general", name: t("tabs.general"), icon: HiCog },
    { id: "email", name: t("tabs.email"), icon: HiEnvelope },
    { id: "rules", name: t("tabs.rules"), icon: IoWarning },
  ];

  return (
    <div className="dashboard-container space-y-6">
      <SEO title={project ? `${project.name} ${t("title")}` : t("title")} />
      <PageHeader
        title={t("title")}
        description={t("description")}
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
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 ease-in-out ${isActive
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
                      {t("general.title")}
                    </CardTitle>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t("general.subtitle")}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("general.name_label")}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder={t("general.name_placeholder")}
                        disabled={saving || !hasAccess}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">{t("general.slug_label")}</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => handleInputChange("slug", e.target.value)}
                        placeholder={t("general.slug_placeholder")}
                        disabled={saving || !hasAccess}
                      />
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {t("general.slug_description")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">{t("general.description_label")}</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        placeholder={t("general.description_placeholder")}
                        rows={3}
                        disabled={saving || !hasAccess}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Status */}
                      <div className="space-y-2">
                        <Label htmlFor="status">{t("general.status_label")}</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => handleInputChange("status", value)}
                          disabled={saving || !hasAccess}
                        >
                          <SelectTrigger
                            id="status"
                            className={`w-full border border-[var(--border)] ${!hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
                              }`}
                          >
                            <SelectValue placeholder={t("general.status_placeholder")} />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border border-[var(--border)] ">
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ACTIVE">
                              {t("general.status_active")}
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ON_HOLD">
                              {t("general.status_on_hold")}
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="COMPLETED">
                              {t("general.status_completed")}
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="ARCHIVED">
                              {t("general.status_archived")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Visibility */}
                      <div className="space-y-2">
                        <Label htmlFor="visibility">{t("general.visibility_label")}</Label>
                        <Select
                          value={formData.visibility}
                          onValueChange={(value) => handleInputChange("visibility", value)}
                          disabled={saving || !hasAccess}
                        >
                          <SelectTrigger
                            id="visibility"
                            className={`w-full border border-[var(--border)] ${!hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
                              }`}
                          >
                            <SelectValue placeholder={t("general.visibility_placeholder")} />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--card)] border border-[var(--border)]">
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="PRIVATE">
                              {t("general.visibility_private")}
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="INTERNAL">
                              {t("general.visibility_internal")}
                            </SelectItem>
                            <SelectItem className="hover:bg-[var(--hover-bg)]" value="PUBLIC">
                              {t("general.visibility_public")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {t("general.visibility_description")}
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
                          {saving ? t("general.saving") : t("general.save_changes")}
                        </ActionButton>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="bg-red-50 dark:bg-red-950/20 border-none rounded-md px-4 py-6">
                  <div className="flex items-start gap-3">
                    <HiExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 dark:text-red-400">{t("danger_zone.title")}</h4>
                      <p className="text-sm text-red-700 dark:text-red-500 mb-4">
                        {t("danger_zone.description")}
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
                          {t("danger_zone.delete_button")}
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
