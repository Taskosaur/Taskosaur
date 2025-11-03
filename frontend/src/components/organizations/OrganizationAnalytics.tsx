import React, { useEffect, useState } from "react";
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

  const resetWidgets = () => {
    setWidgets((prev) => prev.map((widget) => ({ ...widget, visible: true })));
  };

  const resetKPICards = () => {
    setKpiCards((prev) => prev.map((card) => ({ ...card, visible: card.isDefault })));
  };

  const showAllKPICards = () => {
    setKpiCards((prev) => prev.map((card) => ({ ...card, visible: true })));
  };

  // Save preferences to localStorage
  useEffect(() => {
    const widgetPreferences = widgets.reduce(
      (acc, widget) => {
        acc[widget.id] = widget.visible;
        return acc;
      },
      {} as Record<string, boolean>
    );

    const kpiPreferences = kpiCards.reduce(
      (acc, card) => {
        acc[card.id] = card.visible;
        return acc;
      },
      {} as Record<string, boolean>
    );

    localStorage.setItem(
      `organization-analytics-preferences-${organizationId}`,
      JSON.stringify({
        widgets: widgetPreferences,
        kpiCards: kpiPreferences,
      })
    );
  }, [widgets, kpiCards, organizationId]);

  // Load preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`organization-analytics-preferences-${organizationId}`);

    if (saved) {
      try {
        const preferences = JSON.parse(saved);

        setWidgets((prev) =>
          prev.map((widget) => ({
            ...widget,
            visible: preferences.widgets[widget.id] ?? widget.visible,
          }))
        );

        setKpiCards((prev) =>
          prev.map((card) => ({
            ...card,
            visible: preferences.kpiCards[card.id] ?? card.visible,
          }))
        );
      } catch (error) {
        console.error("Failed to load analytics preferences:", error);
      }
    }
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

  if (error) <ErrorState error="Error loading organization analytics:" onRetry={handleFetchData} />;

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleWidgets.map((widget) => {
            const Component = widget.component;
            const widgetData = data[widget.dataKey];

            // Handle case where API request failed and data is null
            if (widgetData === null) {
              return (
                <div key={widget.id} className={widget.gridCols}>
                  <Card className="p-4 h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p>Failed to load data for {widget.title}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFetchData}
                        className="mt-2"
                      >
                        Retry
                      </Button>
                    </div>
                  </Card>
                </div>
              );
            }

            return (
              <div key={widget.id} className={widget.gridCols}>
                {widget.id === "kpi-metrics" ? (
                  <Component data={widgetData} visibleCards={kpiCards} />
                ) : (
                  <Component data={widgetData} />
                )}
              </div>
            );
          })}
        </div>
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
