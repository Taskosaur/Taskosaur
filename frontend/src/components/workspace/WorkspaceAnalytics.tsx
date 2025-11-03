import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageHeader } from "../common/PageHeader";
import {
  DashboardSettingsDropdown,
  useDashboardSettings,
} from "../common/DashboardSettingsDropdown";
import { PageHeaderSkeleton } from "../common/PageHeaderSkeleton";
import { useWorkspace } from "@/contexts/workspace-context";
import ErrorState from "../common/ErrorState";

import { Widget, WorkspaceAnalyticsProps } from "@/types/analytics";

import { TokenManager } from "@/lib/api";
import { workspaceWidgets } from "@/utils/data/workspaceWidgets";
import Tooltip from "../common/ToolTip";

export function WorkspaceAnalytics({ workspaceSlug }: WorkspaceAnalyticsProps) {
  const {
    analyticsData,
    analyticsLoading,
    analyticsError,
    fetchAnalyticsData,
    clearAnalyticsError,
  } = useWorkspace();
  const { createWidgetsSection } = useDashboardSettings();
  const currentOrgId = TokenManager.getCurrentOrgId();
  const [widgets, setWidgets] = useState<Widget[]>(workspaceWidgets);

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
    if (analyticsError) clearAnalyticsError();
    fetchAnalyticsData(currentOrgId, workspaceSlug);
  };

  useEffect(() => {
    if (workspaceSlug) {
      handleFetchData();
    }
  }, [workspaceSlug]);

  useEffect(() => {
    const preferences = widgets.reduce(
      (acc, widget) => {
        acc[widget.id] = widget.visible;
        return acc;
      },
      {} as Record<string, boolean>
    );

    localStorage.setItem(`workspace-widgets-${workspaceSlug}`, JSON.stringify(preferences));
  }, [widgets, workspaceSlug]);

  useEffect(() => {
    const saved = localStorage.getItem(`workspace-widgets-${workspaceSlug}`);
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
    }
  }, [workspaceSlug]);

  if (analyticsLoading) {
    return <AnalyticsSkeleton />;
  }

  if (analyticsError) {
    return <ErrorState error="Error loading organization analytics:" onRetry={handleFetchData} />;
  }

  if (!analyticsData) {
    return (
      <Alert className="flex items-center justify-between">
        <AlertDescription>No analytics data available for this organization.</AlertDescription>
        <Button onClick={handleFetchData} variant="outline" size="sm" className="ml-4 shrink-0">
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
            widget.id === "project-status" ||
            widget.id === "task-priority" ||
            widget.id === "task-type" ||
            widget.id === "sprint-status",
        }))
      );
    }),
  ];

  return (
    <div className="space-y-6" data-testid="workspace-content">
      <PageHeader
        title="Workspace Analytics"
        description="Insights into your workspace performance and metrics"
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

      {analyticsData && visibleCount === 0 && (
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

      {analyticsData && visibleCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleWidgets.map((widget) => {
            const Component = widget.component;
            const widgetData = analyticsData[widget.dataKey];

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

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card">
            <div className="dashboard-stat-card-inner ">
              <div className="dashboard-stat-content space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="analytics-chart-container">
            <div>
              <Skeleton className="h-6 w-48" />
            </div>
            <div>
              <div className={`h-70 w-full flex items-center justify-center`}>
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
