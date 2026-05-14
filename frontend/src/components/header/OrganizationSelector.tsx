import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { useOrganization } from "@/contexts/organization-context";
import { setCurrentOrganizationId } from "@/utils/hierarchyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HiChevronDown, HiCheck, HiCog } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { Building } from "lucide-react";
import { Organization, User } from "@/types";
import { mcpServer } from "@/lib/mcp-server";
import { useNotification } from "@/contexts/notification-context";
import Tooltip from "../common/ToolTip";

export default function OrganizationSelector({
  onOrganizationChange,
}: {
  onOrganizationChange?: (o: Organization) => void;
}) {
  const { t } = useTranslation("header");
  const router = useRouter();
  const { getUserOrganizations, organizations, currentOrganization, setCurrentOrganization: setContextCurrentOrganization, isLoading } = useOrganization();
  const { getCurrentUser } = useAuth();
  const { unreadCountsByOrg } = useNotification();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isFetchingOnOpen, setIsFetchingOnOpen] = useState(false);

  const otherOrgsWithNotifications = unreadCountsByOrg.filter(
    item => item.organizationId !== currentOrganization?.id && item.unreadCount > 0
  );

  const hasOtherNotifications = otherOrgsWithNotifications.length > 0;
  const totalOtherUnreadCount = otherOrgsWithNotifications.reduce(
    (sum, item) => sum + item.unreadCount, 0
  );

  const currentUser: User | null = getCurrentUser() ?? null;

  const getInitials = (name?: string) => name?.charAt(0)?.toUpperCase() || "?";

  const setAndPersistOrganization = (org: Organization) => {
    setContextCurrentOrganization(org);
    setCurrentOrganizationId(org.id);
    onOrganizationChange?.(org);
  };


  const fetchOrganizationsOnOpen = async () => {
    if (!currentUser?.id) return;

    setIsFetchingOnOpen(true);
    try {
      const orgs: Organization[] = (await getUserOrganizations(currentUser.id)) ?? [];

      let selectedOrg: Organization | undefined;

      // Try to select the currently saved org from localStorage
      const savedOrgId = localStorage.getItem("currentOrganizationId");
      if (savedOrgId) {
        selectedOrg = orgs.find((org) => org.id === savedOrgId);
      }

      // If no saved org or saved org no longer exists, pick default org
      if (!selectedOrg) {
        selectedOrg = orgs.find((org) => org.isDefault);
      }

      // If still none, pick the first org
      if (!selectedOrg) {
        selectedOrg = orgs[0];
      }

      if (selectedOrg && selectedOrg.id !== currentOrganization?.id) {
        setAndPersistOrganization(selectedOrg);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setIsFetchingOnOpen(false);
    }
  };

  // Handle organization selection
  const handleOrganizationSelect = (org: Organization) => {
    if (!org?.id || currentOrganization?.id === org.id) return;

    setAndPersistOrganization(org);

    try {
      router.replace("/dashboard");
      mcpServer.clearContext(); // Clear MCP context on org change
    } catch (err) {
      console.error("Router replace failed:", err);
    }
  };

  // Handle dropdown open/close
  const handleDropdownOpen = (open: boolean) => {
    setDropdownOpen(open);
    if (open) {
      fetchOrganizationsOnOpen();
    }
  };

  // Loading state
  if (isLoading || !currentOrganization) {
    return (
      <div className="header-org-selector-loading">
        <div className="header-org-selector-loading-avatar" />
        <div className="header-org-selector-loading-content">
          <div className="header-org-selector-loading-text-primary" />
          <div className="header-org-selector-loading-text-secondary" />
        </div>
      </div>
    );
  }

  const orgTooltipContent = (
    <div className="space-y-1">
      <p className="text-sm font-bold leading-none">{currentOrganization.name}</p>
      <p className="text-xs text-muted-foreground">
        {currentOrganization._count?.members ?? 0} {currentOrganization._count?.members === 1 ? t("member") : t("members")}
      </p>
    </div>
  );

  const notificationTooltipContent = t("unreadNotificationsInOtherOrgs", { count: totalOtherUnreadCount });

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="header-org-selector-trigger max-[530px]:!px-3 max-[530px]:gap-2 relative"
        >
          <Tooltip content={orgTooltipContent} position="bottom">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="header-org-selector-avatar">
                <AvatarFallback className="header-org-selector-avatar-fallback">
                  {getInitials(currentOrganization.name)}
                </AvatarFallback>
              </Avatar>
              <span className="header-org-selector-name max-[530px]:text-sm max-[530px]:font-medium truncate max-w-[120px]">
                {currentOrganization.name}
              </span>
            </div>
          </Tooltip>

          <HiChevronDown className="header-org-selector-chevron max-[530px]:hidden" />
          <span className="hidden max-[530px]:inline-block text-sm font-medium">{t("organizations")}</span>
          
          {hasOtherNotifications && (
            <Tooltip 
              content={notificationTooltipContent} 
              position="bottom" 
              className="absolute -top-1 -right-1 z-10 h-3 w-3"
            >
              <div className="flex h-3 w-3 cursor-pointer relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
            </Tooltip>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="header-org-selector-dropdown" align="end" sideOffset={6}>
        {/* Organizations List */}
        <div className="header-org-list-container">
          {isFetchingOnOpen ? (
            <div className="header-org-loading-state">
              <div className="header-org-list-container space-y-2 p-2">
                {[...Array(5)].map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 animate-pulse px-2 py-1 rounded-md bg-[var(--dropdown-bg)]"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : organizations.length === 0 ? (
            <div className="header-org-empty-state">
              <div className="header-org-empty-icon-container">
                <Building size={20} className="header-org-empty-icon" />
              </div>
              <p className="header-org-empty-title">{t("noOrganizationsFound")}</p>
              <p className="header-org-empty-description">{t("contactAdminAccess")}</p>
            </div>
          ) : (
            <>
              {organizations
                .filter((org, index, self) => 
                  org.id !== currentOrganization.id && 
                  self.findIndex(t => t.id === org.id) === index
                )
                .map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrganizationSelect(org)}
                  className={`header-org-item ${
                    currentOrganization.id === org.id
                      ? "header-org-item-active"
                      : "header-org-item-inactive"
                  }`}
                >
                  <Avatar className="header-org-item-avatar">
                    <AvatarFallback className="header-org-item-avatar-fallback">
                      {getInitials(org.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="header-org-item-info">
                    <p className="header-org-item-name">{org.name}</p>
                    <p className="header-org-item-members">{org._count?.members ?? 0} {org._count?.members === 1 ? t("member") : t("members")}</p>
                  </div>
                  {(() => {
                    const unreadCount = unreadCountsByOrg.find(u => u.organizationId === org.id)?.unreadCount;
                    if (!unreadCount) return null;
                    return (
                      <Tooltip 
                        content={`${unreadCount} ${unreadCount === 1 ? t("unreadNotification") : t("unreadNotifications")}`} 
                        position="right" 
                        className="ml-auto flex items-center"
                      >
                        <div className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </div>
                      </Tooltip>
                    );
                  })()}
                  {currentOrganization.id === org.id && (
                    <HiCheck size={12} className="header-org-item-check" />
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="my-1" />
              <div className="header-org-footer">
                <DropdownMenuItem
                  onClick={() => {
                    try {
                      router.push("/settings");
                    } catch (error) {
                      console.error("Router push failed:", error);
                    }
                  }}
                  className="header-org-manage-item"
                >
                  <div className="header-org-manage-icon-container">
                    <HiCog className="header-org-manage-icon" />
                  </div>
                  <div className="header-org-manage-text">
                    <div className="header-org-manage-title">{t("manageOrganizations")}</div>
                  </div>
                </DropdownMenuItem>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
