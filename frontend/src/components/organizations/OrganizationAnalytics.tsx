import React, { useEffect, useState, useRef } from "react";
import {
  organizationAnalyticsWidgets,
  Widget,
  organizationKPICards,
  KPICard,
} from "@/utils/data/organizationAnalyticsData";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

// Chart Components
import { PageHeader } from "../common/PageHeader";
import {
  DashboardSettingsDropdown,
  useDashboardSettings,
} from "../common/DashboardSettingsDropdown";
import { useOrganization } from "@/contexts/organization-context";
import { PageHeaderSkeleton } from "../common/PageHeaderSkeleton";
import { useTask } from "@/contexts/task-context";
import { toast } from "sonner";
import { TasksResponse } from "@/types";
import { Calendar } from "lucide-react";
import Tooltip from "../common/ToolTip";
import ActionButton from "../common/ActionButton";
import { TodayAgendaDialog } from "./TodayAgendaDialog";
import ErrorState from "../common/ErrorState";
import { HiHome } from "react-icons/hi";

interface OrganizationAnalyticsProps {
  organizationId: string;
}

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

export function OrganizationAnalytics({ organizationId }: OrganizationAnalyticsProps) {
  const {
    analyticsData: data,
    analyticsLoading: loading,
    analyticsError: error,
    fetchAnalyticsData,
    clearAnalyticsError,
  } = useOrganization();
  const { createKPISection, createWidgetsSection } = useDashboardSettings();
  const { getTodayAgenda } = useTask();
  const [todayTask, setTodayTask] = useState<TasksResponse | null>(null);
  const [showTodayAgenda, setShowTodayAgenda] = useState(false);

  // Widget configuration
  const [widgets, setWidgets] = useState<Widget[]>(organizationAnalyticsWidgets);

  const [kpiCards, setKpiCards] = useState<KPICard[]>(organizationKPICards);

  // Track which organization's data is currently loaded to prevent race conditions during saving
  // Using useState instead of useRef to ensure render cycles are synchronized
  const [loadedOrg, setLoadedOrg] = useState<string | null>(null);

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

  const handleFetchData = () => {
    if (error) clearAnalyticsError();
    fetchAnalyticsData(organizationId);
  };
  const handleTodayTaskFetch = async () => {
    try {
      const result = await getTodayAgenda(organizationId);
      setTodayTask(result);
      setShowTodayAgenda(true);
    } catch (error) {
      console.error(error);
      toast.error("Faild to fetch today task data");
    }
  };

  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
      )
    );
  };

  const toggleKPICard = (cardId: string) => {
    setKpiCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, visible: !card.visible } : card))
    );
  };

  const handleKPIOrderChange = (newOrder: string[]) => {
    setKpiCards((prev) => {
      const cardMap = new Map(prev.map((c) => [c.id, c]));
      const newKpiCards: KPICard[] = [];
      const usedIds = new Set(newOrder);

      // Add ordered visible cards
      newOrder.forEach((id) => {
        const card = cardMap.get(id);
        if (card) newKpiCards.push(card);
      });

      // Add remaining (hidden) cards
      prev.forEach((card) => {
        if (!usedIds.has(card.id)) {
          newKpiCards.push(card);
        }
      });

      return newKpiCards;
    });
  };

  const resetWidgets = () => {
    setWidgets((prev) => prev.map((widget) => ({ ...widget, visible: true })));
  };

  const resetKPICards = () => {
    setKpiCards((prev) => prev.map((card) => ({ ...card, visible: card.isDefault })));
  };

  const showAllKPICards = () => {
    setKpiCards((prev) => prev.map((card) => ({ ...card, visible: true })));
  };

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

  // Save preferences to localStorage
  useEffect(() => {
    // Only save if we are sure the current state belongs to the current organization
    if (!organizationId || loadedOrg !== organizationId) return;

    const widgetPreferences = widgets.reduce(
      (acc, widget) => {
        acc[widget.id] = { visible: widget.visible, priority: widget.priority };
        return acc;
      },
      {} as Record<string, { visible: boolean; priority: number }>
    );

    // Save full KPI objects to persist order and visibility
    const kpiPreferences = kpiCards.map((card) => ({
      id: card.id,
      visible: card.visible,
    }));

    localStorage.setItem(
      `organization-analytics-preferences-${organizationId}`,
      JSON.stringify({
        widgets: widgetPreferences,
        kpiCards: kpiPreferences,
      })
    );
  }, [widgets, kpiCards, organizationId, loadedOrg]);

  // Load preferences from localStorage
  useEffect(() => {
    if (!organizationId) return;

    const saved = localStorage.getItem(`organization-analytics-preferences-${organizationId}`);

    if (saved) {
      try {
        const preferences = JSON.parse(saved);

        if (preferences.widgets) {
          setWidgets((prev) =>
            prev.map((widget) => {
              const savedWidget = preferences.widgets[widget.id];
              if (typeof savedWidget === "boolean") {
                // Backward compatibility
                return { ...widget, visible: savedWidget };
              } else if (typeof savedWidget === "object") {
                return {
                  ...widget,
                  visible: savedWidget.visible ?? widget.visible,
                  priority: savedWidget.priority ?? widget.priority,
                };
              }
              return widget;
            })
          );
        }

        if (preferences.kpiCards) {
          if (Array.isArray(preferences.kpiCards)) {
            // New format: Array of objects with order
            const savedCards = preferences.kpiCards as { id: string; visible: boolean }[];
            const processedIds = new Set<string>();
            const newCards: KPICard[] = [];

            // Add saved cards in order
            savedCards.forEach((pref) => {
              const defaultCard = organizationKPICards.find((c) => c.id === pref.id);
              if (defaultCard) {
                newCards.push({ ...defaultCard, visible: pref.visible });
                processedIds.add(pref.id);
              }
            });

            // Add any missing default cards (in case of new features)
            organizationKPICards.forEach((card) => {
              if (!processedIds.has(card.id)) {
                newCards.push(card);
              }
            });

            setKpiCards(newCards);
          } else {
            // Old format: Object map (backward compatibility)
            const kpiPrefs = preferences.kpiCards as Record<string, boolean>;
            setKpiCards((prev) =>
              prev.map((card) => ({
                ...card,
                visible: kpiPrefs[card.id] ?? card.visible,
              }))
            );
          }
        }
      } catch (error) {
        console.error("Failed to load analytics preferences:", error);
        // Fallback to defaults on error
        setWidgets(organizationAnalyticsWidgets);
        setKpiCards(organizationKPICards);
      }
    } else {
      setWidgets(organizationAnalyticsWidgets);
      setKpiCards(organizationKPICards);
    }

    // Mark this organization as loaded
    setLoadedOrg(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      handleFetchData();
    }
  }, [organizationId]);

  if (loading) {
    return <OrganizationAnalyticsSkeleton />;
  }

  const visibleWidgets = widgets
    .filter((widget) => widget.visible)
    .sort((a, b) => a.priority - b.priority);

  const visibleCount = widgets.filter((w) => w.visible).length;

  // Log rendering state for debugging
  if (data && visibleCount > 0) {
    console.log(
      `[Dashboard] Rendering with KPI card order:`,
      kpiCards.map((c) => `${c.id} (${c.visible ? "v" : "h"})`)
    );
  }

  const settingSections = [
    createKPISection(kpiCards, toggleKPICard, showAllKPICards, resetKPICards),
    createWidgetsSection(widgets, toggleWidget, resetWidgets, () => {
      setWidgets((prev) =>
        prev.map((widget) => ({
          ...widget,
          visible:
            widget.id === "kpi-metrics" ||
            widget.id === "project-portfolio" ||
            widget.id === "team-utilization" ||
            widget.id === "task-distribution" ||
            widget.id === "member-workload",
        }))
      );
    }),
  ];
  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper to render widget content
  const renderWidgetContent = (widget: Widget) => {
    if (!data) return null;

    const Component = widget.component;
    const widgetData = data[widget.dataKey];

    // Handle case where API request failed and data is null
    if (widgetData === null) {
      return (
        <Card className="p-4 h-full flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>Failed to load data for {widget.title}</p>
            <Button variant="outline" size="sm" onClick={handleFetchData} className="mt-2">
              Retry
            </Button>
          </div>
        </Card>
      );
    }

    return widget.id === "kpi-metrics" ? (
      <Component data={widgetData} visibleCards={kpiCards} onOrderChange={handleKPIOrderChange} />
    ) : (
      <Component data={widgetData} />
    );
  };

  const activeWidget = activeId ? widgets.find((w) => w.id === activeId) : null;

  if (error) {
    return (
      <ErrorState error="Error loading organization analytics:" onRetry={handleFetchData} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <TodayAgendaDialog
        isOpen={showTodayAgenda}
        onClose={() => setShowTodayAgenda(false)}
        currentDate={getCurrentDate()}
        upcomingTasks={todayTask?.tasks || []}
      />
      <PageHeader
        title="Dashboard"
        description="Comprehensive insights into your organization's performance and health"
        icon={<HiHome className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Tooltip content="Today Agenda" position="top" color="primary">
              <ActionButton
                variant="outline"
                onClick={() => handleTodayTaskFetch()}
                secondary
                className="px-3 py-2 text-xs cursor-pointer"
              >
                <Calendar className="h-4 w-4" />
              </ActionButton>
            </Tooltip>
            <Tooltip content="Dashboard Settings" position="left" color="primary">
              <DashboardSettingsDropdown sections={settingSections} />
            </Tooltip>
          </div>
        }
      />

      {/* No Data Message */}
      {!data && !loading && !error && (
        <Alert>
          <AlertDescription>No analytics data available for this organization.</AlertDescription>
          <Button onClick={handleFetchData} variant="outline" size="sm" className="mt-2">
            Load Data
          </Button>
        </Alert>
      )}

      {/* No Widgets Message */}
      {data && visibleCount === 0 && (
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
              {visibleWidgets.map((widget) => (
                <SortableWidget key={widget.id} id={widget.id} className={widget.gridCols}>
                  {renderWidgetContent(widget)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeWidget ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className={activeWidget.gridCols}>
                  <Card className="h-full opacity-80 shadow-xl cursor-grabbing">
                    {renderWidgetContent(activeWidget)}
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

// Loading Skeleton remains the same
function OrganizationAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Skeleton */}
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
              <div className={`h-64 w-full flex items-center justify-center`}>
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
