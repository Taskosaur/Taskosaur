import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { OrganizationSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Organization } from "@/types/organizations";
import DangerZoneModal from "../common/DangerZoneModal";
import { toast } from "sonner";
import { HiCog, HiExclamationTriangle, HiArrowPath } from "react-icons/hi2";
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
  const router = useRouter();
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

  // Generate slug from name (mirrors backend slugify logic)
  const generateSlugFromName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // remove special chars
      .replace(/\s+/g, "-") // replace spaces with hyphens
      .replace(/-+/g, "-") // replace multiple hyphens with single
      .trim();
  };

  // Slug state - separate from settings for better control
  const [slug, setSlug] = useState(organization.slug);
  // Track if user has manually edited the slug field in this session
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  // Track the original name to detect name changes
  const [previousName, setPreviousName] = useState(organization.name);

  // Use getUserAccess to check permissions
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [hasAccessLoaded, setHasAccessLoaded] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const accessData = await getUserAccess({ name: "organization", id: organization.id });
        const role = accessData?.role;
        // Allow edit access if role is SUPER_ADMIN, Owner or Manager (matching backend permissions)
        setHasEditAccess(role === "SUPER_ADMIN" || role === "OWNER" || role === "MANAGER");
        // Only Owner or SUPER_ADMIN can delete organization
        setIsOwner(role === "SUPER_ADMIN" || role === "OWNER");
      } catch (error) {
        setHasEditAccess(false);
        setIsOwner(false);
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
      settings.general.website !== (organization.website || "") ||
      slug !== organization.slug;

    setHasUnsavedChanges(hasChanges);
  }, [settings, organization, slug]);

  // Auto-update slug when name changes (only if not manually edited in this session)
  useEffect(() => {
    // Only auto-update if name actually changed (not on initial mount)
    if (settings.general.name !== previousName) {
      setPreviousName(settings.general.name);

      // Only auto-generate slug if user hasn't manually edited it
      if (!isSlugManuallyEdited) {
        const newSlug = generateSlugFromName(settings.general.name);
        setSlug(newSlug);
      }
    }
  }, [settings.general.name, previousName, isSlugManuallyEdited]);

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

  // Validate slug format
  const isValidSlug = (slugValue: string): boolean => {
    if (!slugValue || slugValue.trim().length === 0) return false;
    // Only lowercase letters, numbers, and hyphens allowed
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue);
  };

  // Handle slug input change
  const handleSlugChange = (value: string) => {
    // Sanitize input: only allow lowercase, numbers, and hyphens
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    setSlug(sanitized);
    setIsSlugManuallyEdited(true);
  };

  // Reset slug to auto-generated value
  const resetSlugToAuto = () => {
    setSlug(generateSlugFromName(settings.general.name));
    setIsSlugManuallyEdited(false);
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    return (
      settings.general.name.trim().length > 0 &&
      isValidUrl(settings.general.website) &&
      isValidSlug(slug)
    );
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

      // Track if slug is changing for redirect
      const slugChanged = slug !== organization.slug;

      const updatedOrg = await updateOrganization(organization.id, {
        ...settings.general,
        ...(slugChanged && { slug }), // Include slug only if changed
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
      setIsSlugManuallyEdited(false); // Reset manual edit flag after save
      toast.success("Organization settings updated successfully!");

      // Redirect to new URL if slug changed
      if (slugChanged && updatedOrg.slug !== organization.slug) {
        router.replace(`/settings/${updatedOrg.slug}`);
      }
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
                disabled={!hasEditAccess}
              />
              {settings.general.name.trim().length === 0 && (
                <p className="text-xs text-red-500">Organization name is required</p>
              )}
            </div>

            {/* Organization Slug (Editable) */}
            <div className="space-y-2">
              <Label htmlFor="org-slug" className="text-sm font-medium text-[var(--foreground)]">
                Organization Slug
              </Label>
              <div className="flex gap-2">
                <Input
                  id="org-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono flex-1"
                  placeholder="organization-slug"
                  disabled={!hasEditAccess}
                />
                {isSlugManuallyEdited && hasEditAccess && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={resetSlugToAuto}
                    className="h-9 w-9 flex-shrink-0"
                    title="Reset to auto-generated slug"
                  >
                    <HiArrowPath className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!isValidSlug(slug) && slug.length > 0 && (
                <p className="text-xs text-red-500">
                  Slug must contain only lowercase letters, numbers, and hyphens
                </p>
              )}
              {slug.length === 0 && (
                <p className="text-xs text-red-500">Slug is required</p>
              )}
              {slug !== organization.slug && isValidSlug(slug) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Slug will be updated from "{organization.slug}" to "{slug}"
                </p>
              )}
              {slug === organization.slug && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {isSlugManuallyEdited
                    ? "You can edit the slug or click the reset icon to auto-generate from name"
                    : "Slug is auto-generated from the organization name"}
                </p>
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
                disabled={!hasEditAccess}
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
                disabled={!hasEditAccess}
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
            disabled={isLoading || !hasUnsavedChanges || !isFormValid() || !hasEditAccess}
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

      {/* Danger Zone - Only show if user is Owner (delete is Owner-only) */}
      {isOwner && (
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
