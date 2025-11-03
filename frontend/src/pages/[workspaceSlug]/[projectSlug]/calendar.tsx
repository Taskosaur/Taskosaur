import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import TaskCalendarView from "@/components/tasks/views/TaskCalendarView";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjectContext } from "@/contexts/project-context";
import { useTask } from "@/contexts/task-context";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import ActionButton from "@/components/common/ActionButton";
import { Card, CardContent } from "@/components/ui/card";
import { HiCalendarDays } from "react-icons/hi2";
import ErrorState from "@/components/common/ErrorState";

const LoadingSkeleton = () => (
  <div className="flex min-h-screen bg-[var(--background)]">
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 bg-[var(--muted)] rounded w-20"></div>
            <div className="h-4 bg-[var(--muted)] rounded w-4"></div>
            <div className="h-4 bg-[var(--muted)] rounded w-24"></div>
          </div>

          {/* Header skeleton */}
          <div className="space-y-2">
            <div className="h-6 bg-[var(--muted)] rounded w-1/3"></div>
            <div className="h-4 bg-[var(--muted)] rounded w-1/2"></div>
          </div>

          {/* Controls skeleton */}
          <div className="h-10 bg-[var(--muted)] rounded w-32"></div>

          {/* Calendar skeleton */}
          <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none">
            <CardContent className="p-6">
              <div className="h-96 bg-[var(--muted)] rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
);

function ProjectTasksCalendarPageContent() {
  const router = useRouter();
  const { workspaceSlug, projectSlug } = router.query;
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAcess] = useState(null);

  const authContext = useAuth();
  const workspaceContext = useWorkspaceContext();
  const projectContext = useProjectContext();
  const taskContext = useTask();

  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);

  // Track the current route to prevent duplicate calls
  const currentRouteRef = useRef<string>("");
  const isFirstRenderRef = useRef(true);

  const findProjectBySlug = (projects: any[], slug: string) => {
    return projects.find((project) => project.slug === slug);
  };
  const organizationId =
    localStorage.getItem("currentOrganizationId") || localStorage.getItem("organizationId");
  const handleTaskCreated = async () => {
    try {
      if (projectData?.id) {
        const tasks = await taskContext.getCalendarTask(organizationId, {
          projectId: projectData.id,
        });
        setProjectTasks(Array.isArray(tasks) ? tasks : []);
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
    }
  };
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDataLoaded(false);

      // Check authentication
      if (!authContext.isAuthenticated()) {
        router.push("/auth/login");
        return;
      }

      if (typeof workspaceSlug !== "string" || typeof projectSlug !== "string") {
        setError("Invalid workspace or project slug");
        setLoading(false);
        return;
      }

      const workspace = await workspaceContext.getWorkspaceBySlug(workspaceSlug);
      if (!workspace) {
        setError("Workspace not found");
        setLoading(false);
        return;
      }
      setWorkspaceData(workspace);

      const projects = await projectContext.getProjectsByWorkspace(workspace.id);
      const project = findProjectBySlug(projects || [], projectSlug);

      if (!project) {
        setError("Project not found");
        setLoading(false);
        return;
      }
      setProjectData(project);

      const tasks = await taskContext.getCalendarTask(organizationId, {
        projectId: project.id,
      });
      setProjectTasks(tasks || []);

      setDataLoaded(true);
    } catch (err) {
      console.error("Error loading page data:", err);
      setError(err?.message ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectData?.id) return;
    getUserAccess({ name: "project", id: projectData?.id })
      .then((data) => {
        setHasAccess(data?.canChange);
        setUserAcess(data);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [projectData]);

  useEffect(() => {
    if (!workspaceSlug || !projectSlug) return;

    const currentRoute = `${workspaceSlug}/${projectSlug}/tasks/calendar`;

    // Prevent duplicate calls for the same route
    if (currentRouteRef.current === currentRoute && !isFirstRenderRef.current) {
      return;
    }

    // Only reset state and fetch if this is a new route
    if (currentRouteRef.current !== currentRoute) {
      setWorkspaceData(null);
      setProjectData(null);
      setProjectTasks([]);
      setError(null);
      setDataLoaded(false);

      currentRouteRef.current = currentRoute;
      loadData();
    }

    isFirstRenderRef.current = false;
  }, [workspaceSlug, projectSlug]);

  if (loading || !dataLoaded) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={loadData} />;
  }

  if (!workspaceData || !projectData) {
    return <ErrorState error="Project or workspace not found" onRetry={loadData} />;
  }

  return (
    <div className="dashboard-container">
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="min-h-screen">
            <div className="flex flex-col gap-4">
              <PageHeader
                title={`${projectData?.name} Calendar`}
                description={`View and manage tasks for ${projectData?.name} project in calendar format.`}
                actions={
                  userAccess?.role !== "VIEWER" && (
                    <ActionButton primary showPlusIcon onClick={() => setNewTaskModalOpen(true)}>
                      Create Task
                    </ActionButton>
                  )
                }
              />

              {/* Calendar Content */}
              <Card className="h-full border-none shadow-none p-0">
                <CardContent className="p-0">
                  {/* Calendar View */}
                  <div className="">
                    {projectTasks.length === 0 ? (
                      <div className="text-center py-12 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 mb-4 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                          <HiCalendarDays className="w-6 h-6 text-[var(--muted-foreground)]" />
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                          No tasks found
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mb-4">
                          Create your first task for {projectData?.name} to see it on the calendar
                        </p>
                        {userAccess?.role !== "VIEWER" && (
                          <ActionButton
                            variant="outline"
                            showPlusIcon
                            onClick={() => setNewTaskModalOpen(true)}
                          >
                            Create Task
                          </ActionButton>
                        )}
                      </div>
                    ) : (
                      <TaskCalendarView
                        tasks={projectTasks}
                        workspaceSlug={workspaceSlug as string}
                        projectSlug={projectSlug as string}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onTaskCreated={handleTaskCreated}
        workspaceSlug={workspaceSlug as string}
        projectSlug={projectSlug as string}
      />
    </div>
  );
}

export default function ProjectTasksCalendarPage() {
  return <ProjectTasksCalendarPageContent />;
}
