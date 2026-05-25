import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getSidebarCollapsedState, toggleSidebar as toggleSidebarUtil } from "@/utils/sidebarUtils";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/router";
import ResizableSidebar from "./ResizableSidebar";
import WorkspaceSelector from "./WorkspaceSelector";
import ProjectSelector from "./ProjectSelector";
import WorkspaceTree from "./WorkspaceTree";
import Tooltip from "@/components/common/ToolTip";

import {
  HiHome,
  HiViewGrid,
  HiClipboardList,
  HiUsers,
  HiCalendar,
  HiCog,
  HiMenu,
  HiLightningBolt,
  HiViewBoards,
  HiShieldCheck,
} from "react-icons/hi";
import { useProject } from "@/contexts/project-context";

// Type definitions
interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

const usePathnameParsing = (pathname: string, isMounted: boolean) => {
  return useMemo(() => {
    if (!isMounted) return { currentWorkspaceSlug: null, currentProjectSlug: null };

    const parts = pathname.split("/").filter(Boolean);

    // Check for unparsed route parameters (e.g., [workspaceSlug]) - router not ready yet
    if (parts.some(part => part.startsWith('[') && part.endsWith(']'))) {
      return { currentWorkspaceSlug: null, currentProjectSlug: null };
    }

    // Define global routes that should not be treated as workspace slugs
    const globalRoutes = [
      "dashboard",
      "workspaces",
      "projects",
      "activities",
      "settings",
      "tasks",
      "notifications",
      "admin",
    ];

    // Define workspace-level routes that should not be treated as project slugs
    const workspaceRoutes = ["projects", "members", "activities", "tasks", "analytics", "settings"];

    if (parts.length === 0 || globalRoutes.includes(parts[0])) {
      return { currentWorkspaceSlug: null, currentProjectSlug: null };
    }

    if (parts.length === 1) {
      return { currentWorkspaceSlug: parts[0], currentProjectSlug: null };
    }

    if (parts.length >= 2) {
      // If the second part is a workspace-level route, don't treat it as a project slug
      if (workspaceRoutes.includes(parts[1])) {
        return { currentWorkspaceSlug: parts[0], currentProjectSlug: null };
      }
      return { currentWorkspaceSlug: parts[0], currentProjectSlug: parts[1] };
    }

    return { currentWorkspaceSlug: null, currentProjectSlug: null };
  }, [pathname, isMounted]);
};

