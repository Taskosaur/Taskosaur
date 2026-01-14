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

// DnD Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Widget Component
function SortableWidget({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : "auto",
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      {children}
    </div>
  );
}

export function WorkspaceAnalytics({ workspaceSlug }: WorkspaceAnalyticsProps) {
  const {
    analyticsData,
    analyticsLoading,
    analyticsError,
    fetchAnalyticsData,
    clearAnalyticsError,
    currentWorkspace,
    getWorkspaceBySlug,
  } = useWorkspace();
  const { createWidgetsSection } = useDashboardSettings();
  const currentOrgId = TokenManager.getCurrentOrgId();
  const [widgets, setWidgets] = useState<Widget[]>(workspaceWidgets);

  useEffect(() => {
    if (workspaceSlug && (!currentWorkspace || currentWorkspace.slug !== workspaceSlug)) {
      getWorkspaceBySlug(workspaceSlug);
    }
  }, [workspaceSlug, currentWorkspace?.slug]);

  // DnD State
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        acc[widget.id] = { visible: widget.visible, priority: widget.priority };
        return acc;
      },
      {} as Record<string, { visible: boolean; priority: number }>
    );

    localStorage.setItem(`workspace-widgets-${workspaceSlug}`, JSON.stringify(preferences));
  }, [widgets, workspaceSlug]);

  useEffect(() => {
    const saved = localStorage.getItem(`workspace-widgets-${workspaceSlug}`);
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        setWidgets((prev) =>
          prev.map((widget) => {
            const savedWidget = preferences[widget.id];
            // Handle both legacy (boolean) and new (object) formats
            if (typeof savedWidget === "boolean") {
               return { ...widget, visible: savedWidget };
            } else if (savedWidget) {
               return {
                 ...widget,
                 visible: savedWidget.visible ?? widget.visible,
                 priority: savedWidget.priority ?? widget.priority,
               };
            }
            return widget;
          })
        );
      } catch (error) {
        console.error("Failed to load widget preferences:", error);
      }
    }
  }, [workspaceSlug]);

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setWidgets((prevWidgets) => {
        const visibleWidgets = prevWidgets
          .filter((w) => w.visible)
          .sort((a, b) => a.priority - b.priority);

        const oldIndex = visibleWidgets.findIndex((w) => w.id === active.id);
        const newIndex = visibleWidgets.findIndex((w) => w.id === over?.id);

        const reorderedVisibleWidgets = arrayMove(visibleWidgets, oldIndex, newIndex);

        // Map id to new priority
        const priorityMap = new Map<string, number>();
        reorderedVisibleWidgets.forEach((w, index) => {
          priorityMap.set(w.id, index);
        });

        // Hidden widgets keep their relative order after visible ones
        const hiddenWidgets = prevWidgets
          .filter((w) => !w.visible)
          .sort((a, b) => a.priority - b.priority);

        hiddenWidgets.forEach((w, index) => {
          priorityMap.set(w.id, reorderedVisibleWidgets.length + index);
        });

        return prevWidgets.map((w) => ({
          ...w,
          priority: priorityMap.get(w.id) ?? w.priority,
        }));
      });
    }

    setActiveId(null);
  };


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

  const activeWidget = activeId ? widgets.find((w) => w.id === activeId) : null;

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleWidgets.map((widget) => {
                const Component = widget.component;
                const widgetData = analyticsData[widget.dataKey];

                return (
                  <SortableWidget key={widget.id} id={widget.id} className={widget.gridCols}>
                    <Component
                      data={widgetData}
                      workspaceId={currentWorkspace?.slug === workspaceSlug ? currentWorkspace?.id : undefined}
                    />
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeWidget ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className={activeWidget.gridCols}>
                   <Card className="h-full opacity-80 shadow-xl cursor-grabbing">
                    {(() => {
                       const Component = activeWidget.component;
                       const widgetData = analyticsData[activeWidget.dataKey];
                       return (
                         <Component
                           data={widgetData}
                           workspaceId={currentWorkspace?.slug === workspaceSlug ? currentWorkspace?.id : undefined}
                         />
                       );
                    })()}
                  </Card>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
