import { useState, useEffect } from "react";
import { OrganizationSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Organization } from "@/types/organizations";
import DangerZoneModal from "../common/DangerZoneModal";
import { toast } from "sonner";
import { HiCog, HiExclamationTriangle } from "react-icons/hi2";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";

interface OrganizationSettingsProps {
  organization: Organization;
  onUpdate: (organization: Organization) => void;
}

export default function OrganizationSettingsComponent({
  organization,
  onUpdate,
}: OrganizationSettingsProps) {
  const { user } = useAuth();
  const { updateOrganization, deleteOrganization } = useOrganization();

  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<OrganizationSettings>({
    general: {
      name: organization.name,
      description: organization.description || "",
      avatar: organization.avatar || "",
      website: organization.website || "",
    },
    preferences: {
      timezone: "UTC",
      language: "en",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    },
    features: {
      timeTracking: true,
      automation: true,
      customFields: true,
      integrations: true,
    },
    notifications: {
      emailNotifications: true,
      slackNotifications: false,
      webhookUrl: "",
    },
    security: {
      requireTwoFactor: false,
      allowGuestAccess: false,
      sessionTimeout: 30,
    },
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { getUserAccess } = useAuth();

  // Use getUserAccess to check permissions
  const [hasAccess, setHasAccess] = useState(false);
  const [hasAccessLoaded, setHasAccessLoaded] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const accessData = await getUserAccess({ name: "organization", id: organization.id });
        // Only allow access if role is Owner
        setHasAccess(accessData?.role === "OWNER");
      } catch (error) {
        setHasAccess(false);
      } finally {
        setHasAccessLoaded(true);
      }
    };
    if (!hasAccessLoaded && organization.id && user?.id) {
      checkAccess();
    }
  }, [organization.id, user?.id, hasAccessLoaded, getUserAccess]);

  // Track changes to enable/disable save button
  useEffect(() => {
    const hasChanges =
      settings.general.name !== organization.name ||
      settings.general.description !== (organization.description || "") ||
      settings.general.website !== (organization.website || "");

    setHasUnsavedChanges(hasChanges);
  }, [settings, organization]);

  // Validate URL format
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Allow empty URL
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    return settings.general.name.trim().length > 0 && isValidUrl(settings.general.website);
  };

  const dangerZoneActions = [
    {
      name: "delete",
      type: "delete" as const,
      label: "Delete Organization",
      description: "Permanently delete this organization and all its data",
      handler: async () => {
        try {
          await deleteOrganization(organization.id);
        } catch (error: any) {
          let errorMsg = "Failed to delete organization";

          // Extract detailed API error safely
          const apiErr =
            error?.response?.data || error?.data || (typeof error === "object" ? error : null);

          if (apiErr) {
            if (typeof apiErr === "string") {
              errorMsg = apiErr;
            } else if (apiErr.message) {
              errorMsg = apiErr.message;
              if (apiErr.error || apiErr.statusCode) {
                errorMsg += ` (${apiErr.error || ""}${
                  apiErr.statusCode ? `, ${apiErr.statusCode}` : ""
                })`;
              }
            } else {
              errorMsg = JSON.stringify(apiErr);
            }
          } else if (error?.message) {
            errorMsg = error.message;
          } else if (typeof error === "string") {
            errorMsg = error;
          }

          throw new Error(errorMsg);
        }
      },
      variant: "destructive" as const,
    },
  ];

  const handleSave = async () => {
    if (!isFormValid()) {
      toast.error("Please fix the errors before saving");
      return;
    }

    try {
      setIsLoading(true);
      const updatedOrg = await updateOrganization(organization.id, {
        ...settings.general,
        settings: {
          ...settings.preferences,
          ...settings.features,
          ...settings.notifications,
          ...settings.security,
        },
      });
      const mappedOrg = {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
        description: updatedOrg.description,
        avatar: updatedOrg.avatar,
        website: updatedOrg.website,
        settings: updatedOrg.settings,
        ownerId: updatedOrg.ownerId,
        memberCount: 0,
        workspaceCount: 0,
        createdAt: updatedOrg.createdAt,
        updatedAt: updatedOrg.updatedAt,
      };
      onUpdate(mappedOrg);
      setHasUnsavedChanges(false);
      toast.success("Organization settings updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-6">
      {/* Header Section */}
      <CardHeader className="px-0">
        <CardTitle className="text-md flex gap-2 items-center font-semibold text-[var(--foreground)]">
          <HiCog size={25} />
          Organization Settings
        </CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure your organization preferences and settings
        </p>
      </CardHeader>

      {/* General Settings Form */}
      <div className="rounded-md border-none">
        <CardContent className="px-0 py-6">
          <div className="space-y-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name" className="text-sm font-medium text-[var(--foreground)]">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="org-name"
                type="text"
                value={settings.general.name}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    general: { ...prev.general, name: e.target.value },
                  }))
                }
                className="border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                placeholder="Enter organization name"
                required
                disabled={!hasAccess}
              />
              {settings.general.name.trim().length === 0 && (
                <p className="text-xs text-red-500">Organization name is required</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="org-description"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Description
              </Label>
              <Textarea
                id="org-description"
                value={settings.general.description}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    general: { ...prev.general, description: e.target.value },
                  }))
                }
                rows={4}
                className="border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] resize-none"
                placeholder="Describe your organization..."
                disabled={!hasAccess}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                {settings.general.description.length}/500 characters
              </p>
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="org-website" className="text-sm font-medium text-[var(--foreground)]">
                Website
              </Label>
              <Input
                id="org-website"
                type="url"
                value={settings.general.website}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    general: { ...prev.general, website: e.target.value },
                  }))
                }
                className="border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                placeholder="https://example.com"
                disabled={!hasAccess}
              />
              {settings.general.website && !isValidUrl(settings.general.website) && (
                <p className="text-xs text-red-500">
                  Please enter a valid URL (e.g., https://example.com)
                </p>
              )}
            </div>
          </div>
        </CardContent>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasUnsavedChanges || !isFormValid() || !hasAccess}
            className="h-9 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>

      {/* Danger Zone - Only show if user has access */}
      {hasAccess && (
        <div className="rounded-md border-none bg-red-50 dark:bg-red-950/20">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <HiExclamationTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 dark:text-red-400">Danger Zone</h4>
                <p className="text-sm text-red-700 dark:text-red-500 mb-4">
                  These actions cannot be undone. Please proceed with caution.
                </p>
                <DangerZoneModal
                  triggerText="Delete Organization"
                  triggerVariant="destructive"
                  entity={{
                    type: "organization",
                    name: organization.name,
                    displayName: organization.name,
                  }}
                  actions={dangerZoneActions}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
