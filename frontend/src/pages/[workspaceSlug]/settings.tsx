import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

// UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DangerZoneModal from "@/components/common/DangerZoneModal";
import { HiExclamationTriangle } from "react-icons/hi2";
import { PageHeader } from "@/components/common/PageHeader";
import ErrorState from "@/components/common/ErrorState";

function WorkspaceSettingsContent() {
  const router = useRouter();
  const workspaceSlug = router.query.workspaceSlug;
  const initialWorkspaceSlug =
    typeof workspaceSlug === "string" ? workspaceSlug : workspaceSlug?.[0];
  const { getWorkspaceBySlug, updateWorkspace, deleteWorkspace, archiveWorkspace } = useWorkspace();
  const { isAuthenticated } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    slug: "",
  });

  const retryFetch = () => {
    toast.info("Refreshing workspace data...");
    const fetchWorkspace = async () => {
      if (!initialWorkspaceSlug || !isAuthenticated()) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(initialWorkspaceSlug);

        if (!workspaceData) {
          setError("Workspace not found");
          setLoading(false);
          return;
        }

        setWorkspace(workspaceData);
        setFormData({
          name: workspaceData.name || "",
          description: workspaceData.description || "",
          slug: workspaceData.slug || "",
        });
      } catch (err) {
        setError(err?.message ? err.message : "Failed to load workspace");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  };

  useEffect(() => {
    if (workspace) {
      getUserAccess({ name: "workspace", id: workspace.id })
        .then((data) => {
          setHasAccess(data?.canChange);
        })
        .catch((error) => {
          console.error("Error fetching user access:", error);
        });
    }
  }, [workspace]);

  const dangerZoneActions = [
    {
      name: "archive",
      type: "archive" as const,
      label: "Archive Workspace",
      description: "Archive this workspace and make it read-only",
      handler: async () => {
        try {
          const result = await archiveWorkspace(workspace.id);
          if (result.success) {
            await router.replace("/workspaces");
          } else {
            toast.error("Failed to archive workspace");
          }
        } catch (error) {
          console.error("Archive error:", error);
          toast.error("Failed to archive workspace");
          throw error;
        }
      },
      variant: "warning" as const,
    },
    {
      name: "delete",
      type: "delete" as const,
      label: "Delete Workspace",
      description: "Permanently delete this workspace and all its data",
      handler: async () => {
        try {
          await deleteWorkspace(workspace.id);
          await router.replace("/workspaces");
        } catch (error) {
          console.error("Delete error:", error);
          toast.error("Failed to delete workspace");
          throw error;
        }
      },
      variant: "destructive" as const,
    },
  ];

  useEffect(() => {
    let isActive = true;
    const fetchWorkspace = async () => {
      if (!initialWorkspaceSlug || !isAuthenticated()) {
        setError("Authentication required");
        setLoading(false);
        router.push("/login");
        return;
      }

      try {
        setLoading(true);
        const workspaceData = await getWorkspaceBySlug(initialWorkspaceSlug);

        if (!isActive) return;

        if (!workspaceData) {
          setError("Workspace not found");
          setLoading(false);
          router.replace("/workspaces");
          return;
        }

        if (!workspaceData.id) {
          setError("You don't have access to this workspace");
          setLoading(false);
          router.replace("/workspaces");
          return;
        }

        setWorkspace(workspaceData);
        setFormData({
          name: workspaceData.name || "",
          description: workspaceData.description || "",
          slug: workspaceData.slug || "",
        });
      } catch (err) {
        if (!isActive) return;

        const errorMessage = err instanceof Error ? err.message : "Failed to load workspace";
        setError(errorMessage);

        if (errorMessage.includes("not found") || errorMessage.includes("404")) {
          router.replace("/workspaces");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchWorkspace();
    return () => {
      isActive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!workspace) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updatedWorkspace = await updateWorkspace(workspace.id, {
        name: formData?.name?.trim(),
        description: formData?.description?.trim(),
      });

      setWorkspace(updatedWorkspace);

      if (updatedWorkspace.slug !== initialWorkspaceSlug) {
        await router.replace(`/${updatedWorkspace.slug}/settings`);
      }
      toast.success("Workspace settings updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update workspace");
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
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--muted)] rounded w-1/3"></div>
          <Card className="border-none bg-[var(--card)]">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-4 bg-[var(--muted)] rounded w-1/4"></div>
                <div className="h-10 bg-[var(--muted)] rounded"></div>
                <div className="h-4 bg-[var(--muted)] rounded w-1/4"></div>
                <div className="h-20 bg-[var(--muted)] rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !workspace) {
    return <ErrorState error={error} />;
  }

  return (
    <>
      <div className="dashboard-container pt-0 space-y-6">
        <PageHeader
          title="Workspace Settings"
          description="Manage your workspace configuration and preferences"
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
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter workspace name"
                disabled={saving || !hasAccess}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Workspace Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleInputChange("slug", e.target.value)}
                placeholder="workspace-slug"
                disabled={saving || !hasAccess}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                This is used in URLs and should be unique
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe your workspace..."
                rows={3}
                disabled={saving || !hasAccess}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !hasAccess}
                className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-sm hover:shadow-md transition-all duration-200 font-medium cursor-pointer rounded-lg flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
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
                  type: "workspace",
                  name: workspace?.slug || "",
                  displayName: workspace?.name || "",
                }}
                actions={dangerZoneActions}
                onRetry={retryFetch}
              >
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!hasAccess}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <HiExclamationTriangle className="w-4 h-4 mr-2" />
                  Delete Workspace
                </Button>
              </DangerZoneModal>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function WorkspaceSettingsPage() {
  return <WorkspaceSettingsContent />;
}
