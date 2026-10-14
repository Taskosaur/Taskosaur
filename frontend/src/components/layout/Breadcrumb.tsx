import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useOrganization } from "@/contexts/organization-context";
import { workspaceApi } from "@/utils/api/workspaceApi";
import { projectApi } from "@/utils/api/projectApi";
import { useWorkspace } from "@/contexts/workspace-context";

// Helper: Convert slug-like text into Title Case
const formatSegment = (segment: string) => {
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

// Helper: Detect if a segment is a UUID
const isUUID = (segment: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
};

// Helper: Extract UUID from taskId (format: uuid-slug)
const extractUuid = (taskId: string) => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = taskId.match(uuidPattern);
  return match ? match[0] : taskId;
};

interface BreadcrumbItem {
  name: string;
  href?: string;
  current: boolean;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const { currentOrganization } = useOrganization();
  const { workspaceTree } = useWorkspace();
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Sync with actual window location (handles pushState)
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Initial sync
    updatePath();
    
    // Listen to popstate (back/forward)
    window.addEventListener('popstate', updatePath);
    
    // Monkey-patch history.pushState and replaceState to detect URL changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      updatePath();
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      updatePath();
    };
    
    return () => {
      window.removeEventListener('popstate', updatePath);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Use currentPath (from window.location) instead of pathname (from Next.js)
  const pathToUse = currentPath || pathname;

  useEffect(() => {
    if (!pathToUse) {
      setBreadcrumbs([]);
      return;
    }

    // Skip breadcrumb for certain paths
    if (
      pathToUse === "/dashboard" ||
      pathToUse === "/dashboard/" ||
      pathToUse === "/tasks" ||
      pathToUse === "/tasks/" ||
      pathToUse === "/settings" ||
      pathToUse === "/settings/"
    ) {
      setBreadcrumbs([]);
      return;
    }

    const segments = pathToUse.split("/").filter((seg) => seg.length > 0);

    if (segments[segments.length - 1] === "docs") {
      let active = true;
      if (segments[0] === "organization") {
        setBreadcrumbs([{ name: currentOrganization?.name || "Organization", href: "/dashboard", current: false }, { name: "Docs", current: true }]);
      } else {
        const organizationId = currentOrganization?.id;
        if (!organizationId || !isUUID(organizationId)) {
          setBreadcrumbs([]);
          return;
        }
        Promise.resolve().then(() => Promise.all([
          workspaceApi.getWorkspaceBySlug(segments[0], organizationId),
          segments.length === 3 ? projectApi.getProjectBySlug(segments[1], true, segments[0]) : Promise.resolve(null),
        ])).then(([ws, pr]) => {
          if (!active) return;
          setBreadcrumbs([
            { name: ws.name, href: `/${ws.slug}`, current: false },
            ...(pr ? [{ name: pr.name, href: `/${ws.slug}/${pr.slug}`, current: false }] : []),
            { name: "Docs", current: true },
          ]);
        }).catch(() => { if (active) buildBreadcrumbFromSegments(segments); });
      }
      return () => { active = false; };
    }

    // Check if this is a sprint detail page: /[workspace]/[project]/sprints/[sprintId]
    const isSprintDetail = segments.length === 4 &&
                           segments[2] === 'sprints' &&
                           segments[3];

    // Check if this is a task detail page
    // Patterns: /tasks/[slug], /[workspace]/tasks/[slug], /[workspace]/[project]/tasks/[slug]
    const taskSegmentIndex = segments.findIndex((seg, idx) => seg === 'tasks' && idx < segments.length - 1);

    // Handle sprint detail page
    if (isSprintDetail) {
      const sprintIdOrSlug = segments[3];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sprintIdOrSlug);

      const fetchSprintBreadcrumb = async () => {
        try {
          const sprintResponse = isUUID
            ? await api.get(`/sprints/${encodeURIComponent(sprintIdOrSlug)}`)
            : await api.get(`/sprints/by-slug/${encodeURIComponent(segments[1])}/${encodeURIComponent(sprintIdOrSlug)}`);
          const sprint = sprintResponse.data;

          const items: BreadcrumbItem[] = [];

          // Add workspace
          if (segments[0]) {
            items.push({
              name: formatSegment(segments[0]),
              href: `/${segments[0]}`,
              current: false,
            });
          }

          // Add project
          if (segments[1]) {
            items.push({
              name: formatSegment(segments[1]),
              href: `/${segments[0]}/${segments[1]}`,
              current: false,
            });
          }

          // Add sprint name (current)
          items.push({
            name: sprint?.name || formatSegment(sprintIdOrSlug),
            current: true,
          });

          setBreadcrumbs(items);
        } catch (error) {
          console.error('Failed to fetch sprint data for breadcrumb:', error);
          buildBreadcrumbFromSegments(segments);
        }
      };
      fetchSprintBreadcrumb();
      return;
    }

    if (taskSegmentIndex !== -1 && taskSegmentIndex < segments.length - 1) {
      const taskIdOrSlug = segments[taskSegmentIndex + 1];

      const fetchTaskBreadcrumb = async () => {
        try {
          const response = await api.get(`/tasks/key/${encodeURIComponent(taskIdOrSlug)}`);
          const task = response.data;

          const items: BreadcrumbItem[] = [];

          const urlWorkspace = taskSegmentIndex >= 1 && segments[0] !== 'tasks' ? segments[0] : null;
          const urlProject = taskSegmentIndex >= 2 && segments[1] !== 'tasks' ? segments[1] : null;

          const wsSlug = urlWorkspace || task.project?.workspace?.slug;
          const wsName = task.project?.workspace?.name;

          const pgSlug = urlProject || task.project?.slug;
          const pgName = task.project?.name;

          // Add workspace
          if (wsSlug) {
            items.push({
              name: wsName || formatSegment(wsSlug),
              href: `/${wsSlug}`,
              current: false,
            });
          }

          // Add project
          if (pgSlug && wsSlug) {
            items.push({
              name: pgName || formatSegment(pgSlug),
              href: `/${wsSlug}/${pgSlug}`,
              current: false,
            });
          }

          if (pgSlug && wsSlug) {
            items.push({
              name: 'Tasks',
              href: `/${wsSlug}/${pgSlug}/tasks`,
              current: false,
            });
          }

          // Add task (current)
          const taskSlug = task.slug || taskIdOrSlug;
          items.push({
            name: decodeURIComponent(taskSlug).replace(/-/g, ' '),
            current: true,
          });

          setBreadcrumbs(items);
        } catch (error) {
          console.error('Failed to fetch task data for breadcrumb:', error);
          buildBreadcrumbFromSegments(segments);
        }
      };
      fetchTaskBreadcrumb();
      return;
    }

    // Default: build breadcrumb from URL segments
    buildBreadcrumbFromSegments(segments);
  }, [pathToUse, currentOrganization?.id, currentOrganization?.name]);

  const buildBreadcrumbFromSegments = (segments: string[]) => {
    const baseItems: BreadcrumbItem[] = [];
    const workspaceSegment = segments[0];

    if (workspaceTree && workspaceTree.length > 0 && workspaceSegment) {
      const workspace = workspaceTree.find(w => w.slug === workspaceSegment);
      if (workspace && workspace.path) {
        const ancestorIds = workspace.path.split('/').filter(Boolean);
        if (ancestorIds[ancestorIds.length - 1] === workspace.id) {
          ancestorIds.pop();
        }

        ancestorIds.forEach(id => {
          const ancestor = workspaceTree.find(w => w.id === id);
          if (ancestor) {
            baseItems.push({
              name: ancestor.name,
              href: `/${ancestor.slug}`,
              current: false,
            });
          }
        });
      }
    }

    const items = segments.map((seg, idx) => {
      const href = "/" + segments.slice(0, idx + 1).join("/");
      let displayName = formatSegment(seg);

      if (idx === 0 && workspaceTree && workspaceTree.length > 0) {
        const ws = workspaceTree.find(w => w.slug === seg);
        if (ws) displayName = ws.name;
      }

      return {
        name: displayName,
        href,
        current: idx === segments.length - 1,
      };
    });

    setBreadcrumbs([...baseItems, ...items]);
  };

  if (
    !pathToUse ||
    pathToUse === "/dashboard" ||
    pathToUse === "/dashboard/" ||
    pathToUse === "/tasks" ||
    pathToUse === "/tasks/" ||
    pathToUse === "/settings" ||
    pathToUse === "/settings/" ||
    breadcrumbs.length === 0
  ) {
    return null;
  }

  return (
    <div className="breadcrumb-container">
      <div className="">
        <ShadcnBreadcrumb>
          <BreadcrumbList className="breadcrumb-nav">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="breadcrumb-link">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="breadcrumb-separator">
              <ChevronRight className="breadcrumb-separator-icon" />
            </BreadcrumbSeparator>
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={item.href}>
                <BreadcrumbItem className="breadcrumb-item">
                  {item.current ? (
                    <BreadcrumbPage className="breadcrumb-current">
                      <span className="breadcrumb-current-text">{item.name}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href} className="breadcrumb-link">
                        <span className="breadcrumb-link-text">{item.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="breadcrumb-separator">
                    <ChevronRight className="breadcrumb-separator-icon" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </ShadcnBreadcrumb>
      </div>
    </div>
  );
}
