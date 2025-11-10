import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  getCurrentWorkspaceId,
  setCurrentWorkspaceId,
  clearCurrentProjectId,
} from "@/utils/hierarchyContext";
import { HiChevronDown, HiCheck } from "react-icons/hi2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizationId: string;
}

interface WorkspaceSelectorProps {
  currentWorkspaceSlug: string | null;
}

export default function WorkspaceSelector({ currentWorkspaceSlug }: WorkspaceSelectorProps) {
  const router = useRouter();

  const { getWorkspacesByOrganization } = useWorkspace();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // Fetch workspaces for current organization
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setIsLoading(true);
        const workspacesData = await getWorkspacesByOrganization();
        setWorkspaces(workspacesData || []);
      } catch (error) {
        console.error("Error fetching workspaces:", error);
        setWorkspaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();

    const handleOrganizationChange = () => {
      setCurrentWorkspace(null);
      fetchWorkspaces();
    };

    window.addEventListener("organizationChanged", handleOrganizationChange);
    return () => {
      window.removeEventListener("organizationChanged", handleOrganizationChange);
    };
  }, []);

  // Resolve current workspace from URL slug or localStorage fallback
  useEffect(() => {
    if (workspaces.length === 0) {
      setCurrentWorkspace(null);
      return;
    }

    // 1. Try URL slug first
    let workspace = currentWorkspaceSlug && workspaces.find((w) => w.slug === currentWorkspaceSlug);

    // 2. Fallback to localStorage id
    if (!workspace) {
      const storedId = getCurrentWorkspaceId(); // util that reads localStorage
      workspace = workspaces.find((w) => w.id === storedId);
    }

    setCurrentWorkspace(workspace || null);
  }, [workspaces, currentWorkspaceSlug]);

  const handleWorkspaceSelect = (workspace: Workspace) => {
    // Store the workspace ID in localStorage for hierarchy context
    setCurrentWorkspaceId(workspace.id);
    // Clear project context since we're switching workspaces
    clearCurrentProjectId();

    // Dispatch workspace change event
    window.dispatchEvent(new CustomEvent("workspaceChanged"));

    // Navigate to the workspace homepage
    // This replaces the current route to prevent going back to old workspace contexts
    router.replace(`/${workspace.slug}`);
  };

  const getInitials = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || "W";
  };

  // Always render the selector (show loading state instead of hiding)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="layout-workspace-selector-trigger">
          <div className="layout-workspace-selector-icon">
            {currentWorkspace ? getInitials(currentWorkspace.name) : "W"}
          </div>

          <div className="layout-workspace-selector-content">
            {isLoading ? (
              <div className="layout-workspace-selector-loading" />
            ) : (
              <div className="layout-workspace-selector-title">
                {currentWorkspace ? currentWorkspace.name : "Select Workspace"}
              </div>
            )}
          </div>

          <HiChevronDown className="layout-workspace-selector-chevron" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="layout-workspace-selector-dropdown"
        align="start"
        sideOffset={8}
      >
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleWorkspaceSelect(workspace)}
            className={`layout-workspace-selector-item ${
              currentWorkspace?.id === workspace.id ? "layout-workspace-selector-item-selected" : ""
            }`}
          >
            <Avatar className="layout-workspace-selector-item-avatar">
              <AvatarFallback className="layout-workspace-selector-item-avatar-fallback">
                {getInitials(workspace.name)}
              </AvatarFallback>
            </Avatar>
            <div className="layout-workspace-selector-item-content">
              <div className="layout-workspace-selector-item-name">{workspace.name}</div>
              <div className="layout-workspace-selector-item-description">
                {workspace.description || "No description"}
              </div>
            </div>
            {currentWorkspace?.id === workspace.id && (
              <HiCheck className="layout-workspace-selector-item-check" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
