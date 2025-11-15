import { useState, useEffect } from "react";
import { Building2, FolderOpen, Users, CheckCircle, Bug, Zap, Clock } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";

interface OrganizationKPIMetricsProps {
  data: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalMembers: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalBugs: number;
    resolvedBugs: number;
    activeSprints: number;
    projectCompletionRate: number;
    taskCompletionRate: number;
    bugResolutionRate: number;
    overallProductivity: number;
  };
  visibleCards?: Array<{
    id: string;
    label: string;
    visible: boolean;
    isDefault: boolean;
  }>;
}

interface KPICard {
  id: string;
  label: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  visible: boolean;
}

export function OrganizationKPIMetrics({ data, visibleCards = [] }: OrganizationKPIMetricsProps) {
  const [cards, setCards] = useState<KPICard[]>([
    {
      id: "workspaces",
      label: "Total Workspaces",
      value: data?.totalWorkspaces,
      description: `${data?.activeWorkspaces} active`,
      icon: <Building2 className="h-4 w-4" />,
      visible: true,
    },
    {
      id: "projects",
      label: "Total Projects",
      value: data?.totalProjects,
      description: `${data?.activeProjects} active`,
      icon: <FolderOpen className="h-4 w-4" />,
      visible: true,
    },
    {
      id: "members",
      label: "Team Members",
      value: data?.totalMembers,
      description: "Organization members",
      icon: <Users className="h-4 w-4" />,
      visible: true,
    },
    {
      id: "task-completion",
      label: "Task Completion",
      value: `${(data?.taskCompletionRate ?? 0).toFixed(1)}%`,
      description: `${data?.completedTasks ?? 0}/${data?.totalTasks ?? 0} tasks`,
      icon: <CheckCircle className="h-4 w-4" />,
      visible: true,
    },
    {
      id: "bug-resolution",
      label: "Bug Resolution",
      value: `${(data?.bugResolutionRate ?? 0).toFixed(1)}%`,
      description: `${data?.resolvedBugs ?? 0}/${data?.totalBugs ?? 0} resolved`,
      icon: <Bug className="h-4 w-4" />,
      visible: false,
    },
    {
      id: "overdue-tasks",
      label: "Overdue Tasks",
      value: data?.overdueTasks,
      description: "Require attention",
      icon:
        data?.overdueTasks === 0 ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        ),
      visible: false,
    },
    {
      id: "active-sprints",
      label: "Active Sprints",
      value: data?.activeSprints,
      description: "Currently running",
      icon: <Zap className="h-4 w-4" />,
      visible: false,
    },
    {
      id: "productivity",
      label: "Overall Productivity",
      value: `${data?.overallProductivity?.toFixed(1) || 0}%`,
      description: "Task completion rate",
      icon: <CheckCircle className="h-4 w-4" />,
      visible: false,
    },
  ]);

  // Update visibility based on parent component's state
  useEffect(() => {
    if (visibleCards.length > 0) {
      setCards((prev) =>
        prev.map((card) => {
          const visibleCard = visibleCards.find((vc) => vc.id === card.id);
          return visibleCard ? { ...card, visible: visibleCard.visible } : card;
        })
      );
    }
  }, [visibleCards]);

  // Update card values when data changes
  useEffect(() => {
    setCards((prev) =>
      prev.map((card) => {
        switch (card.id) {
          case "workspaces":
            return {
              ...card,
              value: data?.totalWorkspaces,
              description: `${data?.activeWorkspaces} active`,
            };
          case "projects":
            return {
              ...card,
              value: data?.totalProjects,
              description: `${data?.activeProjects} active`,
            };
          case "members":
            return {
              ...card,
              value: data?.totalMembers,
            };
          case "task-completion":
            return {
              ...card,
              value: `${data?.taskCompletionRate?.toFixed(1) || 0}%`,
              description: `${data?.completedTasks}/${data?.totalTasks} tasks`,
            };
          case "bug-resolution":
            return {
              ...card,
              value: `${data?.bugResolutionRate?.toFixed(1) || 0}%`,
              description: `${data?.resolvedBugs}/${data?.totalBugs} resolved`,
            };
          case "overdue-tasks":
            return {
              ...card,
              value: data?.overdueTasks,
              icon:
                data?.overdueTasks === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                ),
            };
          case "active-sprints":
            return {
              ...card,
              value: data?.activeSprints,
            };
          case "productivity":
            return {
              ...card,
              value: `${data?.overallProductivity?.toFixed(1) || 0}%`,
            };
          default:
            return card;
        }
      })
    );
  }, [data]);

  const visibleCardsFiltered = cards.filter((card) => card.visible);
  const visibleCount = visibleCardsFiltered.length;

  return (
    <div className="space-y-4">
      {/* KPI Cards Grid - No header or controls needed */}
      <div
        className={`grid gap-4 ${
          visibleCount <= 4
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
            : visibleCount <= 6
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
        }`}
      >
        {visibleCardsFiltered.map((card) => (
          <StatCard key={card.id} label={card.label} value={card.value} icon={card.icon} />
        ))}
      </div>
    </div>
  );
}
