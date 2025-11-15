import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLayout } from "@/contexts/layout-context";
import NotFound from "@/pages/404";

// Chart Components
import { TaskStatusChart } from "@/components/charts/project/task-status-chart";
import { TaskTypeChart } from "@/components/charts/project/task-type-chart";
import { TaskPriorityChart } from "@/components/charts/project/task-priority-chart";
import { SprintVelocityChart } from "@/components/charts/project/sprint-velocity-chart";
import { ProjectKPIMetrics } from "@/components/charts/project/project-kpi-metrics";
import { PageHeader } from "../common/PageHeader";
import {
  DashboardSettingsDropdown,
  useDashboardSettings,
} from "../common/DashboardSettingsDropdown";
import { PageHeaderSkeleton } from "../common/PageHeaderSkeleton";
import { useProject } from "@/contexts/project-context";
import ErrorState from "../common/ErrorState";
import Tooltip from "../common/ToolTip";
import { useAuth } from "@/contexts/auth-context";

interface ProjectAnalyticsProps {
  projectSlug: string;
}

interface AnalyticsData {
  taskStatus: any[];
  taskType: any[];
  kpiMetrics: any;
  taskPriority: any[];
  sprintVelocity: any[];
}

interface Widget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  dataKey: keyof AnalyticsData;
  visible: boolean;
  gridCols: string;
  priority: number;
}

export function ProjectAnalytics({ projectSlug }: ProjectAnalyticsProps) {
  const { setShow404, show404 } = useLayout();
  const { createWidgetsSection } = useDashboardSettings();
  const {
    analyticsData: data,
    analyticsLoading: loading,
    analyticsError: error,
    refreshingAnalytics: refreshing,
    fetchAnalyticsData,
    clearAnalyticsError,
  } = useProject();
  const { isAuthenticated } = useAuth();
  const isAuth = isAuthenticated();

  // Widget configuration
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "kpi-metrics",
      title: "KPI Metrics",
      component: ProjectKPIMetrics,
      dataKey: "kpiMetrics",
      visible: true,
      gridCols: "col-span-full",
      priority: 1,
    },
    {
      id: "task-status",
      title: "Task Status Flow",
      component: TaskStatusChart,
      dataKey: "taskStatus",
      visible: true,
      gridCols: "col-span-1 md:col-span-1",
      priority: 2,
    },
    {
      id: "task-type",
      title: "Task Type Distribution",
      component: TaskTypeChart,
      dataKey: "taskType",
      visible: true,
      gridCols: "col-span-1 md:col-span-1",
      priority: 3,
    },
    {
      id: "task-priority",
      title: "Task Priority Distribution",
      component: TaskPriorityChart,
      dataKey: "taskPriority",
      visible: true,
      gridCols: "col-span-1 md:col-span-1",
      priority: 4,
    },
    {
      id: "sprint-velocity",
      title: "Sprint Velocity Trend",
      component: SprintVelocityChart,
      dataKey: "sprintVelocity",
      visible: true,
      gridCols: "col-span-1 md:col-span-1",
      priority: 5,
    },
  ]);

  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
      )
    );
  };

  const resetWidgets = () => {
    setWidgets((prev) => prev.map((widget) => ({ ...widget, visible: true })));
  };
  const handleFetchData = () => {
    if (error) clearAnalyticsError();
    fetchAnalyticsData(projectSlug, isAuth);
  };
  useEffect(() => {
    if (projectSlug) {
      handleFetchData();
    }
  }, [projectSlug]);

  // Load widget preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`project-widgets`);
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        setWidgets((prev) =>
          prev.map((widget) => ({
            ...widget,
            visible: preferences[widget.id] ?? widget.visible,
          }))
        );
      } catch (error) {
        console.error("Failed to load widget preferences:", error);
      }
    } else {
      const preferences = widgets.reduce(
        (acc, widget) => {
          acc[widget.id] = widget.visible;
          return acc;
        },
        {} as Record<string, boolean>
      );

      localStorage.setItem(`project-widgets`, JSON.stringify(preferences));
    }
  }, [projectSlug]);

  // Check for 404 errors and show full-page 404 - MUST be before any returns
  useEffect(() => {
    if (error && !show404) {
      const is404Error = error.toLowerCase().includes('not found') ||
                         error.toLowerCase().includes('404') ||
                         error.toLowerCase().includes('project not found') ||
                         error.toLowerCase().includes('workspace not found');

      if (is404Error) {
        setShow404(true);
      }
    }
  }, [error, setShow404, show404]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    // Check if it's a 404/not found error
    const is404Error = error.toLowerCase().includes('not found') ||
                       error.toLowerCase().includes('404') ||
                       error.toLowerCase().includes('project not found') ||
                       error.toLowerCase().includes('workspace not found');

    if (is404Error) {
      return <NotFound />;
    }

    return <ErrorState error={error} onRetry={handleFetchData} />;
  }

  {
    !data && !loading && !error && (
      <Alert>
        <AlertDescription>No analytics data available for this organization.</AlertDescription>
        <Button onClick={handleFetchData} variant="outline" size="sm" className="mt-2">
          Load Data
        </Button>
      </Alert>
    );
  }

  const visibleWidgets = widgets
    .filter((widget) => widget.visible)
    .sort((a, b) => a.priority - b.priority);

  const visibleCount = widgets.filter((w) => w.visible).length;
  const settingSections = [
    createWidgetsSection(widgets, toggleWidget, resetWidgets, () => {
      setWidgets((prev) =>
        prev.map((widget) => ({
          ...widget,
          visible:
            widget.id === "kpi-metrics" ||
            widget.id === "task-status" ||
            widget.id === "task-priority" ||
            widget.id === "task-type" ||
            widget.id === "sprint-velocity",
        }))
      );
    }),
  ];
  return (
    <div className="space-y-6" data-testid="project-content">
      {/* Header */}
      <PageHeader
        title="Project Analytics"
        description="Insights into your project performance and team productivity"
        actions={
          <div className="flex items-center gap-2">
            <Tooltip content="Dashboard Settings" position="top" color="primary">
              <DashboardSettingsDropdown
                sections={settingSections}
                description="Customize your dashboard widgets"
              />
            </Tooltip>
          </div>
        }
      />

      {/* No Widgets Message */}
      {visibleCount === 0 && (
        <Card className="p-8 text-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No widgets to display</h3>
            <p className="text-muted-foreground">
              All widgets are currently hidden. Use the customize button to show widgets.
            </p>
            <Button onClick={resetWidgets} variant="outline" className="mt-4">
              Show All Widgets
            </Button>
          </div>
        </Card>
      )}

      {/* Widgets Grid */}
      {data && visibleCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleWidgets.map((widget) => {
            const Component = widget.component;
            const widgetData = data[widget.dataKey];

            return (
              <div key={widget.id} className={widget.gridCols}>
                <Component data={widgetData} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Loading Skeleton
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Skeleton */}
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card">
            <Card className="dashboard-stat-card-inner">
              <CardContent className="dashboard-stat-content space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="analytics-chart-container">
            <CardHeader>
              {/* Title skeleton */}
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              {/* Chart container skeleton */}
              <div className={`h-70 w-full flex items-center justify-center`}>
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