export default function Sidebar() {
  const { t } = useTranslation("sidebar");
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];
  const { isAuthenticated, getCurrentUser } = useAuth();
  const isAuth = isAuthenticated();
  const currentUser = getCurrentUser();
  const { getProjectBySlug, currentProject } = useProject();
  const [isMounted, setIsMounted] = useState(false);
  const [miniPathName, setMiniPathName] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return getSidebarCollapsedState();
    }
    return false;
  });
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const { currentWorkspaceSlug, currentProjectSlug } = usePathnameParsing(pathname, isMounted);

  useEffect(() => {
    setIsMounted(true);
    const storedState = getSidebarCollapsedState();
    if (storedState !== isSidebarCollapsed) {
      setIsSidebarCollapsed(storedState);
    }
  }, []);

  const toggleSidebar = (forceValue?: boolean) => {
    setHasUserInteracted(true);
    toggleSidebarUtil(setIsSidebarCollapsed, forceValue);
  };

  useEffect(() => {
    if (!isMounted) return;

    const handleResize = () => {
      if (window.innerWidth < 768 && !isSidebarCollapsed && !hasUserInteracted) {
        toggleSidebarUtil(setIsSidebarCollapsed, true);
      }
    };

    window.addEventListener("resize", handleResize);

    if (!hasUserInteracted) {
      handleResize();
    }

    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarCollapsed, hasUserInteracted]);

  // Handle disabled navigation click
  const handleDisabledClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/login");
  };

  const globalNavItems = useMemo(
    () => [
      {
        name: t("dashboard"),
        href: "/dashboard",
        icon: <HiHome size={16} />,
        title: t("globalDashboard"),
        disabled: !isAuth,
      },
      {
        name: t("workspaces"),
        href: "/workspaces",
        icon: <HiViewGrid size={16} />,
        title: t("allWorkspaces"),
        disabled: !isAuth,
      },
      {
        name: t("projects"),
        href: "/projects",
        icon: <HiViewBoards size={16} />,
        title: t("allProjects"),
        disabled: !isAuth,
      },
      {
        name: t("tasks"),
        href: "/tasks",
        icon: <HiClipboardList size={16} />,
        title: t("allTasks"),
        disabled: !isAuth,
      },
      {
        name: t("activities"),
        href: "/activities",
        icon: <HiCalendar size={16} />,
        title: t("allActivities"),
        disabled: !isAuth,
      },
      // Settings only shown to authenticated users
      ...(isAuth
        ? [
            {
              name: t("settings"),
              href: "/settings",
              icon: <HiCog size={16} />,
              title: t("allSettings"),
              disabled: false,
            },
          ]
        : []),
      // Admin panel only shown to super admins
      ...(isAuth && currentUser?.role === "SUPER_ADMIN"
        ? [
            {
              name: t("admin"),
              href: "/admin",
              icon: <HiShieldCheck size={16} />,
              title: t("systemAdministration"),
              disabled: false,
            },
          ]
        : []),
    ],
    [isAuth, currentUser?.role, t]
  );

  const workspaceNavItems = useMemo(
    () =>
      currentWorkspaceSlug
        ? [
            {
              name: t("overview"),
              href: `/${currentWorkspaceSlug}`,
              icon: <HiViewGrid size={16} />,
              title: t("workspaceOverview"),
              disabled: !isAuth,
            },
            {
              name: t("projects"),
              href: `/${currentWorkspaceSlug}/projects`,
              icon: <HiViewBoards size={16} />,
              title: t("workspaceProjects"),
              disabled: !isAuth,
            },
            {
              name: t("members"),
              href: `/${currentWorkspaceSlug}/members`,
              icon: <HiUsers size={16} />,
              title: t("workspaceMembers"),
              disabled: !isAuth,
            },
            {
              name: t("activities"),
              href: `/${currentWorkspaceSlug}/activities`,
              icon: <HiCalendar size={16} />,
              title: t("workspaceActivity"),
              disabled: !isAuth,
            },
            {
              name: t("tasks"),
              href: `/${currentWorkspaceSlug}/tasks`,
              icon: <HiClipboardList size={16} />,
              title: t("workspaceTasks"),
              disabled: !isAuth,
            },
            // Settings only shown to authenticated users
            ...(isAuth
              ? [
                  {
                    name: t("settings"),
                    href: `/${currentWorkspaceSlug}/settings`,
                    icon: <HiCog size={16} />,
                    title: t("workspaceSettings"),
                    disabled: false,
                  },
                ]
              : []),
          ]
        : [],
    [currentWorkspaceSlug, isAuth, t]
  );

  // Default project navigation items for unauthenticated users (all disabled)
  const defaultProjectNavItems = useMemo(
    () => [
      {
        name: t("overview"),
        href: `/${currentWorkspaceSlug || ""}/${currentProjectSlug || ""}`,
        icon: <HiViewBoards size={16} />,
        title: t("projectOverview"),
        disabled: false, // usually for unauthenticated users
      },
      {
        name: t("tasks"),
        href: `/${currentWorkspaceSlug || ""}/${currentProjectSlug || ""}/tasks`,
        icon: <HiClipboardList size={16} />,
        title: t("tasks"),
        disabled: false,
      },
      {
        name: t("sprints"),
        href: `/${currentWorkspaceSlug || ""}/${currentProjectSlug || ""}/sprints`,
        icon: <HiLightningBolt size={16} />,
        title: t("sprints"),
        disabled: false,
      },
      // {
      //   name: "Calendar",
      //   href: `/${currentWorkspaceSlug || ""}/${currentProjectSlug || ""}/calendar`,
      //   icon: <HiCalendar size={16} />,
      //   title: "Calendar",
      //   disabled: false,
      // },
      // {
      //   name: "Members",
      //   href: `/${currentWorkspaceSlug || ""}/${currentProjectSlug || ""}/members`,
      //   icon: <HiUsers size={16} />,
      //   title: "Members",
      //   disabled: false,
      // },
    ],
    [currentWorkspaceSlug, currentProjectSlug]
  );

  const projectNavItems = useMemo(() => {
    // If user is not authenticated, show default project items (disabled)
    if (!isAuth) {
      return defaultProjectNavItems;
    }

    // If user is authenticated, show actual project items
    return currentWorkspaceSlug && currentProjectSlug
      ? [
          {
            name: t("overview"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}`,
            icon: <HiViewBoards size={16} />,
            title: t("projectOverview"),
            disabled: false,
          },
          {
            name: t("tasks"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}/tasks`,
            icon: <HiClipboardList size={16} />,
            title: t("tasks"),
            disabled: false,
          },
          {
            name: t("sprints"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}/sprints`,
            icon: <HiLightningBolt size={16} />,
            title: t("sprints"),
            disabled: false,
          },
          {
            name: t("calendar"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}/calendar`,
            icon: <HiCalendar size={16} />,
            title: t("calendar"),
            disabled: false,
          },
          {
            name: t("members"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}/members`,
            icon: <HiUsers size={16} />,
            title: t("members"),
            disabled: false,
          },
          {
            name: t("settings"),
            href: `/${currentWorkspaceSlug}/${currentProjectSlug}/settings`,
            icon: <HiCog size={16} />,
            title: t("settings"),
            disabled: false,
          },
        ]
      : [];
  }, [currentWorkspaceSlug, currentProjectSlug, isAuth, defaultProjectNavItems, t]);

  const navigationItems: NavItem[] = useMemo(() => {
    // For unauthenticated users, always show project navigation (disabled)
    if (!isAuth) {
      return defaultProjectNavItems;
    }

    // For authenticated users, use existing logic
    if (currentWorkspaceSlug && currentProjectSlug) return projectNavItems;
    if (currentWorkspaceSlug) return workspaceNavItems;
    return globalNavItems;
  }, [
    isAuth,
    currentWorkspaceSlug,
    currentProjectSlug,
    globalNavItems,
    workspaceNavItems,
    projectNavItems,
    defaultProjectNavItems,
  ]);

  const miniSidebarNavItems = useMemo(() => {
    // For unauthenticated users, use global nav items for mini sidebar (disabled)
    if (!isAuth) {
      setMiniPathName("/workspaces");
      return globalNavItems;
    }

    if (currentWorkspaceSlug && currentProjectSlug) {
      if (isSidebarCollapsed) {
        setMiniPathName(`/${currentWorkspaceSlug}/${currentProjectSlug}`);
        return projectNavItems;
      }
      setMiniPathName(`/${currentWorkspaceSlug}`);
      return workspaceNavItems;
    }

    if (currentWorkspaceSlug) {
      if (isSidebarCollapsed) {
        setMiniPathName(`/${currentWorkspaceSlug}`);
        return workspaceNavItems;
      }
      return globalNavItems;
    }

    if (isSidebarCollapsed) {
      setMiniPathName("/dashboard");
      return globalNavItems;
    }
    return [];
  }, [
    isAuth,
    currentWorkspaceSlug,
    currentProjectSlug,
    globalNavItems,
    workspaceNavItems,
    isSidebarCollapsed,
  ]);

  // Listen for sidebar state changes from other components
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent) => {
      setIsSidebarCollapsed(event.detail.collapsed);
    };

    window.addEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);

    return () => {
      window.removeEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);
    };
  }, []);
  useEffect(() => {
    const fetchProject = async () => {
      if (!currentWorkspaceSlug || !currentProjectSlug) {
        return;
      }
      try {
        if (!isAuth) {
          const project = await getProjectBySlug(currentProjectSlug, isAuth, currentWorkspaceSlug);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch project:", error);
      }
    };

    fetchProject();
  }, [isAuth, currentWorkspaceSlug, currentProjectSlug, defaultProjectNavItems]);

  const normalize = (url) => url.replace(/\/$/, "");

  const isActive = (pathname, itemHref, isBase = false) => {
    const current = normalize(pathname);
    const target = normalize(itemHref);

    if (isBase) {
      return current === target;
    }

    return current === target || current.startsWith(target + "/");
  };

  const renderFullSidebar = () => (
    <div className="layout-sidebar-full">
      <div className="layout-sidebar-header">
        {/* Unauthenticated State - Show "Project" Header */}
        {!isAuth && (
          <div className="layout-sidebar-header-dashboard">
            <div className="layout-sidebar-header-dashboard-content">
              <div className="layout-sidebar-header-dashboard-icon">
                <HiViewBoards size={16} />
              </div>
              <span className="layout-sidebar-header-dashboard-title">
                {currentProject ? currentProject.name : t("project")}
              </span>
            </div>
          </div>
        )}

        {/* Authenticated State - Original Logic */}
        {isAuth && (
          <>
            {/* Global Dashboard */}
            {!currentWorkspaceSlug &&
              globalNavItems.length > 0 &&
              (() => {
                const activeItem = globalNavItems.find(
                  (item) => pathname.replace(/\/$/, "") === item.href.replace(/\/$/, "")
                );

                return (
                  <div className="layout-sidebar-header-dashboard">
                    <div className="layout-sidebar-header-dashboard-content">
                      <div className="layout-sidebar-header-dashboard-icon">
                        {activeItem ? activeItem.icon : "TS"}
                      </div>
                      <span className="layout-sidebar-header-dashboard-title">
                        {activeItem ? activeItem.name : "Taskosaur"}
                      </span>
                    </div>
                  </div>
                );
              })()}

            {/* Workspace Level */}
            {currentWorkspaceSlug && !currentProjectSlug && (
              <WorkspaceSelector currentWorkspaceSlug={currentWorkspaceSlug} />
            )}

            {/* Project Level */}
            {currentWorkspaceSlug && currentProjectSlug && (
              <ProjectSelector
                currentWorkspaceSlug={currentWorkspaceSlug}
                currentProjectSlug={currentProjectSlug}
              />
            )}
          </>
        )}
      </div>

      <nav className="layout-sidebar-nav">
        <ul className="layout-sidebar-nav-list">
          {navigationItems.map((item) => {
            const isItemActive = isActive(pathname, item.href, item.name === "Overview");

            return (
              <li key={item.name} className="layout-sidebar-nav-item">
                {item.disabled ? (
                  // Disabled navigation item
                  <div
                    className={`layout-sidebar-nav-link layout-sidebar-nav-link-disabled ${
                      isItemActive
                        ? "layout-sidebar-nav-link-active"
                        : "layout-sidebar-nav-link-inactive"
                    }`}
                    onClick={handleDisabledClick}
                    style={{ cursor: "pointer", opacity: 0.6 }}
                    title={t("loginRequired")}
                  >
                    <span className="layout-sidebar-nav-link-icon">{item.icon}</span>
                    <span className="layout-sidebar-nav-link-text">{item.name}</span>
                  </div>
                ) : (
                  // Enabled navigation item
                  <Link
                    href={item.href}
                    className={`layout-sidebar-nav-link ${
                      isItemActive
                        ? "layout-sidebar-nav-link-active"
                        : "layout-sidebar-nav-link-inactive"
                    }`}
                    {...(item.name === "Settings" && {
                      "data-automation-id": item.href === "/settings"
                        ? "sidebar-org-settings"
                        : item.href.endsWith("/settings") && item.href.split("/").length === 3
                        ? "sidebar-workspace-settings"
                        : "sidebar-project-settings",
                      "aria-label": item.title || "Settings"
                    })}
                  >
                    <span className="layout-sidebar-nav-link-icon">{item.icon}</span>
                    <span className="layout-sidebar-nav-link-text">{item.name}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {isAuth && currentWorkspaceSlug && !currentProjectSlug && (
          <>
            <div className="mt-4 mb-2 mx-3 border-t border-[var(--sidebar-border)]" />
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-wider">
              {t("workspaces")}
              </span>
            </div>
            <WorkspaceTree currentWorkspaceSlug={currentWorkspaceSlug} />
          </>
        )}
      </nav>
    </div>
  );

  const renderMiniSidebar = () => {
    if (!isMounted) {
      return (
        <div className="layout-sidebar-mini">
          <div className="mb-6 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--sidebar-muted)]">
            <HiMenu size={16} />
          </div>
          <div className="flex-grow flex flex-col items-center gap-4"></div>
        </div>
      );
    }
    return (
      <div className="layout-sidebar-mini">
        <Tooltip content={t("expandNavigation")} position="right">
          <button
            onClick={() => toggleSidebar(!isSidebarCollapsed)}
            className="layout-sidebar-mini-expand-button"
          >
            <HiMenu size={16} />
          </button>
        </Tooltip>

        <div className="layout-sidebar-mini-nav">
          {miniSidebarNavItems.map((item) => {
            const isItemActive = isActive(pathname, item.href, item.name === "Overview");
            const linkProps = item.disabled
              ? {
                  onClick: handleDisabledClick,
                  style: { cursor: "pointer", opacity: 0.6 },
                }
              : {};

            return item.disabled ? (
              <Tooltip key={item.name} content={t("loginRequired")} position="right">
                <div
                  className={`layout-sidebar-mini-nav-link layout-sidebar-mini-nav-link-disabled ${
                    isItemActive
                      ? "layout-sidebar-nav-link-active"
                      : "layout-sidebar-mini-nav-link-inactive"
                  }`}
                  {...linkProps}
                >
                  {item.icon}
                </div>
              </Tooltip>
            ) : (
              <Tooltip key={item.name} content={item.title || item.name} position="right">
                <Link
                  href={item.href}
                  className={`layout-sidebar-mini-nav-link ${
                    isItemActive
                      ? "layout-sidebar-nav-link-active"
                      : "layout-sidebar-mini-nav-link-inactive"
                  }`}
                >
                  {item.icon}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  // Hide sidebar on /organization page
  const isOrganizationPage = isMounted && pathname === "/organization";

  if (isOrganizationPage) {
    return null;
  }

  return (
    <>
      {isSidebarCollapsed && (
        <Tooltip content={t("showNavigation")} position="right">
          <button
            onClick={() => toggleSidebar(!isSidebarCollapsed)}
            className="layout-sidebar-toggle-button"
          >
            <HiMenu size={16} />
          </button>
        </Tooltip>
      )}

      <div className="layout-sidebar-container">
        <div
          className={`layout-sidebar-wrapper ${
            isSidebarCollapsed
              ? "layout-sidebar-wrapper-collapsed"
              : "layout-sidebar-wrapper-expanded"
          }`}
        >
          <div className="layout-sidebar-mini">
            {/* Mini sidebar content */}
            {renderMiniSidebar()}
          </div>

          <div className="layout-sidebar-main">
            {isMounted ? (
              <ResizableSidebar minWidth={200} maxWidth={400} className="layout-sidebar-resizable">
                {renderFullSidebar()}
              </ResizableSidebar>
            ) : (
              <div className="layout-sidebar-resizable-fallback">{renderFullSidebar()}</div>
            )}
          </div>
        </div>
      </div>

      {!isSidebarCollapsed && (
        <div
          className="layout-sidebar-overlay"
          onClick={() => toggleSidebar(!isSidebarCollapsed)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
