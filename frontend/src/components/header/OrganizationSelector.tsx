import { useState, useEffect } from "react";
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

export default function OrganizationSelector({
  onOrganizationChange,
}: {
  onOrganizationChange?: (o: Organization) => void;
}) {
  const router = useRouter();
  const { getUserOrganizations } = useOrganization();
  const { getCurrentUser } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isFetchingOnOpen, setIsFetchingOnOpen] = useState(false);

  const currentUser: User | null = getCurrentUser() ?? null;

  const getInitials = (name?: string) => name?.charAt(0)?.toUpperCase() || "?";

  const setAndPersistOrganization = (org: Organization) => {
    setCurrentOrganization(org);
    localStorage.setItem("currentOrganizationId", org.id);
    setCurrentOrganizationId(org.id);
    window.dispatchEvent(new CustomEvent("organizationChanged"));
    onOrganizationChange?.(org);
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    const fetchOrganizations = async () => {
      setIsLoading(true);
      try {
        const orgs: Organization[] = (await getUserOrganizations(currentUser.id)) ?? [];
        setOrganizations(orgs);

        if (orgs.length === 0) {
          setIsLoading(false);
          return;
        }

        let selectedOrg: Organization | undefined;

        // First try to find the org with isDefault = true
        selectedOrg = orgs.find((org) => org.isDefault);

        // If no default org, check localStorage
        if (!selectedOrg) {
          const savedOrgId = localStorage.getItem("currentOrganizationId");
          if (savedOrgId) {
            selectedOrg = orgs.find((org) => org.id === savedOrgId);
          }
        }

        // If still no selection, pick the first org
        if (!selectedOrg) {
          selectedOrg = orgs[0];
        }

        setAndPersistOrganization(selectedOrg);
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, [currentUser?.id]);

  const fetchOrganizationsOnOpen = async () => {
    if (!currentUser?.id) return;

    setIsFetchingOnOpen(true);
    try {
      const orgs: Organization[] = (await getUserOrganizations(currentUser.id)) ?? [];
      setOrganizations(orgs);

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

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="header-org-selector-trigger max-[530px]:!px-3 max-[530px]:gap-2"
        >
          <Avatar className="header-org-selector-avatar">
            <AvatarFallback className="header-org-selector-avatar-fallback">
              {getInitials(currentOrganization.name)}
            </AvatarFallback>
          </Avatar>
          <span className="header-org-selector-name max-[530px]:text-sm max-[530px]:font-medium">
            {currentOrganization.name}
          </span>

          <HiChevronDown className="header-org-selector-chevron max-[530px]:hidden" />
          <span className="hidden max-[530px]:inline-block text-sm font-medium">Organizations</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="header-org-selector-dropdown" align="end" sideOffset={6}>
        {/* Current Organization Header */}
        <div className="header-org-profile-header">
          <Avatar className="header-org-profile-avatar">
            <AvatarFallback className="header-org-profile-avatar-fallback">
              {getInitials(currentOrganization.name)}
            </AvatarFallback>
          </Avatar>
          <div className="header-org-profile-info">
            <div className="header-org-profile-name">{currentOrganization.name}</div>
            <div className="header-org-profile-meta">
              {currentOrganization._count?.members ?? 0} members
              <Badge variant="secondary" className="header-org-profile-badge">
                Org
              </Badge>
            </div>
          </div>
        </div>

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
              <p className="header-org-empty-title">No organizations found</p>
              <p className="header-org-empty-description">Contact your admin to get access</p>
            </div>
          ) : (
            <>
              {organizations.map((org) => (
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
                    <p className="header-org-item-members">{org._count?.members ?? 0} members</p>
                  </div>
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
                    <div className="header-org-manage-title">Manage Organizations</div>
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
