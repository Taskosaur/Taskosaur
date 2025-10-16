import { useState } from "react";
import { OrganizationSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Organization } from "@/types/organizations";
import DangerZoneModal from "../common/DangerZoneModal";
import { toast } from "sonner";
import {
  HiCog,
  HiGlobeAlt,
  HiShieldCheck,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { useOrganization } from "@/contexts/organization-context";
import { Calendar, Clock, Globe, Languages } from "lucide-react";

interface OrganizationSettingsProps {
  organization: Organization;
  onUpdate: (organization: Organization) => void;
}

export default function OrganizationSettingsComponent({
  organization,
  onUpdate,
}: OrganizationSettingsProps) {
  const { updateOrganization, deleteOrganization } = useOrganization();
 
  const [activeTab, setActiveTab] = useState("general");
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

  const tabs = [
    { id: "general", name: "General", icon: HiCog },
    { id: "preferences", name: "Preferences", icon: HiGlobeAlt },
    { id: "security", name: "Security", icon: HiShieldCheck },
  ];

  const retryFetch = () => {
    toast.info("Refreshing organization data...");
  };

  const dangerZoneActions = [
    {
      name: "delete",
      type: "delete" as const,
      label: "Delete Organization",
      description: "Permanently delete this organization and all its data",
      handler: async () => {
        await deleteOrganization(organization.id);
      },
      variant: "destructive" as const,
    },
  ];

  const handleSave = async () => {
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
      toast.success("Organization settings updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization");
    } finally {
      setIsLoading(false);
    }
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    disabled = false,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-[var(--muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary)]"></div>
    </label>
  );

  const renderGeneralTab = () => (
    <div className="space-y-4">
      <div>
        <Label
          htmlFor="org-name"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Organization Name{" "}
          <span className="text-red-500">*</span>
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
          className="mt-1 border-input bg-background text-[var(--foreground)]"
        />
      </div>

      <div>
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
          rows={3}
          className="mt-1 border-input bg-background text-[var(--foreground)]"
        />
      </div>

      <div>
        <Label
          htmlFor="org-website"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Website<span className="text-red-500">*</span>
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
          className="mt-1 border-input bg-background text-[var(--foreground)]"
          placeholder="https://example.com"
        />
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className=" bg-[var(--background)]">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Timezone
            </Label>
          </div>
          <Select
            value={settings.preferences.timezone}
            onValueChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                preferences: { ...prev.preferences, timezone: value },
              }))
            }
          >
            <SelectTrigger className="w-full h-12 rounded-lg text-[var(--foreground)] border-[var(--border)] transition-colors">
              <SelectValue placeholder="Select timezone..." />
            </SelectTrigger>
            <SelectContent className="w-full rounded-lg bg-[var(--card)] shadow-lg border-[var(--border)]">
              <SelectItem
                value="UTC"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                <div className="flex items-center justify-between w-full">
                  <span>UTC</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    +00:00
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="America/New_York"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Eastern Time</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    EST/EDT
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="America/Chicago"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Central Time</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    CST/CDT
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="America/Denver"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Mountain Time</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    MST/MDT
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="America/Los_Angeles"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Pacific Time</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    PST/PDT
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="Europe/London"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>London</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    GMT/BST
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="Europe/Paris"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Paris</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    CET/CEST
                  </span>
                </div>
              </SelectItem>
              <SelectItem
                value="Asia/Tokyo"
                className="hover:bg-[var(--muted)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span>Tokyo</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    JST
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language Setting */}
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
              <Languages className="w-3.5 h-3.5 text-green-600" />
            </div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Language
            </Label>
          </div>
          <Select
            value={settings.preferences.language}
            onValueChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                preferences: { ...prev.preferences, language: value },
              }))
            }
          >
            <SelectTrigger className="w-full h-12 rounded-lg text-[var(--foreground)] border-[var(--border)] transition-colors">
              <SelectValue placeholder="Select language..." />
            </SelectTrigger>
            <SelectContent className="w-full rounded-lg bg-[var(--card)] shadow-lg border-[var(--border)]">
              <SelectItem
                value="en"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇺🇸</span>
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem
                value="es"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇪🇸</span>
                  <span>Spanish</span>
                </div>
              </SelectItem>
              <SelectItem value="fr" className="hover:bg-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇫🇷</span>
                  <span>French</span>
                </div>
              </SelectItem>
              <SelectItem value="de" className="hover:bg-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇩🇪</span>
                  <span>German</span>
                </div>
              </SelectItem>
              <SelectItem value="ja" className="hover:bg-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇯🇵</span>
                  <span>Japanese</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Format Setting */}
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Date Format
            </Label>
          </div>
          <Select
            value={settings.preferences.dateFormat}
            onValueChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                preferences: { ...prev.preferences, dateFormat: value },
              }))
            }
          >
            <SelectTrigger className="w-full h-12 rounded-lg border-[var(--border)] text-[var(--foreground)] transition-colors">
              <SelectValue placeholder="Select date format..." />
            </SelectTrigger>
            <SelectContent className="w-full rounded-lg bg-[var(--card)] shadow-lg border-[var(--border)]">
              <SelectItem
                value="MM/DD/YYYY"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                MM/DD/YYYY
              </SelectItem>
              <SelectItem
                value="DD/MM/YYYY"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                DD/MM/YYYY
              </SelectItem>
              <SelectItem
                value="YYYY-MM-DD"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                YYYY-MM-DD
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Format Setting */}
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Time Format
            </Label>
          </div>
          <Select
            value={settings.preferences.timeFormat}
            onValueChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                preferences: { ...prev.preferences, timeFormat: value },
              }))
            }
          >
            <SelectTrigger className="w-full h-12 rounded-lg border-[var(--border)] text-[var(--foreground)] transition-colors">
              <SelectValue placeholder="Select time format..." />
            </SelectTrigger>
            <SelectContent className="w-full rounded-lg bg-[var(--card)] shadow-lg border-[var(--border)]">
              <SelectItem
                value="12h"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                12 Hour
              </SelectItem>
              <SelectItem
                value="24h"
                className="hover:bg-[var(--muted)] rounded-md"
              >
                24 Hour
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30">
          <div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Require Two-Factor Authentication
            </Label>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Require 2FA for all organization members
            </p>
          </div>
          <ToggleSwitch
            checked={settings.security.requireTwoFactor}
            onChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                security: { ...prev.security, requireTwoFactor: checked },
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30">
          <div>
            <Label className="text-sm font-medium text-[var(--foreground)]">
              Allow Guest Access
            </Label>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Allow external users to access shared resources
            </p>
          </div>
          <ToggleSwitch
            checked={settings.security.allowGuestAccess}
            onChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                security: { ...prev.security, allowGuestAccess: checked },
              }))
            }
          />
        </div>

        <div>
          <Label
            htmlFor="session-timeout"
            className="text-sm font-medium text-[var(--foreground)]"
          >
            Session Timeout (minutes)
          </Label>
          <Input
            id="session-timeout"
            type="number"
            value={settings.security.sessionTimeout}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                security: {
                  ...prev.security,
                  sessionTimeout: parseInt(e.target.value),
                },
              }))
            }
            min="5"
            max="1440"
            className="mt-1 border-input bg-background text-[var(--foreground)]"
          />
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-6">
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
                  type: "organization",
                  name: organization.slug,
                  displayName: organization.name,
                }}
                actions={dangerZoneActions}
                onRetry={retryFetch}
              >
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <HiExclamationTriangle className="w-4 h-4 mr-2" />
                  Delete Organization
                </Button>
              </DangerZoneModal>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralTab();
      case "preferences":
        return renderPreferencesTab();
      case "security":
        return renderSecurityTab();
      default:
        return renderGeneralTab();
    }
  };

  return (
    <div className="space-y-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-md flex gap-2 items-center font-semibold text-[var(--foreground)]">
          <HiCog size={23} />
          Organization Settings
        </CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure your organization preferences and settings
        </p>
      </CardHeader>

      <div className="bg-[var(--card)] rounded-[var(--card-radius)] border-none">
        <div className="border-b border-[var(--border)]">
          <nav className="flex gap-1 px-4">
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
                  <span className="hidden sm:inline">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <CardContent className="p-4">{renderTabContent()}</CardContent>

        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90  transition-all duration-200 font-medium"
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
    </div>
  );
}
