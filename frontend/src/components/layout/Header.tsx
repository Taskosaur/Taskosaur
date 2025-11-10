import { useState, useEffect, useCallback } from "react";
import { getSidebarCollapsedState } from "@/utils/sidebarUtils";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import OrganizationSelector from "../header/OrganizationSelector";
import InvitationManager from "../header/InvitationManager";
import UserProfileMenu from "../header/UserProfileMenu";
import NotificationDropdown from "../header/NotificationDropdown";
import { ModeToggle } from "../header/ModeToggle";
import { useAuth } from "@/contexts/auth-context";
import { useChatContext } from "@/contexts/chat-context";
import { useRouter } from "next/router";
import {
  HiPlus,
  HiChevronDown,
  HiCommandLine,
  HiRocketLaunch,
  HiChatBubbleLeftRight,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { NewProjectModal } from "@/components/projects/NewProjectModal";
import NewWorkspaceDialog from "../workspace/NewWorkspaceDialogProps";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import SearchManager from "../header/SearchManager";
import HeaderView from "../ui/mobile/HeaderView";

const LoginButton = () => {
  const router = useRouter();

  const handleLogin = () => {
    router.push("/login");
  };

  return (
    <Button onClick={handleLogin} variant="default" className="header-login-button">
      Login
    </Button>
  );
};

export default function Header() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const { getCurrentOrganizationId } = useWorkspaceContext();
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [hasOrganizationAccess, setHasOrganizationAccess] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const { getCurrentUser, logout, checkOrganizationAndRedirect, isAuthenticated } = useAuth();
  const isAuth = isAuthenticated();
  const { getWorkspacesByOrganization } = useWorkspaceContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const currentOrganizationId = getCurrentOrganizationId();

  const chatContext = useChatContext();
  const toggleChat = chatContext?.toggleChat;
  const isChatOpen = chatContext?.isChatOpen;
  const [isAIEnabled, setIsAIEnabled] = useState(false);

  const refetchWorkspaces = useCallback(async () => {
    try {
      if (currentOrganizationId) {
        await getWorkspacesByOrganization(currentOrganizationId);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    }
  }, []);

  useEffect(() => {
    if (!currentOrganizationId) return;
    getUserAccess({ name: "organization", id: currentOrganizationId })
      .then((data) => {
        setHasAccess(data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [currentOrganizationId]);

  useEffect(() => {
    const initializeComponent = async () => {
      const user = getCurrentUser();
      setCurrentUser(user);

      if (user?.id) {
        const redirectPath = await checkOrganizationAndRedirect();
        setHasOrganizationAccess(redirectPath !== "/organization");
      }
    };

    initializeComponent();
  }, [getCurrentUser, checkOrganizationAndRedirect]);

  // Check AI enabled status
  useEffect(() => {
    const checkAIStatus = () => {
      const aiEnabled = localStorage.getItem("aiEnabled") === "true";
      setIsAIEnabled(aiEnabled);
    };

    // Check on mount
    checkAIStatus();

    // Listen for AI settings changes
    const handleAISettingsChange = (event: CustomEvent) => {
      setIsAIEnabled(event.detail.aiEnabled);
    };

    window.addEventListener("aiSettingsChanged", handleAISettingsChange as EventListener);

    return () => {
      window.removeEventListener("aiSettingsChanged", handleAISettingsChange as EventListener);
    };
  }, []);

  const pathname = router.pathname;
  const pathParts = pathname?.split("/").filter(Boolean);

  const getContextLevel = () => {
    if (pathParts?.length === 0) return "global";

    if (
      pathParts?.length === 1 &&
      ["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0])
    ) {
      return "global";
    }

    if (
      pathParts?.length > 1 &&
      ["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0])
    ) {
      return "global-nested";
    }

    if (
      pathParts?.length === 1 &&
      !["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0])
    ) {
      return "workspace";
    }

    if (
      pathParts?.length === 2 &&
      !["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0]) &&
      ["projects", "members", "activity", "tasks", "analytics", "settings"].includes(pathParts[1])
    ) {
      return "workspace";
    }

    if (
      pathParts?.length > 2 &&
      !["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0]) &&
      ["projects", "members", "activity", "tasks", "analytics", "settings"].includes(pathParts[1])
    ) {
      return "workspace-nested";
    }

    if (
      pathParts?.length >= 2 &&
      !["dashboard", "workspaces", "activity", "settings", "tasks"].includes(pathParts[0]) &&
      !["projects", "members", "activity", "tasks", "analytics", "settings"].includes(pathParts[1])
    ) {
      return "project";
    }

    return "unknown";
  };

  const contextLevel = getContextLevel();

  const workspaceSlugFromUrl =
    contextLevel === "workspace" ||
    contextLevel === "workspace-nested" ||
    contextLevel === "project"
      ? workspaceSlug
      : null;

  const projectSlugFromUrl = contextLevel === "project" ? projectSlug : null;

  useEffect(() => {
    const checkSidebarState = () => {
      getSidebarCollapsedState();
    };

    checkSidebarState();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebarCollapsed") {
        checkSidebarState();
      }
    };

    const handleSidebarStateChange = () => {
      // setIsSidebarCollapsed(e.detail.collapsed);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  const headerOptions = [
    {
      component: (
        <NotificationDropdown
          userId={currentUser?.id}
          organizationId={getCurrentOrganizationId()}
        />
      ),
    },
    {
      component: <InvitationManager userId={currentUser?.id} />,
    },
    { component: <ModeToggle /> },
    {
      component: (
        <div className="search-manager-header">
          <SearchManager />
        </div>
      ),
    },
  ];

  // Render unauthenticated header
  if (!isAuth) {
    return (
      <header className="header-container">
        <div className="header-content">
          {/* Right Section - Login button only */}
          <div className="justify-end w-full flex items-center space-x-4">
            <LoginButton />
            <ModeToggle />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="header-container">
        <div className="header-content">
          {/* Left Section - Create Button */}
          <div className="header-left">
            {hasOrganizationAccess && (
              <div className={`transition-all duration-300 ease-in-out `}>
                <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                  {hasAccess &&
                    (contextLevel === "global" ||
                      contextLevel === "workspace" ||
                      contextLevel === "project") && (
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" className="header-create-button">
                          <HiPlus className="size-4" />
                          <span className="hidden sm:inline">Create</span>
                          <HiChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    )}

                  <DropdownMenuContent
                    className="header-dropdown-content"
                    align="start"
                    sideOffset={8}
                  >
                    <div className="header-dropdown-header">
                      <h3 className="header-dropdown-title">Create New</h3>
                    </div>

                    <div className="p-2 space-y-1">
                      {contextLevel === "global" && (
                        <>
                          <DropdownMenuItem asChild>
                            <NewWorkspaceDialog
                              open={isWorkspaceDialogOpen}
                              onOpenChange={setIsWorkspaceDialogOpen}
                              refetchWorkspaces={refetchWorkspaces}
                            >
                              <div className="header-dropdown-item">
                                <div className="header-dropdown-icon">
                                  <HiCommandLine className="header-dropdown-icon-inner" />
                                </div>
                                <div className="header-dropdown-item-content">
                                  <div className="header-dropdown-item-title">New Workspace</div>
                                  <div className="header-dropdown-item-description">
                                    Create a workspace for your team
                                  </div>
                                </div>
                              </div>
                            </NewWorkspaceDialog>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="header-dropdown-item"
                            onSelect={() => {
                              setShowNewProjectModal(true);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <div className="header-dropdown-icon">
                              <HiRocketLaunch className="header-dropdown-icon-inner" />
                            </div>
                            <div className="header-dropdown-item-content">
                              <div className="header-dropdown-item-title">New Project</div>
                              <div className="header-dropdown-item-description">
                                Start a new project
                              </div>
                            </div>
                          </DropdownMenuItem>
                        </>
                      )}

                      {contextLevel === "workspace" && (
                        <DropdownMenuItem
                          className="header-dropdown-item"
                          onSelect={() => {
                            setShowNewProjectModal(true);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="header-dropdown-icon">
                            <HiRocketLaunch className="header-dropdown-icon-inner" />
                          </div>
                          <div className="header-dropdown-item-content">
                            <div className="header-dropdown-item-title">New Project</div>
                            <div className="header-dropdown-item-description">
                              Start a new project
                            </div>
                          </div>
                        </DropdownMenuItem>
                      )}

                      {contextLevel === "project" && (
                        <DropdownMenuItem
                          className="header-dropdown-item"
                          onSelect={() => {
                            setShowNewTaskModal(true);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="header-dropdown-icon">
                            <HiPlus className="header-dropdown-icon-inner" />
                          </div>
                          <div className="header-dropdown-item-content">
                            <div className="header-dropdown-item-title">New Task</div>
                            <div className="header-dropdown-item-description">
                              Add a task to this project
                            </div>
                          </div>
                        </DropdownMenuItem>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Right Section - Actions & User Menu */}
          <div className="header-right">
            <div className="hidden min-[531px]:contents">
              <div className="header-center">
                {hasOrganizationAccess && <OrganizationSelector />}
              </div>

              {hasOrganizationAccess && (
                <>
                  {headerOptions.map(({ component }, idx) => (
                    <span key={idx}>{component}</span>
                  ))}

                  {toggleChat && isAIEnabled && (
                    <div className="relative">
                      <Button
                        onClick={toggleChat}
                        variant="ghost"
                        size="icon"
                        aria-label="Toggle AI Chat"
                        className={`header-mode-toggle transition-all duration-200 ${
                          isChatOpen
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 ring-2 ring-blue-500/20"
                            : ""
                        }`}
                      >
                        <HiChatBubbleLeftRight
                          className={`header-mode-toggle-icon transition-colors duration-200 ${
                            isChatOpen ? "text-blue-600 dark:text-blue-400 scale-110" : ""
                          }`}
                        />
                      </Button>
                      {isChatOpen && (
                        <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                      )}
                    </div>
                  )}

                  <div className="header-divider" />
                </>
              )}
            </div>

            <UserProfileMenu
              user={currentUser}
              onLogout={handleLogout}
              hasOrganizationAccess={hasOrganizationAccess}
            />
            <div className="max-[530px]:block hidden">
              {hasOrganizationAccess && (
                <HeaderView
                  currentUser={currentUser}
                  currentOrganizationId={currentOrganizationId}
                  hasOrganizationAccess={hasOrganizationAccess}
                  toggleChat={toggleChat}
                  isChatOpen={isChatOpen}
                  isAIEnabled={isAIEnabled}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {hasOrganizationAccess && showNewProjectModal && (
        <NewProjectModal
          isOpen={true}
          onClose={() => {
            setShowNewProjectModal(false);
          }}
          workspaceSlug={workspaceSlugFromUrl as string}
        />
      )}

      {hasOrganizationAccess && showNewTaskModal && (
        <NewTaskModal
          isOpen={true}
          onClose={() => {
            setShowNewTaskModal(false);
          }}
          isAuth={isAuth}
          workspaceSlug={workspaceSlugFromUrl as string}
          projectSlug={projectSlugFromUrl as string}
        />
      )}
    </>
  );
}
