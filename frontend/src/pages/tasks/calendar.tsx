import ProtectedRoute from "@/components/auth/ProtectedRoute";
import OrganizationProvider from "@/contexts/organization-context";
import WorkspaceProvider from "@/contexts/workspace-context";
import ProjectProvider from "@/contexts/project-context";
import SprintProvider from "@/contexts/sprint-context";
import TaskProvider from "@/contexts/task-context";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Breadcrumb from "@/components/layout/Breadcrumb";
import { Toaster } from "sonner";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTask } from "@/contexts/task-context";
import { useProject } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { TaskViewTabs } from "@/components/tasks/TaskViewTabs";
import TaskCalendarView from "@/components/tasks/views/TaskCalendarView";
import { HiPlus, HiCalendarDays } from "react-icons/hi2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Task } from "@/contexts/task-context";
import { Project } from "@/types";
import ErrorState from "@/components/common/ErrorState";

const LoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-7xl mx-auto p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
        <div className="h-10 bg-muted rounded mb-4"></div>
        <Card>
          <CardContent className="p-6">
            <div className="h-96 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

function TasksCalendarPageContent() {
  const { getTasksByOrganization } = useTask();

  const { getProjectsByUserId } = useProject();

  const { getCurrentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const { getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [displayTasks, setDisplayTasks] = useState<Task[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState("all");

  const isInitializedRef = useRef(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentOrganization) return;
    getUserAccess({ name: "organization", id: currentOrganization?.id })
      .then((data) => {
        setHasAccess(data?.canChange);
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [currentOrganization]);

  const loadData = useCallback(async () => {
    if (!currentUser?.id || !currentOrganization?.id) return;

    try {
      setError(null);
      setIsLoading(true);

      // Load projects for the current user (only on initial load)
      if (!isInitializedRef.current) {
        const projectsData = await getProjectsByUserId(currentUser.id);
        setDisplayProjects(projectsData || []);
      }

      // Prepare parameters for getTasksByOrganization
      const params = {
        page: 1,
        limit: 100, // Load more for calendar view
      };

      // Load tasks from organization
      const result = await getTasksByOrganization(
        currentOrganization.id,
        params
      );
      setDisplayTasks(result.tasks);

      isInitializedRef.current = true;
    } catch (error) {
      console.error("Error loading tasks:", error);
      setError( error?.message ? error.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentOrganization?.id]);

  useEffect(() => {
    if (currentUser?.id && currentOrganization?.id) {
      loadData();
    }
  }, [loadData]);

  const handleRetry = useCallback(() => {
    isInitializedRef.current = false;
    setError(null);
    loadData();
  }, [loadData]);

  // Patch: Normalize tasks to ensure 'key' property exists for type compatibility
  const normalizeTasks = (tasks: any[]): any[] =>
    tasks.map((task) => ({
      ...task,
      key: typeof task.key === "string" ? task.key : task.id || "",
    }));

  // Filter tasks based on selected project
  const filteredTasks =
    selectedProject === "all"
      ? normalizeTasks(displayTasks)
      : normalizeTasks(
          displayTasks.filter((task) => task.projectId === selectedProject)
        );

  if (isLoading && !isInitializedRef.current) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <HiCalendarDays size={20} />
                My Tasks
              </h1>
              <p className="text-sm text-muted-foreground">
                View and manage your tasks by due dates using the calendar view.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Project Filter */}
              <div className="flex items-center gap-2">
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {displayProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add Task Button */}
              {hasAccess && (
                <Button asChild>
                  <Link href="/tasks/new" className="flex items-center gap-2">
                    <HiPlus size={16} />
                    Add Task
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Task Count and Filter Summary */}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {filteredTasks.length} of {displayTasks.length} tasks
            </span>
            <span>•</span>
            <span>Calendar View</span>
            {selectedProject !== "all" && (
              <div className="flex items-center gap-2">
                <span>•</span>
                <span>Filtered by:</span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                  {displayProjects.find((p) => p.id === selectedProject)
                    ?.name || "Project"}
                </span>
                <button
                  onClick={() => setSelectedProject("all")}
                  className="text-primary hover:text-primary/80 text-xs underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6">
          <TaskViewTabs currentView="calendar" baseUrl="/tasks" />
        </div>

        {/* Calendar View */}
        <Card>
          <CardContent className="calendar-wrapper p-6">
            <TaskCalendarView
              tasks={filteredTasks}
              workspaceSlug=""
              projectSlug=""
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function TasksCalendarPage() {
  return (
    <ProtectedRoute>
      <OrganizationProvider>
        <WorkspaceProvider>
          <ProjectProvider>
            <SprintProvider>
              <TaskProvider>
                <div className="min-h-screen bg-[var(--background)]">
                  <div className="flex h-screen">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <Header />
                      <div className="flex-1 overflow-y-auto">
                        <div className="p-4">
                          <Breadcrumb />
                          <TasksCalendarPageContent />
                        </div>
                      </div>
                    </div>
                  </div>
                  <Toaster />
                </div>
              </TaskProvider>
            </SprintProvider>
          </ProjectProvider>
        </WorkspaceProvider>
      </OrganizationProvider>
    </ProtectedRoute>
  );
}
