import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DangerZoneModal from "@/components/common/DangerZoneModal";
import { HiExclamationTriangle } from "react-icons/hi2";
import { PageHeader } from "@/components/common/PageHeader";

function ProjectSettingsContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const {
    getProjectsByWorkspace,
    updateProject,
    deleteProject,
    archiveProject,
  } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const { isAuthenticated, getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

        const workspaceProjects = await getProjectsByWorkspace(
          workspaceData.id
        );
        const projectData = workspaceProjects.find(
          (p) => p.slug === projectSlug
        );

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
        setError(err instanceof Error ? err.message : "Failed to load project");
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
            await router.replace(`/${workspaceSlug}/projects`);
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

          await router.replace(`/${workspaceSlug}/projects`);
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

        const workspaceProjects = await getProjectsByWorkspace(
          workspaceData.id
        );
        const projectData = workspaceProjects.find(
          (p) => p.slug === projectSlug
        );

        if (!isActive) return;

        if (!projectData) {
          setError("Project not found");
          setLoading(false);
          router.replace(`/${workspaceSlug}/projects`);
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

        const errorMessage =
          err instanceof Error ? err.message : "Failed to load project";
        setError(errorMessage);

        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("404")
        ) {
          router.replace(`/${workspaceSlug}/projects`);
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

      setSuccess("Project settings updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
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
    return (
      <div className="p-6">
        <div className=" mx-auto">
          <Alert variant="destructive">
            <HiExclamationTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container space-y-6">
      <PageHeader
        title="Project Settings"
        description="Manage your project configuration and preferences"
      />

      {success && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-200">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <HiExclamationTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none bg-[var(--card)]">
        <CardHeader>
          <CardTitle>General Information</CardTitle>
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
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Used in URLs and should be unique. This field cannot be edited.
            </p>
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

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => handleInputChange("status", e.target.value)}
              disabled={saving || !hasAccess}
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-sm ${
                !hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              value={formData.visibility}
              onChange={(e) => handleInputChange("visibility", e.target.value)}
              disabled={saving || !hasAccess}
              className={`w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-sm ${
                !hasAccess || saving ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <option value="PRIVATE">🔒 Private - Only members</option>
              <option value="INTERNAL">🏢 Internal - Workspace members can view</option>
              <option value="PUBLIC">🌍 Public - Anyone can view</option>
            </select>
            <p className="text-xs text-[var(--muted-foreground)]">
              Control who can access this project. Members always have full access based on their role.
            </p>
          </div>

          {hasAccess && (
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !hasAccess}
                className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium cursor-pointer rounded-lg flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[var(--card)]">
        <CardContent className="p-6">
          <div className="bg-red-50 dark:bg-red-950/20 border-none  rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HiExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">
                  Danger Zone
                </h4>
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
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={!hasAccess}
                  >
                    <HiExclamationTriangle className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </DangerZoneModal>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProjectSettingsPage() {
  return <ProjectSettingsContent />;
}
